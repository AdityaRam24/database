from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.migration_analyzer import simulate_migration_impact
from app.services.db_service import DBService
from app.services.ai_service import AIService
from app.services.schema_analysis import SchemaAnalysisService

router = APIRouter()
db_service = DBService()


def _is_firebase(conn: str) -> bool:
    return '"private_key"' in conn and '"project_id"' in conn


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
    """Generate a SQL patch (PostgreSQL) or Firestore structure advice from natural language."""
    try:
        if _is_firebase(req.connection_string):
            from app.services.firebase_service import FirebaseService
            graph_data = FirebaseService(req.connection_string).get_schema_graph_data()
        else:
            graph_data = SchemaAnalysisService(req.connection_string).get_schema_graph_data()

        schema_lines = []
        for node in graph_data.get("nodes", []):
            label = node["data"]["label"]
            columns = node["data"].get("columns", [])
            col_strs = [f"  - {c['name']} ({c['type']}{'  PK' if c['is_pk'] else ''})" for c in columns]
            schema_lines.append(f"{'Collection' if _is_firebase(req.connection_string) else 'Table'}: {label}")
            schema_lines.extend(col_strs)
        schema_context = "\n".join(schema_lines)

        ai = AIService()

        if _is_firebase(req.connection_string):
            # For Firestore, generate structural advice / migration guidance
            prompt = f"""You are a Firebase Firestore expert. The user wants to make the following change to their Firestore database.
Provide ONLY the Firebase CLI commands, Firebase Admin SDK code, or Firestore Console steps needed to implement this change.
No SQL. No explanations beyond the steps themselves.

Firestore Schema:
{schema_context}

Requested Change: {req.description}"""
            from app.services.ai_service import AIService as _AI
            result = await _AI()._call_ai(
                [{"role": "system", "content": "You are a Firestore migration expert. Return only actionable steps or code."},
                 {"role": "user", "content": prompt}],
                max_tokens=600, temperature=0.1
            )
            return {"sql": result, "db_type": "firestore", "note": "These are Firestore migration steps, not SQL. Apply them manually."}

        sql = await ai.generate_governance_patch(req.description, schema_context)
        return {"sql": sql}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulate-migration")
def simulate_migration(req: SimulateMigrationRequest):
    """Run safety analysis on SQL patch against the shadow DB."""
    if _is_firebase(req.connection_string):
        return {
            "supported": False,
            "db_type": "firestore",
            "message": "Migration simulation uses PostgreSQL DDL parsing and is not available for Firestore. Review your Firestore structural changes manually before applying.",
            "is_safe": None,
            "warnings": [],
        }
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
    if _is_firebase(req.connection_string):
        return {
            "supported": False,
            "db_type": "firestore",
            "message": "Patch application is not available for Firestore. Use the Firebase CLI (`firebase deploy --only firestore:rules`) or Admin SDK to apply Firestore changes.",
        }
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
