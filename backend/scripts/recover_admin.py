import os
import sys
import json
import logging
from typing import Optional

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('recover_admin')

try:
    import firebase_admin
    from firebase_admin import credentials, auth, firestore
except ImportError:
    logger.error("firebase-admin package is not installed. Please install it using 'pip install firebase-admin'")
    sys.exit(1)

def init_firebase():
    """Initialize Firebase Admin SDK using environment variables."""
    if firebase_admin._apps:
        return

    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if service_account_json:
        try:
            cred = credentials.Certificate(json.loads(service_account_json))
            firebase_admin.initialize_app(cred)
            logger.info("Initialized Firebase with FIREBASE_SERVICE_ACCOUNT_JSON")
            return
        except Exception as e:
            logger.error(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
            sys.exit(1)

    service_account_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if service_account_path:
        if not os.path.exists(service_account_path):
            logger.error(f"GOOGLE_APPLICATION_CREDENTIALS path does not exist: {service_account_path}")
            sys.exit(1)
        try:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            logger.info(f"Initialized Firebase with GOOGLE_APPLICATION_CREDENTIALS: {service_account_path}")
            return
        except Exception as e:
            logger.error(f"Failed to load credentials from {service_account_path}: {e}")
            sys.exit(1)

    logger.error("Firebase admin credentials not configured. Please set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON")
    sys.exit(1)

def recover_admin(identifier: str):
    """
    Recover an admin account by setting their Firestore role to 'super_admin' and status to 'approved'.
    Accepts an email address or a UID.
    """
    init_firebase()
    db = firestore.client()

    uid: Optional[str] = None
    email: Optional[str] = None

    # Check if identifier is an email
    if '@' in identifier:
        email = identifier
        logger.info(f"Looking up Firebase Auth user by email: {email}")
        try:
            user = auth.get_user_by_email(email)
            uid = user.uid
            logger.info(f"Found user UID: {uid}")
        except Exception as e:
            logger.error(f"Could not find user with email '{email}': {e}")
            sys.exit(1)
    else:
        uid = identifier
        logger.info(f"Looking up Firebase Auth user by UID: {uid}")
        try:
            user = auth.get_user(uid)
            email = user.email
            logger.info(f"Found user email: {email}")
        except Exception as e:
            logger.error(f"Could not find user with UID '{uid}': {e}")
            sys.exit(1)

    # Perform the recovery
    logger.warning(f"INITIATING EMERGENCY RECOVERY FOR USER: {email or uid} (UID: {uid})")
    
    try:
        user_ref = db.collection('users').document(uid)
        doc = user_ref.get()
        
        updates = {
            'role': 'super_admin',
            'status': 'approved',
            'founder': True
        }
        
        if doc.exists:
            logger.info(f"Existing user document found. Updating role and status...")
            user_ref.update(updates)
        else:
            logger.info(f"No existing user document found. Creating new document with super_admin role...")
            user_ref.set(updates)
            
        logger.info(f"SUCCESS: User {email or uid} is now a super_admin.")
    except Exception as e:
        logger.error(f"Failed to update Firestore document for UID {uid}: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python recover_admin.py <email_or_uid>")
        print("Example: python recover_admin.py sumraftm@gmail.com")
        sys.exit(1)
        
    target = sys.argv[1]
    recover_admin(target)
