import re as _re
import subprocess
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers for run-whole-file + LLM-on-error healing
# ---------------------------------------------------------------------------

def _parse_error_line_number(error_msg: str):
    """
    Pull the 1-indexed line number out of a psycopg2 error string like:
        'syntax error at or near "user"\\nLINE 211: CREATE OR REPLACE …'
    Returns an int or None.
    """
    m = _re.search(r'\bLINE\s+(\d+)\b', error_msg, _re.IGNORECASE)
    return int(m.group(1)) if m else None


def _extract_statement_at_line(sql: str, line_number: int):
    """
    Given the full SQL text and a 1-indexed line number from a psycopg2 error,
    returns a window of text: 10 lines above and 40 lines below the error line.
    
    This provides enough context for the LLM to understand and fix the error,
    without requiring complex AST boundary parsing.

    Returns (statement_text, start_line_1idx, end_line_1idx) or None.
    """
    lines = sql.split('\n')
    n = len(lines)

    if line_number < 1 or line_number > n:
        return None

    target = line_number - 1  # convert to 0-indexed

    start_line = max(0, target - 10)
    end_line = min(n - 1, target + 40)

    statement = '\n'.join(lines[start_line:end_line + 1]).rstrip()
    return statement, start_line + 1, end_line + 1


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------

