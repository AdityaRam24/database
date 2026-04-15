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
    sql_override: Optional[str] = None   # pre-built SQL (e.g. from council mode) — skips AI generation
    conversation_history: Optional[List[dict]] = None


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


# Synonym mapping for more natural language support
TABLE_SYNONYMS = {
    'Customer': ['customers', 'users', 'clients', 'people', 'contacts'],
    'Invoice': ['sales', 'orders', 'purchases', 'transactions', 'billing'],
    'Track': ['songs', 'music', 'tracks', 'audio'],
    'Album': ['albums', 'records', 'collections'],
    'Artist': ['artists', 'singers', 'bands', 'musicians'],
    'Employee': ['employees', 'staff', 'team members', 'workers'],
    'InvoiceLine': ['items', 'order details', 'purchase lines'],
}

def build_keyword_sql(question: str, schema_context: str) -> str:
    """Build a sophisticated SQL query from keywords when AI is offline."""
    q = question.lower()
    
    # Extract available tables and columns from schema
    schema_map = {}
    current_table = None
    all_tables = re.findall(r'Table:\s*(\w+)', schema_context)
    
    # Parse schema_context into a structured map for intelligent column picking
    for line in schema_context.split('\n'):
        t_match = re.search(r'Table:\s*(\w+)', line)
        if t_match:
            current_table = t_match.group(1)
            schema_map[current_table] = []
        elif current_table and line.strip().startswith('-'):
            c_match = re.search(r'-\s*(\w+)', line)
            if c_match:
                schema_map[current_table].append(c_match.group(1))

    # 1. Identify Target Table using Synonyms and Column Evidence
    available_tables = all_tables or ['Customer']
    
    # Heuristic: If we see a country/city/date, look for tables that have those columns
    preferred_tables = []
    has_country_word = any(c in q for c in COUNTRY_NAMES) or 'country' in q
    if has_country_word:
        preferred_tables = [t for t, cols in schema_map.items() if any('country' in c.lower() for c in cols)]

    target_table = preferred_tables[0] if preferred_tables else available_tables[0]
    found_table = False

    # Try mapping by synonyms
    for table_name, synonyms in TABLE_SYNONYMS.items():
        if any(s in q for s in synonyms + [table_name.lower()]):
            if table_name in available_tables:
                target_table = table_name
                found_table = True
                break
    
    # Try mapping by direct name match
    if not found_table:
        for t in available_tables:
            if t.lower() in q:
                target_table = t
                found_table = True
                break

    # 2. Identify Intent (SELECT vs COUNT)
    is_count = bool(re.search(r'\bhow many\b|\bcount\b|\btotal\s+(?:number|count|of)\b', q))
    if not is_count and q.strip().startswith('total '):
        is_count = True
    
    # 3. Intelligent Column Picking (if not count)
    select_cols = "*"
    available_cols = schema_map.get(target_table, [])
    if not is_count:
        target_cols = []
        # Common column keywords
        col_patterns = {
            'Name': ['names', 'called', 'named'],
            'Email': ['emails', 'email address'],
            'Phone': ['phones', 'phone numbers', 'contact'],
            'City': ['cities', 'city'],
            'Country': ['countries', 'country'],
            'Total': ['amount', 'price', 'total', 'cost'],
            'Title': ['titles', 'subject'],
        }
        for col_name, keywords in col_patterns.items():
            if any(k in q for k in keywords):
                # Find best matching actual column in this table
                for actual in available_cols:
                    if col_name.lower() in actual.lower():
                        target_cols.append(f'"{actual}"')
        if target_cols:
            select_cols = ", ".join(list(set(target_cols)))

    # 4. Filters (WHERE)
    where_parts = []
    
    # Country filters (ONLY if table has a Country column)
    target_country_col = next((c for c in available_cols if 'country' in c.lower()), None)
    if target_country_col:
        for country in COUNTRY_NAMES:
            if country in q:
                proper = country.title().replace('Usa', 'USA').replace('Uk', 'UK')
                where_parts.append(f'"{target_country_col}" ILIKE \'{proper}\'')
                break
            
    # Simple numerical filters (e.g. "id > 10")
    num_match = re.search(r'(\w+)\s*(>|<|=)\s*(\d+)', question)
    if num_match:
        col, op, val = num_match.groups()
        # Verify column exists
        for actual in available_cols:
            if col.lower() in actual.lower():
                where_parts.append(f'"{actual}" {op} {val}')
                break

    # 5. Sorting (ORDER BY)
    order_by = ""
    if re.search(r'\blatest\b|\brecent\b|\bnewest\b', q):
        # Look for date columns
        for actual in schema_map.get(target_table, []):
            if any(k in actual.lower() for k in ['date', 'created', 'at', 'time']):
                order_by = f' ORDER BY "{actual}" DESC'
                break
    elif re.search(r'\bhighest\b|\bmost\b|\btop\b', q):
        # Look for numeric columns (Total, UnitPrice, etc)
        for actual in schema_map.get(target_table, []):
            if any(k in actual.lower() for k in ['total', 'price', 'amount', 'count']):
                order_by = f' ORDER BY "{actual}" DESC'
                break

    # 6. Final Assembly
    sql = f'SELECT {f"COUNT(*)" if is_count else select_cols} FROM "{target_table}"'
    if where_parts:
        sql += ' WHERE ' + ' AND '.join(where_parts)
    sql += order_by
    
    # Default limit
    if not is_count and 'LIMIT' not in sql.upper():
        limit = 50 if 'all' in q else 10
        sql += f' LIMIT {limit}'
        
    return sql + ';'


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

    # ── Fast path: caller supplied the SQL directly (e.g. council mode) ──────
    if req.sql_override and req.sql_override.strip():
        sql = req.sql_override.strip()
        explanation = f'SQL provided by AI Council for: "{req.question}"'
    else:
        # Try AI first (Ollama)
        try:
            from app.services.ai_service import AIService
            ai = AIService()
            result = await ai.generate_and_heal_sql(
                question=req.question,
                schema_context=schema_context,
                connection_string=req.connection_string,
                conversation_history=req.conversation_history or [],
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

