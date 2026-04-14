from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class SchemaAnalysisService:
    def __init__(self, connection_string: str):
        from app.core.config import settings
        if connection_string == "SHADOW_DB":
             self.engine = create_engine(settings.SHADOW_DB_URL, poolclass=NullPool)
        else:
             self.engine = create_engine(connection_string, poolclass=NullPool)

    async def get_dashboard_stats(self, connection_string: str) -> Dict[str, Any]:
        """
        Returns high-level stats: total tables, total size, optimization score.
        """
        try:
            from app.services.optimization_service import OptimizationService
            opt_service = OptimizationService(connection_string)
            recs = await opt_service.generate_recommendations(with_ai=False)
            score = OptimizationService.calculate_score(recs)

            with self.engine.connect() as conn:
                # Total Size & Table Count
                query = text("""
                    SELECT
                        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
                        (SELECT sum(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) FROM pg_tables WHERE schemaname = 'public') as total_size_bytes,
                        (SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public') as total_pk_count,
                        (SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as total_fk_count;
                """)
                result = conn.execute(query).fetchone()
                total_tables = result[0]
                total_size_bytes = result[1] or 0
                total_pk_count = result[2]
                total_fk_count = result[3]
                
                return {
                    "total_tables": total_tables,
                    "total_size_bytes": total_size_bytes,
                    "total_size_mb": round(total_size_bytes / (1024 * 1024), 2),
                    "total_pk_count": total_pk_count,
                    "total_fk_count": total_fk_count,
                    "optimization_score": score
                }
        except Exception as e:
            logger.error(f"Error fetching dashboard stats: {e}")
            raise e

    def get_schema_graph_data(self) -> Dict[str, List[Any]]:
        """
        Returns nodes (tables) and edges (foreign keys) for React Flow.
        """
        try:
            with self.engine.connect() as conn:
                # 1. Fetch Nodes (Tables with row counts and sizes)
                nodes_query = text("""
                    SELECT
                        t.tablename,
                        c.reltuples::bigint as estimated_rows,
                        pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename)) as size_bytes,
                        s.seq_scan,
                        s.idx_scan
                    FROM pg_tables t
                    JOIN pg_class c ON c.relname = t.tablename
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
                    WHERE t.schemaname = 'public' AND n.nspname = 'public';
                """)
                nodes_result = conn.execute(nodes_query).fetchall()
                
                # Fetch columns with primary key info
                columns_query = text("""
                    SELECT
                        c.table_name,
                        c.column_name,
                        c.data_type,
                        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
                    FROM information_schema.columns c
                    LEFT JOIN (
                        SELECT ku.table_name, ku.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage ku
                          ON tc.constraint_name = ku.constraint_name
                          AND tc.table_schema = ku.table_schema
                        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
                    ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
                    WHERE c.table_schema = 'public'
                    ORDER BY c.table_name, c.ordinal_position;
                """)
                columns_result = conn.execute(columns_query).fetchall()

                # Group columns by table
                from collections import defaultdict
                columns_by_table: dict = defaultdict(list)
                for col_row in columns_result:
                    columns_by_table[col_row[0]].append({
                        "name": col_row[1],
                        "type": col_row[2],
                        "is_pk": col_row[3]
                    })

                nodes = []
                for row in nodes_result:
                    table_name = row[0]
                    nodes.append({
                        "id": table_name,
                        "type": "tableNode",
                        "data": {
                            "label": table_name,
                            "rows": row[1],
                            "size_bytes": row[2],
                            "seq_scan": row[3] or 0,
                            "idx_scan": row[4] or 0,
                            "columns": columns_by_table.get(table_name, [])
                        },
                        "position": {"x": 0, "y": 0}
                    })

                # 2. Fetch Edges (Foreign Keys)
                edges_query = text("""
                    SELECT
                        tc.table_name AS source_table,
                        kcu.column_name AS source_column,
                        ccu.table_name AS target_table,
                        ccu.column_name AS target_column,
                        c.is_nullable AS source_nullable,
                        (
                            SELECT COUNT(*) > 0
                            FROM information_schema.table_constraints u_tc
                            JOIN information_schema.key_column_usage u_kcu
                              ON u_tc.constraint_name = u_kcu.constraint_name
                            WHERE u_tc.table_name = tc.table_name 
                              AND u_kcu.column_name = kcu.column_name
                              AND u_tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
                        ) AS source_is_unique
                    FROM
                        information_schema.table_constraints AS tc
                        JOIN information_schema.key_column_usage AS kcu
                          ON tc.constraint_name = kcu.constraint_name
                          AND tc.table_schema = kcu.table_schema
                        JOIN information_schema.constraint_column_usage AS ccu
                          ON ccu.constraint_name = tc.constraint_name
                          AND ccu.table_schema = tc.table_schema
                        JOIN information_schema.columns c
                          ON c.table_schema = tc.table_schema AND c.table_name = tc.table_name AND c.column_name = kcu.column_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
                """)
                edges_result = conn.execute(edges_query).fetchall()

                edges = []
                fk_columns = set()
                
                for idx, row in enumerate(edges_result):
                    s_table, s_col, t_table, t_col, s_null, s_uniq = row
                    
                    fk_columns.add((s_table, s_col))
                    
                    participation = "partial" if s_null == 'YES' else "total"
                    cardinality = "1:1" if s_uniq else "1:n"

                    edges.append({
                        "id": f"e{idx}-{s_table}-{t_table}",
                        "source": s_table,
                        "target": t_table,
                        "label": f"{s_col} -> {t_col}",
                        "data": {
                            "source_col": s_col,
                            "target_col": t_col,
                            "participation": participation,
                            "cardinality": cardinality
                        }
                    })

                # Inject is_fk into nodes
                for node in nodes:
                    table_name = node["id"]
                    for col in node["data"]["columns"]:
                        col["is_fk"] = (table_name, col["name"]) in fk_columns

                return {
                    "nodes": nodes,
                    "edges": edges
                }

        except Exception as e:
            logger.error(f"Error fetching graph data: {e}")
            raise e

    def get_table_data(self, table_name: str, limit: int = 1000) -> Dict[str, Any]:
        """
        Safely fetches up to `limit` rows from the specified table.
        Returns columns and rows data.
        """
        try:
            with self.engine.connect() as conn:
                # Basic injection prevention since we use table name
                # postgres quote_ident is safer, or checking against information_schema
                safe_table = table_name.replace('"', '""')
                
                query = text(f'SELECT * FROM "{safe_table}" LIMIT :limit')
                result = conn.execute(query, {"limit": limit})
                
                columns = list(result.keys())
                rows = [dict(zip(columns, row)) for row in result.fetchall()]
                
                return {
                    "columns": columns,
                    "rows": rows
                }
        except Exception as e:
            logger.error(f"Error fetching table data for {table_name}: {e}")
            raise e

    def get_table_intelligence(self, table_name: str) -> Dict[str, Any]:
        """
        Fetches detailed intelligence for a specific table: DDL, indexes, constraints, and column stats.
        """
        try:
            with self.engine.connect() as conn:
                safe_table = table_name.replace("'", "''")
                safe_ident = table_name.replace('"', '""')

                # 1. basic properties
                query_info = text(f"""
                    SELECT c.reltuples::bigint,
                           pg_total_relation_size('"{safe_ident}"') as size_bytes,
                           obj_description(c.oid) as description
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = '{safe_table}' AND n.nspname = 'public';
                """)
                info = conn.execute(query_info).fetchone()
                
                # 2. Columns (reusing information_schema)
                query_cols = text(f"""
                    SELECT column_name, data_type, is_nullable, character_maximum_length, column_default
                    FROM information_schema.columns
                    WHERE table_name = '{safe_table}' AND table_schema = 'public'
                    ORDER BY ordinal_position;
                """)
                cols = [dict(zip(["name", "type", "nullable", "max_len", "default"], r)) for r in conn.execute(query_cols).fetchall()]

                # 3. Indexes and their usage (Index Health)
                query_idx = text(f"""
                    SELECT
                        i.relname as index_name,
                        am.amname as index_type,
                        idx.indisunique as is_unique,
                        pg_get_indexdef(idx.indexrelid) as index_def,
                        s.idx_scan,
                        s.idx_tup_read,
                        s.idx_tup_fetch
                    FROM pg_index idx
                    JOIN pg_class c ON c.oid = idx.indrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    JOIN pg_class i ON i.oid = idx.indexrelid
                    JOIN pg_am am ON i.relam = am.oid
                    LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = idx.indexrelid
                    WHERE c.relname = '{safe_table}' AND n.nspname = 'public';
                """)
                indexes = [dict(zip(["name", "type", "is_unique", "definition", "scans", "tup_read", "tup_fetch"], r)) 
                           for r in conn.execute(query_idx).fetchall()]

                # 4. Generate DDL
                col_defs = []
                for c in cols:
                    def_str = f'"{c["name"]}" {c["type"]}'
                    if c["max_len"]: def_str += f'({c["max_len"]})'
                    if c["nullable"] == "NO": def_str += ' NOT NULL'
                    if c["default"]: def_str += f' DEFAULT {c["default"]}'
                    col_defs.append("  " + def_str)
                
                ddl = f'CREATE TABLE "{table_name}" (\n' + ",\n".join(col_defs) + '\n);'

                return {
                    "table_name": table_name,
                    "rows": info[0] if info else 0,
                    "size_bytes": info[1] if info else 0,
                    "description": info[2] if info else "",
                    "columns": cols,
                    "indexes": indexes,
                    "ddl": ddl
                }
        except Exception as e:
            logger.error(f"Error fetching table intelligence for {table_name}: {e}")
            raise e

    def insert_row(self, table_name: str, row_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Safely inserts a single row into the given table using parameterized queries.
        """
        try:
            with self.engine.begin() as conn:
                safe_table = table_name.replace('"', '""')
                
                # Filter out any keys where the value is None or empty string (for integer columns)
                filtered_data = {k: v for k, v in row_data.items() if v is not None and v != ""}
                
                if not filtered_data:
                    raise Exception("No data to insert")

                columns = [f'"{k.replace(chr(34), chr(34)+chr(34))}"' for k in filtered_data.keys()]
                placeholders = [f":{k}" for k in filtered_data.keys()]
                
                query_str = f"INSERT INTO \"{safe_table}\" ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
                
                query = text(query_str)
                conn.execute(query, filtered_data)
                
                return {"success": True, "message": "Row inserted successfully."}
        except Exception as e:
            logger.error(f"Error inserting row into {table_name}: {e}")
            raise e
