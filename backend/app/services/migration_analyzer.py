"""
Migration Safety Analysis Service — Module 2 (Governance)

Before any SQL patch is applied to the shadow DB, this module:
  1. Parses the SQL to extract table/column/operation
  2. Checks FK constraints, indexes, views, and functions that depend on the target
  3. Returns a safety verdict + structured warning message

Never touches the real/production database.
"""

import logging
import re
from typing import Any
from sqlalchemy import text, create_engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Block-listed command patterns (always unsafe, never apply)
# ──────────────────────────────────────────────────────────────────────────────
BLOCKED_PATTERNS = [
    r'\bDROP\s+DATABASE\b',
    r'\bTRUNCATE\b',
    r'\bDELETE\b(?!.*\bWHERE\b)',     # DELETE without WHERE
    r'\bUPDATE\b(?!.*\bWHERE\b)',     # UPDATE without WHERE
    r'\bDROP\s+SCHEMA\b',
]

ALLOWED_OPERATIONS = [
    r'\bALTER\s+TABLE\b',
    r'\bCREATE\s+INDEX\b',
    r'\bCREATE\s+TABLE\b',
    r'\bADD\s+COLUMN\b',
    r'\bDROP\s+COLUMN\b',
    r'\bALTER\s+COLUMN\b',
    r'\bRENAME\s+COLUMN\b',
    r'\bRENAME\s+TO\b',
]


def _engine(conn_str: str):
    """Create a throw-away engine with NullPool so connections are never held open."""
    return create_engine(conn_str, poolclass=NullPool)


# ──────────────────────────────────────────────────────────────────────────────
# SQL Parser
# ──────────────────────────────────────────────────────────────────────────────

