"""
Predictive Indexing Service — Module 1 (Performance)

Three-phase analysis:
  Phase A — Visual Bottleneck Map: columns hot in WHERE clauses with no index (red highlight)
  Phase B — Space vs Speed:        zombie indexes (idx_scan = 0) that waste space
  Phase C — SQL Generation:        ranked CREATE INDEX recommendations from heuristic rules

No ML required. AI insight is opt-in.
"""

import logging
import re
import asyncio
from typing import Any
from sqlalchemy import text, create_engine
from sqlalchemy.pool import NullPool
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Data models
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class IndexRecommendation:
    table_name: str
    column_names: list[str]
    index_sql: str
    reason: str
    impact_score: float          # 0–100 normalised
    risk_level: str              # "low" | "medium" | "high"
    ai_explanation: str = ""
    estimated_calls: int = 0
    avg_exec_ms: float = 0.0
    query_frequency_pct: float = 0.0   # % of queries that use this column


@dataclass
class ZombieIndex:
    index_name: str
    table_name: str
    index_def: str
    size_bytes: int
    size_human: str
    idx_scan: int                # how many times it's been used (0 = zombie)
    drop_sql: str
    saving_note: str             # human-readable


@dataclass
class BottleneckColumn:
    table_name: str
    column_name: str
    data_type: str
    is_indexed: bool
    seq_scan_count: int          # proxy for how hot this column is
    row_count: int
    status: str                  # "critical" | "warning" | "healthy"
    suggestion: str


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _engine(conn_str: str):
    """Throw-away engine with NullPool — connections are never held open."""
    return create_engine(conn_str, poolclass=NullPool)


def _pg_stat_available(conn) -> bool:
    try:
        conn.execute(text("SELECT 1 FROM pg_stat_statements LIMIT 1"))
        return True
    except Exception:
        return False


def _table_row_count(conn, table: str) -> int:
    try:
        row = conn.execute(
            text("SELECT reltuples::bigint FROM pg_class WHERE relname = :t"),
            {"t": table}
        ).fetchone()
        return int(row[0]) if row and row[0] else 0
    except Exception:
        return 0


