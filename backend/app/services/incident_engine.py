"""
Incident Engine — Real-time AI-driven database incident detection.

Detects database incidents based on telemetry, computes severity scores,
and maintains a rolling baseline for Z-Score anomaly detection.
"""

import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
INCIDENTS_BASELINES_FILE = os.path.join(DATA_DIR, "incident_baselines.json")

# Z-Score thresholds
Z_INCIDENT = 3.0


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _load_baselines() -> Dict[str, Any]:
    _ensure_data_dir()
    if os.path.exists(INCIDENTS_BASELINES_FILE):
        try:
            with open(INCIDENTS_BASELINES_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"snapshots": [], "last_updated": None, "incident_history": []}


def _save_baselines(data: Dict[str, Any]):
    _ensure_data_dir()
    with open(INCIDENTS_BASELINES_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def _prune_old_snapshots(snapshots: List[Dict], days: int = 7) -> List[Dict]:
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    return [s for s in snapshots if s.get("timestamp", "") >= cutoff]

def _prune_old_incidents(incidents: List[Dict], days: int = 30) -> List[Dict]:
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    return [i for i in incidents if i.get("detected_at", "") >= cutoff]


class IncidentEngine:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string, poolclass=NullPool)
        self.connection_string = connection_string

    def collect_metrics(self) -> Dict[str, Any]:
        """Snapshot current DB metrics."""
        metrics = {}

        try:
            with self.engine.connect() as conn:
                # 1. pg_stat_statements (Query Latency, Slow Queries, Frequency)
                # Ensure pg_stat_statements is available
                has_pgss = conn.execute(text(
                    "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'"
                )).scalar()

                metrics["queries"] = []
                metrics["query_stats"] = {
                    "total_calls": 0,
                    "avg_mean_time": 0.0,
                    "max_mean_time": 0.0
                }

                if has_pgss:
                    query_rows = conn.execute(text("""
                        SELECT 
                            queryid,
                            query, 
                            calls, 
                            total_exec_time, 
                            mean_exec_time 
                        FROM pg_stat_statements 
                        WHERE dbid = (SELECT datid FROM pg_stat_database WHERE datname = current_database())
                          AND query NOT LIKE '%pg_stat_statements%'
                        ORDER BY mean_exec_time DESC 
                        LIMIT 100
                    """)).fetchall()
                    
                    total_calls = 0
                    sum_mean_time = 0.0
                    max_mean_time = 0.0
                    
                    for row in query_rows:
                        q_id = str(row[0])
                        calls = int(row[2])
                        mean_time = float(row[4])
                        metrics["queries"].append({
                            "query_id": q_id,
                            "query_snippet": row[1][:100] + "..." if len(row[1]) > 100 else row[1],
                            "calls": calls,
                            "total_exec_time": float(row[3]),
                            "mean_exec_time": mean_time
                        })
                        total_calls += calls
                        sum_mean_time += mean_time
                        if mean_time > max_mean_time:
                            max_mean_time = mean_time
                            
                    avg_time = sum_mean_time / len(query_rows) if query_rows else 0.0
                    metrics["query_stats"] = {
                        "total_calls": total_calls,
                        "avg_mean_time": avg_time,
                        "max_mean_time": max_mean_time
                    }

                # 2. Table sizes
                table_sizes = {}
                rows = conn.execute(text("""
                    SELECT tablename, 
                           pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) as size_bytes
                    FROM pg_tables WHERE schemaname = 'public'
                """)).fetchall()
                for row in rows:
                    table_sizes[row[0]] = row[1]
                metrics["table_sizes"] = table_sizes

                # 3. Connection counts
                conn_count = conn.execute(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL AND state != 'idle'"
                )).scalar()
                metrics["connection_count"] = conn_count

                # 4. Sequential scans
                seq_scans = conn.execute(text("""
                    SELECT relname, seq_scan
                    FROM pg_stat_user_tables WHERE schemaname = 'public'
                    ORDER BY seq_scan DESC
                """)).fetchall()
                
                table_seq_scans = {}
                total_seq = 0
                for row in seq_scans:
                    table_seq_scans[row[0]] = row[1]
                    total_seq += row[1]
                metrics["table_seq_scans"] = table_seq_scans
                metrics["total_seq_scans"] = total_seq

                # 5. High error rate proxy (from pg_stat_database)
                error_count = conn.execute(text("""
                    SELECT xact_rollback
                    FROM pg_stat_database 
                    WHERE datname = current_database()
                """)).scalar()
                metrics["xact_rollback"] = error_count

        except Exception as e:
            logger.error(f"Incident metric collection failed: {e}")
            raise e

        # Save to baselines
        snapshot = {
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        }

        baselines = _load_baselines()
        baselines["snapshots"].append(snapshot)
        baselines["snapshots"] = _prune_old_snapshots(baselines["snapshots"])
        baselines["last_updated"] = snapshot["timestamp"]
        _save_baselines(baselines)

        return snapshot

    def detect_incidents(self) -> Dict[str, Any]:
        """Analyze latest metrics against baselines to produce Incidents."""
        baselines = _load_baselines()
        snapshots = baselines.get("snapshots", [])

        if len(snapshots) < 3:
            return {
                "status": "insufficient_data",
                "message": f"Building baseline ({len(snapshots)} snapshots). Need 3+ for incident detection.",
                "incidents": [],
                "summary": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
            }

        latest = snapshots[-1]["metrics"]
        incidents = []

        # 1. Query Latency Spike
        if "query_stats" in latest and latest["query_stats"]:
            hist_mean_times = []
            for s in snapshots[:-1]:
                qs = s["metrics"].get("query_stats")
                if qs and qs.get("avg_mean_time", 0) > 0:
                    hist_mean_times.append(qs["avg_mean_time"])
            
            if hist_mean_times:
                current_latency = latest["query_stats"]["avg_mean_time"]
                mean_latency = float(np.mean(hist_mean_times))
                std_latency = float(np.std(hist_mean_times))
                
                if std_latency > 0:
                    z = (current_latency - mean_latency) / std_latency
                    if z > Z_INCIDENT and current_latency > 50: # Only if avg > 50ms
                        latest_calls = latest["query_stats"]["total_calls"]
                        hist_calls = np.mean([s["metrics"].get("query_stats", {}).get("total_calls", 0) for s in snapshots[:-1]])
                        
                        incidents.append(self._create_incident(
                            type="Query Latency Spike",
                            affected_table="Global (Multiple)",
                            root_cause=f"Average query execution time spiked to {current_latency:.2f}ms. Baseline is {mean_latency:.2f}ms.",
                            current_val=current_latency,
                            baseline_val=mean_latency,
                            z_score=z,
                            query_calls=latest_calls,
                            hist_calls=hist_calls,
                            table_size=0
                        ))

        # 2. Slow Queries
        for q in latest.get("queries", []):
            if q["mean_exec_time"] > 200: # Threshold for "slow query"
                incidents.append(self._create_incident(
                    type="Slow Query",
                    affected_table="Unknown", 
                    root_cause=f"Query is taking {q['mean_exec_time']:.1f}ms on average.\nSQL: {q['query_snippet']}",
                    current_val=q["mean_exec_time"],
                    baseline_val=50.0, # Assumed baseline
                    z_score=0.0, # Contextual
                    query_calls=q["calls"],
                    hist_calls=1,
                    table_size=0
                ))

        # 3. Table Growth Anomaly
        for table, current_size in latest.get("table_sizes", {}).items():
            historical_sizes = [
                s["metrics"].get("table_sizes", {}).get(table) 
                for s in snapshots[:-1] 
                if s["metrics"].get("table_sizes", {}).get(table) is not None
            ]
            
            if len(historical_sizes) >= 2:
                mean_size = float(np.mean(historical_sizes))
                std_size = float(np.std(historical_sizes))
                
                if std_size > 0:
                    z = (current_size - mean_size) / std_size
                    if z > Z_INCIDENT and current_size > 1024*1024:  # At least 1MB
                        incidents.append(self._create_incident(
                            type="Table Growth Anomaly",
                            affected_table=table,
                            root_cause=f"Table {table} size jumped to {current_size/1024/1024:.1f}MB. Baseline: {mean_size/1024/1024:.1f}MB.",
                            current_val=current_size,
                            baseline_val=mean_size,
                            z_score=z,
                            query_calls=100,
                            hist_calls=100,
                            table_size=current_size
                        ))

        # 4. Sequential Scan Spike (Missing Index)
        for table, current_scans in latest.get("table_seq_scans", {}).items():
            hist_scans = [
                s["metrics"].get("table_seq_scans", {}).get(table, 0)
                for s in snapshots[:-1]
            ]
            if len(hist_scans) >= 2:
                # We care about the *rate* of seq scans, not the absolute accumulating counter
                # But pg_stat_user_tables is cumulative, so difference between snapshots is better
                # For simplicity here, we assume it's cumulative and a sudden large increase
                # signifies an index issue.
                mean_scans = float(np.mean(hist_scans))
                std_scans = float(np.std(hist_scans))
                
                if std_scans > 0:
                    z = (current_scans - mean_scans) / std_scans
                    if z > Z_INCIDENT and (current_scans - mean_scans) > 1000:
                        incidents.append(self._create_incident(
                            type="Sequential Scans Spike",
                            affected_table=table,
                            root_cause=f"Sudden spike in sequential scans on {table} (jump of {int(current_scans - mean_scans)} from expectation). Possible missing index.",
                            current_val=current_scans,
                            baseline_val=mean_scans,
                            z_score=z,
                            query_calls=current_scans - mean_scans, # Proxy
                            hist_calls=1,
                            table_size=latest.get("table_sizes", {}).get(table, 0)
                        ))

        # 5. Connection Spikes
        current_conn = latest.get("connection_count", 0)
        hist_conn = [s["metrics"].get("connection_count", 0) for s in snapshots[:-1]]
        if len(hist_conn) >= 2:
            mean_conn = float(np.mean(hist_conn))
            std_conn = float(np.std(hist_conn))
            if std_conn > 0:
                z = (current_conn - mean_conn) / std_conn
                if z > Z_INCIDENT and current_conn > 10:
                    incidents.append(self._create_incident(
                        type="Connection Spike",
                        affected_table="Global",
                        root_cause=f"Active connection pool saturated. Current: {current_conn}, Baseline: {int(mean_conn)}.",
                        current_val=current_conn,
                        baseline_val=mean_conn,
                        z_score=z,
                        query_calls=current_conn,
                        hist_calls=mean_conn,
                        table_size=0
                    ))

        # 6. High Error Rate (Rollbacks)
        current_rb = latest.get("xact_rollback", 0)
        hist_rb = [s["metrics"].get("xact_rollback", 0) for s in snapshots[:-1]]
        if len(hist_rb) >= 2:
            mean_rb = float(np.mean(hist_rb))
            std_rb = float(np.std(hist_rb))
            if std_rb > 0:
                z = (current_rb - mean_rb) / std_rb
                # Difference signifies new rollbacks since last snapshot
                if z > Z_INCIDENT and (current_rb - mean_rb) > 50:
                    incidents.append(self._create_incident(
                        type="High Error Rate",
                        affected_table="Global",
                        root_cause=f"Transaction rollback spike. {int(current_rb - mean_rb)} new rollbacks detected.",
                        current_val=current_rb,
                        baseline_val=mean_rb,
                        z_score=z,
                        query_calls=current_rb - mean_rb,
                        hist_calls=1, # freq base
                        table_size=0
                    ))

        # Deduplicate incidents (similar types on same table)
        unique_incidents = {}
        for inc in incidents:
            key = f"{inc['type']}_{inc['affected_table']}"
            if key not in unique_incidents or inc['severity_score'] > unique_incidents[key]['severity_score']:
                unique_incidents[key] = inc
        
        final_incidents = list(unique_incidents.values())
        final_incidents.sort(key=lambda x: x["severity_score"], reverse=True)

        # Update history
        if final_incidents:
            baselines["incident_history"].extend(final_incidents)
            baselines["incident_history"] = _prune_old_incidents(baselines["incident_history"])
            _save_baselines(baselines)

        summary = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for i in final_incidents:
            summary[i["severity_level"]] += 1

        return {
            "status": "success",
            "snapshot_count": len(snapshots),
            "summary": summary,
            "incidents": final_incidents
        }

    def _create_incident(self, type: str, affected_table: str, root_cause: str, 
                         current_val: float, baseline_val: float, z_score: float,
                         query_calls: float, hist_calls: float, table_size: float) -> Dict[str, Any]:
        """Calculates severity using the specific formula and creates the incident object."""
        
        # 1. Impact Score (0-100) — based on table size + query frequency
        size_mb = table_size / (1024 * 1024)
        size_factor = min(size_mb / 1000.0, 1.0) * 50 # up to 50 points based on size up to 1GB
        freq_factor = min(query_calls / 5000.0, 1.0) * 50 # up to 50 points for 5000+ calls
        impact_score = size_factor + freq_factor
        if affected_table == "Global" or affected_table == "Global (Multiple)":
            impact_score = max(impact_score, 80) # Global issues have high impact

        # 2. Frequency Score (0-100) — how often anomaly occurs (calls vs baseline)
        frequency_score = 50.0
        if hist_calls > 0:
            freq_increase = query_calls / hist_calls
            frequency_score = min((freq_increase - 1) * 20, 100)
            if frequency_score < 0: frequency_score = 50

        # 3. Latency/Deviation Increase Score (0-100)
        latency_score = 0.0
        if baseline_val > 0:
            increase = current_val / baseline_val
            latency_score = min(increase * 20, 100)
            
        # Specific override for z-score contexts
        if z_score > 0:
            latency_score = max(latency_score, min(z_score * 10, 100))

        # Final Formula
        severity_score = (impact_score * 0.5) + (frequency_score * 0.3) + (latency_score * 0.2)
        severity_score = min(max(severity_score, 0), 100) # Clamp 0-100

        # Level classification
        if severity_score >= 80:
            level = "CRITICAL"
        elif severity_score >= 60:
            level = "HIGH"
        elif severity_score >= 40:
            level = "MEDIUM"
        else:
            level = "LOW"

        return {
            "id": f"INC-{int(datetime.utcnow().timestamp())}-{hash(type+affected_table)%10000}",
            "type": type,
            "affected_table": affected_table,
            "detected_at": datetime.utcnow().isoformat(),
            "root_cause": root_cause,
            "severity_score": int(severity_score),
            "severity_level": level,
            "metrics": {
                "impact_score": int(impact_score),
                "frequency_score": int(frequency_score),
                "latency_increase_score": int(latency_score),
                "z_score": round(z_score, 2),
                "deviation_pct": round(((current_val - baseline_val) / baseline_val * 100), 1) if baseline_val > 0 else 0
            }
        }

    def get_incident_history(self) -> Dict[str, Any]:
        baselines = _load_baselines()
        incidents = baselines.get("incident_history", [])
        incidents.sort(key=lambda x: x["detected_at"], reverse=True)
        return {
            "incidents": incidents
        }

    def get_summary(self) -> Dict[str, Any]:
        baselines = _load_baselines()
        incidents = baselines.get("incident_history", [])
        
        # We might only care about summarizing *active* or recent incidents, 
        # but let's just summarize the last 24h
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        recent = [i for i in incidents if i["detected_at"] >= cutoff]
        
        summary = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for i in recent:
            summary[i["severity_level"]] += 1
            
        return {
            "summary": summary,
            "recent_count": len(recent)
        }
