from fastapi import APIRouter, HTTPException, Body
from app.services.schema_analysis import SchemaAnalysisService
from app.services.ai_service import AIService, safe_sql_check
from pydantic import BaseModel
from typing import Optional, List
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class AnalysisRequest(BaseModel):
    connection_string: str

class AskRequest(BaseModel):
    connection_string: str
    question: str
    language: Optional[str] = "english"
    conversation_history: Optional[List[dict]] = None
    business_rules: Optional[str] = ""

class QueryRequest(BaseModel):
    connection_string: str
    question: str
    language: Optional[str] = "english"
    conversation_history: Optional[List[dict]] = None
    business_rules: Optional[str] = ""

class ExplainRequest(BaseModel):
    sql: str

class TableDataRequest(BaseModel):
    connection_string: str
    table_name: str


def _is_mongodb(conn: str) -> bool:
    return conn.startswith("mongodb://") or conn.startswith("mongodb+srv://")

@router.post("/dashboard")
async def get_dashboard_summary(request: AnalysisRequest):
    try:
        if _is_mongodb(request.connection_string):
            from app.services.mongodb_service import MongoDBService
            return MongoDBService(request.connection_string).get_dashboard_stats()
        service = SchemaAnalysisService(request.connection_string)
        return await service.get_dashboard_stats(request.connection_string)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/graph")
def get_schema_graph(request: AnalysisRequest):
    try:
        if _is_mongodb(request.connection_string):
            from app.services.mongodb_service import MongoDBService
            return MongoDBService(request.connection_string).get_schema_graph_data()
        service = SchemaAnalysisService(request.connection_string)
        return service.get_schema_graph_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ask")
async def ask_ai(request: AskRequest):
    try:
        service = SchemaAnalysisService(request.connection_string)
        graph_data = service.get_schema_graph_data()
        schema_lines = []
        for node in graph_data.get("nodes", []):
            table_name = node["data"]["label"]
            columns = node["data"].get("columns", [])
            col_strs = [f"  - {c['name']} ({c['type']}{'  PK' if c['is_pk'] else ''})" for c in columns]
            schema_lines.append(f"Table: {table_name}")
            schema_lines.extend(col_strs)
        schema_context = "\n".join(schema_lines) if schema_lines else "No schema data available."

        ai_service = AIService()
        answer = await ai_service.answer_database_question(
            question=request.question,
            schema_context=schema_context,
            conversation_history=request.conversation_history,
            language=request.language or "english",
            business_rules=request.business_rules or ""
        )

        # Parse for [EXECUTE: SQL] action
        suggested_action = None
        import re
        match = re.search(r'\[EXECUTE:\s*(.*?)\]', answer, re.DOTALL)
        if match:
            suggested_action = match.group(1).strip()
            answer = re.sub(r'\[EXECUTE:.*?\]', '', answer).strip()

        return {
            "answer": answer,
            "suggested_action": suggested_action
        }

    except Exception as e:
        logger.error(f"Ask AI failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query")
async def run_query(request: QueryRequest):
    """Self-healing NLP-to-SQL endpoint. Generates, validates, fixes and executes SQL."""
    try:
        service = SchemaAnalysisService(request.connection_string)
        graph_data = service.get_schema_graph_data()
        schema_lines = []
        for node in graph_data.get("nodes", []):
            table_name = node["data"]["label"]
            columns = node["data"].get("columns", [])
            col_strs = [f"  - {c['name']} ({c['type']}{'  PK' if c['is_pk'] else ''})" for c in columns]
            schema_lines.append(f"Table: {table_name}")
            schema_lines.extend(col_strs)
        schema_context = "\n".join(schema_lines) if schema_lines else ""

        ai_service = AIService()
        result = await ai_service.generate_and_heal_sql(
            question=request.question,
            schema_context=schema_context,
            connection_string=request.connection_string,
            conversation_history=request.conversation_history,
            language=request.language or "english",
            business_rules=request.business_rules or ""
        )
        return result
    except Exception as e:
        logger.error(f"Query execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain")
async def explain_sql(request: ExplainRequest):
    """Translates a SQL query into plain English."""
    try:
        check = safe_sql_check(request.sql)
        ai_service = AIService()
        explanation = await ai_service.explain_sql(request.sql)
        return {"explanation": explanation, "is_safe": check["is_safe"], "safety_reason": check["reason"]}
    except Exception as e:
        logger.error(f"Explain SQL failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/table-data")
def get_table_data(request: TableDataRequest):
    try:
        service = SchemaAnalysisService(request.connection_string)
        return service.get_table_data(request.table_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DriftScanRequest(BaseModel):
    connection_string: str


class QueryCostRequest(BaseModel):
    connection_string: str
    sql: str


@router.post("/drift-scan")
def run_drift_scan(request: DriftScanRequest):
    """Run semantic drift detection across all tables."""
    try:
        from app.services.drift_detector import DriftDetector
        detector = DriftDetector(request.connection_string)
        return detector.scan_distributions()
    except Exception as e:
        logger.error(f"Drift scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query-cost")
def estimate_query_cost(request: QueryCostRequest):
    """Estimate query cost (rows scanned, I/O, estimated dollar cost, CO2)."""
    try:
        from sqlalchemy import create_engine, text as sa_text
        from sqlalchemy.pool import NullPool
        engine = create_engine(request.connection_string, poolclass=NullPool)
        with engine.connect() as conn:
            # Use EXPLAIN to get query plan
            plan_result = conn.execute(sa_text(f"EXPLAIN (FORMAT JSON) {request.sql}"))
            plan_json = plan_result.fetchone()[0]

            # Extract key metrics from plan
            if isinstance(plan_json, list) and len(plan_json) > 0:
                plan = plan_json[0].get("Plan", {})
            elif isinstance(plan_json, str):
                import json
                parsed = json.loads(plan_json)
                plan = parsed[0].get("Plan", {}) if isinstance(parsed, list) else parsed.get("Plan", {})
            else:
                plan = {}

            total_cost = plan.get("Total Cost", 0)
            startup_cost = plan.get("Startup Cost", 0)
            plan_rows = plan.get("Plan Rows", 0)
            plan_width = plan.get("Plan Width", 0)

            # Estimated I/O (simplified: cost / 10 = page reads)
            estimated_pages = max(1, int(total_cost / 10))
            estimated_bytes = estimated_pages * 8192  # 8KB per page

            # Cloud cost estimation (approximate: $0.023/GB for S3, $0.10/GB for compute)
            gb_scanned = estimated_bytes / (1024 ** 3)
            estimated_dollar_cost = round(gb_scanned * 0.10, 6)

            # CO2 estimate (0.0003 kgCO2/kWh * 0.001 kWh per GB scanned)
            co2_grams = round(gb_scanned * 0.3, 4)

            return {
                "query": request.sql,
                "plan_summary": {
                    "total_cost": round(total_cost, 2),
                    "startup_cost": round(startup_cost, 2),
                    "estimated_rows": plan_rows,
                    "row_width_bytes": plan_width,
                    "node_type": plan.get("Node Type", "Unknown"),
                },
                "cost_estimate": {
                    "estimated_pages_read": estimated_pages,
                    "estimated_bytes_scanned": estimated_bytes,
                    "estimated_dollar_cost": estimated_dollar_cost,
                    "dollar_cost_display": f"${estimated_dollar_cost:.6f}",
                    "co2_grams": co2_grams,
                    "co2_display": f"{co2_grams:.4f}g CO₂",
                },
                "rating": "cheap" if total_cost < 100 else "moderate" if total_cost < 1000 else "expensive"
            }
    except Exception as e:
        logger.error(f"Query cost estimation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

