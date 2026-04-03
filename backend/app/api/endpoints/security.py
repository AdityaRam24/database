"""
Security API — /api/security/*
Endpoints for synthetic data generation, prompt scanning, and guardrail status.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


def _is_firebase(conn: str) -> bool:
    return '"private_key"' in conn and '"project_id"' in conn


class SyntheticRequest(BaseModel):
    source_connection_string: str
    target_connection_string: Optional[str] = None


class PromptScanRequest(BaseModel):
    prompt: str


@router.post("/generate-synthetic")
def generate_synthetic(req: SyntheticRequest):
    """Generate a synthetic mirror of the database with PII replaced."""
    if _is_firebase(req.source_connection_string):
        return {
            "supported": False,
            "db_type": "firestore",
            "message": (
                "Synthetic data generation copies schema + data into a PostgreSQL shadow DB and is not available "
                "for Firestore. To work with anonymised Firestore data, export a collection, anonymise it with "
                "a script, and re-import to a test project."
            ),
        }
    try:
        from app.services.synthetic_data import SyntheticDataService
        from app.core.config import settings
        target = req.target_connection_string or settings.SHADOW_DB_URL
        service = SyntheticDataService(req.source_connection_string, target)
        result = service.generate_synthetic_mirror()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect-pii")
def detect_pii(req: SyntheticRequest):
    """Scan the database and identify columns/fields likely containing PII."""
    if _is_firebase(req.source_connection_string):
        try:
            from app.services.firebase_service import FirebaseService
            service = FirebaseService(req.source_connection_string)
            pii_map = service.detect_pii_fields()
            total_fields = sum(len(v) for v in pii_map.values())
            return {
                "pii_columns": pii_map,
                "tables_with_pii": len(pii_map),
                "total_pii_columns": total_fields,
                "db_type": "firestore",
                "note": "PII detected by scanning Firestore field names against common PII patterns.",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        from app.services.synthetic_data import SyntheticDataService
        from app.core.config import settings
        target = req.target_connection_string or settings.SHADOW_DB_URL
        service = SyntheticDataService(req.source_connection_string, target)
        pii_map = service.detect_pii_columns()
        total_cols = sum(len(v) for v in pii_map.values())
        return {
            "pii_columns": pii_map,
            "tables_with_pii": len(pii_map),
            "total_pii_columns": total_cols
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan-prompt")
def scan_prompt(req: PromptScanRequest):
    """Scan a natural language prompt for injection/jailbreak attempts."""
    try:
        from app.services.prompt_firewall import scan_prompt as firewall_scan
        return firewall_scan(req.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/guardrail-status")
def guardrail_status():
    """Return current guardrail configuration status."""
    return {
        "auto_limit": {
            "enabled": True,
            "description": "All SELECT queries automatically get LIMIT 100 appended",
            "status": "active"
        },
        "blocklist": {
            "enabled": True,
            "blocked_commands": ["DROP DATABASE", "DROP TABLE", "TRUNCATE", "DELETE FROM"],
            "description": "Destructive SQL commands are blocked unless MFA-authorized",
            "status": "active"
        },
        "prompt_firewall": {
            "enabled": True,
            "categories": ["instruction_override", "sql_injection", "destructive_intent", "social_engineering"],
            "description": "Heuristic scanner blocks prompt injection attempts before AI processing",
            "status": "active"
        },
        "synthetic_data": {
            "enabled": True,
            "description": "One-click PII replacement for safe testing environments",
            "status": "available"
        }
    }
