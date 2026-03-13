"""
Anomaly Detector — Z-Score-based statistical baseline engine.

Collects metrics (query_latency, table_size_growth, connection_counts),
maintains a rolling 7-day history, and detects anomalies using Z-Scores.
"""

import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
BASELINES_FILE = os.path.join(DATA_DIR, "metric_baselines.json")

# Z-Score thresholds
Z_WARNING = 2.0
Z_CRITICAL = 3.0


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _load_baselines() -> Dict[str, Any]:
    _ensure_data_dir()
    if os.path.exists(BASELINES_FILE):
        try:
            with open(BASELINES_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"snapshots": [], "last_updated": None}


def _save_baselines(data: Dict[str, Any]):
    _ensure_data_dir()
    with open(BASELINES_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def _prune_old_snapshots(snapshots: List[Dict], days: int = 7) -> List[Dict]:
    """Keep only snapshots from the last N days."""
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    return [s for s in snapshots if s.get("timestamp", "") >= cutoff]


class AnomalyDetector:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string, poolclass=NullPool)
        self.connection_string = connection_string

    def collect_metrics(self) -> Dict[str, Any]:
        """Snapshot current DB metrics and append to rolling baselines."""
        metrics = {}

        try:
            with self.engine.connect() as conn:
                # 1. Table sizes
                table_sizes = {}
                rows = conn.execute(text("""
                    SELECT tablename, 
                           pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) as size_bytes
                    FROM pg_tables WHERE schemaname = 'public'
                """)).fetchall()
                for row in rows:
                    table_sizes[row[0]] = row[1]
                metrics["table_sizes"] = table_sizes
                metrics["total_size"] = sum(table_sizes.values())

                # 2. Connection counts
                conn_count = conn.execute(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL"
                )).scalar()
                metrics["connection_count"] = conn_count

                # 3. Active queries (proxy for latency pressure)
                active_queries = conn.execute(text("""
                    SELECT count(*) FROM pg_stat_activity 
                    WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
                """)).scalar()
                metrics["active_queries"] = active_queries

                # 4. Sequential scans (proxy for slow query latency)
                seq_scans = conn.execute(text("""
                    SELECT relname, seq_scan, seq_tup_read, 
                           CASE WHEN seq_scan > 0 THEN seq_tup_read / seq_scan ELSE 0 END as avg_rows_per_scan
                    FROM pg_stat_user_tables WHERE schemaname = 'public'
                    ORDER BY seq_tup_read DESC
                """)).fetchall()
                table_latency = {}
                for row in seq_scans:
                    table_latency[row[0]] = {
                        "seq_scans": row[1],
                        "total_rows_read": row[2],
                        "avg_rows_per_scan": float(row[3])
                    }
                metrics["table_latency"] = table_latency
                metrics["total_seq_scans"] = sum(r[1] for r in seq_scans)

                # 5. Cache hit ratio
                cache_result = conn.execute(text("""
                    SELECT 
                        sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) as ratio
                    FROM pg_statio_user_tables
                """)).scalar()
                metrics["cache_hit_ratio"] = float(cache_result) if cache_result else 0.0

        except Exception as e:
            logger.error(f"Metric collection failed: {e}")
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

    def detect_anomalies(self) -> Dict[str, Any]:
        """Compute Z-Scores for each metric against the rolling baseline."""
        baselines = _load_baselines()
        snapshots = baselines.get("snapshots", [])

        if len(snapshots) < 3:
            return {
                "status": "insufficient_data",
                "message": f"Need at least 3 snapshots for anomaly detection. Currently have {len(snapshots)}.",
                "anomalies": [],
                "metrics_summary": {}
            }

        latest = snapshots[-1]["metrics"]
        anomalies = []
        metrics_summary = {}

        # --- Scalar metrics ---
        scalar_keys = [
            ("total_size", "Total Database Size", "bytes"),
            ("connection_count", "Active Connections", "connections"),
            ("total_seq_scans", "Sequential Scans", "scans"),
            ("cache_hit_ratio", "Cache Hit Ratio", "ratio"),
            ("active_queries", "Active Queries", "queries"),
        ]

        for key, label, unit in scalar_keys:
            values = [s["metrics"].get(key, 0) for s in snapshots[:-1] if key in s["metrics"]]
            current = latest.get(key, 0)

            if not values or len(values) < 2:
                continue

            mean = float(np.mean(values))
            std = float(np.std(values))
            z_score = float((current - mean) / std) if std > 0 else 0.0

            # Confidence band
            upper_bound = mean + Z_WARNING * std
            lower_bound = max(0, mean - Z_WARNING * std)

            severity = "normal"
            if abs(z_score) >= Z_CRITICAL:
                severity = "critical"
            elif abs(z_score) >= Z_WARNING:
                severity = "warning"

            entry = {
                "metric": key,
                "label": label,
                "unit": unit,
                "current_value": current,
                "mean": round(mean, 2),
                "std": round(std, 2),
                "z_score": round(z_score, 2),
                "severity": severity,
                "upper_bound": round(upper_bound, 2),
                "lower_bound": round(lower_bound, 2),
                "deviation_pct": round(abs(current - mean) / mean * 100, 1) if mean > 0 else 0.0,
            }

            metrics_summary[key] = entry

            if severity != "normal":
                root_cause = self._infer_root_cause(key, current, mean, latest)
                anomalies.append({**entry, "root_cause": root_cause})

        # --- Per-table size anomalies ---
        for table, current_size in latest.get("table_sizes", {}).items():
            historical_sizes = []
            for s in snapshots[:-1]:
                ts = s["metrics"].get("table_sizes", {}).get(table)
                if ts is not None:
                    historical_sizes.append(ts)

            if len(historical_sizes) < 2:
                continue

            mean = float(np.mean(historical_sizes))
            std = float(np.std(historical_sizes))

            if std > 0:
                z = float((current_size - mean) / std)
                if abs(z) >= Z_WARNING:
                    anomalies.append({
                        "metric": f"table_size_{table}",
                        "label": f"Table Size: {table}",
                        "unit": "bytes",
                        "current_value": current_size,
                        "mean": round(mean, 2),
                        "std": round(std, 2),
                        "z_score": round(z, 2),
                        "severity": "critical" if abs(z) >= Z_CRITICAL else "warning",
                        "upper_bound": round(mean + Z_WARNING * std, 2),
                        "lower_bound": round(max(0, mean - Z_WARNING * std), 2),
                        "deviation_pct": round(abs(current_size - mean) / mean * 100, 1) if mean > 0 else 0,
                        "root_cause": f"Table '{table}' size changed by {round(abs(current_size - mean) / mean * 100, 1)}% from baseline. Possible bulk insert or data bloat."
                    })

        return {
            "status": "analyzed",
            "snapshot_count": len(snapshots),
            "anomalies": sorted(anomalies, key=lambda a: abs(a["z_score"]), reverse=True),
            "metrics_summary": metrics_summary,
            "last_updated": baselines.get("last_updated")
        }

    def _infer_root_cause(self, metric: str, current, mean, latest_metrics: Dict) -> str:
        """Heuristic root-cause analysis for common anomaly patterns."""
        deviation_pct = round(abs(current - mean) / mean * 100, 1) if mean > 0 else 0

        if metric == "total_seq_scans":
            # Find the table with highest seq scans
            latency = latest_metrics.get("table_latency", {})
            worst = max(latency.items(), key=lambda x: x[1].get("seq_scans", 0), default=(None, {}))
            if worst[0]:
                return (f"Sequential scans spiked by {deviation_pct}%. "
                        f"Table '{worst[0]}' has {worst[1].get('seq_scans', 0)} seq scans — "
                        f"likely missing index on a frequently-queried column.")
            return f"Sequential scans increased {deviation_pct}% above baseline. Consider adding indexes."

        if metric == "total_size":
            biggest_tables = sorted(latest_metrics.get("table_sizes", {}).items(), key=lambda x: x[1], reverse=True)[:3]
            if biggest_tables:
                top = ", ".join(f"'{t[0]}' ({round(t[1]/1024/1024, 1)} MB)" for t in biggest_tables)
                return f"Database size grew {deviation_pct}% above baseline. Largest tables: {top}."
            return f"Database size increased {deviation_pct}% above normal."

        if metric == "connection_count":
            return (f"Connection count is {deviation_pct}% above baseline ({current} vs avg {round(mean, 0)}). "
                    f"Possible connection leak or traffic spike.")

        if metric == "cache_hit_ratio":
            direction = "dropped" if current < mean else "increased"
            return (f"Cache hit ratio {direction} to {round(current * 100, 1)}% "
                    f"(baseline: {round(mean * 100, 1)}%). "
                    f"{'Consider increasing shared_buffers.' if current < mean else ''}")

        if metric == "active_queries":
            return (f"Active queries spiked to {current} (baseline avg: {round(mean, 1)}). "
                    f"Possible slow query or lock contention.")

        return f"{metric} deviated {deviation_pct}% from rolling 7-day baseline."

    def get_metric_history(self) -> Dict[str, Any]:
        """Return time-series data for charting."""
        baselines = _load_baselines()
        snapshots = baselines.get("snapshots", [])

        series = {
            "timestamps": [],
            "total_size": [],
            "connection_count": [],
            "total_seq_scans": [],
            "cache_hit_ratio": [],
            "active_queries": [],
        }

        for snap in snapshots:
            series["timestamps"].append(snap["timestamp"])
            m = snap["metrics"]
            series["total_size"].append(m.get("total_size", 0))
            series["connection_count"].append(m.get("connection_count", 0))
            series["total_seq_scans"].append(m.get("total_seq_scans", 0))
            series["cache_hit_ratio"].append(m.get("cache_hit_ratio", 0))
            series["active_queries"].append(m.get("active_queries", 0))

        # Compute bands for each metric
        bands = {}
        for key in ["total_size", "connection_count", "total_seq_scans", "cache_hit_ratio", "active_queries"]:
            vals = series[key]
            if len(vals) >= 3:
                mean = float(np.mean(vals))
                std = float(np.std(vals))
                bands[key] = {
                    "mean": round(mean, 2),
                    "upper": round(mean + Z_WARNING * std, 2),
                    "lower": round(max(0, mean - Z_WARNING * std), 2),
                }
            else:
                bands[key] = {"mean": 0, "upper": 0, "lower": 0}

        return {
            "series": series,
            "confidence_bands": bands,
            "snapshot_count": len(snapshots)
        }
