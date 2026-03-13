"""
Anomaly Detection API — /api/anomaly/*
Endpoints for metric collection, anomaly detection, and history retrieval.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class AnomalyRequest(BaseModel):
    connection_string: str


@router.post("/collect")
def collect_metrics(req: AnomalyRequest):
    """Snapshot current DB metrics and update rolling baselines."""
    try:
        from app.services.anomaly_detector import AnomalyDetector
        detector = AnomalyDetector(req.connection_string)
        snapshot = detector.collect_metrics()
        return {"success": True, "snapshot": snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect")
def detect_anomalies(req: AnomalyRequest):
    """Detect anomalies using Z-Score analysis against rolling baselines."""
    try:
        from app.services.anomaly_detector import AnomalyDetector
        detector = AnomalyDetector(req.connection_string)
        result = detector.detect_anomalies()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
def get_metric_history(req: AnomalyRequest):
    """Return metric time-series for chart rendering with confidence bands."""
    try:
        from app.services.anomaly_detector import AnomalyDetector
        detector = AnomalyDetector(req.connection_string)
        return detector.get_metric_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