class DBService:
    @staticmethod
    def verify_connection(connection_string: str) -> bool:
        """
        Verifies if the provided connection string can connect to the database.
        """
        try:
            engine = create_engine(connection_string, poolclass=NullPool)
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Connection verification failed: {e}")
            return False

    @staticmethod
    def create_shadow_clone(source_conn_str: str) -> bool:
        """
        Dumps schema from source and restores it to shadow DB.
        Uses pg_dump (schema-only) and psql.
        """
        try:
            from urllib.parse import urlparse
            source_parsed = urlparse(source_conn_str)
            shadow_parsed = urlparse(settings.SHADOW_DB_URL)

            dump_cmd = [
                settings.PG_DUMP_PATH,
                "--dbname=" + source_conn_str,
                "--schema-only",
                "--no-owner",
                "--no-acl",
                "--format=plain"
            ]

            import os
            env = os.environ.copy()
            if source_parsed.password:
                env['PGPASSWORD'] = source_parsed.password

            logger.info(f"Starting schema dump with: {dump_cmd}")
            dump_process = subprocess.run(dump_cmd, capture_output=True, text=True, encoding='utf-8', env=env)

            if dump_process.returncode != 0:
                logger.error(f"pg_dump failed: {dump_process.stderr}")
                raise Exception(f"Failed to dump schema: {dump_process.stderr}")

            sql_schema = dump_process.stdout

            logger.info("Restoring schema to shadow DB...")
            restore_commands = """
            DROP SCHEMA IF EXISTS public CASCADE;
            CREATE SCHEMA public;
            """ + sql_schema

            restore_cmd = [settings.PSQL_PATH, settings.SHADOW_DB_URL]

            restore_env = os.environ.copy()
            if shadow_parsed.password:
                restore_env['PGPASSWORD'] = shadow_parsed.password

            restore_process = subprocess.run(
                restore_cmd,
                input=restore_commands,
                text=True,
                encoding='utf-8',
                capture_output=True,
                env=restore_env
            )

            if restore_process.returncode != 0:
                logger.error(f"Restore failed: {restore_process.stderr}")
                raise Exception(f"Failed to restore shadow DB: {restore_process.stderr}")

            logger.info("Shadow clone created successfully.")
            return True

        except Exception as e:
            logger.error(f"Shadow cloning error: {e}")
            raise e

    @staticmethod
    def create_shadow_from_sql(sql_content: str) -> bool:
        """
        Populates the shadow DB from a provided SQL string.
        """
        try:
            logger.info("Restoring schema from SQL file...")

            sql_content = sql_content.replace('`', '"')

            import re
            sql_content = re.sub(r'(?i)^\s*DROP\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'(?i)^\s*CREATE\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'(?i)^\s*USE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'^\\\S[^\n]*', '', sql_content, flags=re.MULTILINE)

            pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
            sql_content = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql_content)

            DBService._ensure_shadow_db_exists()

            restore_commands = """
            DROP SCHEMA IF EXISTS public CASCADE;
            CREATE SCHEMA public;
            """ + sql_content

            from urllib.parse import urlparse
            import os
            shadow_parsed = urlparse(settings.SHADOW_DB_URL)
            restore_env = os.environ.copy()
            if shadow_parsed.password:
                restore_env['PGPASSWORD'] = shadow_parsed.password

            restore_cmd = [settings.PSQL_PATH, settings.SHADOW_DB_URL]

            restore_process = subprocess.run(
                restore_cmd,
                input=restore_commands,
                text=True,
                encoding='utf-8',
                capture_output=True,
                env=restore_env
            )

            if restore_process.returncode != 0:
                logger.error(f"Restore from SQL failed: {restore_process.stderr}")
                raise Exception(f"Failed to restore shadow DB from SQL: {restore_process.stderr}")

            logger.info("Shadow clone created from SQL file successfully.")
            return True

        except FileNotFoundError:
            logger.warning("psql not found in PATH or settings.PSQL_PATH. Falling back to SQLAlchemy execution.")
            try:
                engine = create_engine(settings.SHADOW_DB_URL, poolclass=NullPool)
                with engine.connect() as connection:
                    connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
                    connection.execute(text("CREATE SCHEMA public"))
                    connection.commit()
                    connection.execute(text(sql_content))
                    connection.commit()

                logger.info("Shadow clone created from SQL file successfully (via SQLAlchemy).")
                return True

            except Exception as e_sql:
                logger.error(f"Fallback SQL execution failed: {e_sql}")
                raise e_sql

        except Exception as e:
            logger.error(f"Shadow cloning from SQL error: {e}")
            raise e

    @staticmethod
    async def create_dedicated_db_from_sql(
        sql_content: str,
        project_name: str,
        llm_healer=None,
        max_heal_retries: int = 5,
    ) -> dict:
        """
        Creates a new isolated PostgreSQL database and populates it from
        *sql_content*.

        Healing strategy
        ----------------
        1. Run the **entire** SQL file in a single psycopg2 transaction.
        2. If psycopg2 raises an error it reports  ``LINE N:`` — parse N.
        3. Extract the exact statement that contains line N from the SQL text.
        4. Send **only that statement** + the error message to the LLM healer.
        5. Replace those lines in the SQL text with the LLM's corrected version.
        6. **Rollback** (the transaction was never committed, so the DB is clean)
           and re-run the patched file from the very beginning.
        7. Repeat up to *max_heal_retries* times.

        Returns a dict with keys:
            connection_string, healed_count, skipped_count, healed_statements
        """
        import re
        import uuid
        import asyncio
        import psycopg2
        from urllib.parse import urlparse

        # ── Pre-process ────────────────────────────────────────────────────
        sql_content = sql_content.replace('`', '"')
        sql_content = re.sub(r'(?i)^\s*DROP\s+DATABASE\s+.*?;',   '', sql_content, flags=re.MULTILINE)
        sql_content = re.sub(r'(?i)^\s*CREATE\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
        sql_content = re.sub(r'(?i)^\s*USE\s+.*?;',               '', sql_content, flags=re.MULTILINE)
        sql_content = re.sub(r'^\\\S[^\n]*',                       '', sql_content, flags=re.MULTILINE)

        # ── Create the isolated database ───────────────────────────────────
        safe_name = re.sub(r'[^a-z0-9]', '_', project_name.lower())[:30].strip('_')
        db_name   = f"{safe_name}_{uuid.uuid4().hex[:8]}"

        db_url = settings.SHADOW_DB_URL
        if not db_url:
            raise ValueError("SHADOW_DB_URL must be configured as connection template.")

        base_url = db_url.rsplit('/', 1)[0] + '/postgres'
        engine   = create_engine(base_url, poolclass=NullPool)
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn_admin:
            conn_admin.execute(text(f"CREATE DATABASE {db_name}"))

        new_db_url  = db_url.rsplit('/', 1)[0] + f'/{db_name}'
        logger.info(f"Dedicated database '{db_name}' created. Populating…")

        parsed = urlparse(new_db_url)
        conn_params = dict(
            dbname   = parsed.path.lstrip('/'),
            user     = parsed.username,
            password = parsed.password,
            host     = parsed.hostname,
            port     = parsed.port,
        )

        healed_count     = 0
        skipped_count    = 0
        healed_statements: list = []

        # ── Run-fix-rerun loop ─────────────────────────────────────────────
        for attempt in range(1, max_heal_retries + 2):   # +1 for the initial run
            conn = psycopg2.connect(**conn_params)
            conn.autocommit = False   # run in a transaction so rollback = clean slate

            try:
                with conn.cursor() as cur:
                    cur.execute(sql_content)
                conn.commit()
                conn.close()
                logger.info(
                    f"Database '{db_name}' populated successfully "
                    f"(attempt {attempt}, healed={healed_count})."
                )
                break  # ✓ done

            except psycopg2.Error as db_err:
                conn.rollback()
                conn.close()

                # Full error string (pgerror includes the LINE N: context)
                error_msg = (db_err.pgerror or str(db_err)).strip()
                logger.warning(f"Attempt {attempt} failed:\n{error_msg[:400]}")

                if not llm_healer:
                    # No healer configured — propagate as-is
                    raise Exception(f"Failed to populate database: {error_msg}")

                if attempt > max_heal_retries:
                    skipped_count += 1
                    raise Exception(
                        f"SQL still failing after {max_heal_retries} LLM healing "
                        f"attempt(s). Last error:\n{error_msg}"
                    )

                # ── Parse the failing line number ──────────────────────────
                line_number = _parse_error_line_number(error_msg)
                if line_number is None:
                    raise Exception(
                        f"psycopg2 error did not contain a LINE number. "
                        f"Cannot locate failing statement.\nError: {error_msg}"
                    )

                logger.info(f"Error at line {line_number}. Extracting failing statement…")

                # ── Extract the exact statement containing that line ───────
                stmt_info = _extract_statement_at_line(sql_content, line_number)
                if stmt_info is None:
                    raise Exception(
                        f"Could not extract statement at line {line_number} "
                        f"from the SQL content."
                    )

                failing_stmt, start_line, end_line = stmt_info
                logger.info(
                    f"Sending statement at lines {start_line}–{end_line} to LLM…\n"
                    f"{failing_stmt[:300]}"
                )

                # ── Ask the LLM to fix ONLY that statement ─────────────────
                try:
                    if asyncio.iscoroutinefunction(llm_healer):
                        fixed_sql = await llm_healer(
                            oracle_sql    = failing_stmt,
                            error_message = error_msg,
                            line_number   = line_number,
                        )
                    else:
                        fixed_sql = llm_healer(
                            oracle_sql    = failing_stmt,
                            error_message = error_msg,
                            line_number   = line_number,
                        )
                except Exception as heal_err:
                    raise Exception(f"LLM healer raised an error: {heal_err}")

                if not fixed_sql or fixed_sql.strip() == failing_stmt.strip():
                    skipped_count += 1
                    raise Exception(
                        f"LLM could not produce a different fix for the "
                        f"statement at line {line_number}."
                    )
                    
                # ── Ensure no markdown formatting slipped through ────────
                fixed_sql = fixed_sql.strip()
                if fixed_sql.startswith("```"):
                    lines = fixed_sql.split('\n')
                    if lines and lines[0].startswith("```"):
                        lines = lines[1:]  # strip opening backticks
                    if lines and lines[-1].strip() == "```":
                        lines = lines[:-1] # strip closing backticks
                    fixed_sql = '\n'.join(lines).strip()

                # ── Patch the SQL content & prepare for next attempt ───────
                sql_lines    = sql_content.split('\n')
                sql_content  = '\n'.join(
                    sql_lines[:start_line - 1]
                    + [fixed_sql]
                    + sql_lines[end_line:]
                )

                healed_count += 1
                healed_statements.append({
                    "line_start": line_number,
                    "original":   failing_stmt,
                    "fixed":      fixed_sql.strip(),
                })
                logger.info(
                    f"Statement patched (lines {start_line}–{end_line}). "
                    f"Re-running full file (attempt {attempt + 1})…"
                )

        return {
            "connection_string":  new_db_url,
            "healed_count":       healed_count,
            "skipped_count":      skipped_count,
            "healed_statements":  healed_statements,
            "patched_sql":        sql_content,
        }

    @staticmethod
    def _ensure_shadow_db_exists():
        """
        Ensures the shadow_db database exists. If not, it creates it.
        """
        try:
            from urllib.parse import urlparse

            db_url = settings.SHADOW_DB_URL
            if not db_url:
                return

            base_url  = db_url.rsplit('/', 1)[0] + '/postgres'
            target_db = db_url.rsplit('/', 1)[1]

            engine = create_engine(base_url, isolation_level="AUTOCOMMIT", poolclass=NullPool)
            with engine.connect() as connection:
                result = connection.execute(
                    text(f"SELECT 1 FROM pg_database WHERE datname = '{target_db}'")
                )
                if not result.scalar():
                    logger.info(f"Database {target_db} not found. Creating...")
                    connection.execute(text(f"CREATE DATABASE {target_db}"))
                    logger.info(f"Database {target_db} created successfully.")

        except Exception as e:
            logger.error(f"Failed to ensure shadow DB exists: {e}")

    @staticmethod
    def get_table_count(connection_string: str) -> int:
        try:
            DBService._ensure_shadow_db_exists()
            engine = create_engine(connection_string, poolclass=NullPool)
            with engine.connect() as connection:
                result = connection.execute(text(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
                ))
                return result.scalar()
        except Exception:
            return 0

    @staticmethod
    def apply_change(sql_command: str, connection_string: str = None) -> bool:
        """
        Applies a SQL command to the specified database (defaulting to Shadow DB).
        """
        forbidden_keywords = ["DROP DATABASE"]
        upper_sql = sql_command.upper()

        for keyword in forbidden_keywords:
            if keyword in upper_sql:
                logger.warning(f"Blocked destructive SQL: {sql_command}")
                raise ValueError(f"Destructive command '{keyword}' is not allowed for safety concerns.")

        try:
            target_url = connection_string or settings.SHADOW_DB_URL
            engine = create_engine(target_url, poolclass=NullPool)
            with engine.connect() as connection:
                connection.execute(text(sql_command))
                connection.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to apply SQL: {e}")
            raise e
