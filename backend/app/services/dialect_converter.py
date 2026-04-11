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
            import sqlglot.expressions as exp

            # Parse into a list of ASTs
            ast_list = sqlglot.parse(sql, read=read_dialect)

            valid_statements = []
            for stmt in ast_list:
                if not stmt:
                    continue

                # Force all identifiers (tables, columns) to lowercase and unquote them.
                # This guarantees they become generic case-insensitive matches in PostgreSQL.
                for node in stmt.find_all(exp.Identifier):
                    if hasattr(node, "this") and isinstance(node.this, str):
                        node.args["this"] = node.this.lower()
                        if "quoted" in node.args:
                            node.args["quoted"] = False

                valid_statements.append(stmt.sql(dialect="postgres"))

            return ";\n".join(valid_statements) + (";" if valid_statements else "")
        except Exception as e:
            logger.error(f"SQLGlot transpilation error: {e}")
            raise ValueError(f"Failed to transpile from {source_dialect} to postgres: {e}")

    @classmethod
    def convert_partial(cls, sql: str, source_dialect: str) -> tuple:
        """
        Like convert(), but processes each statement individually.
        Returns (converted_sql, failed_statements) where:
          - converted_sql: semicolon-joined PostgreSQL SQL for all statements
            that sqlglot could handle (failed ones are kept as-is so position is preserved)
          - failed_statements: list of raw original statement strings that sqlglot could not convert
        """
        import sqlglot.expressions as exp

        dialect = source_dialect.lower().strip()
        pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
        sql = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql)

        if dialect == "postgresql":
            return sql.strip(), []

        read_dialect = "tsql" if dialect == "mssql" else dialect

        try:
            ast_list = sqlglot.parse(sql, read=read_dialect)
        except Exception as e:
            logger.error(f"SQLGlot parse failed entirely: {e}")
            # Can't parse at all — return original as failed
            return "", [sql]

        converted = []
        failed = []

        for stmt in ast_list:
            if not stmt:
                continue
            raw = stmt.sql(dialect=read_dialect)
            try:
                for node in stmt.find_all(exp.Identifier):
                    if hasattr(node, "this") and isinstance(node.this, str):
                        node.args["this"] = node.this.lower()
                        if "quoted" in node.args:
                            node.args["quoted"] = False
                converted.append(stmt.sql(dialect="postgres"))
            except Exception as e:
                logger.warning(f"Statement-level conversion failed, queuing for LLM repair: {e}")
                converted.append(None)  # placeholder so we can splice the repair in later
                failed.append((len(converted) - 1, raw))

        return converted, failed
