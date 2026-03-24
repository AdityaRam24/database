"""
dialect_converter.py
Converts SQL from various dialects (MySQL, SQLite, MSSQL, Oracle) to PostgreSQL syntax.
Uses regex-based transformations — no external dependencies required.
"""
import re


class DialectConverter:
    """Converts a SQL string from a source dialect to PostgreSQL."""

    SUPPORTED = ("postgresql", "mysql", "sqlite", "mssql", "oracle")

    @classmethod
    def convert(cls, sql: str, source_dialect: str) -> str:
        dialect = source_dialect.lower().strip()
        if dialect == "postgresql":
            return sql
        if dialect == "mysql":
            return cls._from_mysql(sql)
        if dialect == "sqlite":
            return cls._from_sqlite(sql)
        if dialect == "mssql":
            return cls._from_mssql(sql)
        if dialect == "oracle":
            return cls._from_oracle(sql)
        raise ValueError(f"Unsupported dialect: {source_dialect!r}. Supported: {cls.SUPPORTED}")

    # -------------------------------------------------------------------------
    # MySQL → PostgreSQL
    # -------------------------------------------------------------------------
    @classmethod
    def _from_mysql(cls, sql: str) -> str:
        # 1. Backtick identifiers → double-quoted
        sql = re.sub(r'`([^`]+)`', r'"\1"', sql)

        # 2. AUTO_INCREMENT → SERIAL (handle both as column type and as option)
        sql = re.sub(r'\bINT\s+AUTO_INCREMENT\b', 'SERIAL', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bBIGINT\s+AUTO_INCREMENT\b', 'BIGSERIAL', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bSMALLINT\s+AUTO_INCREMENT\b', 'SMALLSERIAL', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bAUTO_INCREMENT\b', '', sql, flags=re.IGNORECASE)

        # 3. Numeric types
        sql = re.sub(r'\bTINYINT\s*\(\s*1\s*\)', 'BOOLEAN', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bTINYINT\b', 'SMALLINT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bMEDIUMINT\b', 'INTEGER', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bINT\s*\(\s*\d+\s*\)', 'INTEGER', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bUNSIGNED\b', '', sql, flags=re.IGNORECASE)

        # 4. String types
        sql = re.sub(r'\bTINYTEXT\b', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bMEDIUMTEXT\b', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bLONGTEXT\b', 'TEXT', sql, flags=re.IGNORECASE)

        # 5. Binary types
        sql = re.sub(r'\bTINYBLOB\b', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bMEDIUMBLOB\b', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bLONGBLOB\b', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bBLOB\b', 'BYTEA', sql, flags=re.IGNORECASE)

        # 6. Date/time types
        sql = re.sub(r'\bDATETIME\b', 'TIMESTAMP', sql, flags=re.IGNORECASE)

        # 7. MySQL-specific table options (strip entire ENGINE=, CHARSET=, COLLATE= clauses)
        sql = re.sub(r'\bENGINE\s*=\s*\w+', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bDEFAULT\s+CHARSET\s*=\s*\w+', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bCHARACTER\s+SET\s*=?\s*\w+', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bCOLLATE\s*=?\s*[\w_]+', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bROW_FORMAT\s*=\s*\w+', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bCOMMENT\s*=\s*\'[^\']*\'', '', sql, flags=re.IGNORECASE)

        # 8. ON UPDATE CURRENT_TIMESTAMP (not directly supported, strip)
        sql = re.sub(r'\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b', '', sql, flags=re.IGNORECASE)

        # 9. ENUM → TEXT with a CHECK constraint note (simplification)
        sql = re.sub(r"\bENUM\s*\([^)]+\)", 'TEXT', sql, flags=re.IGNORECASE)

        # 10. Trailing commas before closing paren caused by stripping options
        sql = re.sub(r',\s*\)', ')', sql)

        return sql.strip()

    # -------------------------------------------------------------------------
    # SQLite → PostgreSQL
    # -------------------------------------------------------------------------
    @classmethod
    def _from_sqlite(cls, sql: str) -> str:
        # 1. INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
        sql = re.sub(
            r'\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b',
            'SERIAL PRIMARY KEY',
            sql, flags=re.IGNORECASE
        )
        # 2. INTEGER PRIMARY KEY (without AUTOINCREMENT) → SERIAL PRIMARY KEY
        sql = re.sub(
            r'\bINTEGER\s+PRIMARY\s+KEY\b',
            'SERIAL PRIMARY KEY',
            sql, flags=re.IGNORECASE
        )
        # 3. Standalone AUTOINCREMENT keyword
        sql = re.sub(r'\bAUTOINCREMENT\b', '', sql, flags=re.IGNORECASE)

        # 4. BLOB → BYTEA
        sql = re.sub(r'\bBLOB\b', 'BYTEA', sql, flags=re.IGNORECASE)

        # 5. SQLite allows untyped columns — leave TEXT as-is (compatible)
        # REAL → DOUBLE PRECISION
        sql = re.sub(r'\bREAL\b', 'DOUBLE PRECISION', sql, flags=re.IGNORECASE)

        # 6. PRAGMA statements → strip
        sql = re.sub(r'PRAGMA\s+[^;]+;', '', sql, flags=re.IGNORECASE)

        return sql.strip()

    # -------------------------------------------------------------------------
    # MSSQL (T-SQL) → PostgreSQL
    # -------------------------------------------------------------------------
    @classmethod
    def _from_mssql(cls, sql: str) -> str:
        # 1. [bracket] identifiers → "double-quoted"
        sql = re.sub(r'\[([^\]]+)\]', r'"\1"', sql)

        # 2. IDENTITY column definition → SERIAL
        sql = re.sub(r'\bINT\s+IDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)', 'SERIAL', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bBIGINT\s+IDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)', 'BIGSERIAL', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bSMALLINT\s+IDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)', 'SMALLSERIAL', sql, flags=re.IGNORECASE)
        # Any remaining IDENTITY()
        sql = re.sub(r'\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)', '', sql, flags=re.IGNORECASE)

        # 3. String types
        sql = re.sub(r'\bNVARCHAR\b', 'VARCHAR', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNVARCHAR\s*\(\s*MAX\s*\)', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bVARCHAR\s*\(\s*MAX\s*\)', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNTEXT\b', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNCHAR\b', 'CHAR', sql, flags=re.IGNORECASE)

        # 4. Date/time types
        sql = re.sub(r'\bDATETIME2\b', 'TIMESTAMP', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bSMALLDATETIME\b', 'TIMESTAMP', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bDATETIME\b', 'TIMESTAMP', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bDATETIMEOFFSET\b', 'TIMESTAMPTZ', sql, flags=re.IGNORECASE)

        # 5. Numeric
        sql = re.sub(r'\bBIT\b', 'BOOLEAN', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bMONEY\b', 'NUMERIC(19,4)', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bSMALLMONEY\b', 'NUMERIC(10,4)', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bUNIQUEIDENTIFIER\b', 'UUID', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bIMAGE\b', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bVARBINARY\b', 'BYTEA', sql, flags=re.IGNORECASE)

        # 6. GO batch separator → strip
        sql = re.sub(r'^\s*GO\s*$', '', sql, flags=re.IGNORECASE | re.MULTILINE)

        # 7. USE <database> statement → strip
        sql = re.sub(r'^\s*USE\s+\S+\s*;?\s*$', '', sql, flags=re.IGNORECASE | re.MULTILINE)

        # 8. WITH (NOLOCK) / other table hints → strip
        sql = re.sub(r'\bWITH\s*\(\s*\w+\s*\)', '', sql, flags=re.IGNORECASE)

        # 9. CLUSTERED / NONCLUSTERED index keywords → strip
        sql = re.sub(r'\b(CLUSTERED|NONCLUSTERED)\b', '', sql, flags=re.IGNORECASE)

        return sql.strip()

    # -------------------------------------------------------------------------
    # Oracle → PostgreSQL
    # -------------------------------------------------------------------------
    @classmethod
    def _from_oracle(cls, sql: str) -> str:
        # 1. Numeric types
        sql = re.sub(r'\bNUMBER\s*\(\s*\*\s*\)', 'NUMERIC', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNUMBER\b', 'NUMERIC', sql, flags=re.IGNORECASE)

        # 2. String types
        sql = re.sub(r'\bVARCHAR2\b', 'VARCHAR', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNVARCHAR2\b', 'VARCHAR', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bCHAR2\b', 'CHAR', sql, flags=re.IGNORECASE)

        # 3. LOB types
        sql = re.sub(r'\bCLOB\b', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNCLOB\b', 'TEXT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bBLOB\b', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bRAW\s*\(\s*\d+\s*\)', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bLONG\s+RAW\b', 'BYTEA', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bLONG\b', 'TEXT', sql, flags=re.IGNORECASE)

        # 4. Date/time types
        sql = re.sub(r'\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b', 'TIMESTAMPTZ', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bTIMESTAMP\s+WITH\s+LOCAL\s+TIME\s+ZONE\b', 'TIMESTAMPTZ', sql, flags=re.IGNORECASE)

        # 5. Sequence objects → strip (assume SERIAL used instead)
        sql = re.sub(
            r'CREATE\s+SEQUENCE\s+\S+[^;]*;',
            '-- [Sequence removed - use SERIAL/BIGSERIAL in PostgreSQL]',
            sql, flags=re.IGNORECASE | re.DOTALL
        )
        # .NEXTVAL / .CURRVAL → nextval hint comment
        sql = re.sub(r'\b\w+\.NEXTVAL\b', 'DEFAULT', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\b\w+\.CURRVAL\b', 'DEFAULT', sql, flags=re.IGNORECASE)

        # 6. Oracle-specific clauses
        sql = re.sub(r'\bNOCYCLE\b', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bCACHE\s+\d+\b', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNOCACHE\b', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bNOORDER\b', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\bORDER\b(?=\s)', '', sql, flags=re.IGNORECASE)  # only as option keyword

        # 7. Dual table references → strip/simplify
        sql = re.sub(r'\bFROM\s+DUAL\b', '', sql, flags=re.IGNORECASE)

        # 8. Oracle double-slash end-of-block → strip
        sql = re.sub(r'^\s*/\s*$', '', sql, flags=re.MULTILINE)

        # 9. SYSDATE → CURRENT_TIMESTAMP
        sql = re.sub(r'\bSYSDATE\b', 'CURRENT_TIMESTAMP', sql, flags=re.IGNORECASE)

        # 10. NVL → COALESCE
        sql = re.sub(r'\bNVL\s*\(', 'COALESCE(', sql, flags=re.IGNORECASE)

        return sql.strip()
