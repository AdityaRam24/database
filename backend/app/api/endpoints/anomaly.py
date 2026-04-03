"""
Anomaly Detection API — /api/anomaly/*
Endpoints for metric collection, anomaly detection, and history retrieval.
"""

"""
Anomaly Detection API — /api/anomaly/*
Endpoints for metric collection, anomaly detection, and history retrieval.
Supports PostgreSQL (full) and Firestore (document-count-based).
"""

import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# Reuse the same baselines dir as AnomalyDetector
_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
)
_FIRESTORE_BASELINES = os.path.join(_DATA_DIR, "firestore_anomaly_baselines.json")

Z_WARNING = 2.0
Z_CRITICAL = 3.0


def _is_firebase(conn: str) -> bool:
    return '"private_key"' in conn and '"project_id"' in conn


def _load_fs_baselines() -> Dict[str, Any]:
    os.makedirs(_DATA_DIR, exist_ok=True)
    if os.path.exists(_FIRESTORE_BASELINES):
        try:
            with open(_FIRESTORE_BASELINES) as f:
                return json.load(f)
        except Exception:
            pass
    return {"snapshots": [], "last_updated": None}


def _save_fs_baselines(data: Dict[str, Any]):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_FIRESTORE_BASELINES, "w") as f:
        json.dump(data, f, indent=2, default=str)


class AnomalyRequest(BaseModel):
    connection_string: str


@router.post("/collect")
def collect_metrics(req: AnomalyRequest):
    """Snapshot current DB metrics and update rolling baselines."""
    if _is_firebase(req.connection_string):
        try:
            from app.services.firebase_service import FirebaseService
            metrics = FirebaseService(req.connection_string).collect_anomaly_metrics()
            snapshot = {"timestamp": datetime.utcnow().isoformat(), "metrics": metrics}
            bl = _load_fs_baselines()
            bl["snapshots"].append(snapshot)
            cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
            bl["snapshots"] = [s for s in bl["snapshots"] if s["timestamp"] >= cutoff]
            bl["last_updated"] = snapshot["timestamp"]
            _save_fs_baselines(bl)
            return {"success": True, "snapshot": snapshot}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

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
    if _is_firebase(req.connection_string):
        try:
            bl = _load_fs_baselines()
            snapshots = bl.get("snapshots", [])
            if len(snapshots) < 3:
                return {
                    "status": "insufficient_data",
                    "message": f"Need at least 3 snapshots for anomaly detection. Currently have {len(snapshots)}.",
                    "anomalies": [],
                    "metrics_summary": {},
                    "db_type": "firestore",
                }

            latest = snapshots[-1]["metrics"]
            anomalies = []
            metrics_summary = {}

            # Total document count anomaly
            for key, label in [("total_documents", "Total Documents"), ("total_collections", "Collection Count")]:
                values = [s["metrics"].get(key, 0) for s in snapshots[:-1] if key in s["metrics"]]
                current = latest.get(key, 0)
                if len(values) < 2:
                    continue
                mean = float(np.mean(values))
                std = float(np.std(values))
                z = float((current - mean) / std) if std > 0 else 0.0
                severity = "critical" if abs(z) >= Z_CRITICAL else "warning" if abs(z) >= Z_WARNING else "normal"
                entry = {
                    "metric": key, "label": label, "unit": "count",
                    "current_value": current, "mean": round(mean, 2), "std": round(std, 2),
                    "z_score": round(z, 2), "severity": severity,
                    "upper_bound": round(mean + Z_WARNING * std, 2),
                    "lower_bound": round(max(0, mean - Z_WARNING * std), 2),
                    "deviation_pct": round(abs(current - mean) / mean * 100, 1) if mean > 0 else 0.0,
                }
                metrics_summary[key] = entry
                if severity != "normal":
                    entry["root_cause"] = f"{label} changed by {entry['deviation_pct']}% from 7-day baseline."
                    anomalies.append(entry)

            # Per-collection document count anomalies
            for col, current_count in latest.get("doc_counts", {}).items():
                hist = [s["metrics"].get("doc_counts", {}).get(col) for s in snapshots[:-1] if s["metrics"].get("doc_counts", {}).get(col) is not None]
                if len(hist) < 2:
                    continue
                mean = float(np.mean(hist))
                std = float(np.std(hist))
                if std > 0:
                    z = float((current_count - mean) / std)
                    if abs(z) >= Z_WARNING:
                        anomalies.append({
                            "metric": f"collection_{col}", "label": f"Collection: {col}", "unit": "documents",
                            "current_value": current_count, "mean": round(mean, 2), "std": round(std, 2),
                            "z_score": round(z, 2),
                            "severity": "critical" if abs(z) >= Z_CRITICAL else "warning",
                            "deviation_pct": round(abs(current_count - mean) / mean * 100, 1) if mean > 0 else 0,
                            "root_cause": f"Collection '{col}' document count changed by {round(abs(current_count - mean) / mean * 100, 1)}% from baseline. Possible bulk write or data deletion.",
                        })

            return {
                "status": "analyzed", "snapshot_count": len(snapshots),
                "anomalies": sorted(anomalies, key=lambda a: abs(a["z_score"]), reverse=True),
                "metrics_summary": metrics_summary,
                "last_updated": bl.get("last_updated"),
                "db_type": "firestore",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

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
    if _is_firebase(req.connection_string):
        try:
            bl = _load_fs_baselines()
            snapshots = bl.get("snapshots", [])
            series: Dict[str, list] = {"timestamps": [], "total_documents": [], "total_collections": []}
            for snap in snapshots:
                series["timestamps"].append(snap["timestamp"])
                m = snap["metrics"]
                series["total_documents"].append(m.get("total_documents", 0))
                series["total_collections"].append(m.get("total_collections", 0))
            bands: Dict[str, Any] = {}
            for key in ["total_documents", "total_collections"]:
                vals = series[key]
                if len(vals) >= 3:
                    mean = float(np.mean(vals))
                    std = float(np.std(vals))
                    bands[key] = {"mean": round(mean, 2), "upper": round(mean + Z_WARNING * std, 2), "lower": round(max(0, mean - Z_WARNING * std), 2)}
                else:
                    bands[key] = {"mean": 0, "upper": 0, "lower": 0}
            return {"series": series, "confidence_bands": bands, "snapshot_count": len(snapshots), "db_type": "firestore"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        from app.services.anomaly_detector import AnomalyDetector
        detector = AnomalyDetector(req.connection_string)
        return detector.get_metric_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
