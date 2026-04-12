"""
dialect_converter.py
Converts SQL from various dialects (MySQL, SQLite, MSSQL, Oracle) to PostgreSQL syntax.

For Oracle: uses a two-pass approach —
  1. sqlglot handles plain DDL (CREATE TABLE, CREATE INDEX, etc.)
  2. OracleToPgConverter handles PL/SQL blocks (procedures, functions, triggers)
     and applies comprehensive data-type / built-in-function substitutions.
"""
import re
import sqlglot
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Oracle → PostgreSQL rule-based converter
# ---------------------------------------------------------------------------

class OracleToPgConverter:
    """
    Converts an Oracle SQL file to PostgreSQL without requiring any external
    tool or LLM.  Handles:
      - Oracle data types  (NUMBER, VARCHAR2, CLOB, DATE, …)
      - Built-in functions (NVL, DECODE, SYSDATE, SUBSTR, …)
      - Sequence syntax   (seq.NEXTVAL, NOCACHE, NOMAXVALUE, …)
      - DDL clean-up      (TABLESPACE, STORAGE, PCTFREE, … clauses)
      - PL/SQL → PL/pgSQL (IS/AS → $$ LANGUAGE plpgsql, %TYPE, exceptions, …)
    """

    # ------------------------------------------------------------------ types
    # Applied in order; use raw strings so \b works correctly.
    _TYPE_SUBS = [
        # NUMBER with scale 0 or no scale → INTEGER
        (r'\bNUMBER\s*\(\s*(\d+)\s*,\s*0\s*\)',          r'INTEGER'),
        (r'\bNUMBER\s*\(\s*(\d+)\s*\)',                   r'INTEGER'),
        # NUMBER(p,s) → NUMERIC(p,s)
        (r'\bNUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)',       r'NUMERIC(\1,\2)'),
        # bare NUMBER → NUMERIC
        (r'\bNUMBER\b',                                    r'NUMERIC'),
        (r'\bVARCHAR2\s*\(',                               r'VARCHAR('),
        (r'\bNVARCHAR2\s*\(',                              r'VARCHAR('),
        (r'\bNVARCHAR\s*\(',                               r'VARCHAR('),
        (r'\bNCHAR\b',                                     r'CHAR'),
        (r'\bCLOB\b',                                      r'TEXT'),
        (r'\bNCLOB\b',                                     r'TEXT'),
        (r'\bBLOB\b',                                      r'BYTEA'),
        (r'\bRAW\s*\(\d+\)',                               r'BYTEA'),
        (r'\bLONG\s+RAW\b',                                r'BYTEA'),
        (r'\bLONG\b',                                      r'TEXT'),
        (r'\bBINARY_FLOAT\b',                              r'REAL'),
        (r'\bBINARY_DOUBLE\b',                             r'DOUBLE PRECISION'),
        (r'\bFLOAT\b',                                     r'DOUBLE PRECISION'),
        (r'\bXMLTYPE\b',                                   r'XML'),
        (r'\bROWID\b',                                     r'TEXT'),
        # Oracle DATE carries time → PostgreSQL TIMESTAMP
        (r'\bDATE\b',                                      r'TIMESTAMP'),
    ]

    # --------------------------------------------------------------- functions
    _FUNC_SUBS = [
        # NVL → COALESCE
        (r'\bNVL\s*\(',                                    r'COALESCE('),
        # SYSDATE / SYSTIMESTAMP
        (r'\bSYSDATE\b',                                   r'CURRENT_TIMESTAMP'),
        (r'\bSYSTIMESTAMP\b',                              r'CURRENT_TIMESTAMP'),
        # SYS_GUID → gen_random_uuid()
        (r'\bSYS_GUID\s*\(\s*\)',                          r'gen_random_uuid()'),
        # SUBSTR → SUBSTRING … FROM … FOR
        (r'\bSUBSTR\s*\(',                                 r'SUBSTRING('),
        # INSTR(str, sub) → POSITION(sub IN str)  — best-effort, single-arg
        (r'\bINSTR\s*\(\s*([^,]+),\s*([^)]+)\)',
         r'POSITION(\2 IN \1)'),
        # DECODE(expr, v1,r1, v2,r2, …)  →  CASE expr WHEN …  (simple 2-branch)
        # Full multi-branch handled separately in _convert_decode()
        # TRUNC(date, fmt) → DATE_TRUNC(fmt, date)  — when fmt arg present
        (r'\bTRUNC\s*\(\s*([^,]+),\s*([^)]+)\)',
         r"DATE_TRUNC(\2, \1)"),
        # RAISE_APPLICATION_ERROR
        (r"\bRAISE_APPLICATION_ERROR\s*\(\s*-?\d+\s*,\s*'([^']*)'\s*\)",
         r"RAISE EXCEPTION '\1'"),
        # DBMS_OUTPUT.PUT_LINE('msg')
        (r"\bDBMS_OUTPUT\.PUT_LINE\s*\(\s*'([^']*)'\s*\)",
         r"RAISE NOTICE '%', '\1'"),
        (r"\bDBMS_OUTPUT\.PUT_LINE\s*\(([^)]+)\)",
         r"RAISE NOTICE '%', \1"),
        # FROM DUAL → (remove)
        (r'\bFROM\s+DUAL\b',                               r''),
        # sequence.NEXTVAL / sequence.CURRVAL
        (r'\b(\w+)\.NEXTVAL\b',                            r"nextval('\1')"),
        (r'\b(\w+)\.CURRVAL\b',                            r"currval('\1')"),
        # ROWNUM in WHERE → LIMIT  (simple case: WHERE ROWNUM <= n or < n)
        (r'WHERE\s+ROWNUM\s*<=\s*(\d+)',                   r'LIMIT \1'),
        (r'WHERE\s+ROWNUM\s*<\s*(\d+)',
         lambda m: f'LIMIT {int(m.group(1)) - 1}'),
    ]

    # ------------------------------------------------- Oracle DDL noise words
    # Clauses that have no PostgreSQL equivalent — strip them entirely.
    _DDL_STRIP_PATTERNS = [
        r'\bTABLESPACE\s+\w+',
        r'\bSTORAGE\s*\([^)]*\)',
        r'\bPCTFREE\s+\d+',
        r'\bPCTUSED\s+\d+',
        r'\bINITRANS\s+\d+',
        r'\bMAXTRANS\s+\d+',
        r'\bNOLOGGING\b',
        r'\bLOGGING\b',
        r'\bCOMPRESS\b',
        r'\bNOCOMPRESS\b',
        r'\bPARALLEL\b',
        r'\bNOPARALLEL\b',
        r'\bCACHE\b',
        r'\bNOCACHE\b',
        r'\bORDER\b',
        r'\bNOORDER\b',
        r'\bUSING\s+INDEX\b(?:\s+\w+)?',
        r'\bENABLE\b',
        r'\bDISABLE\b',
        r'\bNOVALIDATE\b',
        r'\bVALIDATE\b',
        r'\bEXCEPTIONS\s+INTO\s+\w+',
        r'\bDEFAULT\s+ON\s+NULL\b',
        r'\bVISIBLE\b',
        r'\bINVISIBLE\b',
        r'\bSEGMENT\s+CREATION\s+\w+',
    ]

    # ------------------------------------------------- Sequence keyword fixes
    _SEQ_SUBS = [
        (r'\bNOCYCLE\b',    r'NO CYCLE'),
        (r'\bNOCACHE\b',    r''),
        (r'\bNOMAXVALUE\b', r'NO MAXVALUE'),
        (r'\bNOMINVALUE\b', r'NO MINVALUE'),
        (r'\bNOORDER\b',    r''),
        (r'\bORDER\b',      r''),
    ]

    # ------------------------------------------------- PL/SQL exception names
    _EXC_MAP = {
        'NO_DATA_FOUND':       'NO_DATA_FOUND',
        'TOO_MANY_ROWS':       'TOO_MANY_ROWS',
        'DUP_VAL_ON_INDEX':    'UNIQUE_VIOLATION',
        'VALUE_ERROR':         'DATA_EXCEPTION',
        'ZERO_DIVIDE':         'DIVISION_BY_ZERO',
        'INVALID_NUMBER':      'INVALID_TEXT_REPRESENTATION',
        'INVALID_CURSOR':      'INVALID_CURSOR_STATE',
        'CURSOR_ALREADY_OPEN': 'INVALID_CURSOR_STATE',
        'ACCESS_INTO_NULL':    'NULL_VALUE_NOT_ALLOWED',
        'ROWTYPE_MISMATCH':    'DATATYPE_MISMATCH',
        'SUBSCRIPT_BEYOND_COUNT': 'ARRAY_SUBSCRIPT_ERROR',
        'SUBSCRIPT_OUTSIDE_LIMIT': 'ARRAY_SUBSCRIPT_ERROR',
    }

    # ================================================================ public API

    @classmethod
    def convert(cls, sql: str) -> str:
        """Convert an entire Oracle SQL file string to PostgreSQL."""
        statements = cls._split_oracle(sql)
        out = []
        for stmt in statements:
            stmt = stmt.strip()
            if not stmt:
                continue
            converted = cls._convert_one(stmt)
            if converted:
                out.append(converted.strip().rstrip(';'))
        return ';\n\n'.join(out) + (';' if out else '')

    # ================================================================ internals

    @classmethod
    def _split_oracle(cls, sql: str) -> list:
        """
        Split an Oracle SQL file into individual statements.
        Oracle uses '/' on its own line to terminate PL/SQL blocks.
        """
        # Strip comments (preserve string literals)
        sql = re.sub(r"('[^']*')|--[^\n]*",
                     lambda m: m.group(1) if m.group(1) else '', sql)
        sql = re.sub(r'/\*[\s\S]*?\*/', '', sql)

        statements = []
        # Split on bare '/' lines (PL/SQL block terminator)
        blocks = re.split(r'^\s*/\s*$', sql, flags=re.MULTILINE)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            # Block that contains a PL/SQL body → keep as one unit
            if re.search(r'\b(?:IS|AS|BEGIN|DECLARE)\b', block, re.IGNORECASE):
                statements.append(block)
            else:
                # Plain SQL — split on semicolons
                for part in re.split(r';\s*', block):
                    part = part.strip()
                    if part:
                        statements.append(part)
        return statements

    @classmethod
    def _convert_one(cls, stmt: str) -> str:
        """Dispatch a single statement to the right converter."""
        upper = stmt.upper()

        # PL/SQL block → PL/pgSQL
        if re.match(
            r'\s*CREATE\s+(?:OR\s+REPLACE\s+)?'
            r'(?:PROCEDURE|FUNCTION|TRIGGER|PACKAGE\s+BODY|PACKAGE)\b',
            upper
        ):
            return cls._convert_plsql(stmt)

        # CREATE SEQUENCE
        if re.match(r'\s*CREATE\s+(?:OR\s+REPLACE\s+)?SEQUENCE\b', upper):
            return cls._convert_sequence(stmt)

        # Everything else: try sqlglot first, fall back to substitutions
        try:
            result = sqlglot.transpile(stmt, read='oracle', write='postgres', pretty=False)
            if result and result[0].strip():
                return result[0]
        except Exception:
            pass

        # sqlglot failed — apply substitutions directly
        return cls._apply_all(stmt)

    # --------------------------------------------------------- PL/SQL → PL/pgSQL

    @classmethod
    def _convert_plsql(cls, stmt: str) -> str:
        """Convert a CREATE PROCEDURE/FUNCTION/TRIGGER block to PL/pgSQL."""

        # 1. Normalise CRLF
        s = stmt.replace('\r\n', '\n').replace('\r', '\n')

        # 2. Fix parameter direction keywords Oracle uses
        s = re.sub(r'\bIN\s+OUT\b', r'INOUT', s, flags=re.IGNORECASE)

        # 3. Convert RETURN → RETURNS  (only in the header, before IS/AS/BEGIN)
        #    Oracle: FUNCTION foo RETURN type IS
        #    PG:     FUNCTION foo() RETURNS type AS
        s = re.sub(
            r'\bRETURN\b(?=\s+\w)',
            'RETURNS',
            s,
            count=1,
            flags=re.IGNORECASE
        )

        # 4. Replace the Oracle IS/AS block opener with PG dollar-quote
        #    Pattern:  <header> IS  <declarations> BEGIN
        #    or        <header> AS  <declarations> BEGIN
        #    → <header> AS $$ DECLARE <declarations> BEGIN
        s = re.sub(
            r'\b(IS|AS)\b\s*(?=\w|\n)',
            'AS $$\nDECLARE\n',
            s,
            count=1,
            flags=re.IGNORECASE
        )

        # 5. %TYPE → TEXT  (can't resolve Oracle schema type at parse time)
        s = re.sub(r'\w+(?:\.\w+)?%TYPE', 'TEXT', s, flags=re.IGNORECASE)

        # 6. %ROWTYPE → RECORD
        s = re.sub(r'\w+(?:\.\w+)?%ROWTYPE', 'RECORD', s, flags=re.IGNORECASE)

        # 7. Oracle exception names → PostgreSQL equivalents
        for ora_exc, pg_exc in cls._EXC_MAP.items():
            s = re.sub(r'\b' + ora_exc + r'\b', pg_exc, s, flags=re.IGNORECASE)

        # 8. PRAGMA … → remove entire line
        s = re.sub(r'^\s*PRAGMA\b[^\n]*\n?', '', s, flags=re.IGNORECASE | re.MULTILINE)

        # 9. Close with $$ LANGUAGE plpgsql
        #    Oracle ends with:  END [name];   or   END;
        s = re.sub(
            r'\bEND\s*(?:\w+\s*)?;\s*$',
            'END;\n$$ LANGUAGE plpgsql',
            s.rstrip(),
            flags=re.IGNORECASE
        )

        # 10. Apply type and function substitutions inside the body
        s = cls._apply_all(s)

        return s

    # --------------------------------------------------------- sequences

    @classmethod
    def _convert_sequence(cls, stmt: str) -> str:
        s = stmt
        for pattern, replacement in cls._SEQ_SUBS:
            s = re.sub(pattern, replacement, s, flags=re.IGNORECASE)
        # Clean up extra whitespace from removed keywords
        s = re.sub(r'[ \t]+', ' ', s)
        s = re.sub(r'\n{3,}', '\n\n', s)
        return s

    # --------------------------------------------------------- substitutions

    @classmethod
    def _apply_all(cls, s: str) -> str:
        s = cls._apply_types(s)
        s = cls._apply_funcs(s)
        s = cls._apply_ddl_strip(s)
        s = cls._apply_seq(s)
        return s

    @classmethod
    def _apply_types(cls, s: str) -> str:
        for pattern, repl in cls._TYPE_SUBS:
            s = re.sub(pattern, repl, s, flags=re.IGNORECASE)
        return s

    @classmethod
    def _apply_funcs(cls, s: str) -> str:
        for pattern, repl in cls._FUNC_SUBS:
            s = re.sub(pattern, repl, s, flags=re.IGNORECASE)
        # DECODE(expr, v1, r1, [v2, r2, …,] [default])
        s = cls._convert_decode(s)
        return s

    @classmethod
    def _apply_ddl_strip(cls, s: str) -> str:
        for pattern in cls._DDL_STRIP_PATTERNS:
            s = re.sub(pattern, '', s, flags=re.IGNORECASE)
        return s

    @classmethod
    def _apply_seq(cls, s: str) -> str:
        for pattern, repl in cls._SEQ_SUBS:
            s = re.sub(pattern, repl, s, flags=re.IGNORECASE)
        return s

    @classmethod
    def _convert_decode(cls, sql: str) -> str:
        """
        Convert Oracle DECODE(expr, v1, r1, v2, r2, …, [default]) to
        CASE expr WHEN v1 THEN r1 WHEN v2 THEN r2 … [ELSE default] END.
        Uses a simple parenthesis-balanced argument splitter.
        """
        def replacer(m: re.Match) -> str:
            args_str = m.group(1)
            args = _split_args(args_str)
            if len(args) < 3:
                return m.group(0)   # can't parse — leave as-is
            expr = args[0].strip()
            pairs = args[1:]
            parts = [f'CASE {expr}']
            i = 0
            while i + 1 < len(pairs):
                parts.append(f' WHEN {pairs[i].strip()} THEN {pairs[i+1].strip()}')
                i += 2
            if i < len(pairs):   # odd element = ELSE default
                parts.append(f' ELSE {pairs[i].strip()}')
            parts.append(' END')
            return ''.join(parts)

        return re.sub(r'\bDECODE\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)',
                      replacer, sql, flags=re.IGNORECASE)


