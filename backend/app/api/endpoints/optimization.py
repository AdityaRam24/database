from fastapi import APIRouter, HTTPException
from app.services.optimization_service import OptimizationService
from app.models.optimization import OptimizationResponse
from pydantic import BaseModel

router = APIRouter()

class ScanRequest(BaseModel):
    connection_string: str
    with_ai: bool = False  # set True to get AI explanations (slower)

@router.post("/scan", response_model=OptimizationResponse)
async def run_optimization_scan(request: ScanRequest):
    try:
        service = OptimizationService(request.connection_string)
        # with_ai=False → instant results; with_ai=True → parallel AI enrichment
        recommendations = await service.generate_recommendations(with_ai=request.with_ai)
        return OptimizationResponse(recommendations=recommendations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.models.apply import ApplyOptimizationRequest
from app.services.db_service import DBService

@router.post("/apply")
def apply_optimization(request: ApplyOptimizationRequest):
    try:
        DBService.apply_change(request.sql_command, request.connection_string)
        return {"success": True, "message": "Applied successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
