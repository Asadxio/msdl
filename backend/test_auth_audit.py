import os
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
import firebase_admin
from firebase_admin import firestore as real_admin_firestore

# Set test environment variables
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "test"
os.environ["REQUIRE_APP_CHECK"] = "false"  # allow bypass for unit test requests

import server
from server import app

# ──────────────────────────────────────────────────────────────
# MOCKS AND STUBS
# ──────────────────────────────────────────────────────────────

class FakeFirestoreSnapshot:
    def __init__(self, data, exists=True, doc_id=None, collection_name=None, db_mock=None):
        self._data = data
        self.exists = exists
        self.id = doc_id
        self.collection_name = collection_name
        self.db_mock = db_mock

    def to_dict(self):
        return self._data

    @property
    def reference(self):
        return FakeFirestoreDocument(self.collection_name, self.id, self.db_mock)

class FakeFirestoreDocument:
    def __init__(self, collection_name, doc_id, db_mock):
        self.collection_name = collection_name
        self.id = doc_id
        self.db_mock = db_mock

    def get(self, transaction=None):
        data = self.db_mock.get_doc(self.collection_name, self.id)
        return FakeFirestoreSnapshot(data, exists=(data is not None), doc_id=self.id, collection_name=self.collection_name, db_mock=self.db_mock)

    def set(self, data, merge=False):
        self.db_mock.set_doc(self.collection_name, self.id, data, merge=merge)

    def update(self, data):
        self.db_mock.set_doc(self.collection_name, self.id, data, merge=True)

    def delete(self):
        self.db_mock.delete_doc(self.collection_name, self.id)

    @property
    def reference(self):
        return self

class FakeFirestoreCollection:
    def __init__(self, name, db_mock, filters=None):
        self.name = name
        self.db_mock = db_mock
        self.filters = filters or []

    def document(self, doc_id=None):
        if doc_id is None:
            import uuid
            doc_id = str(uuid.uuid4())
        return FakeFirestoreDocument(self.name, doc_id, self.db_mock)

    def add(self, data):
        import uuid
        doc_id = str(uuid.uuid4())
        self.db_mock.set_doc(self.name, doc_id, data)
        return FakeFirestoreDocument(self.name, doc_id, self.db_mock)

    def where(self, field, op, value):
        new_filters = self.filters + [(field, op, value)]
        return FakeFirestoreCollection(self.name, self.db_mock, new_filters)

    def limit(self, n):
        return self

    def stream(self):
        docs = []
        all_docs = self.db_mock.get_all(self.name)
        for doc_id, data in all_docs.items():
            # Apply filters
            match = True
            for field, op, value in self.filters:
                doc_val = data.get(field)
                if op == "==":
                    if doc_val != value:
                        match = False
                elif op == "<=":
                    if doc_val is None or doc_val > value:
                        match = False
                elif op == "in":
                    if doc_val not in value:
                        match = False
            if match:
                docs.append(FakeFirestoreSnapshot(data, exists=True, doc_id=doc_id, collection_name=self.name, db_mock=self.db_mock))
        return docs

class FakeFirestoreClient:
    def __init__(self):
        self.store = {}
        self.added = {}

    def get_doc(self, collection, doc_id):
        return self.store.get(collection, {}).get(doc_id)

    def get_all(self, collection):
        return self.store.get(collection, {})

    def set_doc(self, collection, doc_id, data, merge=True):
        self.store.setdefault(collection, {})
        # Filter out Increment objects or replace them
        cleaned_data = {}
        for k, v in data.items():
            cleaned_data[k] = v
        if merge and doc_id in self.store[collection]:
            self.store[collection][doc_id].update(cleaned_data)
        else:
            self.store[collection][doc_id] = cleaned_data
        self.added.setdefault(collection, []).append(cleaned_data)

    def delete_doc(self, collection, doc_id):
        if collection in self.store and doc_id in self.store[collection]:
            del self.store[collection][doc_id]

    def collection(self, name):
        return FakeFirestoreCollection(name, self)

    def transaction(self):
        return FakeTransaction()

class FakeTransaction:
    def get(self, doc_ref):
        return doc_ref.get(transaction=self)
    def set(self, doc_ref, data, merge=True):
        doc_ref.set(data, merge=merge)
    def update(self, doc_ref, data):
        doc_ref.update(data)
    def delete(self, doc_ref):
        doc_ref.delete()

class FakeMongoCollection:
    async def insert_one(self, data):
        return None
    def find(self):
        class FakeCursor:
            async def to_list(self, limit):
                return []
        return FakeCursor()

class FakeMongoClient:
    def __init__(self):
        self.status_checks = FakeMongoCollection()

# ──────────────────────────────────────────────────────────────
# TEST FIXTURES
# ──────────────────────────────────────────────────────────────

