from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)


class FirebaseService:
    """
    Connects to a Firestore database using a service account JSON string.
    Each instance gets its own firebase_admin App (keyed by project_id) to
    avoid the "app already exists" error on repeated calls.
    """

    def __init__(self, service_account_json: str):
        import firebase_admin
        from firebase_admin import credentials, firestore

        sa = json.loads(service_account_json)
        self.project_id = sa.get("project_id", "unknown")
        app_name = f"lighthouse_{self.project_id}"

        # Re-use existing app or create a new one
        try:
            self._app = firebase_admin.get_app(app_name)
        except ValueError:
            cred = credentials.Certificate(sa)
            self._app = firebase_admin.initialize_app(cred, name=app_name)

        self.db = firestore.client(app=self._app)

    # ------------------------------------------------------------------
    # Static helpers
    # ------------------------------------------------------------------

    @staticmethod
    def verify_connection(service_account_json: str) -> bool:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            sa = json.loads(service_account_json)
            project_id = sa.get("project_id", "unknown")
            app_name = f"lighthouse_verify_{project_id}"

            try:
                app = firebase_admin.get_app(app_name)
            except ValueError:
                cred = credentials.Certificate(sa)
                app = firebase_admin.initialize_app(cred, name=app_name)

            db = firestore.client(app=app)
            # Listing collections is the cheapest live call
            list(db.collections())
            return True
        except Exception as e:
            logger.warning(f"Firebase connection failed: {e}")
            return False

    # ------------------------------------------------------------------
    # Schema / graph
    # ------------------------------------------------------------------

    def _infer_fields(self, doc_data: dict) -> List[Dict]:
        """Convert a Firestore document's top-level fields into column descriptors."""
        fields = []
        for field, value in doc_data.items():
            # Map Python / Firestore types to friendly names
            if hasattr(value, "id"):          # DocumentReference
                type_name = "reference"
            elif isinstance(value, bool):
                type_name = "boolean"
            elif isinstance(value, int):
                type_name = "integer"
            elif isinstance(value, float):
                type_name = "float"
            elif isinstance(value, str):
                type_name = "string"
            elif isinstance(value, list):
                type_name = "array"
            elif isinstance(value, dict):
                type_name = "map"
            else:
                type_name = type(value).__name__
            fields.append({
                "name": field,
                "type": type_name,
                "is_pk": False,
                "is_fk": type_name == "reference",
            })
        # Prepend the implicit document ID field
        fields.insert(0, {"name": "id", "type": "string", "is_pk": True, "is_fk": False})
        return fields

    def get_collection_count(self) -> int:
        return len(list(self.db.collections()))

    def get_schema_graph_data(self) -> Dict[str, List[Any]]:
        collections = list(self.db.collections())
        collection_ids = {col.id for col in collections}
        nodes = []
        edges = []
        edge_id = 0

        for i, col_ref in enumerate(collections):
            col_id = col_ref.id

            # Sample one document to infer schema
            sample_docs = list(col_ref.limit(1).stream())
            columns = []
            doc_data = {}
            if sample_docs:
                doc_data = sample_docs[0].to_dict() or {}
                columns = self._infer_fields(doc_data)

            # Estimated document count (metadata)
            try:
                count_agg = col_ref.count().get()
                row_count = count_agg[0][0].value
            except Exception:
                row_count = 0

            nodes.append({
                "id": col_id,
                "type": "tableNode",
                "position": {"x": (i % 4) * 300, "y": (i // 4) * 240},
                "data": {
                    "label": col_id,
                    "columns": columns,
                    "rows": row_count,
                    "size_bytes": 0,
                    "indexes": [],
                },
            })

            # Infer edges from DocumentReference fields or *_id / *Id naming
            for field, value in doc_data.items():
                ref_target = None
                if hasattr(value, "parent"):
                    # It's a DocumentReference — the parent collection is the target
                    ref_target = value.parent.id
                elif field.endswith("_id"):
                    ref_target = field[:-3]
                elif field.endswith("Id") and not field[0].isupper():
                    ref_target = field[:-2].lower()

                if ref_target and ref_target in collection_ids and ref_target != col_id:
                    edges.append({
                        "id": f"e{edge_id}",
                        "source": col_id,
                        "target": ref_target,
                        "label": field,
                        "type": "smoothstep",
                        "style": {"stroke": "#f97316"},   # orange to distinguish from Mongo (purple)
                        "markerEnd": {"type": "arrowclosed"},
                    })
                    edge_id += 1

        return {"nodes": nodes, "edges": edges}

    # ------------------------------------------------------------------
    # Data browser
    # ------------------------------------------------------------------

    def _serialize(self, value: Any) -> Any:
        """Recursively make Firestore values JSON-serialisable."""
        from datetime import datetime, date
        if hasattr(value, "id") and hasattr(value, "path"):
            return value.path               # DocumentReference → path string
        if isinstance(value, dict):
            return {k: self._serialize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._serialize(v) for v in value]
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return value

    def get_collection_data(self, collection_name: str, limit: int = 100) -> Dict[str, Any]:
        col_ref = self.db.collection(collection_name)
        docs = list(col_ref.limit(limit).stream())

        if not docs:
            return {"columns": [], "rows": []}

        all_keys: set = set()
        rows = []
        for doc in docs:
            data = doc.to_dict() or {}
            data["id"] = doc.id
            all_keys.update(data.keys())
            rows.append(data)

        columns = sorted(list(all_keys))
        if "id" in columns:
            columns.remove("id")
            columns.insert(0, "id")

        serialized_rows = [{k: self._serialize(v) for k, v in row.items()} for row in rows]

        return {"columns": columns, "rows": serialized_rows}

    # ------------------------------------------------------------------
    # Anomaly / Incident metrics
    # ------------------------------------------------------------------

    def collect_anomaly_metrics(self) -> Dict[str, Any]:
        """Snapshot Firestore collection document counts for anomaly tracking."""
        collections = list(self.db.collections())
        doc_counts: Dict[str, int] = {}
        for col_ref in collections:
            try:
                count_agg = col_ref.count().get()
                doc_counts[col_ref.id] = count_agg[0][0].value
            except Exception:
                doc_counts[col_ref.id] = 0
        return {
            "doc_counts": doc_counts,
            "total_collections": len(collections),
            "total_documents": sum(doc_counts.values()),
        }

    # ------------------------------------------------------------------
    # Optimization recommendations
    # ------------------------------------------------------------------

    def generate_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """
        Analyse Firestore collections for common optimization patterns:
        - Reference fields without declared indexes
        - Oversized documents (too many top-level fields)
        - Collections with no documents (empty dead collections)
        """
        recs: List[Dict[str, Any]] = []
        collections = list(self.db.collections())

        for col_ref in collections:
            col_id = col_ref.id
            docs = list(col_ref.limit(10).stream())
            if not docs:
                recs.append({
                    "table": col_id,
                    "column": None,
                    "type": "empty_collection",
                    "description": f"Collection '{col_id}' appears to be empty. Consider removing it to keep the schema clean.",
                    "impact": "Low",
                    "explanation": None,
                    "sql_command": None,
                })
                continue

            # Union of all field names across sampled docs
            all_fields: Dict[str, set] = {}
            for doc in docs:
                for field, value in (doc.to_dict() or {}).items():
                    all_fields.setdefault(field, set()).add(type(value).__name__)

            # Rec: Reference / FK-like fields may need composite indexes
            for field, types in all_fields.items():
                if (
                    "DocumentReference" in types
                    or field.endswith("_id")
                    or (field.endswith("Id") and not field[0].isupper())
                ):
                    recs.append({
                        "table": col_id,
                        "column": field,
                        "type": "missing_index",
                        "description": (
                            f"Field '{field}' in '{col_id}' looks like a reference/FK. "
                            "Add a composite index in the Firebase Console for queries that filter or sort by this field."
                        ),
                        "impact": "High",
                        "explanation": None,
                        "sql_command": f"# Firebase Console → Firestore → Indexes → Add composite index on {col_id} ({field} ASC)",
                    })

            # Rec: Documents with too many top-level fields
            if len(all_fields) > 25:
                recs.append({
                    "table": col_id,
                    "column": None,
                    "type": "oversized_document",
                    "description": (
                        f"Documents in '{col_id}' have ~{len(all_fields)} top-level fields. "
                        "Consider moving infrequently accessed fields into a sub-collection to reduce read cost."
                    ),
                    "impact": "Medium",
                    "explanation": None,
                    "sql_command": None,
                })

        return recs

    # ------------------------------------------------------------------
    # PII detection
    # ------------------------------------------------------------------

    def detect_pii_fields(self) -> Dict[str, List[str]]:
        """Scan collection field names for PII patterns."""
        import re
        PII_PATTERN = re.compile(
            r"(email|phone|mobile|ssn|passport|address|zip|postal|dob|birth|"
            r"first.?name|last.?name|full.?name|credit.?card|card.?number|cvv|"
            r"ip.?address|latitude|longitude|gender|ethnicity|salary|income|"
            r"national.?id|driver.?licen)",
            re.IGNORECASE,
        )
        pii_map: Dict[str, List[str]] = {}
        for col_ref in self.db.collections():
            docs = list(col_ref.limit(1).stream())
            if not docs:
                continue
            pii_fields = [f for f in (docs[0].to_dict() or {}).keys() if PII_PATTERN.search(f)]
            if pii_fields:
                pii_map[col_ref.id] = pii_fields
        return pii_map

    # ------------------------------------------------------------------
    # Dashboard stats
    # ------------------------------------------------------------------

    def get_dashboard_stats(self) -> Dict[str, Any]:
        collections = list(self.db.collections())
        total_collections = len(collections)
        total_docs = 0

        for col_ref in collections:
            try:
                count_agg = col_ref.count().get()
                total_docs += count_agg[0][0].value
            except Exception:
                pass

        return {
            "total_tables": total_collections,
            "total_size_bytes": 0,
            "total_size_mb": 0,
            "total_documents": total_docs,
            "total_indexes": 0,
            "optimization_score": 100,
            "db_type": "firestore",
            "db_name": self.project_id,
        }