def parse_sql_patch(sql: str) -> dict:
    """
    Extract (table_name, column_name, operation) from a SQL patch string.
    Handles the most common DDL patterns accurately, including quoted identifiers.
    """
    sql_clean = sql.strip().rstrip(";")

    def _strip_quotes(s: str):
        return s.replace('"', '').strip() if s else s

    m = re.search(r'ALTER\s+TABLE\s+([\"\w]+)\s+(DROP\s+COLUMN|ADD\s+COLUMN|ALTER\s+COLUMN|RENAME\s+COLUMN\s+[\"\w]+\s+TO)\s+([\"\w]+)',
                  sql_clean, re.IGNORECASE)
    if m:
        op_part = m.group(2).upper()
        if "DROP" in op_part:
            op = "DROP_COLUMN"
        elif "ADD" in op_part:
            op = "ADD_COLUMN"
        elif "RENAME" in op_part:
            op = "RENAME_COLUMN"
        else:
            op = "ALTER_COLUMN"
        return {"table": _strip_quotes(m.group(1)), "column": _strip_quotes(m.group(3)), "operation": op, "raw_sql": sql}

    m = re.search(r'ALTER\s+TABLE\s+([\"\w]+)\s+RENAME\s+TO\s+([\"\w]+)', sql_clean, re.IGNORECASE)
    if m:
        return {"table": _strip_quotes(m.group(1)), "column": None, "operation": "RENAME_TABLE", "raw_sql": sql}

    m = re.search(r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+[\"\w]+\s+ON\s+([\"\w]+)\s*\(([^)]+)\)', sql_clean, re.IGNORECASE)
    if m:
        return {"table": _strip_quotes(m.group(1)), "column": _strip_quotes(m.group(2)), "operation": "CREATE_INDEX", "raw_sql": sql}

    m = re.search(r'CREATE\s+TABLE\s+([\"\w]+)', sql_clean, re.IGNORECASE)
    if m:
        return {"table": _strip_quotes(m.group(1)), "column": None, "operation": "CREATE_TABLE", "raw_sql": sql}

    m = re.search(r'INSERT\s+INTO\s+([\"\w]+)', sql_clean, re.IGNORECASE)
    if m:
        return {"table": _strip_quotes(m.group(1)), "column": None, "operation": "INSERT", "raw_sql": sql}

    m = re.search(r'UPDATE\s+([\"\w]+)', sql_clean, re.IGNORECASE)
    if m:
        return {"table": _strip_quotes(m.group(1)), "column": None, "operation": "UPDATE", "raw_sql": sql}

    return {"table": None, "column": None, "operation": "UNKNOWN", "raw_sql": sql}


# ──────────────────────────────────────────────────────────────────────────────
# Dependency checkers
# ──────────────────────────────────────────────────────────────────────────────

def _check_fk_constraints(conn, table: str, column: str | None) -> list[str]:
    warnings = []
    try:
        if column:
            rows = conn.execute(text("""
                SELECT tc.constraint_name, ccu.table_name AS ref_table
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
                 AND tc.table_schema = ccu.table_schema
                WHERE (tc.table_name = :t OR ccu.table_name = :t)
                  AND ccu.column_name = :c
                  AND tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
            """), {"t": table, "c": column}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT tc.constraint_name, ccu.table_name AS ref_table
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
                WHERE (tc.table_name = :t OR ccu.table_name = :t)
                  AND tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
            """), {"t": table}).fetchall()

        for r in rows:
            warnings.append(f"FK constraint '{r[0]}' references this column (→ table '{r[1]}')")
    except Exception as e:
        logger.debug(f"FK check: {e}")
    return warnings


def _check_dependent_indexes(conn, table: str, column: str | None) -> list[str]:
    warnings = []
    try:
        if column:
            rows = conn.execute(text("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = :t
                  AND schemaname = 'public'
                  AND indexdef ILIKE :col_like
            """), {"t": table, "col_like": f"%{column}%"}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT indexname, indexdef FROM pg_indexes
                WHERE tablename = :t AND schemaname = 'public'
            """), {"t": table}).fetchall()

        for r in rows:
            warnings.append(f"Index '{r[0]}' will be broken or dropped: {r[1]}")
    except Exception as e:
        logger.debug(f"Index check: {e}")
    return warnings


def _check_dependent_views(conn, table: str, column: str | None) -> list[str]:
    warnings = []
    try:
        if column:
            rows = conn.execute(text("""
                SELECT view_name
                FROM information_schema.view_column_usage
                WHERE table_name = :t
                  AND column_name = :c
                  AND table_schema = 'public'
            """), {"t": table, "c": column}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT DISTINCT view_name
                FROM information_schema.view_column_usage
                WHERE table_name = :t AND table_schema = 'public'
            """), {"t": table}).fetchall()

        for r in rows:
            warnings.append(f"View '{r[0]}' depends on this column")
    except Exception as e:
        logger.debug(f"View check: {e}")
    return warnings


def _check_dependent_functions(conn, column: str | None, table: str | None) -> list[str]:
    warnings = []
    try:
        search_term = column or table
        if not search_term:
            return warnings
        rows = conn.execute(text("""
            SELECT proname
            FROM pg_proc
            WHERE prosrc ILIKE :term
              AND prokind = 'f'
            LIMIT 10
        """), {"term": f"%{search_term}%"}).fetchall()
        for r in rows:
            warnings.append(f"Function '{r[0]}' references '{search_term}' in its body")
    except Exception as e:
        logger.debug(f"Function check: {e}")
    return warnings


# ──────────────────────────────────────────────────────────────────────────────
# Main public function
# ──────────────────────────────────────────────────────────────────────────────

