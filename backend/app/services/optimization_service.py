from sqlalchemy import create_engine, text, inspect
from sqlalchemy.pool import NullPool
from app.models.optimization import OptimizationRecommendation
from app.services.ai_service import AIService
from typing import List
import logging
import asyncio

logger = logging.getLogger(__name__)

class OptimizationService:
    def __init__(self, connection_string: str):
        from app.core.config import settings
        if connection_string == "SHADOW_DB":
             self.engine = create_engine(settings.SHADOW_DB_URL, poolclass=NullPool)
        else:
             self.engine = create_engine(connection_string, poolclass=NullPool)
        self.ai_service = AIService()

    @staticmethod
    def calculate_score(recommendations: List[OptimizationRecommendation]) -> int:
        """
        Calculates a score from 0 to 100 based on recommendations.
        - High impact: -15 points
        - Medium impact: -8 points
        - Low impact: -3 points
        """
        score = 100
        for rec in recommendations:
            impact = rec.impact or "Low"
            if impact == "High": score -= 15
            elif impact == "Medium": score -= 8
            else: score -= 3
        return max(0, min(100, score))

    async def generate_recommendations(self, with_ai: bool = False) -> List[OptimizationRecommendation]:
        """
        Scans the schema for optimization opportunities.
        
        with_ai=False (default): fast path — returns recommendations instantly with no LLM calls.
        with_ai=True: enriches all recommendations with AI explanations in parallel.
        """
        recommendations = []
        inspector = inspect(self.engine)

        try:
            with self.engine.connect() as conn:
                tables = inspector.get_table_names(schema='public')

                for table_name in tables:
                    columns = inspector.get_columns(table_name, schema='public')

                    # Heuristic 1: Oversized string columns
                    string_cols = [c for c in columns if str(c['type']).startswith(('VARCHAR', 'TEXT', 'CHAR'))]

                    if string_cols:
                        select_clauses = []
                        for col in string_cols:
                            cname = col['name']
                            select_clauses.append(f"max(length(quote_ident('{cname}'))) as max_len_{cname}")

                        if select_clauses:
                            query_str = f"SELECT {', '.join(select_clauses)} FROM public.{table_name} LIMIT 1000"
                            try:
                                result = conn.execute(text(query_str)).fetchone()
                                if result:
                                    for col in string_cols:
                                        cname = col['name']
                                        key_max_len = f"max_len_{cname}".lower()
                                        try:
                                            max_len = getattr(result, key_max_len)
                                            if max_len is None: max_len = 0
                                        except AttributeError:
                                            max_len = 0

                                        current_type = str(col['type'])
                                        suggested_len = 100
                                        if max_len < 50: suggested_len = 50
                                        if max_len < 100: suggested_len = 100
                                        else: suggested_len = 255

                                        should_recommend = False
                                        if 'TEXT' in current_type:
                                            should_recommend = True
                                        elif 'VARCHAR' in current_type and '(' in current_type:
                                            try:
                                                curr_len = int(current_type.split('(')[1].split(')')[0])
                                                if curr_len > 500 and max_len < 100:
                                                    should_recommend = True
                                            except: pass

                                        if should_recommend:
                                            description = f"Column '{cname}' is {current_type} but max length is {max_len}. Resize to VARCHAR({suggested_len})."
                                            recommendations.append(OptimizationRecommendation(
                                                table=table_name,
                                                column=cname,
                                                type="resize",
                                                description=description,
                                                explanation=None,  # filled below if with_ai=True
                                                impact="Medium",
                                                sql_command=f"ALTER TABLE {table_name} ALTER COLUMN {cname} TYPE VARCHAR({suggested_len});"
                                            ))

                            except Exception as e:
                                logger.warning(f"Failed to analyze table {table_name}: {e}")
                                continue

            # ── AI enrichment: run all calls in parallel if requested ──────────
            if with_ai and recommendations:
                async def enrich(rec: OptimizationRecommendation) -> str:
                    return await self.ai_service.generate_explanation(
                        finding=rec.description,
                        context=f"Table: {rec.table}, Column: {rec.column}, Type will be resized."
                    )

                explanations = await asyncio.gather(*[enrich(r) for r in recommendations], return_exceptions=True)
                for rec, exp in zip(recommendations, explanations):
                    if isinstance(exp, str):
                        rec.explanation = exp
                    else:
                        rec.explanation = "AI explanation unavailable."

            return recommendations

        except Exception as e:
            logger.error(f"Optimization scan failed: {e}")
            raise e
