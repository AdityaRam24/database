"""
Performance API — /api/performance/*
Wraps the three-phase index analysis service.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from app.services.index_analyzer import get_full_analysis, simulate_index_impact
from app.services.ai_service import AIService

router = APIRouter()

_FIRESTORE_PERF_NOT_SUPPORTED = {
    "supported": False,
    "db_type": "firestore",
    "message": (
        "Index performance analysis uses PostgreSQL system statistics (pg_stat_user_tables, EXPLAIN ANALYZE) "
        "and is not available for Firestore. Use the Firebase Console → Firestore → Indexes to manage indexes, "
        "and the Firebase Performance Monitoring SDK for query profiling."
    ),
    "bottleneck_map": [],
    "zombie_indexes": [],
    "recommendations": [],
}


def _is_firebase(conn: str) -> bool:
    return '"private_key"' in conn and '"project_id"' in conn


class AnalysisRequest(BaseModel):
    connection_string: str
    with_ai: bool = False


class SimulateRequest(BaseModel):
    connection_string: str
    index_sql: str
    sample_query: str | None = None


@router.post("/run-performance-analysis")
async def run_performance_analysis(req: AnalysisRequest):
    """
    Full three-phase analysis:
      - bottleneck_map  (Phase A — visual red/green column map)
      - zombie_indexes  (Phase B — unused indexes wasting space)
      - recommendations (Phase C — missing index SQL + AI insight)
    For Firestore: returns a structured N/A response with guidance.
    """
    if _is_firebase(req.connection_string):
        return _FIRESTORE_PERF_NOT_SUPPORTED

    ai_service = AIService() if req.with_ai else None
    result = await get_full_analysis(req.connection_string, ai_service)
    return result


@router.post("/simulate-index")
async def simulate_index(req: SimulateRequest):
    """
    Apply a CREATE INDEX on the shadow DB and return before/after
    execution times from EXPLAIN ANALYZE.
    For Firestore: not supported.
    """
    if _is_firebase(req.connection_string):
        return {
            "supported": False,
            "db_type": "firestore",
            "message": "Index simulation uses EXPLAIN ANALYZE and is not available for Firestore.",
        }

    return simulate_index_impact(
        req.connection_string,
        req.index_sql,
        req.sample_query,
    )
