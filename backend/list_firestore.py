"""
List ALL real data currently stored in Firestore under users/*/projects
Run from the backend/ directory:

    .\\venv\\Scripts\\python.exe list_firestore.py
"""
import sys
import os
from datetime import timezone

sys.path.insert(0, os.path.dirname(__file__))

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

print("\n=== Scanning Firestore: users -> (all users) -> projects ===\n")

# List all user documents
users_ref = db.collection("users")
user_docs = list(users_ref.stream())

if not user_docs:
    print("  [!] No documents found under the 'users' collection.")
    print("      This means either:")
    print("      1. No one has connected a database via the app yet")
    print("      2. The backend was offline when someone tried to connect")
    print("      3. You are looking at the wrong Firebase project")
    print()
    print("  Your Firebase project: database-lighthouse")
    print("  Console URL: https://console.firebase.google.com/project/database-lighthouse/firestore/data/~2Fusers")
    sys.exit(0)

print("  Found {} user document(s)\n".format(len(user_docs)))

total_projects = 0
for user_doc in user_docs:
    uid = user_doc.id
    projects_ref = db.collection("users").document(uid).collection("projects")
    projects = list(projects_ref.order_by("createdAt", direction="DESCENDING").stream())

    print("  USER: {}".format(uid))
    if not projects:
        print("    (no projects)")
    for p in projects:
        data = p.to_dict()
        total_projects += 1
        print("    Project ID : {}".format(p.id))
        print("    Name       : {}".format(data.get("projectName", "?")))
        print("    Type       : {}".format(data.get("connectionType", "?")))
        print("    File       : {}".format(data.get("fileName", "-")))
        print("    Dialect    : {}".format(data.get("dialect", "-")))
        print("    DB Host    : {}".format(data.get("dbHost", "-")))
        print("    DB Name    : {}".format(data.get("dbName", "-")))
        print("    Connected  : {}".format(data.get("connectedAt", "-")))
        print("    Created    : {}".format(data.get("createdAt", "-")))
        print()
    print()

print("=== Total: {} project(s) across {} user(s) ===\n".format(total_projects, len(user_docs)))
print("Firebase Console (direct link):")
print("  https://console.firebase.google.com/project/database-lighthouse/firestore/data/~2Fusers")
