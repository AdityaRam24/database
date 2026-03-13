from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.core.firebase_admin import get_firestore_client
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class ProjectIn(BaseModel):
    uid: str
    projectName: str
    connectionType: str  # 'connection' | 'file' | 'ai' | 'github'
    sqlContent: Optional[str] = ""
    connectionString: str


@router.post("")
async def save_project(project: ProjectIn):
    """Save a database project to Firestore using Admin SDK."""
    try:
        db = get_firestore_client()
        doc_ref = (
            db.collection("users")
            .document(project.uid)
            .collection("projects")
            .document()
        )
        doc_ref.set({
            "projectName": project.projectName,
            "connectionType": project.connectionType,
            "sqlContent": project.sqlContent or "",
            "connectionString": project.connectionString,
            "createdAt": SERVER_TIMESTAMP,
        })
        return {"id": doc_ref.id, "status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{uid}")
async def get_projects(uid: str):
    """Get all database projects for a user from Firestore using Admin SDK."""
    try:
        db = get_firestore_client()
        docs = (
            db.collection("users")
            .document(uid)
            .collection("projects")
            .order_by("createdAt", direction="DESCENDING")
            .stream()
        )
        projects = []
        for doc in docs:
            data = doc.to_dict()
            projects.append({
                "id": doc.id,
                "projectName": data.get("projectName", ""),
                "connectionType": data.get("connectionType", "connection"),
                "sqlContent": data.get("sqlContent", ""),
                "connectionString": data.get("connectionString", ""),
            })
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{uid}/{project_id}")
async def delete_project(uid: str, project_id: str):
    """Delete a database project from Firestore using Admin SDK."""
    try:
        db = get_firestore_client()
        db.collection("users").document(uid).collection("projects").document(project_id).delete()
        return {"status": "deleted", "id": project_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