def _existing_indexes(conn, table: str) -> set[str]:
    try:
        rows = conn.execute(
            text("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_class c ON c.oid = i.indrelid
                JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
                WHERE c.relname = :t
            """),
            {"t": table}
        ).fetchall()
        return {r[0] for r in rows}
    except Exception:
        return set()


def _log_db_info(conn) -> None:
    """Print connected DB details to the terminal for debugging."""
    try:
        row = conn.execute(text("""
            SELECT
                current_database()                          AS db_name,
                version()                                   AS pg_version,
                pg_size_pretty(pg_database_size(current_database())) AS db_size,
                (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS table_count
        """)).fetchone()
        if row:
            db_name, pg_version, db_size, table_count = row
            short_version = pg_version.split(',')[0] if pg_version else pg_version
            logger.info(
                "[DB-Lighthouse] ✅ Connected to database\n"
                f"  Database : {db_name}\n"
                f"  Version  : {short_version}\n"
                f"  Size     : {db_size}\n"
                f"  Tables   : {table_count} (public schema)"
            )
    except Exception as e:
        logger.debug(f"_log_db_info: {e}")


def _user_tables(conn) -> list[str]:
    try:
        rows = conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        ).fetchall()
        tables = [r[0] for r in rows]
        if not tables:
            logger.warning("[DB-Lighthouse] ⚠️  No tables found in shadow DB (public schema). "
                           "Load a SQL schema on the dashboard first.")
        else:
            _log_db_info(conn)
        return tables
    except Exception:
        return []



# ──────────────────────────────────────────────────────────────────────────────
# Phase A — Visual Bottleneck Map
# ──────────────────────────────────────────────────────────────────────────────

def get_bottleneck_map(conn_str: str) -> list[dict]:
    """
    For each user table, return each column with:
      - is_indexed: bool
      - seq_scan_count: proxy for query activity
      - status: "critical" | "warning" | "healthy"

    "Critical" = column not indexed AND its table has many sequential scans.
    This powers the red/amber/green visual on the frontend.
    """
    results: list[dict] = []
    try:
        engine = _engine(conn_str)
        with engine.connect() as conn:
            tables = _user_tables(conn)
            for table in tables:
                indexed = _existing_indexes(conn, table)
                row_count = _table_row_count(conn, table)

                # Seq scan count for this table
                seq_scans = 0
                try:
                    r = conn.execute(
                        text("SELECT seq_scan FROM pg_stat_user_tables WHERE relname = :t"),
                        {"t": table}
                    ).fetchone()
                    seq_scans = int(r[0]) if r and r[0] else 0
                except Exception:
                    pass

                # All columns for this table
                try:
                    cols = conn.execute(text("""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_name = :t AND table_schema = 'public'
                        ORDER BY ordinal_position
                    """), {"t": table}).fetchall()

                    for col, dtype in cols:
                        is_indexed = col in indexed
                        if not is_indexed and seq_scans > 100 and row_count > 10_000:
                            status = "critical"
                            suggestion = (
                                f"90%+ queries on '{table}' may be doing full scans. "
                                f"Consider: CREATE INDEX idx_{table}_{col} ON {table} ({col});"
                            )
                        elif not is_indexed and seq_scans > 20:
                            status = "warning"
                            suggestion = f"Moderate scan activity detected. Index '{col}' if used in WHERE clauses."
                        else:
                            status = "healthy"
                            suggestion = "No action needed." if is_indexed else "Low traffic — monitor before indexing."

                        results.append({
                            "table_name": table,
                            "column_name": col,
                            "data_type": dtype,
                            "is_indexed": is_indexed,
                            "seq_scan_count": seq_scans,
                            "row_count": row_count,
                            "status": status,
                            "suggestion": suggestion,
                        })
                except Exception as e:
                    logger.debug(f"bottleneck_map columns for {table}: {e}")

    except Exception as e:
        logger.error(f"get_bottleneck_map: {e}")

    return results


# ──────────────────────────────────────────────────────────────────────────────
# Phase B — Zombie Index Detection (Space vs Speed)
# ──────────────────────────────────────────────────────────────────────────────

def detect_zombie_indexes(conn_str: str) -> list[dict]:
    """
    Finds indexes that have never been used (idx_scan = 0).
    Excludes primary key indexes (they're always needed).
    Returns DROP INDEX SQL + estimated space saving.
    """
    results: list[dict] = []
    try:
        engine = _engine(conn_str)
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT
                    s.indexrelname   AS index_name,
                    s.relname        AS table_name,
                    i.indexdef       AS index_def,
                    s.idx_scan       AS idx_scan,
                    pg_relation_size(s.indexrelid) AS size_bytes,
                    pg_size_pretty(pg_relation_size(s.indexrelid)) AS size_human
                FROM pg_stat_user_indexes s
                JOIN pg_indexes i
                  ON i.indexname = s.indexrelname
                 AND i.tablename = s.relname
                JOIN pg_index pi
                  ON pi.indexrelid = s.indexrelid
                LEFT JOIN pg_constraint c
                  ON c.conindid = s.indexrelid
                WHERE s.idx_scan = 0
                  AND c.oid IS NULL
                  AND pi.indisunique = false
                ORDER BY size_bytes DESC
                LIMIT 30
            """)).fetchall()

            for r in rows:
                idx_name, tbl, idx_def, idx_scan, size_bytes, size_human = r
                results.append({
                    "index_name": idx_name,
                    "table_name": tbl,
                    "index_def": idx_def,
                    "idx_scan": int(idx_scan or 0),
                    "size_bytes": int(size_bytes or 0),
                    "size_human": size_human or "unknown",
                    "drop_sql": f'DROP INDEX IF EXISTS "{idx_name}" CASCADE;',
                    "saving_note": (
                        f"Dropping this index frees {size_human} of storage and "
                        f"speeds up INSERT/UPDATE on '{tbl}' (no index maintenance needed)."
                    ),
                })

    except Exception as e:
        logger.error(f"detect_zombie_indexes: {e}")

    return results


# ──────────────────────────────────────────────────────────────────────────────
# Phase C — Missing Index Recommendations (Heuristic rules + AI SQL)
# ──────────────────────────────────────────────────────────────────────────────

def analyze_query_stats(conn_str: str) -> list[dict]:
    """Read pg_stat_statements for slow queries. Falls back to [] if not installed."""
    results = []
    try:
        engine = _engine(conn_str)
        with engine.connect() as conn:
            if not _pg_stat_available(conn):
                return results

            rows = conn.execute(text("""
                SELECT query, calls,
                       mean_exec_time  AS mean_exec_ms,
                       total_exec_time AS total_exec_ms
                FROM pg_stat_statements
                WHERE calls > 5
                  AND mean_exec_time > 10
                ORDER BY total_exec_time DESC
                LIMIT 50
            """)).fetchall()

            for r in rows:
                results.append({
                    "query": r[0],
                    "calls": r[1],
                    "mean_exec_ms": round(r[2], 2),
                    "total_exec_ms": round(r[3], 2),
                })
    except Exception as e:
        logger.error(f"analyze_query_stats: {e}")
    return results


def detect_missing_indexes(conn_str: str) -> list[IndexRecommendation]:
    """
    Three heuristic rules:
      1. FK columns without index on their table
      2. Sequential scans on large tables (>100k rows)
      3. Low-correlation columns (bad ORDER BY performance)
    """
    recs: list[IndexRecommendation] = []

    try:
        engine = _engine(conn_str)
        with engine.connect() as conn:
            tables = _user_tables(conn)

            for table in tables:
                row_count = _table_row_count(conn, table)
                indexed = _existing_indexes(conn, table)

                # ── Rule 1: FK columns without index ──
                try:
                    fk_rows = conn.execute(text("""
                        SELECT kcu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                          ON tc.constraint_name = kcu.constraint_name
                         AND tc.table_schema = kcu.table_schema
                        WHERE tc.constraint_type = 'FOREIGN KEY'
                          AND tc.table_name = :t
                          AND tc.table_schema = 'public'
                    """), {"t": table}).fetchall()

                    for fk_row in fk_rows:
                        col = fk_row[0]
                        if col not in indexed:
                            recs.append(IndexRecommendation(
                                table_name=table,
                                column_names=[col],
                                index_sql=f"CREATE INDEX idx_{table}_{col} ON {table} ({col});",
                                reason=f"Foreign key column '{col}' has no index. JOIN queries will full-scan this table.",
                                impact_score=0,
                                risk_level="high" if row_count > 100_000 else "medium",
                                query_frequency_pct=90.0,
                            ))
                except Exception as e:
                    logger.debug(f"FK check {table}: {e}")

                # ── Rule 2: Sequential scan on large table ──
                if row_count > 100_000:
                    try:
                        seq_row = conn.execute(text("""
                            SELECT seq_scan, seq_tup_read
                            FROM pg_stat_user_tables WHERE relname = :t
                        """), {"t": table}).fetchone()

                        if seq_row and seq_row[0] and seq_row[0] > 50:
                            col_rows = conn.execute(text("""
                                SELECT column_name
                                FROM information_schema.columns
                                WHERE table_name = :t AND table_schema = 'public'
                                  AND data_type IN (
                                    'integer','bigint','uuid','character varying','text',
                                    'timestamp with time zone','timestamp without time zone',
                                    'date','boolean'
                                  )
                                LIMIT 5
                            """), {"t": table}).fetchall()

                            for cr in col_rows:
                                col = cr[0]
                                if col not in indexed and not col.endswith("_id"):
                                    recs.append(IndexRecommendation(
                                        table_name=table,
                                        column_names=[col],
                                        index_sql=f"CREATE INDEX idx_{table}_{col}_seqscan ON {table} ({col});",
                                        reason=f"Table '{table}' ({row_count:,} rows) has {seq_row[0]} sequential scans. Indexing '{col}' reduces full-table reads.",
                                        impact_score=0,
                                        risk_level="high",
                                        estimated_calls=int(seq_row[0]),
                                        query_frequency_pct=min(seq_row[0] / 10, 99.0),
                                    ))
                                    break
                    except Exception as e:
                        logger.debug(f"Seq scan check {table}: {e}")

                # ── Rule 3: Low-correlation ORDER BY columns ──
                try:
                    corr_rows = conn.execute(text("""
                        SELECT attname, correlation
                        FROM pg_stats
                        WHERE tablename = :t
                          AND correlation IS NOT NULL
                          AND abs(correlation) < 0.1
                        LIMIT 3
                    """), {"t": table}).fetchall()

                    for cr in corr_rows:
                        col = cr[0]
                        if col not in indexed:
                            recs.append(IndexRecommendation(
                                table_name=table,
                                column_names=[col],
                                index_sql=f"CREATE INDEX idx_{table}_{col}_order ON {table} ({col});",
                                reason=f"Column '{col}' has low correlation ({cr[1]:.2f}). ORDER BY queries heap-sort data inefficiently.",
                                impact_score=0,
                                risk_level="low",
                                query_frequency_pct=30.0,
                            ))
                except Exception as e:
                    logger.debug(f"Correlation check {table}: {e}")

    except Exception as e:
        logger.error(f"detect_missing_indexes: {e}")

    return recs


def rank_index_recommendations(recs: list[IndexRecommendation]) -> list[IndexRecommendation]:
    risk_order = {"high": 3, "medium": 2, "low": 1}
    for rec in recs:
        raw = (rec.avg_exec_ms * rec.estimated_calls) / 1000.0
        rec.impact_score = raw

    max_score = max((r.impact_score for r in recs), default=1) or 1
    for rec in recs:
        base = (rec.impact_score / max_score) * 80
        risk_bonus = risk_order.get(rec.risk_level, 1) * 6
        rec.impact_score = round(min(base + risk_bonus, 100), 1)

    return sorted(recs, key=lambda r: r.impact_score, reverse=True)


def simulate_index_impact(conn_str: str, index_sql: str, sample_query: str | None = None) -> dict:
    result = {"before_ms": 0.0, "after_ms": 0.0, "improvement_pct": 0.0, "error": None}
    try:
        engine = _engine(conn_str)
        with engine.connect() as conn:
            m = re.search(r'\bON\s+(\w+)\s*\(([^)]+)\)', index_sql, re.IGNORECASE)
            if not m:
                result["error"] = "Could not parse table/column from index SQL"
                return result

            table = m.group(1)
            cols = [c.strip() for c in m.group(2).split(",")]
            if not sample_query:
                sample_query = f"SELECT * FROM {table} WHERE {cols[0]} IS NOT NULL LIMIT 100"

            try:
                conn.execute(text("SET enable_indexscan = off; SET enable_bitmapscan = off;"))
                before = conn.execute(text(f"EXPLAIN (ANALYZE, FORMAT JSON) {sample_query}")).fetchone()
                conn.execute(text("SET enable_indexscan = on; SET enable_bitmapscan = on;"))
                if before:
                    plan = before[0]
                    result["before_ms"] = round(plan[0]["Execution Time"], 2) if isinstance(plan, list) else 0
            except Exception as ex:
                logger.warning(f"simulate BEFORE: {ex}")

            with conn.begin():
                conn.execute(text(index_sql))

            try:
                after = conn.execute(text(f"EXPLAIN (ANALYZE, FORMAT JSON) {sample_query}")).fetchone()
                if after:
                    plan = after[0]
                    result["after_ms"] = round(plan[0]["Execution Time"], 2) if isinstance(plan, list) else 0
            except Exception as ex:
                logger.warning(f"simulate AFTER: {ex}")

            if result["before_ms"] and result["after_ms"]:
                diff = result["before_ms"] - result["after_ms"]
                result["improvement_pct"] = round((diff / result["before_ms"]) * 100, 1)

    except Exception as e:
        logger.error(f"simulate_index_impact: {e}")
        result["error"] = str(e)

    return result


async def get_full_analysis(conn_str: str, ai_service=None) -> dict:
    """
    Full three-phase pipeline. Returns:
    {
        bottleneck_map: [...],   # Phase A
        zombie_indexes: [...],   # Phase B
        recommendations: [...],  # Phase C
    }
    """
    bottleneck = get_bottleneck_map(conn_str)
    zombies = detect_zombie_indexes(conn_str)
    raw = detect_missing_indexes(conn_str)
    ranked = rank_index_recommendations(raw)

    if ai_service and ranked:
        for rec in ranked:
            try:
                rec.ai_explanation = await ai_service.generate_explanation(
                    finding=rec.index_sql,
                    context=rec.reason,
                )
            except Exception as e:
                logger.error(f"Fallback generated explanation due to error: {e}")
                rec.ai_explanation = rec.reason

    return {
        "bottleneck_map": bottleneck,
        "zombie_indexes": zombies,
        "recommendations": [
            {
                "table_name": r.table_name,
                "column_names": r.column_names,
                "index_sql": r.index_sql,
                "reason": r.reason,
                "impact_score": r.impact_score,
                "risk_level": r.risk_level,
                "ai_explanation": r.ai_explanation or r.reason,
                "query_frequency_pct": r.query_frequency_pct,
            }
            for r in ranked
        ],
    }


# Keep old entry point for backward compat
async def get_recommendations_with_ai(conn_str: str, ai_service=None) -> list[dict]:
    result = await get_full_analysis(conn_str, ai_service)
    return result["recommendations"]
