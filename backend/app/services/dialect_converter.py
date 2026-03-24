"""
dialect_converter.py
Converts SQL from various dialects (MySQL, SQLite, MSSQL, Oracle) to PostgreSQL syntax.
Powered by sqlglot.
"""
import re
import sqlglot
import logging

logger = logging.getLogger(__name__)

class DialectConverter:
    """Converts a SQL string from a source dialect to PostgreSQL."""

    SUPPORTED = ("postgresql", "mysql", "sqlite", "mssql", "oracle", "tsql")

    @classmethod
    def convert(cls, sql: str, source_dialect: str) -> str:
        dialect = source_dialect.lower().strip()
        
        # Remove all SQL comments while preserving strings/identifiers
        pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
        sql = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql)

        if dialect == "postgresql":
            return sql.strip()

        if dialect not in cls.SUPPORTED:
            raise ValueError(f"Unsupported dialect: {source_dialect!r}. Supported: {cls.SUPPORTED}")

        # SQLGlot uses 'tsql' for Microsoft SQL Server
        read_dialect = "tsql" if dialect == "mssql" else dialect

        try:
            # sqlglot.transpile returns a list of transpiled statements
            transpiled_statements = sqlglot.transpile(sql, read=read_dialect, write="postgres")
            
            # Filter out empty statements
            valid_statements = [s for s in transpiled_statements if s and s.strip()]
            
            return ";\n".join(valid_statements) + (";" if valid_statements else "")
        except Exception as e:
            logger.error(f"SQLGlot transpilation error: {e}")
            raise ValueError(f"Failed to transpile from {source_dialect} to postgres: {e}")
