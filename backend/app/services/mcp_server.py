"""
MCP (Model Context Protocol) Server — Expose DB schema and business rules
as a machine-readable manifest for AI agents.
"""

import json
import os
import logging
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
SEMANTIC_RULES_FILE = os.path.join(DATA_DIR, "semantic_rules.json")


def load_semantic_rules() -> List[Dict]:
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(SEMANTIC_RULES_FILE):
        try:
            with open(SEMANTIC_RULES_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return []


def save_semantic_rules(rules: List[Dict]):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SEMANTIC_RULES_FILE, "w") as f:
        json.dump(rules, f, indent=2)


class MCPServer:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string, poolclass=NullPool)

    def generate_manifest(self) -> Dict[str, Any]:
        """
        Generate an MCP-compatible manifest containing:
        - Database metadata
        - Table schemas with columns, types, constraints
        - Foreign key relationships
        - Business rules from the semantic layer
        """
        manifest = {
            "protocol": "mcp",
            "version": "1.0",
            "server": {
                "name": "DB-Lighthouse",
                "description": "AI-powered database management and optimization tool",
                "generated_at": datetime.utcnow().isoformat() + "Z",
            },
            "resources": [],
            "tools": [],
        }

        try:
            with self.engine.connect() as conn:
                # 1. Database info
                db_name = conn.execute(text("SELECT current_database()")).scalar()
                db_version = conn.execute(text("SELECT version()")).scalar()

                manifest["server"]["database"] = {
                    "name": db_name,
                    "engine": "PostgreSQL",
                    "version": db_version,
                }

                # 2. Table schemas
                tables = conn.execute(text("""
                    SELECT t.tablename,
                           c.reltuples::bigint as estimated_rows,
                           pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename)) as size_bytes
                    FROM pg_tables t
                    JOIN pg_class c ON c.relname = t.tablename
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE t.schemaname = 'public' AND n.nspname = 'public'
                """)).fetchall()

                for tbl_name, row_count, size_bytes in tables:
                    columns = conn.execute(text("""
                        SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                               CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                               CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
                        FROM information_schema.columns c
                        LEFT JOIN (
                            SELECT ku.table_name, ku.column_name
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage ku
                              ON tc.constraint_name = ku.constraint_name
                            WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
                        ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
                        LEFT JOIN (
                            SELECT ku.table_name, ku.column_name
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage ku
                              ON tc.constraint_name = ku.constraint_name
                            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
                        ) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
                        WHERE c.table_schema = 'public' AND c.table_name = :table
                        ORDER BY c.ordinal_position
                    """), {"table": tbl_name}).fetchall()

                    col_list = []
                    for col in columns:
                        col_list.append({
                            "name": col[0],
                            "type": col[1],
                            "nullable": col[2] == "YES",
                            "default": col[3],
                            "is_primary_key": col[4],
                            "is_foreign_key": col[5],
                        })

                    manifest["resources"].append({
                        "uri": f"db://public/{tbl_name}",
                        "type": "table",
                        "name": tbl_name,
                        "description": f"Table '{tbl_name}' with {row_count} estimated rows ({round(size_bytes/1024, 1)} KB)",
                        "metadata": {
                            "schema": "public",
                            "estimated_rows": row_count,
                            "size_bytes": size_bytes,
                            "columns": col_list,
                        }
                    })

                # 3. Foreign key relationships
                fk_query = conn.execute(text("""
                    SELECT
                        tc.table_name AS source,
                        kcu.column_name AS source_column,
                        ccu.table_name AS target,
                        ccu.column_name AS target_column,
                        tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu
                      ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
                """)).fetchall()

                relationships = []
                for fk in fk_query:
                    relationships.append({
                        "source": f"db://public/{fk[0]}",
                        "source_column": fk[1],
                        "target": f"db://public/{fk[2]}",
                        "target_column": fk[3],
                        "constraint": fk[4],
                        "type": "foreign_key"
                    })

                manifest["relationships"] = relationships

        except Exception as e:
            logger.error(f"MCP manifest generation failed: {e}")
            manifest["error"] = str(e)

        # 4. Business rules from semantic layer
        rules = load_semantic_rules()
        manifest["semantic_layer"] = {
            "business_rules": [
                {
                    "name": r.get("name", ""),
                    "definition": r.get("definition", ""),
                    "description": f"When a query references '{r.get('name', '')}', "
                                   f"it means: {r.get('definition', '')}",
                }
                for r in rules
            ]
        }

        # 5. Available tools/capabilities
        manifest["tools"] = [
            {
                "name": "query",
                "description": "Execute a natural language query against the database. "
                               "The system will convert it to SQL, validate it, and return results.",
                "input_schema": {"type": "object", "properties": {"question": {"type": "string"}}}
            },
            {
                "name": "analyze_performance",
                "description": "Run a three-phase performance analysis: bottleneck map, zombie indexes, and recommendations.",
                "input_schema": {"type": "object", "properties": {"with_ai": {"type": "boolean"}}}
            },
            {
                "name": "detect_anomalies",
                "description": "Run Z-Score anomaly detection on database metrics.",
                "input_schema": {"type": "object", "properties": {}}
            },
        ]

        return manifest
