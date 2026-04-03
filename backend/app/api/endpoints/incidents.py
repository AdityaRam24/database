"""
Incidents API — /api/incidents/*
Supports PostgreSQL (full telemetry) and Firestore (collection growth + document count anomalies).
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

_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
)
_FS_INCIDENTS_FILE = os.path.join(_DATA_DIR, "firestore_incident_baselines.json")
Z_INCIDENT = 3.0


def _is_firebase(conn: str) -> bool:
    return '"private_key"' in conn and '"project_id"' in conn


def _load_fs_inc() -> Dict[str, Any]:
    os.makedirs(_DATA_DIR, exist_ok=True)
    if os.path.exists(_FS_INCIDENTS_FILE):
        try:
            with open(_FS_INCIDENTS_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {"snapshots": [], "incident_history": [], "last_updated": None}


def _save_fs_inc(data: Dict[str, Any]):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_FS_INCIDENTS_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


class IncidentRequest(BaseModel):
    connection_string: str


@router.post("/scan")
def scan_incidents(req: IncidentRequest):
    """Snapshot current DB metrics and detect real-time incidents."""
    if _is_firebase(req.connection_string):
        try:
            from app.services.firebase_service import FirebaseService
            metrics = FirebaseService(req.connection_string).collect_anomaly_metrics()
            snapshot = {"timestamp": datetime.utcnow().isoformat(), "metrics": metrics}

            bl = _load_fs_inc()
            bl["snapshots"].append(snapshot)
            cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
            bl["snapshots"] = [s for s in bl["snapshots"] if s["timestamp"] >= cutoff]
            bl["last_updated"] = snapshot["timestamp"]

            snapshots = bl["snapshots"]
            incidents = []

            if len(snapshots) >= 3:
                latest = snapshots[-1]["metrics"]

                # Detect per-collection growth anomalies
                for col, current_count in latest.get("doc_counts", {}).items():
                    hist = [s["metrics"].get("doc_counts", {}).get(col) for s in snapshots[:-1] if s["metrics"].get("doc_counts", {}).get(col) is not None]
                    if len(hist) < 2:
                        continue
                    mean = float(np.mean(hist))
                    std = float(np.std(hist))
                    if std > 0:
                        z = float((current_count - mean) / std)
                        if z > Z_INCIDENT and (current_count - mean) > 100:
                            deviation_pct = round((current_count - mean) / mean * 100, 1) if mean > 0 else 0
                            severity_score = min(100, int(z * 15 + 20))
                            level = "CRITICAL" if severity_score >= 80 else "HIGH" if severity_score >= 60 else "MEDIUM"
                            incidents.append({
                                "id": f"INC-FS-{int(datetime.utcnow().timestamp())}-{hash(col) % 10000}",
                                "type": "Collection Growth Anomaly",
                                "affected_table": col,
                                "detected_at": datetime.utcnow().isoformat(),
                                "root_cause": f"Collection '{col}' grew by {deviation_pct}% from baseline ({int(mean)} → {current_count} docs). Possible bulk write or runaway data creation.",
                                "severity_score": severity_score,
                                "severity_level": level,
                                "metrics": {"z_score": round(z, 2), "deviation_pct": deviation_pct},
                                "db_type": "firestore",
                            })

                # Detect total document count spike
                hist_total = [s["metrics"].get("total_documents", 0) for s in snapshots[:-1]]
                current_total = latest.get("total_documents", 0)
                if len(hist_total) >= 2:
                    mean_t = float(np.mean(hist_total))
                    std_t = float(np.std(hist_total))
                    if std_t > 0:
                        z_t = float((current_total - mean_t) / std_t)
                        if z_t > Z_INCIDENT:
                            incidents.append({
                                "id": f"INC-FS-TOTAL-{int(datetime.utcnow().timestamp())}",
                                "type": "Total Document Spike",
                                "affected_table": "Global",
                                "detected_at": datetime.utcnow().isoformat(),
                                "root_cause": f"Total Firestore document count jumped to {current_total} (baseline avg: {int(mean_t)}).",
                                "severity_score": min(100, int(z_t * 12 + 30)),
                                "severity_level": "HIGH",
                                "metrics": {"z_score": round(z_t, 2)},
                                "db_type": "firestore",
                            })

            if incidents:
                bl["incident_history"].extend(incidents)
                cutoff30 = (datetime.utcnow() - timedelta(days=30)).isoformat()
                bl["incident_history"] = [i for i in bl["incident_history"] if i["detected_at"] >= cutoff30]

            _save_fs_inc(bl)

            summary = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
            for i in incidents:
                summary[i["severity_level"]] = summary.get(i["severity_level"], 0) + 1

            status = "insufficient_data" if len(snapshots) < 3 else "success"
            return {
                "status": status,
                "message": f"Building baseline ({len(snapshots)} snapshots). Need 3+." if status == "insufficient_data" else None,
                "snapshot_count": len(snapshots),
                "summary": summary,
                "incidents": incidents,
                "db_type": "firestore",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        from app.services.incident_engine import IncidentEngine
        engine = IncidentEngine(req.connection_string)
        engine.collect_metrics()
        result = engine.detect_incidents()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
def get_incident_history(req: IncidentRequest):
    """Return historical incidents for visualization in timeline."""
    if _is_firebase(req.connection_string):
        try:
            bl = _load_fs_inc()
            incidents = sorted(bl.get("incident_history", []), key=lambda x: x["detected_at"], reverse=True)
            return {"incidents": incidents, "db_type": "firestore"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        from app.services.incident_engine import IncidentEngine
        engine = IncidentEngine(req.connection_string)
        return engine.get_incident_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summary")
def get_incident_summary(req: IncidentRequest):
    """Return summary counts of incidents by severity for dashboard badges."""
    if _is_firebase(req.connection_string):
        try:
            bl = _load_fs_inc()
            cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
            recent = [i for i in bl.get("incident_history", []) if i["detected_at"] >= cutoff]
            summary = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
            for i in recent:
                summary[i.get("severity_level", "LOW")] = summary.get(i.get("severity_level", "LOW"), 0) + 1
            return {"summary": summary, "recent_count": len(recent), "db_type": "firestore"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        from app.services.incident_engine import IncidentEngine
        engine = IncidentEngine(req.connection_string)
        return engine.get_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
