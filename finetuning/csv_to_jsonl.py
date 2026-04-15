import csv
import json
import os

CSV_FILE = os.path.join(os.path.dirname(__file__), "spider_text_sql.csv")
JSONL_FILE = os.path.join(os.path.dirname(__file__), "dataset.jsonl")

INSTRUCTION = "Convert the plain English question into PostgreSQL."

added = 0
skipped = 0

with open(CSV_FILE, newline="", encoding="utf-8") as csv_f, \
     open(JSONL_FILE, "a", encoding="utf-8") as jsonl_f:

    reader = csv.DictReader(csv_f)
    for row in reader:
        text_query = row.get("text_query", "").strip()
        sql_command = row.get("sql_command", "").strip()

        if not text_query or not sql_command:
            skipped += 1
            continue

        entry = {
            "instruction": INSTRUCTION,
            "input": f"Question: {text_query}",
            "output": sql_command,
        }
        jsonl_f.write(json.dumps(entry) + "\n")
        added += 1

print(f"Done. Added {added} entries to {JSONL_FILE} ({skipped} skipped).")
