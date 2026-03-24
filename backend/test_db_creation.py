import psycopg2
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
import uuid

db_name = f"test_{uuid.uuid4().hex[:8]}"
base_url = "postgresql://postgres:root@127.0.0.1:5432/postgres"

print(f"Testing DB creation for {db_name}...")
engine = create_engine(base_url, poolclass=NullPool)
with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
    connection.execute(text(f"CREATE DATABASE {db_name}"))
print("Done creating database via sqlalchemy.")

print("Connecting via psycopg2...")
try:
    conn = psycopg2.connect(
        dbname=db_name,
        user="postgres",
        password="root",
        host="127.0.0.1",
        port=5432
    )
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT 1;")
        print("Success:", cur.fetchone())
    conn.close()
except Exception as e:
    print(f"Failed psycopg2: {e}")
