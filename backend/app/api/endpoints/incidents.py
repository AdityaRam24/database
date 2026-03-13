"""
Incidents API — /api/incidents/*
Endpoints for collecting metrics to detect incidents and retrieving incident history.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class IncidentRequest(BaseModel):
    connection_string: str


@router.post("/scan")
def scan_incidents(req: IncidentRequest):
    """Snapshot current DB metrics and detect real-time incidents."""
    try:
        from app.services.incident_engine import IncidentEngine
        engine = IncidentEngine(req.connection_string)
        # First collect to update baselines
        engine.collect_metrics()
        # Then detect based on new snapshot
        result = engine.detect_incidents()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
def get_incident_history(req: IncidentRequest):
    """Return historical incidents for visualization in timeline."""
    try:
        from app.services.incident_engine import IncidentEngine
        engine = IncidentEngine(req.connection_string)
        return engine.get_incident_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summary")
def get_incident_summary(req: IncidentRequest):
    """Return summary counts of incidents by severity for dashboard badges."""
    try:
        from app.services.incident_engine import IncidentEngine
        engine = IncidentEngine(req.connection_string)
        return engine.get_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
