import os
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore

_initialized = False
_db = None

def get_firestore_client():
    """Returns an initialized Firestore Admin client, initializing once on first call."""
    global _initialized, _db
    if _initialized:
        return _db

    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "../serviceAccountKey.json")
    # Resolve relative to this file's location
    if not os.path.isabs(cred_path):
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cred_path = os.path.join(base, cred_path.lstrip("./"))

    if not os.path.exists(cred_path):
        raise FileNotFoundError(
            f"Firebase service account key not found at: {cred_path}\n"
            "Set FIREBASE_CREDENTIALS_PATH in your backend/.env"
        )

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    _db = admin_firestore.client()
    _initialized = True
    return _db
