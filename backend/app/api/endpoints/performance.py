"""
Performance API — /api/performance/*
Wraps the three-phase index analysis service.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from app.services.index_analyzer import get_full_analysis, simulate_index_impact
from app.services.ai_service import AIService

router = APIRouter()


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
    """
    ai_service = AIService() if req.with_ai else None
    result = await get_full_analysis(req.connection_string, ai_service)
    return result


@router.post("/simulate-index")
async def simulate_index(req: SimulateRequest):
    """
    Apply a CREATE INDEX on the shadow DB and return before/after
    execution times from EXPLAIN ANALYZE.
    """
    return simulate_index_impact(
        req.connection_string,
        req.index_sql,
        req.sample_query,
    )
