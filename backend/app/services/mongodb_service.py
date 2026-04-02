from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class MongoDBService:
    def __init__(self, connection_string: str):
        from pymongo import MongoClient
        self.client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        # Parse the database name from the URI, fall back to first available DB
        from urllib.parse import urlparse
        parsed = urlparse(connection_string)
        db_name = parsed.path.lstrip("/").split("?")[0]
        if not db_name:
            db_name = self.client.list_database_names()[0]
        self.db = self.client[db_name]
        self.db_name = db_name

    @staticmethod
    def verify_connection(connection_string: str) -> bool:
        try:
            from pymongo import MongoClient
            client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            client.close()
            return True
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}")
            return False

    def get_collection_count(self) -> int:
        return len(self.db.list_collection_names())

    def get_schema_graph_data(self) -> Dict[str, List[Any]]:
        """
        Returns nodes (collections with sampled fields) and edges
        (inferred relationships via ObjectId-named fields).
        """
        collection_names = self.db.list_collection_names()
        nodes = []
        edges = []
        edge_id = 0

        for i, col_name in enumerate(collection_names):
            collection = self.db[col_name]

            # Sample one document to infer field names
            sample = collection.find_one()
            columns = []
            if sample:
                for field, value in sample.items():
                    col_type = type(value).__name__
                    is_pk = field == "_id"
                    columns.append({
                        "name": field,
                        "type": col_type,
                        "is_pk": is_pk,
                        "is_fk": False,
                    })

            # Get index info
            indexes = []
            try:
                for idx in collection.list_indexes():
                    indexes.append(idx.get("name", ""))
            except Exception:
                pass

            # Estimated document count
            try:
                row_count = collection.estimated_document_count()
            except Exception:
                row_count = 0

            nodes.append({
                "id": col_name,
                "type": "tableNode",
                "position": {"x": (i % 4) * 280, "y": (i // 4) * 220},
                "data": {
                    "label": col_name,
                    "columns": columns,
                    "rows": row_count,
                    "size_bytes": 0,
                    "indexes": indexes,
                },
            })

            # Infer edges: fields named <other_collection>_id or ending in _id
            if sample:
                for field in sample.keys():
                    if field == "_id":
                        continue
                    # Check for ObjectId reference pattern: field ends with _id or _ref
                    ref_name = None
                    if field.endswith("_id"):
                        ref_name = field[:-3]  # strip _id
                    elif field.endswith("Id"):
                        ref_name = field[:-2].lower()

                    if ref_name and ref_name in collection_names:
                        edges.append({
                            "id": f"e{edge_id}",
                            "source": col_name,
                            "target": ref_name,
                            "label": field,
                            "type": "smoothstep",
                            "style": {"stroke": "#7c3aed"},
                            "markerEnd": {"type": "arrowclosed"},
                        })
                        edge_id += 1

        return {"nodes": nodes, "edges": edges}

    def get_dashboard_stats(self) -> Dict[str, Any]:
        collection_names = self.db.list_collection_names()
        total_collections = len(collection_names)
        total_docs = 0
        total_indexes = 0

        for col_name in collection_names:
            col = self.db[col_name]
            try:
                total_docs += col.estimated_document_count()
                total_indexes += len(list(col.list_indexes()))
            except Exception:
                pass

        return {
            "total_tables": total_collections,
            "total_size_bytes": 0,
            "total_size_mb": 0,
            "total_documents": total_docs,
            "total_indexes": total_indexes,
            "optimization_score": 100,
            "db_type": "mongodb",
            "db_name": self.db_name,
        }
