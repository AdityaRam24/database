"""
Quick Firestore verification script.
Run from the backend/ directory:

    .\\venv\\Scripts\\python.exe test_firestore.py

It will:
  1. Write a test document to  users/TEST_USER/projects/
  2. Read it back and print every field
  3. List all docs for that test user
  4. Delete the test document (cleanup)
"""
# -*- coding: utf-8 -*-

import sys
import os
from datetime import datetime, timezone

# Make sure imports work regardless of where you run from
sys.path.insert(0, os.path.dirname(__file__))

# Locate the service account key (one level up from backend/)
KEY_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json")
)

if not os.path.exists(KEY_PATH):
    print("[ERROR] serviceAccountKey.json not found at: " + KEY_PATH)
    sys.exit(1)

import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore

if not firebase_admin._apps:
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred)

db = admin_firestore.client()

TEST_UID = "TEST_USER_script"

# ── 1. WRITE ──────────────────────────────────────────────────────────────────
print("\n--- STEP 1: Writing test document to Firestore ---")
doc_ref = (
    db.collection("users")
    .document(TEST_UID)
    .collection("projects")
    .document()
)

test_data = {
    "projectName":    "Test Project (script)",
    "connectionType": "file",
    "connectionString": "SHADOW_DB",
    "sqlContent":     "CREATE TABLE test (id SERIAL PRIMARY KEY);",
    "fileName":       "test.sql",
    "fileType":       "text/x-sql",
    "dialect":        "postgresql",
    "connectedAt":    datetime.now(timezone.utc).isoformat(),
    "createdAt":      admin_firestore.SERVER_TIMESTAMP,
}

doc_ref.set(test_data)
print("  [OK] Written -- document ID: " + doc_ref.id)

# ── 2. READ ───────────────────────────────────────────────────────────────────
print("\n--- STEP 2: Reading it back ---")
snap = doc_ref.get()

if not snap.exists:
    print("  [FAIL] Document NOT found -- Firestore write may have failed!")
    sys.exit(1)

data = snap.to_dict()
print("  [OK] Document exists -- fields stored in Firestore:\n")
for key, val in data.items():
    print("     {:<20}: {}".format(key, val))

# ── 3. LIST all projects for test user ───────────────────────────────────────
print("\n--- STEP 3: Listing all projects under uid='{}' ---".format(TEST_UID))
docs = list(
    db.collection("users")
    .document(TEST_UID)
    .collection("projects")
    .stream()
)
print("  Found {} project(s)".format(len(docs)))
for d in docs:
    dd = d.to_dict()
    print("  * [{}] {} -- type: {}".format(d.id, dd.get("projectName"), dd.get("connectionType")))

# ── 4. CLEANUP ────────────────────────────────────────────────────────────────
print("\n--- STEP 4: Deleting test document (cleanup) ---")
doc_ref.delete()
print("  [OK] Deleted document " + doc_ref.id)

print("\n[SUCCESS] All checks passed -- Firestore is working correctly!\n")
