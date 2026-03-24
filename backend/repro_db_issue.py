
from app.services.db_service import DBService
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)

sql_content = "CREATE TABLE test_table (id SERIAL PRIMARY KEY, name TEXT);"
project_name = "test_chi_repro"

print("Starting DB creation test...")
try:
    new_db_url = DBService.create_dedicated_db_from_sql(sql_content, project_name)
    print(f"SUCCESS: Created DB at {new_db_url}")
except Exception as e:
    print(f"FAILED: {e}")
