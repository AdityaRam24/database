from fastapi import APIRouter, HTTPException
from app.services.optimization_service import OptimizationService
from app.models.optimization import OptimizationResponse
from pydantic import BaseModel

router = APIRouter()


def _is_firebase(conn: str) -> bool:
    return '"private_key"' in conn and '"project_id"' in conn


class ScanRequest(BaseModel):
    connection_string: str
    with_ai: bool = False  # set True to get AI explanations (slower)

@router.post("/scan")
async def run_optimization_scan(request: ScanRequest):
    if _is_firebase(request.connection_string):
        from app.services.firebase_service import FirebaseService
        try:
            service = FirebaseService(request.connection_string)
            recs = service.generate_optimization_recommendations()
            if request.with_ai and recs:
                from app.services.ai_service import AIService
                import asyncio
                ai = AIService()
                async def enrich(rec):
                    rec["explanation"] = await ai.generate_explanation(
                        finding=rec["description"],
                        context=f"Firestore collection: {rec['table']}"
                    )
                    return rec
                recs = await asyncio.gather(*[enrich(r) for r in recs])
            return {"recommendations": recs, "db_type": "firestore"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        service = OptimizationService(request.connection_string)
        recommendations = await service.generate_recommendations(with_ai=request.with_ai)
        return OptimizationResponse(recommendations=recommendations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.models.apply import ApplyOptimizationRequest
from app.services.db_service import DBService

@router.post("/apply")
def apply_optimization(request: ApplyOptimizationRequest):
    if _is_firebase(request.connection_string):
        return {
            "supported": False,
            "message": "Firestore optimizations (index creation) must be applied manually via the Firebase Console or the Firebase CLI. See the sql_command field in each recommendation for guidance.",
        }
    try:
        DBService.apply_change(request.sql_command, request.connection_string)
        return {"success": True, "message": "Applied successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
