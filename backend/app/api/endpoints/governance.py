from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.migration_analyzer import simulate_migration_impact
from app.services.db_service import DBService
from app.services.ai_service import AIService
from app.services.schema_analysis import SchemaAnalysisService

router = APIRouter()
db_service = DBService()


class SimulateMigrationRequest(BaseModel):
    connection_string: str
    sql_patch: str


class ApplyPatchRequest(BaseModel):
    connection_string: str
    sql_patch: str


class GeneratePatchRequest(BaseModel):
    connection_string: str
    description: str


@router.post("/ai-generate-patch")
async def ai_generate_patch(req: GeneratePatchRequest):
    """Generate a SQL patch from natural language using AI."""
    try:
        # Get schema context
        service = SchemaAnalysisService(req.connection_string)
        graph_data = service.get_schema_graph_data()
        schema_lines = []
        for node in graph_data.get("nodes", []):
            table_name = node["data"]["label"]
            columns = node["data"].get("columns", [])
            col_strs = [f"  - {c['name']} ({c['type']}{'  PK' if c['is_pk'] else ''})" for c in columns]
            schema_lines.append(f"Table: {table_name}")
            schema_lines.extend(col_strs)
        schema_context = "\n".join(schema_lines)

        ai = AIService()
        sql = await ai.generate_governance_patch(req.description, schema_context)
        return {"sql": sql}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulate-migration")
def simulate_migration(req: SimulateMigrationRequest):
    """Run safety analysis on SQL patch against the shadow DB."""
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
    """Apply a SQL patch to the shadow DB — ONLY after passing safety analysis."""
    try:
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