@pytest.fixture
def setup_test_context(monkeypatch):
    # Initialize fake Firestore Db
    fake_db = FakeFirestoreClient()
    
    # Populate mock users
    fake_db.store["users"] = {
        "uid_super_admin": {"role": "super_admin", "status": "approved", "name": "Super Admin"},
        "uid_founder": {"role": "super_admin", "status": "approved", "founder": True, "name": "Founder"},
        "uid_admin": {"role": "admin", "status": "approved", "name": "Admin"},
        "uid_teacher": {"role": "teacher", "status": "approved", "name": "Teacher"},
        "uid_student": {"role": "student", "status": "approved", "name": "Student"},
        "uid_parent": {"role": "parent", "status": "approved", "name": "Parent"},  # Normalized to student at verify
        "uid_disabled": {"role": "student", "status": "disabled", "name": "Disabled"},
        "uid_unapproved": {"role": "student", "status": "pending", "name": "Pending"},
    }

    # Mock token verification
    def mock_verify_id_token(token, check_revoked=False):
        if token == "super_admin_token":
            return {"uid": "uid_super_admin", "email": "super_admin@msdl.com", "email_verified": True}
        elif token == "founder_token":
            return {"uid": "uid_founder", "email": "founder@msdl.com", "email_verified": False}
        elif token == "admin_token":
            return {"uid": "uid_admin", "email": "admin@msdl.com", "email_verified": True}
        elif token == "teacher_token":
            return {"uid": "uid_teacher", "email": "teacher@msdl.com", "email_verified": True}
        elif token == "student_token":
            return {"uid": "uid_student", "email": "student@msdl.com", "email_verified": True}
        elif token == "parent_token":
            return {"uid": "uid_parent", "email": "parent@msdl.com", "email_verified": True}
        elif token == "anonymous_token":
            return {"uid": "uid_anonymous", "email_verified": False}
        elif token == "disabled_token":
            return {"uid": "uid_disabled", "email": "disabled@msdl.com", "email_verified": True}
        elif token == "unapproved_token":
            return {"uid": "uid_unapproved", "email": "unapproved@msdl.com", "email_verified": True}
        elif token == "revoked_token":
            raise Exception("Token revoked")
        elif token == "expired_token":
            raise Exception("Token expired")
        else:
            raise Exception("Invalid token")

    monkeypatch.setattr(server.firebase_auth, "verify_id_token", mock_verify_id_token)
    monkeypatch.setattr(server, "firebase_db", fake_db)
    monkeypatch.setattr(server, "db", FakeMongoClient())
    
    # Mock transactional helpers
    import payments.payment_finalizer as finalizer_module
    monkeypatch.setattr(finalizer_module.admin_firestore, "transactional", lambda fn: fn, raising=False)
    monkeypatch.setattr(finalizer_module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    
    # Mock nonce check and action confirm
    monkeypatch.setattr(server, "_enforce_nonce", lambda request, uid: None)
    monkeypatch.setattr(server, "_validate_admin_origin", lambda request: None)
    
    return fake_db

# ──────────────────────────────────────────────────────────────
# VERIFICATION RUNTIME TESTS
# ──────────────────────────────────────────────────────────────

def test_login_and_auth_verification(setup_test_context):
    client = TestClient(app)
    
    # 1. Super Admin
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer super_admin_token"})
    assert response.status_code == 200
    
    # 2. Founder (email verification bypass should succeed)
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer founder_token"})
    assert response.status_code == 200
    
    # 3. Admin
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200

    # 4. Teacher
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer teacher_token"})
    assert response.status_code == 200

    # 5. Student
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 200

    # 6. Parent
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer parent_token"})
    assert response.status_code == 200

    # 7. Anonymous (uid not in Firestore)
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer anonymous_token"})
    assert response.status_code == 403
    assert "Approved user required" in response.json()["detail"]

    # 8. Disabled User
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer disabled_token"})
    assert response.status_code == 403
    assert "Approved user required" in response.json()["detail"]

    # 9. Unapproved User
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer unapproved_token"})
    assert response.status_code == 403
    assert "Approved user required" in response.json()["detail"]

    # 10. Invalid, Revoked, or Expired Token
    response = client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer invalid_token"})
    assert response.status_code == 401
    assert "Invalid auth token" in response.json()["detail"]


def test_rbac_protected_endpoints(setup_test_context):
    client = TestClient(app)

    # 1. Super Admin and Admin can access get_status_checks
    response = client.get("/api/status", headers={"Authorization": "Bearer super_admin_token"})
    assert response.status_code == 200

    response = client.get("/api/status", headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200

    # Students, teachers, and others are blocked from get_status_checks
    response = client.get("/api/status", headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403

    # Teacher gets 403
    response = client.get("/api/status", headers={"Authorization": "Bearer teacher_token"})
    assert response.status_code == 403


def test_rbac_payments_admin_action(setup_test_context):
    client = TestClient(app)
    
    # Pre-populate dummy payment
    setup_test_context.store["payments"] = {
        "pay_1": {
            "state": "pending",
            "status": "pending",
            "amount": 100,
            "user_id": "uid_student",
            "provider": "razorpay",
            "type": "fees",
            "review_mode": "manual",
            "currency": "INR"
        }
    }
    
    payload = {"payment_id": "pay_1", "next_state": "succeeded", "note": "manually approved"}

    # Admin/Super Admin can run payments_admin_action
    response = client.post("/api/payments/admin/action", json=payload, headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200

    # Student / Teacher gets 403
    response = client.post("/api/payments/admin/action", json=payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403

    response = client.post("/api/payments/admin/action", json=payload, headers={"Authorization": "Bearer teacher_token"})
    assert response.status_code == 403


def test_rbac_push_endpoints(setup_test_context):
    client = TestClient(app)

    # Broadcast Push (send_to_all = True): Only admins allowed
    broadcast_payload = {"title": "Hello", "body": "World", "send_to_all": True}
    
    response = client.post("/api/push/send", json=broadcast_payload, headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200

    response = client.post("/api/push/send", json=broadcast_payload, headers={"Authorization": "Bearer teacher_token"})
    assert response.status_code == 403

    response = client.post("/api/push/send", json=broadcast_payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403

    # Enqueue Push: Teachers and admins allowed
    enqueue_payload = {
        "dedupe_id": "d1",
        "event": "e1",
        "channel": "c1",
        "payload": {},
        "recipients": ["r1"]
    }
    
    response = client.post("/api/push/enqueue", json=enqueue_payload, headers={"Authorization": "Bearer teacher_token"})
    assert response.status_code == 200

    response = client.post("/api/push/enqueue", json=enqueue_payload, headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200

    # Student cannot enqueue
    response = client.post("/api/push/enqueue", json=enqueue_payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403


def test_rbac_certificate_generation(setup_test_context):
    client = TestClient(app)

    # Setup database requirements for certificate generation
    setup_test_context.store["courses"] = {
        "course_1": {"name": "LMS Course", "requires_payment": True}
    }
    setup_test_context.store["enrollments"] = {
        "uid_student:course_1": {"user_id": "uid_student", "course_id": "course_1", "status": "active"}
    }
    setup_test_context.store["lessons"] = {
        "l1": {"course_id": "course_1"}
    }
    setup_test_context.store["lesson_progress"] = {
        "prog_1": {"user_id": "uid_student", "course_id": "course_1", "lesson_id": "l1", "completed": True}
    }
    setup_test_context.store["payments"] = {
        "uid_student:course_1": {"user_id": "uid_student", "course_id": "course_1", "state": "succeeded", "status": "succeeded"}
    }
    setup_test_context.store["quiz_results"] = {
        "qr_1": {"user_id": "uid_student", "quiz_id": "quiz_1", "score": 10, "total_questions": 10}
    }

    payload = {"course_id": "course_1"}

    # Active student can generate certificate
    response = client.post("/api/certificates/generate", json=payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Missing enrollment should return 403
    setup_test_context.store["enrollments"] = {}
    response = client.post("/api/certificates/generate", json=payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403


def test_rbac_quiz_submission(setup_test_context):
    client = TestClient(app)

    # Student submitting quiz
    payload = {
        "quiz_id": "quiz_1",
        "nonce": "n1",
        "started_at_ms": int(server.time.time() * 1000) - 5000,
        "score": 8,
        "total_questions": 10
    }

    response = client.post("/api/lms/quiz/submit", json=payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_rbac_analytics_endpoints(setup_test_context):
    client = TestClient(app)

    # Analytics Ingest is allowed for any approved user
    payload = {"events": [{"name": "click", "ts": int(server.time.time() * 1000)}]}
    response = client.post("/api/analytics/ingest", json=payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 200

    # Analytics Aggregation Job requires admin or moderator role
    response = client.post("/api/jobs/aggregate-analytics", headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200

    response = client.post("/api/jobs/aggregate-analytics", headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403


def test_rbac_ai_infer(setup_test_context):
    client = TestClient(app)

    # Regular feature is allowed for student
    payload = {"feature": "lms_summary", "payload": {"content": "Sample content text"}}
    response = client.post("/api/ai/infer", json=payload, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 200

    # Restricted feature (ops_insight) requires admin/super_admin/moderator
    payload_restricted = {"feature": "ops_insight", "payload": {}}
    response = client.post("/api/ai/infer", json=payload_restricted, headers={"Authorization": "Bearer student_token"})
    assert response.status_code == 403

    response = client.post("/api/ai/infer", json=payload_restricted, headers={"Authorization": "Bearer admin_token"})
    assert response.status_code == 200


def test_security_logging_on_auth_failures(setup_test_context):
    client = TestClient(app)

    # Clean the recorded logs list
    setup_test_context.added["security_events_immutable"] = []

    # Expired token -> should log security event 'auth_token_failed'
    client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer expired_token"})
    logs = setup_test_context.added.get("security_events_immutable", [])
    assert len(logs) > 0
    assert any(log["event"] == "auth_token_failed" for log in logs)

    # Deactivated user -> should log security event 'auth_unapproved_user'
    client.post("/api/status", json={"client_name": "Web"}, headers={"Authorization": "Bearer disabled_token"})
    logs = setup_test_context.added.get("security_events_immutable", [])
    assert any(log["event"] == "auth_unapproved_user" for log in logs)
