"""
Schema Snapshots API — Captures, stores, and retrieves schema snapshots
for the Time Machine feature.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.schema_analysis import SchemaAnalysisService
import sqlite3
import hashlib
import json
import logging
import os
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── SQLite Storage ─────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "snapshots.db")

def _get_db():
    """Get a connection to the snapshots SQLite database."""
    db_path = os.path.abspath(DB_PATH)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connection_hash TEXT NOT NULL,
            schema_hash TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT 'Snapshot',
            tag TEXT NOT NULL DEFAULT 'SNAPSHOT',
            accent TEXT NOT NULL DEFAULT '#6366f1',
            graph_json TEXT NOT NULL,
            diff_summary TEXT DEFAULT ''
        )
    """)
    conn.commit()
    return conn


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _compute_diff(old_graph: dict, new_graph: dict) -> tuple[str, str, str]:
    """
    Compare two graph snapshots and return (label, tag, diff_summary).
    """
    old_tables = {n["id"]: n for n in old_graph.get("nodes", [])}
    new_tables = {n["id"]: n for n in new_graph.get("nodes", [])}

    added_tables = set(new_tables.keys()) - set(old_tables.keys())
    dropped_tables = set(old_tables.keys()) - set(new_tables.keys())

    added_cols = []
    dropped_cols = []

    for table_id in set(old_tables.keys()) & set(new_tables.keys()):
        old_cols = {c["name"] for c in old_tables[table_id].get("data", {}).get("columns", [])}
        new_cols = {c["name"] for c in new_tables[table_id].get("data", {}).get("columns", [])}
        for c in new_cols - old_cols:
            added_cols.append(f"{table_id}.{c}")
        for c in old_cols - new_cols:
            dropped_cols.append(f"{table_id}.{c}")

    diff_lines = []
    if added_tables:
        for t in added_tables:
            col_count = len(new_tables[t].get("data", {}).get("columns", []))
            diff_lines.append(f"+Table: {t} ({col_count} cols)")
    if dropped_tables:
        for t in dropped_tables:
            diff_lines.append(f"-Table: {t}")
    if added_cols:
        for c in added_cols:
            diff_lines.append(f"+Column: {c}")
    if dropped_cols:
        for c in dropped_cols:
            diff_lines.append(f"-Column: {c}")

    diff_summary = "\n".join(diff_lines) if diff_lines else "No structural changes"

    # Generate label
    if added_tables:
        label = f"Added {', '.join(added_tables)}"
    elif dropped_tables:
        label = f"Dropped {', '.join(dropped_tables)}"
    elif added_cols:
        label = f"Added columns"
    elif dropped_cols:
        label = f"Dropped columns"
    else:
        label = "Schema update"

    # Generate tag
    if added_tables or dropped_tables:
        tag = "MIGRATION"
    elif added_cols or dropped_cols:
        tag = "ALTER"
    else:
        tag = "UPDATE"

    return label, tag, diff_summary


# ─── Accent Color Rotation ──────────────────────────────────────────────────────

ACCENT_COLORS = ["#6366f1", "#a855f7", "#f59e0b", "#3b82f6", "#10b981", "#ec4899", "#14b8a6", "#f97316"]


# ─── Request Models ─────────────────────────────────────────────────────────────

class SnapshotRequest(BaseModel):
    connection_string: str


# ─── Endpoints ───────────────────────────────────────────────────────────────────