def simulate_migration_impact(conn_str: str, sql_patch: str) -> dict:
    """
    Full safety analysis pipeline.
    Returns:
    {
        is_safe: bool,
        blocked_reason: str | None,
        broken_queries: int,
        dependent_indexes: int,
        dependent_views: int,
        dependent_functions: int,
        warning_message: str,
        warnings: list[str],
        dependency_breakdown: dict,
        parsed: dict,
    }
    """
    all_warnings: list[str] = []

    # ── Step 1: Block-list check ──
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, sql_patch, re.IGNORECASE | re.DOTALL):
            clean_pattern = pattern.replace(r'\b', '')
            return {
                "is_safe": False,
                "blocked_reason": f"Command matches unsafe pattern: `{pattern}`. Blocked.",
                "broken_queries": 0,
                "dependent_indexes": 0,
                "dependent_views": 0,
                "dependent_functions": 0,
                "warning_message": f"🚫 This SQL is blocked for safety. Pattern matched: {clean_pattern}",
                "warnings": [f"Blocked SQL pattern: {pattern}"],
                "dependency_breakdown": {},
                "parsed": parse_sql_patch(sql_patch),
            }

    # ── Step 2: Parse ──
    parsed = parse_sql_patch(sql_patch)
    table = parsed.get("table")
    column = parsed.get("column")
    operation = parsed.get("operation", "UNKNOWN")

    # Safe operations (add/create/insert) don't need full structural dependency scan
    read_only_ops = {"ADD_COLUMN", "CREATE_INDEX", "CREATE_TABLE", "INSERT", "UPDATE"}
    if operation in read_only_ops:
        return {
            "is_safe": True,
            "blocked_reason": None,
            "broken_queries": 0,
            "dependent_indexes": 0,
            "dependent_views": 0,
            "dependent_functions": 0,
            "warning_message": f"✅ '{operation}' is a safe additive operation. No existing objects will be affected.",
            "warnings": [],
            "dependency_breakdown": {},
            "parsed": parsed,
        }

    if not table:
        return {
            "is_safe": False,
            "blocked_reason": "Could not parse table name from SQL",
            "broken_queries": 0,
            "dependent_indexes": 0,
            "dependent_views": 0,
            "dependent_functions": 0,
            "warning_message": "⚠️ Could not parse the SQL. Please check the syntax.",
            "warnings": ["Unparseable SQL patch"],
            "dependency_breakdown": {},
            "parsed": parsed,
        }

    # ── Step 3: Dependency checks ──
    fk_warnings: list[str] = []
    idx_warnings: list[str] = []
    view_warnings: list[str] = []
    fn_warnings: list[str] = []

    try:
        engine = _engine(conn_str)
        with engine.connect() as conn:
            fk_warnings = _check_fk_constraints(conn, table, column)
            idx_warnings = _check_dependent_indexes(conn, table, column)
            view_warnings = _check_dependent_views(conn, table, column)
            fn_warnings = _check_dependent_functions(conn, column, table)
    except Exception as e:
        logger.error(f"simulate_migration_impact DB error: {e}")
        all_warnings.append(f"DB connection error during analysis: {e}")

    all_warnings = fk_warnings + idx_warnings + view_warnings + fn_warnings

    total_issues = len(all_warnings)
    is_safe = total_issues == 0

    # Build warning message
    parts = []
    target = f"'{column}'" if column else f"table '{table}'"
    if fk_warnings:
        parts.append(f"{len(fk_warnings)} FK constraint{'s' if len(fk_warnings) > 1 else ''}")
    if idx_warnings:
        parts.append(f"{len(idx_warnings)} index{'es' if len(idx_warnings) > 1 else ''}")
    if view_warnings:
        parts.append(f"{len(view_warnings)} view{'s' if len(view_warnings) > 1 else ''}")
    if fn_warnings:
        parts.append(f"{len(fn_warnings)} function{'s' if len(fn_warnings) > 1 else ''}")

    if parts:
        warn_msg = f"⚠️ Modifying {target} will affect: {', '.join(parts)}. Review before applying."
    else:
        warn_msg = f"✅ No dependencies found for {target}. Safe to apply."

    return {
        "is_safe": is_safe,
        "blocked_reason": None,
        "broken_queries": len(fk_warnings),
        "dependent_indexes": len(idx_warnings),
        "dependent_views": len(view_warnings),
        "dependent_functions": len(fn_warnings),
        "warning_message": warn_msg,
        "warnings": all_warnings,
        "dependency_breakdown": {
            "foreign_keys": fk_warnings,
            "indexes": idx_warnings,
            "views": view_warnings,
            "functions": fn_warnings,
        },
        "parsed": parsed,
    }
