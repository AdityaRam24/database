"""
Semantic Drift Detector — Monitor column value distributions for logical anomalies.

Detects when columns start receiving unexpected values:
- Negative prices
- Null spikes
- Unusual value distributions
"""

import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Any
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
DISTRIBUTIONS_FILE = os.path.join(DATA_DIR, "column_distributions.json")


def _load_distributions() -> Dict:
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(DISTRIBUTIONS_FILE):
        try:
            with open(DISTRIBUTIONS_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"tables": {}, "last_scanned": None}


def _save_distributions(data: Dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DISTRIBUTIONS_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


class DriftDetector:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string, poolclass=NullPool)

    def scan_distributions(self) -> Dict[str, Any]:
        """
        Scan all columns and compute distribution stats.
        Compare against previous baselines to detect drift.
        """
        current_stats = {}
        drift_alerts = []
        previous = _load_distributions()

        with self.engine.connect() as conn:
            # Get all tables and their columns
            tables = conn.execute(text("""
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            """)).fetchall()

            # Group by table
            from collections import defaultdict
            table_columns = defaultdict(list)
            for table_name, col_name, data_type in tables:
                table_columns[table_name].append({"name": col_name, "type": data_type})

            for table_name, columns in table_columns.items():
                current_stats[table_name] = {}
                row_count_result = conn.execute(text(
                    f'SELECT count(*) FROM "{table_name}"'
                )).scalar()

                for col in columns:
                    col_name = col["name"]
                    data_type = col["type"]
                    stats = {"data_type": data_type, "row_count": row_count_result}

                    try:
                        # Null percentage
                        null_count = conn.execute(text(
                            f'SELECT count(*) FROM "{table_name}" WHERE "{col_name}" IS NULL'
                        )).scalar()
                        stats["null_pct"] = round(null_count / row_count_result * 100, 2) if row_count_result > 0 else 0
                        stats["null_count"] = null_count

                        # Distinct count
                        distinct = conn.execute(text(
                            f'SELECT count(DISTINCT "{col_name}") FROM "{table_name}"'
                        )).scalar()
                        stats["distinct_count"] = distinct
                        stats["distinct_pct"] = round(distinct / row_count_result * 100, 2) if row_count_result > 0 else 0

                        # Numeric column stats
                        if data_type in ("integer", "bigint", "smallint", "numeric", "real",
                                         "double precision", "decimal", "float"):
                            agg = conn.execute(text(
                                f'SELECT min("{col_name}"), max("{col_name}"), '
                                f'avg("{col_name}")::float, stddev("{col_name}")::float '
                                f'FROM "{table_name}" WHERE "{col_name}" IS NOT NULL'
                            )).fetchone()

                            if agg and agg[0] is not None:
                                stats["min"] = float(agg[0])
                                stats["max"] = float(agg[1])
                                stats["avg"] = round(float(agg[2]), 4) if agg[2] else 0
                                stats["stddev"] = round(float(agg[3]), 4) if agg[3] else 0

                                # Drift checks for numeric columns
                                if stats["min"] < 0 and any(
                                    x in col_name.lower() for x in ["price", "amount", "cost", "total", "quantity", "count", "age"]
                                ):
                                    drift_alerts.append({
                                        "table": table_name,
                                        "column": col_name,
                                        "alert_type": "negative_values",
                                        "severity": "critical",
                                        "message": f"Column '{col_name}' contains negative values (min: {stats['min']}). "
                                                   f"This is unexpected for a {col_name.replace('_', ' ')} field.",
                                        "current_value": stats["min"],
                                    })

                    except Exception as e:
                        logger.debug(f"Column stats error for {table_name}.{col_name}: {e}")

                    current_stats[table_name][col_name] = stats

                    # Compare with previous baseline for drift
                    prev_col = previous.get("tables", {}).get(table_name, {}).get(col_name, {})
                    if prev_col:
                        # Null spike detection
                        prev_null_pct = prev_col.get("null_pct", 0)
                        curr_null_pct = stats.get("null_pct", 0)
                        if curr_null_pct - prev_null_pct > 20:
                            drift_alerts.append({
                                "table": table_name,
                                "column": col_name,
                                "alert_type": "null_spike",
                                "severity": "warning",
                                "message": f"Null percentage in '{col_name}' jumped from {prev_null_pct}% to {curr_null_pct}%.",
                                "prev_value": prev_null_pct,
                                "current_value": curr_null_pct,
                            })

                        # Distinct count drop (possible data corruption or enum collapse)
                        prev_distinct = prev_col.get("distinct_count", 0)
                        curr_distinct = stats.get("distinct_count", 0)
                        if prev_distinct > 10 and curr_distinct < prev_distinct * 0.5:
                            drift_alerts.append({
                                "table": table_name,
                                "column": col_name,
                                "alert_type": "distinct_collapse",
                                "severity": "warning",
                                "message": f"Distinct values in '{col_name}' dropped from {prev_distinct} to {curr_distinct}.",
                                "prev_value": prev_distinct,
                                "current_value": curr_distinct,
                            })

                        # Value range expansion for numeric cols
                        if "max" in stats and "max" in prev_col:
                            if prev_col["max"] > 0 and stats["max"] > prev_col["max"] * 10:
                                drift_alerts.append({
                                    "table": table_name,
                                    "column": col_name,
                                    "alert_type": "value_range_explosion",
                                    "severity": "warning",
                                    "message": f"Max value in '{col_name}' exploded from {prev_col['max']} to {stats['max']}.",
                                    "prev_value": prev_col["max"],
                                    "current_value": stats["max"],
                                })

        # Save current as new baseline
        _save_distributions({"tables": current_stats, "last_scanned": datetime.utcnow().isoformat()})

        return {
            "tables_scanned": len(current_stats),
            "columns_scanned": sum(len(cols) for cols in current_stats.values()),
            "drift_alerts": drift_alerts,
            "has_previous_baseline": bool(previous.get("tables")),
            "last_scanned": datetime.utcnow().isoformat()
        }