@router.post("/capture")
def capture_snapshot(request: SnapshotRequest):
    """
    Capture the current live schema as a snapshot.
    Only stores if the schema has actually changed since the last snapshot.
    """
    logger.info("Capturing schema snapshot...")

    try:
        service = SchemaAnalysisService(request.connection_string)
        graph_data = service.get_schema_graph_data()
    except Exception as e:
        logger.error(f"Failed to fetch schema for snapshot: {e}")
        raise HTTPException(status_code=500, detail=f"Could not fetch schema: {str(e)}")

    structural_data = {
        "tables": sorted([
            {
                "name": n.get("id"),
                "columns": sorted([c.get("name") for c in n.get("data", {}).get("columns", [])])
            }
            for n in graph_data.get("nodes", [])
        ], key=lambda x: x["name"]),
        "edges": sorted([f"{e.get('source')}->{e.get('target')}" for e in graph_data.get("edges", [])])
    }
    schema_hash = _hash(json.dumps(structural_data, sort_keys=True))
    graph_json = json.dumps(graph_data, sort_keys=True, default=str)
    conn_hash = _hash(request.connection_string)

    db = _get_db()
    try:
        # Check if this exact schema already exists as the latest snapshot
        last = db.execute(
            "SELECT id, schema_hash, graph_json FROM schema_snapshots WHERE connection_hash = ? ORDER BY id DESC LIMIT 1",
            (conn_hash,)
        ).fetchone()

        if last and last["schema_hash"] == schema_hash:
            return {
                "status": "unchanged",
                "message": "Schema has not changed since the last snapshot.",
                "snapshot_id": last["id"]
            }

        # Compute diff against previous snapshot
        now = datetime.now(timezone.utc).isoformat()

        if last:
            old_graph = json.loads(last["graph_json"])
            label, tag, diff_summary = _compute_diff(old_graph, graph_data)
        else:
            table_count = len(graph_data.get("nodes", []))
            label = f"Initial Schema ({table_count} tables)"
            tag = "INIT"
            diff_summary = f"Initial capture: {table_count} tables"

        # Pick accent color based on count
        count = db.execute(
            "SELECT COUNT(*) as cnt FROM schema_snapshots WHERE connection_hash = ?",
            (conn_hash,)
        ).fetchone()["cnt"]
        accent = ACCENT_COLORS[count % len(ACCENT_COLORS)]

        db.execute(
            """INSERT INTO schema_snapshots (connection_hash, schema_hash, captured_at, label, tag, accent, graph_json, diff_summary)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (conn_hash, schema_hash, now, label, tag, accent, graph_json, diff_summary)
        )
        db.commit()

        new_id = db.execute("SELECT last_insert_rowid() as id").fetchone()["id"]

        logger.info(f"Snapshot #{new_id} captured: {label}")
        return {
            "status": "captured",
            "message": f"Snapshot captured: {label}",
            "snapshot_id": new_id,
            "label": label,
            "tag": tag,
            "diff_summary": diff_summary
        }

    finally:
        db.close()


@router.post("/list")
def list_snapshots(request: SnapshotRequest):
    """
    List all snapshots for a given connection string (without the full graph JSON).
    """
    conn_hash = _hash(request.connection_string)
    db = _get_db()

    try:
        rows = db.execute(
            """SELECT id, captured_at, label, tag, accent, diff_summary, schema_hash
               FROM schema_snapshots
               WHERE connection_hash = ?
               ORDER BY id ASC""",
            (conn_hash,)
        ).fetchall()

        return {
            "snapshots": [
                {
                    "id": r["id"],
                    "captured_at": r["captured_at"],
                    "label": r["label"],
                    "tag": r["tag"],
                    "accent": r["accent"],
                    "diff_summary": r["diff_summary"],
                }
                for r in rows
            ]
        }
    finally:
        db.close()


@router.get("/get/{snapshot_id}")
def get_snapshot(snapshot_id: int):
    """
    Get the full graph JSON for a specific snapshot.
    """
    db = _get_db()

    try:
        row = db.execute(
            "SELECT * FROM schema_snapshots WHERE id = ?",
            (snapshot_id,)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Snapshot not found")

        return {
            "id": row["id"],
            "captured_at": row["captured_at"],
            "label": row["label"],
            "tag": row["tag"],
            "accent": row["accent"],
            "diff_summary": row["diff_summary"],
            "graph_data": json.loads(row["graph_json"])
        }
    finally:
        db.close()
