"""
Collaboration API — DB Lighthouse
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os, json, uuid, datetime

router = APIRouter()

# ── Path helpers ──────────────────────────────────────────────────────────────

_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data"
)
_COLLABS_FILE = os.path.join(_DATA_DIR, "collaborations.json")
_APPROVALS_FILE = os.path.join(_DATA_DIR, "pending_approvals.json")
_AUDIT_FILE = os.path.join(_DATA_DIR, "audit_logs.json")

def _ensure_data_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)

def _firebase_configured() -> bool:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "../serviceAccountKey.json")
    if not os.path.isabs(cred_path):
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cred_path = os.path.join(base, cred_path.lstrip("./"))
    return os.path.exists(cred_path)

def _get_db():
    from app.core.firebase_admin import get_firestore_client
    return get_firestore_client()

def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"

# ── Local JSON helpers ────────────────────────────────────────────────────────

def _load_json(path: str) -> dict:
    _ensure_data_dir()
    if not os.path.exists(path): return {}
    try:
        with open(path, "r", encoding="utf-8") as f: return json.load(f)
    except Exception: return {}

def _save_json(path: str, data: dict):
    _ensure_data_dir()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _log_audit(project_id: str, owner_uid: str, action: str, details: str, user_email: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            from google.cloud.firestore_v1 import SERVER_TIMESTAMP
            db.collection("audit_logs").document().set({
                "project_id": project_id,
                "owner_uid": owner_uid,
                "action": action,
                "details": details,
                "user_email": user_email,
                "created_at": SERVER_TIMESTAMP
            })
        except Exception:
            pass
    else:
        try:
            logs = _load_json(_AUDIT_FILE)
            log_id = str(uuid.uuid4())
            logs[log_id] = {
                "project_id": project_id,
                "owner_uid": owner_uid,
                "action": action,
                "details": details,
                "user_email": user_email,
                "created_at": _now_iso()
            }
            _save_json(_AUDIT_FILE, logs)
        except Exception:
            pass


# ── Request / Response models ─────────────────────────────────────────────────

class InviteRequest(BaseModel):
    owner_uid: str
    project_id: str
    project_name: str
    connection_string: str
    connection_type: str
    invited_email: str

class RemoveCollaboratorRequest(BaseModel):
    owner_uid: str
    project_id: str
    invite_id: str
    
class AcceptRejectInviteRequest(BaseModel):
    invite_id: str

class PendingChangeRequest(BaseModel):
    owner_uid: str
    project_id: str
    project_name: str
    submitted_by_uid: str
    submitted_by_email: str
    sql_patch: str
    description: Optional[str] = ""
    connection_string: str

class ApproveRejectRequest(BaseModel):
    owner_uid: str
    approval_id: str
    connection_string: str
    sql_patch: str

class RejectRequest(BaseModel):
    owner_uid: str
    approval_id: str

# ══════════════════════════════════════════════════════════════════════════════
# INVITE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/invite")
async def invite_collaborator(req: InviteRequest):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            from google.cloud.firestore_v1 import SERVER_TIMESTAMP
            existing = (
                db.collection("collaborations")
                .where("owner_uid", "==", req.owner_uid)
                .where("project_id", "==", req.project_id)
                .where("invited_email", "==", req.invited_email.lower())
                .stream()
            )
            for doc in existing:
                if doc.to_dict().get("status") in ["active", "pending"]:
                    return {"status": "already_invited"}
            doc_ref = db.collection("collaborations").document()
            doc_ref.set({
                "owner_uid":         req.owner_uid,
                "project_id":        req.project_id,
                "project_name":      req.project_name,
                "connection_string": req.connection_string,
                "connection_type":   req.connection_type,
                "invited_email":     req.invited_email.lower(),
                "status":            "pending",
                "created_at":        SERVER_TIMESTAMP,
            })
            _log_audit(req.project_id, req.owner_uid, "INVITE_SENT", f"Invited {req.invited_email.lower()}", req.owner_uid)
            return {"status": "invited", "invite_id": doc_ref.id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        collabs = _load_json(_COLLABS_FILE)
        email_lower = req.invited_email.lower()
        for v in collabs.values():
            if (v.get("owner_uid") == req.owner_uid
                    and v.get("project_id") == req.project_id
                    and v.get("invited_email") == email_lower
                    and v.get("status") in ["active", "pending"]):
                return {"status": "already_invited"}

        invite_id = str(uuid.uuid4())
        collabs[invite_id] = {
            "owner_uid":         req.owner_uid,
            "project_id":        req.project_id,
            "project_name":      req.project_name,
            "connection_string": req.connection_string,
            "connection_type":   req.connection_type,
            "invited_email":     email_lower,
            "status":            "pending",
            "created_at":        _now_iso(),
        }
        _save_json(_COLLABS_FILE, collabs)
        _log_audit(req.project_id, req.owner_uid, "INVITE_SENT", f"Invited {email_lower}", req.owner_uid)
        return {"status": "invited", "invite_id": invite_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invites/{email}")
async def get_pending_invites(email: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            docs = (
                db.collection("collaborations")
                .where("invited_email", "==", email.lower())
                .where("status", "==", "pending")
                .stream()
            )
            invites = []
            for doc in docs:
                d = doc.to_dict()
                invites.append({
                    "invite_id":         doc.id,
                    "owner_uid":         d.get("owner_uid"),
                    "project_id":        d.get("project_id"),
                    "project_name":      d.get("project_name"),
                    "invited_email":     d.get("invited_email"),
                })
            return {"invites": invites}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        collabs = _load_json(_COLLABS_FILE)
        email_lower = email.lower()
        invites = []
        for invite_id, v in collabs.items():
            if v.get("invited_email") == email_lower and v.get("status") == "pending":
                invites.append({
                    "invite_id":         invite_id,
                    "owner_uid":         v.get("owner_uid"),
                    "project_id":        v.get("project_id"),
                    "project_name":      v.get("project_name"),
                    "invited_email":     v.get("invited_email"),
                })
        return {"invites": invites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invites/accept")
async def accept_invite(req: AcceptRejectInviteRequest):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            doc_ref = db.collection("collaborations").document(req.invite_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Invite not found")
            d = doc.to_dict()
            doc_ref.update({"status": "active"})
            _log_audit(d.get("project_id"), d.get("owner_uid"), "INVITE_ACCEPTED", f"{d.get('invited_email')} joined the project", d.get("invited_email"))
            return {"status": "active"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    try:
        collabs = _load_json(_COLLABS_FILE)
        if req.invite_id not in collabs:
            raise HTTPException(status_code=404, detail="Invite not found")
        collabs[req.invite_id]["status"] = "active"
        _save_json(_COLLABS_FILE, collabs)
        d = collabs[req.invite_id]
        _log_audit(d.get("project_id"), d.get("owner_uid"), "INVITE_ACCEPTED", f"{d.get('invited_email')} joined the project", d.get("invited_email"))
        return {"status": "active"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invites/reject")
async def reject_invite(req: AcceptRejectInviteRequest):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            doc_ref = db.collection("collaborations").document(req.invite_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Invite not found")
            doc_ref.update({"status": "rejected"})
            return {"status": "rejected"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    try:
        collabs = _load_json(_COLLABS_FILE)
        if req.invite_id not in collabs:
            raise HTTPException(status_code=404, detail="Invite not found")
        collabs[req.invite_id]["status"] = "rejected"
        _save_json(_COLLABS_FILE, collabs)
        return {"status": "rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# SHARED PROJECTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/shared/{uid}")
async def get_shared_projects(uid: str, email: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            docs = (db.collection("collaborations")
                    .where("invited_email", "==", email.lower())
                    .where("status", "==", "active").stream())
            projects = []
            for doc in docs:
                d = doc.to_dict()
                projects.append({
                    "invite_id":         doc.id,
                    "owner_uid":         d.get("owner_uid"),
                    "project_id":        d.get("project_id"),
                    "project_name":      d.get("project_name"),
                    "connection_string": d.get("connection_string"),
                    "connection_type":   d.get("connection_type"),
                    "invited_email":     d.get("invited_email"),
                })
            return {"projects": projects}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        collabs = _load_json(_COLLABS_FILE)
        email_lower = email.lower()
        projects = []
        for invite_id, v in collabs.items():
            if v.get("invited_email") == email_lower and v.get("status") == "active":
                projects.append({
                    "invite_id":         invite_id,
                    "owner_uid":         v.get("owner_uid"),
                    "project_id":        v.get("project_id"),
                    "project_name":      v.get("project_name"),
                    "connection_string": v.get("connection_string"),
                    "connection_type":   v.get("connection_type"),
                    "invited_email":     v.get("invited_email"),
                })
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# MEMBERS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/members/{owner_uid}/{project_id}")
async def get_project_members(owner_uid: str, project_id: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            docs = (db.collection("collaborations")
                    .where("owner_uid", "==", owner_uid)
                    .where("project_id", "==", project_id)
                    .where("status", "==", "active").stream())
            return {"members": [{"invite_id": d.id, "invited_email": d.to_dict().get("invited_email")} for d in docs]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        collabs = _load_json(_COLLABS_FILE)
        members = []
        for invite_id, v in collabs.items():
            if v.get("owner_uid") == owner_uid and v.get("project_id") == project_id and v.get("status") == "active":
                members.append({"invite_id": invite_id, "invited_email": v.get("invited_email")})
        return {"members": members}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# REMOVE COLLABORATOR
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/remove")
async def remove_collaborator(req: RemoveCollaboratorRequest):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            doc_ref = db.collection("collaborations").document(req.invite_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Invite not found")
            if doc.to_dict().get("owner_uid") != req.owner_uid:
                raise HTTPException(status_code=403, detail="Only the project owner can remove collaborators")
            doc_ref.delete()
            return {"status": "removed"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        collabs = _load_json(_COLLABS_FILE)
        if req.invite_id not in collabs:
            raise HTTPException(status_code=404, detail="Invite not found")
        if collabs[req.invite_id].get("owner_uid") != req.owner_uid:
            raise HTTPException(status_code=403, detail="Only the project owner can remove collaborators")
        del collabs[req.invite_id]
        _save_json(_COLLABS_FILE, collabs)
        return {"status": "removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# SUBMIT PENDING CHANGE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/pending-change")
async def submit_pending_change(req: PendingChangeRequest):
    use_firebase = _firebase_configured()

    if use_firebase:
        try:
            db = _get_db()
            from google.cloud.firestore_v1 import SERVER_TIMESTAMP
            doc_ref = db.collection("pending_approvals").document()
            doc_ref.set({
                "owner_uid":          req.owner_uid,
                "project_id":         req.project_id,
                "project_name":       req.project_name,
                "submitted_by_uid":   req.submitted_by_uid,
                "submitted_by_email": req.submitted_by_email,
                "sql_patch":          req.sql_patch,
                "description":        req.description or "",
                "connection_string":  req.connection_string,
                "status":             "pending",
                "created_at":         SERVER_TIMESTAMP,
            })
            _log_audit(req.project_id, req.owner_uid, "PATCH_SUBMITTED", f"{req.submitted_by_email} proposed a change", req.submitted_by_email)
            return {"status": "submitted", "approval_id": doc_ref.id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        approvals = _load_json(_APPROVALS_FILE)
        approval_id = str(uuid.uuid4())
        approvals[approval_id] = {
            "owner_uid":          req.owner_uid,
            "project_id":         req.project_id,
            "project_name":       req.project_name,
            "submitted_by_uid":   req.submitted_by_uid,
            "submitted_by_email": req.submitted_by_email,
            "sql_patch":          req.sql_patch,
            "description":        req.description or "",
            "connection_string":  req.connection_string,
            "status":             "pending",
            "created_at":         _now_iso(),
        }
        _save_json(_APPROVALS_FILE, approvals)
        _log_audit(req.project_id, req.owner_uid, "PATCH_SUBMITTED", f"{req.submitted_by_email} proposed a change", req.submitted_by_email)
        return {"status": "submitted", "approval_id": approval_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# GET PENDING CHANGES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/pending/{owner_uid}/{project_id}")
async def get_pending_changes(owner_uid: str, project_id: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            docs = (db.collection("pending_approvals")
                    .where("owner_uid", "==", owner_uid)
                    .where("project_id", "==", project_id)
                    .where("status", "==", "pending").stream())
            pending = []
            for doc in docs:
                d = doc.to_dict()
                created = d.get("created_at")
                pending.append({
                    "approval_id":        doc.id,
                    "submitted_by_email": d.get("submitted_by_email"),
                    "submitted_by_uid":   d.get("submitted_by_uid"),
                    "sql_patch":          d.get("sql_patch"),
                    "description":        d.get("description"),
                    "connection_string":  d.get("connection_string"),
                    "created_at":         created.isoformat() if hasattr(created, "isoformat") else str(created) if created else None,
                })
            return {"pending": pending}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        approvals = _load_json(_APPROVALS_FILE)
        pending = []
        for approval_id, v in approvals.items():
            if v.get("owner_uid") == owner_uid and v.get("project_id") == project_id and v.get("status") == "pending":
                pending.append({
                    "approval_id":        approval_id,
                    "submitted_by_email": v.get("submitted_by_email"),
                    "submitted_by_uid":   v.get("submitted_by_uid"),
                    "sql_patch":          v.get("sql_patch"),
                    "description":        v.get("description"),
                    "connection_string":  v.get("connection_string"),
                    "created_at":         v.get("created_at"),
                })
        return {"pending": pending}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending-count/{owner_uid}")
async def get_pending_count(owner_uid: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            docs = (db.collection("pending_approvals")
                    .where("owner_uid", "==", owner_uid)
                    .where("status", "==", "pending").stream())
            return {"count": sum(1 for _ in docs)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        approvals = _load_json(_APPROVALS_FILE)
        count = sum(1 for v in approvals.values() if v.get("owner_uid") == owner_uid and v.get("status") == "pending")
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# APPROVE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/approve")
async def approve_change(req: ApproveRejectRequest):
    use_firebase = _firebase_configured()
    async def _run_safety_and_apply():
        try:
            from app.services.migration_analyzer import simulate_migration_impact
            safety = simulate_migration_impact(req.connection_string, req.sql_patch)
            if not safety["is_safe"]:
                raise HTTPException(status_code=422, detail={
                    "message": "Migration blocked by safety analysis",
                    "warning_message": safety["warning_message"],
                    "warnings": safety["warnings"],
                })
        except ImportError:
            pass 
        from app.services.db_service import DBService
        DBService.apply_change(req.sql_patch, req.connection_string)

    if use_firebase:
        try:
            db = _get_db()
            doc_ref = db.collection("pending_approvals").document(req.approval_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Approval not found")
            d = doc.to_dict()
            if d.get("owner_uid") != req.owner_uid:
                raise HTTPException(status_code=403, detail="Only the project owner can approve changes")
            await _run_safety_and_apply()
            doc_ref.update({"status": "approved"})
            _log_audit(d.get("project_id"), req.owner_uid, "PATCH_APPROVED", f"Admin approved change proposed by {d.get('submitted_by_email')}", "Admin")
            return {"status": "approved", "message": "Change applied successfully"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        approvals = _load_json(_APPROVALS_FILE)
        if req.approval_id not in approvals:
            raise HTTPException(status_code=404, detail="Approval not found")
        d = approvals[req.approval_id]
        if d.get("owner_uid") != req.owner_uid:
            raise HTTPException(status_code=403, detail="Only the project owner can approve changes")
        await _run_safety_and_apply()
        approvals[req.approval_id]["status"] = "approved"
        _save_json(_APPROVALS_FILE, approvals)
        _log_audit(d.get("project_id"), req.owner_uid, "PATCH_APPROVED", f"Admin approved change proposed by {d.get('submitted_by_email')}", "Admin")
        return {"status": "approved", "message": "Change applied successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ══════════════════════════════════════════════════════════════════════════════
# REJECT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/reject")
async def reject_change(req: RejectRequest):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            doc_ref = db.collection("pending_approvals").document(req.approval_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Approval not found")
            d = doc.to_dict()
            if d.get("owner_uid") != req.owner_uid:
                raise HTTPException(status_code=403, detail="Only the project owner can reject changes")
            doc_ref.update({"status": "rejected"})
            _log_audit(d.get("project_id"), req.owner_uid, "PATCH_REJECTED", f"Admin rejected change proposed by {d.get('submitted_by_email')}", "Admin")
            return {"status": "rejected"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        approvals = _load_json(_APPROVALS_FILE)
        if req.approval_id not in approvals:
            raise HTTPException(status_code=404, detail="Approval not found")
        d = approvals[req.approval_id]
        if d.get("owner_uid") != req.owner_uid:
            raise HTTPException(status_code=403, detail="Only the project owner can reject changes")
        approvals[req.approval_id]["status"] = "rejected"
        _save_json(_APPROVALS_FILE, approvals)
        _log_audit(d.get("project_id"), req.owner_uid, "PATCH_REJECTED", f"Admin rejected change proposed by {d.get('submitted_by_email')}", "Admin")
        return {"status": "rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT LOGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/audit-logs/{project_id}")
async def get_audit_logs(project_id: str):
    use_firebase = _firebase_configured()
    if use_firebase:
        try:
            db = _get_db()
            docs = (db.collection("audit_logs")
                    .where("project_id", "==", project_id)
                    .order_by("created_at", direction="DESCENDING")
                    .limit(50)
                    .stream())
            logs = []
            for doc in docs:
                d = doc.to_dict()
                created = d.get("created_at")
                logs.append({
                    "log_id": doc.id,
                    "action": d.get("action"),
                    "details": d.get("details"),
                    "user_email": d.get("user_email"),
                    "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created) if created else None
                })
            return {"logs": logs}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        all_logs = _load_json(_AUDIT_FILE)
        project_logs = []
        for log_id, v in all_logs.items():
            if v.get("project_id") == project_id:
                project_logs.append({
                    "log_id": log_id,
                    "action": v.get("action"),
                    "details": v.get("details"),
                    "user_email": v.get("user_email"),
                    "created_at": v.get("created_at")
                })
        # Sort descending by created_at
        project_logs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"logs": project_logs[:50]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