def _split_args(s: str) -> list:
    """Split a comma-separated argument string respecting nested parentheses."""
    args, current, depth = [], [], 0
    for ch in s:
        if ch == '(':
            depth += 1
            current.append(ch)
        elif ch == ')':
            depth -= 1
            current.append(ch)
        elif ch == ',' and depth == 0:
            args.append(''.join(current))
            current = []
        else:
            current.append(ch)
    if current:
        args.append(''.join(current))
    return args


# ---------------------------------------------------------------------------
# Main dialect converter (sqlglot + OracleToPgConverter for oracle)
# ---------------------------------------------------------------------------

class DialectConverter:
    """Converts a SQL string from a source dialect to PostgreSQL."""

    SUPPORTED = ("postgresql", "mysql", "sqlite", "mssql", "oracle", "tsql")

    @classmethod
    def convert(cls, sql: str, source_dialect: str) -> str:
        dialect = source_dialect.lower().strip()

        # Remove all SQL comments while preserving string literals
        pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
        sql = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql)

        if dialect == "postgresql":
            return sql.strip()

        if dialect not in cls.SUPPORTED:
            raise ValueError(
                f"Unsupported dialect: {source_dialect!r}. Supported: {cls.SUPPORTED}"
            )

        # Oracle: use the dedicated rule-based converter
        if dialect == "oracle":
            logger.info("Using OracleToPgConverter for Oracle dialect.")
            return OracleToPgConverter.convert(sql)

        # All other dialects: use sqlglot
        read_dialect = "tsql" if dialect == "mssql" else dialect
        try:
            import sqlglot.expressions as exp

            ast_list = sqlglot.parse(sql, read=read_dialect)
            valid_statements = []
            for stmt in ast_list:
                if not stmt:
                    continue
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
        Returns (converted_list, failed_list) where:
          - converted_list: list of PostgreSQL SQL strings (None as placeholder
            for statements that failed — position preserved for splicing).
          - failed_list: list of (position, raw_stmt) tuples for statements
            that could not be converted and must be handled elsewhere.
        """
        dialect = source_dialect.lower().strip()

        pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
        sql = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql)

        if dialect == "postgresql":
            return [sql.strip()], []

        # Oracle: use the rule-based converter — it handles the whole file
        if dialect == "oracle":
            logger.info("Using OracleToPgConverter (convert_partial) for Oracle dialect.")
            try:
                converted_sql = OracleToPgConverter.convert(sql)
                # Return all statements as successfully converted
                return [converted_sql], []
            except Exception as e:
                logger.error(f"OracleToPgConverter failed: {e}")
                return [None], [(0, sql)]

        import sqlglot.expressions as exp
        read_dialect = "tsql" if dialect == "mssql" else dialect

        try:
            ast_list = sqlglot.parse(sql, read=read_dialect)
        except Exception as e:
            logger.error(f"SQLGlot parse failed entirely: {e}")
            stmts = [s.strip() for s in sql.split(';') if s.strip()]
            converted = [None] * len(stmts)
            failed = [(i, stmt) for i, stmt in enumerate(stmts)]
            return converted, failed

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
                logger.warning(f"Statement-level conversion failed: {e}")
                converted.append(None)
                failed.append((len(converted) - 1, raw))

        return converted, failed
                                node.args["quoted"] = False
                    converted.append(stmt.sql(dialect="postgres"))
            except Exception as e:
                logger.warning(f"Statement-level conversion failed, queuing for LLM repair.")
                converted.append(None)
                failed.append((len(converted) - 1, raw))

        return converted, failed
