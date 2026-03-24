
from app.services.db_service import DBService
import logging

logging.basicConfig(level=logging.INFO)

# Simulate the exact SQL that failed in the user's screenshot
sql_content = """
DROP DATABASE IF EXISTS `Chinook`;
CREATE TABLE "users" (
  "id" int NOT NULL,
  "username" varchar(50) NOT NULL,
  PRIMARY KEY ("id")
);
"""

project_name = "test_backticks"

print("Starting DB creation test with backticks...")
try:
    new_db_url = DBService.create_dedicated_db_from_sql(sql_content, project_name)
    print(f"SUCCESS: Created DB at {new_db_url}")
except Exception as e:
    print(f"FAILED: {e}")
