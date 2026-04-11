import subprocess
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger(__name__)

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
            # Parse password from connection string
            from urllib.parse import urlparse
            source_parsed = urlparse(source_conn_str)
            shadow_parsed = urlparse(settings.SHADOW_DB_URL)
            
            # 1. Dump Schema from Source
            # pg_dump -s (schema only) --no-owner --no-acl
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
            
            # 2. Restore to Shadow DB
            logger.info("Restoring schema to shadow DB...")
            # We need to recreate the public schema to ensure it's clean
            restore_commands = """
            DROP SCHEMA IF EXISTS public CASCADE;
            CREATE SCHEMA public;
            """ + sql_schema
            
            # Use psql to piping the schema
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
            
            # Sanitize SQL dialect issues (e.g. MySQL backticks to Postgres double quotes)
            sql_content = sql_content.replace('`', '"')
            
            # Strip CREATE/DROP DATABASE commands as we provision our own container DB
            import re
            sql_content = re.sub(r'(?i)^\s*DROP\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'(?i)^\s*CREATE\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'(?i)^\s*USE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            # Strip psql meta-commands (\c, \connect, \i, \set, \echo, \copy, etc.)
            sql_content = re.sub(r'^\\[^\n]*', '', sql_content, flags=re.MULTILINE)
            
            # Remove all SQL comments while preserving strings/identifiers
            pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
            sql_content = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql_content)
            
            # 0. Ensure target DB exists
            DBService._ensure_shadow_db_exists()
            
            # Recreate public schema
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
                # Fallback: Execute using SQLAlchemy
                
                # 1. Drop and Create Schema
                engine = create_engine(settings.SHADOW_DB_URL, poolclass=NullPool)
                with engine.connect() as connection:
                    connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
                    connection.execute(text("CREATE SCHEMA public"))
                    connection.commit()
                    
                    # 2. Execute SQL Content
                    # Wrapping in text() might not handle multiple statements in all drivers, 
                    # but psycopg2 usually handles scripts if passed as a single string.
                    # If not, we might need to split by ';', but AI output usually mimics a dump.
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
    def create_dedicated_db_from_sql(sql_content: str, project_name: str) -> str:
        """
        Creates a new, isolated PostgreSQL database for a specific project
        and populates it from a provided SQL string.
        Returns the new connection string.
        """
        try:
            import re
            import uuid
            from urllib.parse import urlparse

            # Sanitize SQL dialect issues (e.g. MySQL backticks to Postgres double quotes)
            sql_content = sql_content.replace('`', '"')
            
            # Strip CREATE/DROP DATABASE commands as we provision our own container DB
            sql_content = re.sub(r'(?i)^\s*DROP\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'(?i)^\s*CREATE\s+DATABASE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            sql_content = re.sub(r'(?i)^\s*USE\s+.*?;', '', sql_content, flags=re.MULTILINE)
            # Strip psql meta-commands (\c, \connect, \i, \set, \echo, \copy, etc.)
            sql_content = re.sub(r'^\\[^\n]*', '', sql_content, flags=re.MULTILINE)

            # Remove all SQL comments while preserving strings/identifiers
            pattern = r"('[^']*'|\"[^\"]*\")|(--[^\n]*|/\*[\s\S]*?\*/)"
            sql_content = re.sub(pattern, lambda m: m.group(1) if m.group(1) else "", sql_content)

            # 1. Sanitize project name to create a safe database name
            safe_name = re.sub(r'[^a-z0-9]', '_', project_name.lower())[:30] # Max 30 chars
            safe_name = safe_name.strip('_')
            db_name = f"{safe_name}_{uuid.uuid4().hex[:8]}"

            # 2. Get base connection URL
            db_url = settings.SHADOW_DB_URL # Defaults to shadow_db connection string
            if not db_url:
                raise ValueError("SHADOW_DB_URL must be configured as connection template.")
            
            base_url = db_url.rsplit('/', 1)[0] + '/postgres'
            
            # 3. Create the database
            logger.info(f"Creating dedicated database: {db_name}")
            engine = create_engine(base_url, poolclass=NullPool)
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
                connection.execute(text(f"CREATE DATABASE {db_name}"))

            # 4. Construct new connection URL
            new_db_url = db_url.rsplit('/', 1)[0] + f'/{db_name}'
            # 5. Populate Database via psycopg2
            logger.info(f"Restoring SQL file into: {db_name}")
            try:
                import psycopg2
                
                # Parse new connection URL
                parsed = urlparse(new_db_url)
                
                # Use psycopg2 to run the literal multi-statement .sql file string
                conn = psycopg2.connect(
                    dbname=parsed.path.lstrip('/'),
                    user=parsed.username,
                    password=parsed.password,
                    host=parsed.hostname,
                    port=parsed.port
                )
                conn.autocommit = True
                
                with conn.cursor() as cur:
                    cur.execute(sql_content)
                
                conn.close()
                logger.info(f"Dedicated database {db_name} populated successfully.")
                return new_db_url
                
            except Exception as e_sql:
                logger.error(f"psycopg2 SQL execution failed: {e_sql}")
                raise Exception(f"Failed to populate database: Invalid SQL or syntax error ({e_sql})")

        except Exception as e:
            logger.error(f"Dedicated DB creation error: {e}")
            raise e

    @staticmethod
    def _ensure_shadow_db_exists():
        """
        Ensures the shadow_db database exists. If not, it creates it.
        """
        try:
            # Parse the URL to get the base connection (to 'postgres' db)
            from urllib.parse import urlparse
            
            # Default to postgres/root/localhost if parsing fails (as a fallback)
            db_url = settings.SHADOW_DB_URL
            if not db_url:
                return

            # Construct connection to 'postgres' database to create 'shadow_db'
            # We can't connect to 'shadow_db' if it doesn't exist.
            base_url = db_url.rsplit('/', 1)[0] + '/postgres'
            target_db = db_url.rsplit('/', 1)[1]
            
            engine = create_engine(base_url, isolation_level="AUTOCOMMIT", poolclass=NullPool)
            with engine.connect() as connection:
                # Check if db exists
                result = connection.execute(text(f"SELECT 1 FROM pg_database WHERE datname = '{target_db}'"))
                if not result.scalar():
                    logger.info(f"Database {target_db} not found. Creating...")
                    connection.execute(text(f"CREATE DATABASE {target_db}"))
                    logger.info(f"Database {target_db} created successfully.")
                    
        except Exception as e:
            logger.error(f"Failed to ensure shadow DB exists: {e}")
            # Don't raise here, we'll try to proceed and let the main connection fail if it must

    @staticmethod
    def get_table_count(connection_string: str) -> int:
        try:
            DBService._ensure_shadow_db_exists() # Ensure DB exists before counting
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
        # 1. Security Validation
        forbidden_keywords = ["DROP DATABASE"]
        upper_sql = sql_command.upper()
        
        for keyword in forbidden_keywords:
            if keyword in upper_sql:
                logger.warning(f"Blocked destructive SQL: {sql_command}")
                raise ValueError(f"Destructive command '{keyword}' is not allowed for safety concerns.")

        # 2. Execute on Target DB
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
