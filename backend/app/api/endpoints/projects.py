from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

router = APIRouter()


def _firebase_configured() -> bool:
    """Check if Firebase credentials are available without throwing."""
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "../serviceAccountKey.json")
    if not os.path.isabs(cred_path):
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cred_path = os.path.join(base, cred_path.lstrip("./"))
    return os.path.exists(cred_path)


class ProjectIn(BaseModel):
    uid: str
    projectName: str
    connectionType: str          # 'connection' | 'file' | 'ai' | 'github' | 'mongodb' | 'firebase'
    connectionString: str
    sqlContent: Optional[str] = ""

    # ── Rich metadata ──────────────────────────────────────────────────────
    fileName: Optional[str] = None    # e.g. "chinook.sql"
    fileType: Optional[str] = None    # MIME or extension, e.g. "text/x-sql"
    dialect: Optional[str] = None     # e.g. "postgresql", "mysql", "sqlite"
    dbHost: Optional[str] = None      # hostname extracted from conn string
    dbName: Optional[str] = None      # database name extracted from conn string
    description: Optional[str] = None # AI prompt text
    githubUrl: Optional[str] = None   # original GitHub URL
    connectedAt: Optional[str] = None # ISO 8601 timestamp from frontend


@router.post("")
async def save_project(project: ProjectIn):
    """Save a database project to Firestore using Admin SDK."""
    if not _firebase_configured():
        return {"id": "local", "status": "saved_locally"}
    try:
        from app.core.firebase_admin import get_firestore_client
        from google.cloud.firestore_v1 import SERVER_TIMESTAMP
        db = get_firestore_client()
        doc_ref = (
            db.collection("users")
            .document(project.uid)
            .collection("projects")
            .document()
        )

        # Build the document — only include optional fields when they have a value
        doc_data: dict = {
            "projectName":    project.projectName,
            "connectionType": project.connectionType,
            "connectionString": project.connectionString,
            "sqlContent":     project.sqlContent or "",
            "createdAt":      SERVER_TIMESTAMP,
        }

        # Rich metadata — stored only when present so existing documents
        # remain backward-compatible (no null/None pollution).
        if project.fileName:
            doc_data["fileName"] = project.fileName
        if project.fileType:
            doc_data["fileType"] = project.fileType
        if project.dialect:
            doc_data["dialect"] = project.dialect
        if project.dbHost:
            doc_data["dbHost"] = project.dbHost
        if project.dbName:
            doc_data["dbName"] = project.dbName
        if project.description:
            doc_data["description"] = project.description
        if project.githubUrl:
            doc_data["githubUrl"] = project.githubUrl
        if project.connectedAt:
            doc_data["connectedAt"] = project.connectedAt

        doc_ref.set(doc_data)
        return {"id": doc_ref.id, "status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{uid}")
async def get_projects(uid: str):
    """Get all database projects for a user from Firestore using Admin SDK."""
    if not _firebase_configured():
        return {"projects": []}
    try:
        from app.core.firebase_admin import get_firestore_client
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
                "id":               doc.id,
                "projectName":      data.get("projectName", ""),
                "connectionType":   data.get("connectionType", "connection"),
                "connectionString": data.get("connectionString", ""),
                "sqlContent":       data.get("sqlContent", ""),
                # Rich metadata — may be absent in older documents
                "fileName":         data.get("fileName"),
                "fileType":         data.get("fileType"),
                "dialect":          data.get("dialect"),
                "dbHost":           data.get("dbHost"),
                "dbName":           data.get("dbName"),
                "description":      data.get("description"),
                "githubUrl":        data.get("githubUrl"),
                "connectedAt":      data.get("connectedAt"),
            })
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{uid}/{project_id}")
async def delete_project(uid: str, project_id: str):
    """Delete a database project from Firestore using Admin SDK."""
    if not _firebase_configured():
        return {"status": "deleted", "id": project_id}
    try:
        from app.core.firebase_admin import get_firestore_client
        db = get_firestore_client()
        db.collection("users").document(uid).collection("projects").document(project_id).delete()
        return {"status": "deleted", "id": project_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
