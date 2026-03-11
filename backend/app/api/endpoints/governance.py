from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.migration_analyzer import simulate_migration_impact
from app.services.db_service import DBService

router = APIRouter()
db_service = DBService()


class SimulateMigrationRequest(BaseModel):
    connection_string: str
    sql_patch: str


class ApplyPatchRequest(BaseModel):
    connection_string: str
    sql_patch: str


@router.post("/simulate-migration")
def simulate_migration(req: SimulateMigrationRequest):
    """
    Run safety analysis on SQL patch against the shadow DB.
    Returns is_safe, warnings, and dependency breakdown.
    This MUST be called before /apply-patch.
    """
    try:
        result = simulate_migration_impact(req.connection_string, req.sql_patch)
        return {
            "is_safe": result["is_safe"],
            "blocked_reason": result.get("blocked_reason"),
            "warnings": result["warnings"],
            "warning_message": result["warning_message"],
            "broken_queries": result["broken_queries"],
            "dependent_indexes": result["dependent_indexes"],
            "dependent_views": result["dependent_views"],
            "dependent_functions": result["dependent_functions"],
            "dependency_breakdown": result["dependency_breakdown"],
            "parsed": result["parsed"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply-patch")
async def apply_patch(req: ApplyPatchRequest):
    """
    Apply a SQL patch to the shadow DB — ONLY after passing safety analysis.
    Re-runs safety check internally to prevent bypassing the UI.
    """
    try:
        # Mandatory safety gate — re-validate server-side
        safety = simulate_migration_impact(req.connection_string, req.sql_patch)
        if not safety["is_safe"]:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Migration blocked by safety analysis",
                    "warning_message": safety["warning_message"],
                    "warnings": safety["warnings"],
                }
            )

        result = DBService.apply_change(req.sql_patch, req.connection_string)
        return {"success": True, "message": "Patch applied successfully", "result": result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
