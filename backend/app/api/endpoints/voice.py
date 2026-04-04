"""
Voice SQL endpoint — takes a natural language question and executes against the DB.
Works fully offline: uses keyword-matching when Ollama is unavailable.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class VoiceQueryRequest(BaseModel):
    connection_string: str
    question: str


KEYWORD_PATTERNS = [
    # Count queries
    (r'\bhow many\b', 'COUNT'),
    (r'\btotal\b.*\b(customers?|records?|rows?|entries?|tracks?|albums?|artists?|invoices?|employees?)\b', 'COUNT'),
    # Specific table keywords
    (r'\bcustomers?\b', 'Customer'),
    (r'\btracks?\b', 'Track'),
    (r'\balbums?\b', 'Album'),
    (r'\bartists?\b', 'Artist'),
    (r'\binvoices?\b', 'Invoice'),
    (r'\binvoice.?items?\b', 'InvoiceLine'),
    (r'\bemployees?\b', 'Employee'),
    (r'\bplaylists?\b', 'Playlist'),
    (r'\bgenres?\b', 'Genre'),
    (r'\bmedia.?types?\b', 'MediaType'),
]

COUNTRY_NAMES = [
    'germany', 'usa', 'united states', 'canada', 'france', 'brazil',
    'uk', 'united kingdom', 'india', 'australia', 'norway', 'sweden',
    'finland', 'denmark', 'portugal', 'spain', 'italy', 'austria',
    'belgium', 'netherlands', 'poland', 'czech', 'hungary', 'argentina',
    'chile', 'ireland',
]


def build_keyword_sql(question: str, schema_context: str) -> str:
    """Build a SQL query from the question using keyword matching."""
    q = question.lower()

    # Extract available tables from schema
    tables_in_schema = re.findall(r'Table:\s*(\w+)', schema_context)

    # Find best matching table
    best_table = tables_in_schema[0] if tables_in_schema else 'Customer'
    for patt, table_name in KEYWORD_PATTERNS:
        if re.search(patt, q) and table_name != 'COUNT':
            if table_name in tables_in_schema:
                best_table = table_name
                break

    # Detect COUNT intent
    is_count = bool(re.search(r'\bhow many\b|\bcount\b|\btotal number\b', q))

    # Build WHERE clause
    where_clauses = []

    # Country filter
    for country in COUNTRY_NAMES:
        if country in q:
            proper = country.title().replace('Usa', 'USA').replace('Uk', 'UK')
            where_clauses.append(f'"Country" ILIKE \'{proper}\'')
            break

    # City filter
    city_match = re.search(r'\bfrom\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b', question)
    if city_match and not any(c in q for c in COUNTRY_NAMES):
        where_clauses.append(f'"City" ILIKE \'{city_match.group(1)}\'')

    # Build SQL
    select_part = f'COUNT(*)' if is_count else '*'
    sql = f'SELECT {select_part} FROM "{best_table}"'
    if where_clauses:
        sql += ' WHERE ' + ' AND '.join(where_clauses)
    if not is_count:
        limit = 50 if re.search(r'\ball\b|\bevery\b', q) else 10
        sql += f' LIMIT {limit}'
    sql += ';'
    return sql


@router.post("/query")
async def voice_query(req: VoiceQueryRequest):
    """
    NLP → SQL → Execute pipeline for the Voice Orb.
    Falls back to keyword SQL if the AI engine is offline.
    """
    from sqlalchemy import create_engine, text as sa_text
    from sqlalchemy.pool import NullPool
    from app.services.schema_analysis import SchemaAnalysisService

    # Build schema context for AI + keyword fallback
    try:
        svc = SchemaAnalysisService(req.connection_string)
        graph = svc.get_schema_graph_data()
        schema_lines = []
        for node in graph.get('nodes', []):
            t = node['data']['label']
            cols = node['data'].get('columns', [])
            schema_lines.append(f'Table: {t}')
            schema_lines += [f"  - {c['name']} ({c['type']})" for c in cols]
        schema_context = '\n'.join(schema_lines) or 'No schema available.'
    except Exception as e:
        schema_context = ''
        logger.warning(f'Schema fetch failed: {e}')

    sql = None
    explanation = None
    used_fallback = False

    # Try AI first (Ollama)
    try:
        from app.services.ai_service import AIService
        ai = AIService()
        result = await ai.generate_and_heal_sql(
            question=req.question,
            schema_context=schema_context,
            connection_string=req.connection_string,
            conversation_history=[],
        )
        if result.get('error') is None and result.get('sql'):
            return result  # AI worked fully — return directly
        sql = result.get('sql')
        explanation = result.get('explanation')
    except Exception as e:
        logger.warning(f'AI engine offline: {e}')

    # If AI failed or Ollama is offline → keyword fallback
    if not sql:
        sql = build_keyword_sql(req.question, schema_context)
        used_fallback = True
        explanation = f'AI is offline — executed keyword-based query for: "{req.question}"'

    # Execute the SQL directly
    try:
        engine = create_engine(req.connection_string, poolclass=NullPool)
        with engine.connect() as conn:
            res = conn.execute(sa_text(sql))
            columns = list(res.keys())
            rows = [list(row) for row in res.fetchall()]

        chart_type = None
        if len(columns) == 2 and len(rows) <= 20:
            chart_type = 'bar'

        return {
            'sql': sql,
            'rows': rows,
            'columns': columns,
            'error': None,
            'chart_type': chart_type,
            'explanation': explanation,
            'offline_mode': used_fallback,
        }
    except Exception as db_err:
        raise HTTPException(status_code=500, detail=str(db_err))
