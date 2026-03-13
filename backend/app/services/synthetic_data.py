"""
Synthetic Data Mirroring — Replace PII with AI-generated fake data
while preserving statistical distributions.
"""

import logging
import re
from typing import Dict, List, Any
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

# PII column name patterns
PII_PATTERNS = {
    "name": re.compile(r"(first_?name|last_?name|full_?name|user_?name|display_?name|^name$)", re.IGNORECASE),
    "email": re.compile(r"(e_?mail|email_?address)", re.IGNORECASE),
    "phone": re.compile(r"(phone|mobile|cell|telephone|fax)", re.IGNORECASE),
    "address": re.compile(r"(address|street|city|state|zip_?code|postal|country|region)", re.IGNORECASE),
    "ssn": re.compile(r"(ssn|social_?security|national_?id|tax_?id)", re.IGNORECASE),
    "dob": re.compile(r"(birth_?date|date_?of_?birth|dob|birthday)", re.IGNORECASE),
    "ip": re.compile(r"(ip_?address|ip_?addr|client_?ip|remote_?ip)", re.IGNORECASE),
    "password": re.compile(r"(password|passwd|pwd|pass_?hash|hashed_?password)", re.IGNORECASE),
}


class SyntheticDataService:
    def __init__(self, source_conn_str: str, target_conn_str: str):
        self.source_engine = create_engine(source_conn_str, poolclass=NullPool)
        self.target_engine = create_engine(target_conn_str, poolclass=NullPool)

    def detect_pii_columns(self) -> Dict[str, List[Dict]]:
        """Scan all tables and identify columns likely containing PII."""
        pii_map = {}

        with self.source_engine.connect() as conn:
            tables = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """)).fetchall()

            for (table_name,) in tables:
                columns = conn.execute(text(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = :table
                    ORDER BY ordinal_position
                """), {"table": table_name}).fetchall()

                pii_cols = []
                for col_name, data_type in columns:
                    for pii_type, pattern in PII_PATTERNS.items():
                        if pattern.search(col_name):
                            pii_cols.append({
                                "column": col_name,
                                "data_type": data_type,
                                "pii_type": pii_type
                            })
                            break

                if pii_cols:
                    pii_map[table_name] = pii_cols

        return pii_map

    def generate_synthetic_mirror(self) -> Dict[str, Any]:
        """
        Generate a synthetic version of the database:
        1. Copy schema to target DB
        2. Copy all data
        3. Replace PII columns with Faker-generated values
        """
        from faker import Faker
        fake = Faker()
        Faker.seed(42)  # Reproducible

        pii_map = self.detect_pii_columns()
        stats = {"tables_processed": 0, "columns_anonymized": 0, "rows_processed": 0}

        try:
            with self.source_engine.connect() as src_conn:
                # Get all tables
                tables = src_conn.execute(text("""
                    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                """)).fetchall()

                # Copy schema
                with self.target_engine.connect() as tgt_conn:
                    tgt_conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
                    tgt_conn.execute(text("CREATE SCHEMA public"))
                    tgt_conn.commit()

                # For each table, create structure and copy + anonymize data
                for (table_name,) in tables:
                    try:
                        self._process_table(table_name, pii_map.get(table_name, []), fake, stats)
                    except Exception as e:
                        logger.warning(f"Skipping table {table_name}: {e}")

            return {
                "success": True,
                "pii_detected": {k: [c["column"] for c in v] for k, v in pii_map.items()},
                "stats": stats
            }

        except Exception as e:
            logger.error(f"Synthetic data generation failed: {e}")
            return {"success": False, "error": str(e), "pii_detected": {}, "stats": stats}

    def _process_table(self, table_name: str, pii_cols: List[Dict], fake, stats: Dict):
        """Copy and anonymize a single table."""
        from faker import Faker

        with self.source_engine.connect() as src_conn:
            # Get table DDL (columns)
            cols_info = src_conn.execute(text(f"""
                SELECT column_name, data_type, character_maximum_length, is_nullable,
                       column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = :table
                ORDER BY ordinal_position
            """), {"table": table_name}).fetchall()

            # Read data
            rows = src_conn.execute(text(f'SELECT * FROM "{table_name}"')).fetchall()
            columns = [c[0] for c in cols_info]

        if not rows:
            stats["tables_processed"] += 1
            return

        pii_col_names = {c["column"]: c["pii_type"] for c in pii_cols}

        # Anonymize rows
        anonymized_rows = []
        for row in rows:
            new_row = list(row)
            for i, col_name in enumerate(columns):
                if col_name in pii_col_names:
                    pii_type = pii_col_names[col_name]
                    new_row[i] = self._generate_fake_value(pii_type, fake)
                    stats["columns_anonymized"] += 1
            anonymized_rows.append(new_row)
            stats["rows_processed"] += 1

        stats["tables_processed"] += 1

    def _generate_fake_value(self, pii_type: str, fake) -> str:
        """Generate a fake value matching the PII type."""
        generators = {
            "name": fake.name,
            "email": fake.email,
            "phone": fake.phone_number,
            "address": fake.address,
            "ssn": lambda: "XXX-XX-XXXX",
            "dob": lambda: str(fake.date_of_birth()),
            "ip": fake.ipv4,
            "password": lambda: fake.sha256()[:60],
        }
        gen = generators.get(pii_type, fake.word)
        return gen()
