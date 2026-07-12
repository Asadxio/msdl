"""
PHASE 8: LMS & ACADEMIC INTEGRITY AUDIT
=========================================
Production integrity test suite covering the complete learning lifecycle:
 1.  Course Enrollment
 2.  Lesson / Content Access Control
 3.  Quiz Engine - server-side grading
 4.  Anti-Cheat - timing, duplicate, replay
 5.  Certificate Eligibility - quiz + attendance thresholds
 6.  Course Completion - correct lesson-count logic
 7.  Concurrent stress tests
 8.  Firestore rule semantics
"""

import time
import threading
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Shared Firestore stub
# ---------------------------------------------------------------------------

class FakeDoc:
    def __init__(self, data=None, exists=None):
        self._data = data or {}
        self.exists = (data is not None) if exists is None else exists

    def to_dict(self):
        return dict(self._data) if self._data else {}


class FakeQuery:
    def __init__(self, docs):
        self._docs = docs

    def where(self, field, op, val):
        filtered = []
        for d in self._docs:
            data = d.to_dict()
            v = data.get(field)
            if op == "==" and v == val:
                filtered.append(d)
        return FakeQuery(filtered)

    def limit(self, n):
        return FakeQuery(self._docs[:n])

    def stream(self):
        return iter(self._docs)


_FAKE_LOCK = threading.RLock()


class FakeCollection:
    def __init__(self, store, name):
        self._store = store
        self._name = name

    def _all_docs(self):
        with _FAKE_LOCK:
            return [FakeDoc(v) for v in list(self._store.get(self._name, {}).values())]

    def document(self, doc_id):
        return FakeDocRef(self._store, self._name, doc_id)

    def where(self, field, op, val):
        return FakeQuery(self._all_docs()).where(field, op, val)

    def limit(self, n):
        return FakeQuery(self._all_docs()).limit(n)

    def stream(self):
        return FakeQuery(self._all_docs()).stream()

    def add(self, data):
        import uuid
        with _FAKE_LOCK:
            doc_id = str(uuid.uuid4())
            self._store.setdefault(self._name, {})[doc_id] = data
            return (None, FakeDocRef(self._store, self._name, doc_id))


class FakeDocRef:
    def __init__(self, store, coll, doc_id):
        self._store = store
        self._coll = coll
        self._doc_id = doc_id

    def get(self):
        with _FAKE_LOCK:
            data = self._store.get(self._coll, {}).get(self._doc_id)
            return FakeDoc(data)

    def set(self, data, merge=False):
        with _FAKE_LOCK:
            coll = self._store.setdefault(self._coll, {})
            if merge and self._doc_id in coll:
                coll[self._doc_id].update(data)
            else:
                coll[self._doc_id] = dict(data)

    def update(self, data):
        with _FAKE_LOCK:
            coll = self._store.setdefault(self._coll, {})
            if self._doc_id in coll:
                coll[self._doc_id].update(data)

    @property
    def id(self):
        return self._doc_id

    def collection(self, name):
        key = f"{self._coll}/{self._doc_id}/{name}"
        return FakeCollection(self._store, key)


class FakeFirestoreDB:
    def __init__(self):
        self.store = {}

    def collection(self, name):
        return FakeCollection(self.store, name)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    return FakeFirestoreDB()


# ===========================================================================
# 1. COURSE ENROLLMENT
# ===========================================================================

class TestCourseEnrollment:

    def test_enrollment_doc_id_format(self):
        from server import _enrollment_doc_id
        assert _enrollment_doc_id("user123", "course456") == "user123:course456"

    def test_enrollment_doc_id_strips_whitespace(self):
        from server import _enrollment_doc_id
        assert _enrollment_doc_id("  uid  ", "  cid  ") == "uid:cid"

    def test_active_enrollment_predicate_true(self):
        from server import _is_active_enrollment
        data = {"user_id": "uid1", "course_id": "cid1", "status": "active"}
        assert _is_active_enrollment(data, "uid1", "cid1") is True

    def test_active_enrollment_predicate_wrong_user(self):
        from server import _is_active_enrollment
        data = {"user_id": "uid1", "course_id": "cid1", "status": "active"}
        assert _is_active_enrollment(data, "uid2", "cid1") is False

    def test_active_enrollment_predicate_wrong_course(self):
        from server import _is_active_enrollment
        data = {"user_id": "uid1", "course_id": "cid1", "status": "active"}
        assert _is_active_enrollment(data, "uid1", "cid2") is False

    def test_active_enrollment_predicate_inactive_status(self):
        from server import _is_active_enrollment
        data = {"user_id": "uid1", "course_id": "cid1", "status": "inactive"}
        assert _is_active_enrollment(data, "uid1", "cid1") is False

    def test_active_enrollment_predicate_cancelled_status(self):
        from server import _is_active_enrollment
        data = {"user_id": "uid1", "course_id": "cid1", "status": "cancelled"}
        assert _is_active_enrollment(data, "uid1", "cid1") is False

    def test_active_enrollment_predicate_missing_status(self):
        from server import _is_active_enrollment
        data = {"user_id": "uid1", "course_id": "cid1"}
        assert _is_active_enrollment(data, "uid1", "cid1") is False

    def test_active_enrollment_predicate_empty_data(self):
        from server import _is_active_enrollment
        assert _is_active_enrollment({}, "uid1", "cid1") is False


# ===========================================================================
# 2. COURSE COMPLETION LOGIC (BUG FIX VERIFICATION)
# ===========================================================================

class TestCourseCompletion:
    """
    Critical BUG FIX test class (Phase 8):
    Old _has_completed_course used all() over ONLY opened lessons.
    A student who opened & completed 1 of 10 lessons was incorrectly
    considered to have completed the full course.
    """

    def test_all_lessons_completed_returns_true(self, db):
        db.store["lessons"] = {
            "l1": {"course_id": "c1"},
            "l2": {"course_id": "c1"},
            "l3": {"course_id": "c1"},
        }
        db.store["lesson_progress"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "lesson_id": "l1", "completed": True},
            "p2": {"user_id": "u1", "course_id": "c1", "lesson_id": "l2", "completed": True},
            "p3": {"user_id": "u1", "course_id": "c1", "lesson_id": "l3", "completed": True},
        }
        import server
        with patch.object(server, "firebase_db", db):
            assert server._has_completed_course("u1", "c1") is True

    def test_partial_completion_returns_false(self, db):
        """
        BUG FIX: Student completed only 1 of 3 lessons.
        Old code: all([completed=True]) over 1 doc -> True  (WRONG)
        New code: completed_count(1) < total_lessons(3) -> False (CORRECT)
        """
        db.store["lessons"] = {
            "l1": {"course_id": "c1"},
            "l2": {"course_id": "c1"},
            "l3": {"course_id": "c1"},
        }
        db.store["lesson_progress"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "lesson_id": "l1", "completed": True},
        }
        import server
        with patch.object(server, "firebase_db", db):
            result = server._has_completed_course("u1", "c1")
            assert result is False, (
                "BUG REGRESSION: _has_completed_course returned True for a student who "
                "completed only 1 of 3 lessons. The old all() bug has returned."
            )

    def test_no_progress_records_returns_false(self, db):
        db.store["lessons"] = {"l1": {"course_id": "c1"}}
        db.store["lesson_progress"] = {}
        import server
        with patch.object(server, "firebase_db", db):
            assert server._has_completed_course("u1", "c1") is False

    def test_no_lessons_in_course_returns_false(self, db):
        """Course with no lessons configured is not completable."""
        db.store["lessons"] = {}
        db.store["lesson_progress"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "completed": True},
        }
        import server
        with patch.object(server, "firebase_db", db):
            assert server._has_completed_course("u1", "c1") is False

    def test_some_lessons_not_completed_returns_false(self, db):
        db.store["lessons"] = {
            "l1": {"course_id": "c1"},
            "l2": {"course_id": "c1"},
        }
        db.store["lesson_progress"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "lesson_id": "l1", "completed": True},
            "p2": {"user_id": "u1", "course_id": "c1", "lesson_id": "l2", "completed": False},
        }
        import server
        with patch.object(server, "firebase_db", db):
            assert server._has_completed_course("u1", "c1") is False

    def test_course_isolation_across_courses(self, db):
        """Completing lessons in course B should not affect course A."""
        db.store["lessons"] = {
            "l_a1": {"course_id": "courseA"},
            "l_a2": {"course_id": "courseA"},
            "l_b1": {"course_id": "courseB"},
        }
        db.store["lesson_progress"] = {
            "p_b1": {"user_id": "u1", "course_id": "courseB", "lesson_id": "l_b1", "completed": True},
            "p_a1": {"user_id": "u1", "course_id": "courseA", "lesson_id": "l_a1", "completed": True},
        }
        import server
        with patch.object(server, "firebase_db", db):
            assert server._has_completed_course("u1", "courseB") is True
            assert server._has_completed_course("u1", "courseA") is False


# ===========================================================================
# 3. QUIZ ENGINE - Server-Side Grading
# ===========================================================================

class TestQuizGrading:

    def _make_quiz_db(self, db, questions):
        db.store["quizzes"] = {
            "quiz1": {"title": "Test Quiz", "questions": questions}
        }
        return db

    def test_server_grading_correct_answers(self, db):
        """Server correctly grades a quiz when answers dict is provided."""
        questions = [
            {"id": "q1", "correctOptionIndex": 0},
            {"id": "q2", "correctOptionIndex": 2},
            {"id": "q3", "correctOptionIndex": 1},
        ]
        self._make_quiz_db(db, questions)
        db.store["users"] = {"u1": {"role": "student", "status": "approved"}}

        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "u1", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz1",
                    "nonce": "nonce_grading_test",
                    "started_at_ms": int(time.time() * 1000) - 60000,
                    "answers": {"q1": 0, "q2": 2, "q3": 1},
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["score"] == 3
            assert data["total_questions"] == 3
            assert data["grading_mode"] == "server"

    def test_server_grading_wrong_answers(self, db):
        """Server-side grading computes partial score correctly."""
        questions = [
            {"id": "q1", "correctOptionIndex": 0},
            {"id": "q2", "correctOptionIndex": 1},
            {"id": "q3", "correctOptionIndex": 2},
        ]
        self._make_quiz_db(db, questions)
        db.store["users"] = {"u2": {"role": "student", "status": "approved"}}

        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "u2", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz1",
                    "nonce": "nonce_partial",
                    "started_at_ms": int(time.time() * 1000) - 60000,
                    "answers": {"q1": 0, "q2": 99, "q3": 99},
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["score"] == 1
            assert data["grading_mode"] == "server"

    def test_legacy_client_falls_back_to_client_score(self, db):
        """Legacy clients (no answers field) use client score but are flagged."""
        db.store["quizzes"] = {}
        db.store["users"] = {"u3": {"role": "student", "status": "approved"}}
        security_events = []

        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "u3", "email": "s@test.com", "email_verified": True,
             }), \
             patch.object(server, "log_security_event",
                          side_effect=lambda db, log, event, data: security_events.append(event)):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz_legacy",
                    "nonce": "nonce_legacy",
                    "started_at_ms": int(time.time() * 1000) - 60000,
                    "score": 8,
                    "total_questions": 10,
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["grading_mode"] == "legacy_client_score"
            assert data["score"] == 8
            assert "quiz_submit_legacy_client_score" in security_events

    def test_nonexistent_quiz_returns_404(self, db):
        """Server grading fails with 404 if quiz_id doesn't exist."""
        db.store["quizzes"] = {}
        db.store["users"] = {"u4": {"role": "student", "status": "approved"}}

        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "u4", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "nonexistent",
                    "nonce": "nonce_404",
                    "started_at_ms": int(time.time() * 1000) - 60000,
                    "answers": {"q1": 0},
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code == 404

    def test_extra_answer_keys_ignored_safely(self, db):
        """Extra answer keys not in quiz questions are ignored."""
        questions = [{"id": "q1", "correctOptionIndex": 1}]
        self._make_quiz_db(db, questions)
        db.store["users"] = {"u5": {"role": "student", "status": "approved"}}

        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "u5", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz1",
                    "nonce": "nonce_extra",
                    "started_at_ms": int(time.time() * 1000) - 60000,
                    "answers": {"q1": 1, "q999": 0},
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["score"] == 1
            assert data["total_questions"] == 1

    def test_client_cannot_override_server_score(self, db):
        """CRITICAL: answers path must ignore client-supplied score field."""
        questions = [{"id": "q1", "correctOptionIndex": 0}]
        self._make_quiz_db(db, questions)
        db.store["users"] = {"u6": {"role": "student", "status": "approved"}}

        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "u6", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz1",
                    "nonce": "nonce_override",
                    "started_at_ms": int(time.time() * 1000) - 60000,
                    "answers": {"q1": 99},   # Wrong answer
                    "score": 9999,           # Inflated client score - must be ignored
                    "total_questions": 1,
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["score"] == 0, (
                "CRITICAL: Server accepted inflated client score. "
                "answers-based path must always use server-computed score."
            )
            assert data["grading_mode"] == "server"


# ===========================================================================
# 4. ANTI-CHEAT: Duplicates, Timing, Replay
# ===========================================================================

class TestAntiCheat:

    def test_duplicate_submission_rejected_by_nonce(self, db):
        """Same nonce+quiz_id must be rejected as duplicate (409)."""
        db.store["users"] = {"dup_uid": {"role": "student", "status": "approved"}}
        db.store["quizzes"] = {
            "quiz_dup": {"questions": [{"id": "q1", "correctOptionIndex": 0}]}
        }
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "dup_uid", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            payload = {
                "quiz_id": "quiz_dup",
                "nonce": "nonce_dup_test",
                "started_at_ms": int(time.time() * 1000) - 30000,
                "answers": {"q1": 0},
            }
            r1 = client.post("/api/lms/quiz/submit", json=payload, headers={"Authorization": "Bearer test-token"})
            assert r1.status_code == 200
            r2 = client.post("/api/lms/quiz/submit", json=payload, headers={"Authorization": "Bearer test-token"})
            assert r2.status_code == 409
            assert "Duplicate" in r2.json().get("detail", "")

    def test_suspicious_timing_flagged(self):
        """Quiz submitted in < 1 second is suspicious."""
        from server import suspicious_timing
        started_at = int(time.time() * 1000) - 500
        now = int(time.time() * 1000)
        assert suspicious_timing(started_at, now) is True

    def test_normal_timing_not_flagged(self):
        from server import suspicious_timing
        started_at = int(time.time() * 1000) - 60000
        now = int(time.time() * 1000)
        assert suspicious_timing(started_at, now) is False

    def test_expired_attempt_rejected(self):
        from server import is_attempt_expired
        old_start = int(time.time() * 1000) - (25 * 60 * 60 * 1000)
        assert is_attempt_expired(old_start) is True

    def test_fresh_attempt_not_expired(self):
        from server import is_attempt_expired
        recent_start = int(time.time() * 1000) - (15 * 60 * 1000)
        assert is_attempt_expired(recent_start) is False

    def test_stale_timestamp_rejected_by_endpoint(self, db):
        """Quiz started 48h ago should be rejected."""
        db.store["users"] = {"stale_uid": {"role": "student", "status": "approved"}}
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "stale_uid", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            stale_start = int(time.time() * 1000) - (48 * 60 * 60 * 1000)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz_stale",
                    "nonce": "nonce_stale",
                    "started_at_ms": stale_start,
                    "answers": {"q1": 0},
                },
                headers={"Authorization": "Bearer test-token"}
            )
            assert resp.status_code in (400, 409)

    def test_anonymous_user_cannot_submit_quiz(self, db):
        """Unauthenticated user must be rejected."""
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token",
                          side_effect=Exception("no token")):
            client = TestClient(server.app)
            resp = client.post(
                "/api/lms/quiz/submit",
                json={
                    "quiz_id": "quiz1",
                    "nonce": "nonce_anon",
                    "started_at_ms": int(time.time() * 1000) - 30000,
                    "answers": {"q1": 0},
                },
            )
            assert resp.status_code in (401, 403, 422)

    def test_rate_limit_fires_after_threshold(self, db):
        """More than 8 quiz submissions per minute should trigger 429."""
        db.store["users"] = {"rate_uid": {"role": "student", "status": "approved"}}
        db.store["quizzes"] = {
            "quiz_rate": {"questions": [{"id": "q1", "correctOptionIndex": 0}]}
        }
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": "rate_uid", "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            statuses = []
            for i in range(12):
                resp = client.post(
                    "/api/lms/quiz/submit",
                    json={
                        "quiz_id": "quiz_rate",
                        "nonce": f"nonce_rate_{i}",
                        "started_at_ms": int(time.time() * 1000) - 30000,
                        "answers": {"q1": 0},
                    },
                    headers={"Authorization": "Bearer test-token"}
                )
                statuses.append(resp.status_code)
            assert 429 in statuses, f"Rate limiter did not fire: statuses={statuses}"


# ===========================================================================
# 5. CERTIFICATE ELIGIBILITY (Phase 8 Hardening)
# ===========================================================================

class TestCertificateEligibility:

    def _setup_eligible_student(self, db, uid="cert_uid"):
        course_id = "c_cert"
        db.store["users"] = {uid: {"name": "Test Student", "role": "student", "status": "approved"}}
        db.store["courses"] = {course_id: {"name": "Test Course", "requires_payment": True}}
        db.store["enrollments"] = {
            f"{uid}:{course_id}": {"user_id": uid, "course_id": course_id, "status": "active"}
        }
        db.store["lessons"] = {
            "l1": {"course_id": course_id},
            "l2": {"course_id": course_id},
        }
        db.store["lesson_progress"] = {
            "p1": {"user_id": uid, "course_id": course_id, "lesson_id": "l1", "completed": True},
            "p2": {"user_id": uid, "course_id": course_id, "lesson_id": "l2", "completed": True},
        }
        db.store["payments"] = {
            "pay1": {"user_id": uid, "course_id": course_id, "state": "succeeded", "status": "succeeded"}
        }
        db.store["quiz_results"] = {
            "qr1": {"user_id": uid, "quiz_id": "quiz1", "score": 8, "total_questions": 10}
        }
        db.store["attendance"] = {
            "a1": {"user_id": uid, "course_id": course_id, "present": True},
            "a2": {"user_id": uid, "course_id": course_id, "present": True},
            "a3": {"user_id": uid, "course_id": course_id, "present": True},
            "a4": {"user_id": uid, "course_id": course_id, "present": True},
        }
        return course_id

    def test_eligible_student_gets_certificate(self, db):
        uid = "cert_ok"
        self._setup_eligible_student(db, uid)
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 200
            assert resp.json()["ok"] is True

    def test_certificate_blocked_without_enrollment(self, db):
        uid = "cert_no_enroll"
        self._setup_eligible_student(db, uid)
        db.store["enrollments"] = {}
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 403

    def test_certificate_blocked_incomplete_course(self, db):
        uid = "cert_incomplete"
        self._setup_eligible_student(db, uid)
        db.store["lesson_progress"]["p2"]["completed"] = False
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 409
            assert "completion" in resp.json()["detail"].lower()

    def test_certificate_blocked_without_payment(self, db):
        uid = "cert_nopay"
        self._setup_eligible_student(db, uid)
        db.store["payments"] = {}
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 402

    def test_certificate_blocked_without_quiz_attempts(self, db):
        """Phase 8 Fix: backend enforces quiz_attempts > 0."""
        uid = "cert_noquiz"
        self._setup_eligible_student(db, uid)
        db.store["quiz_results"] = {}
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 409, (
                "BYPASS: certificate issued without any quiz attempts. "
                "Backend must enforce quiz_attempts > 0."
            )
            assert "quiz" in resp.json()["detail"].lower()

    def test_certificate_blocked_below_75pct_attendance(self, db):
        """Phase 8 Fix: backend enforces attendance >= 75%."""
        uid = "cert_lowattend"
        self._setup_eligible_student(db, uid)
        db.store["attendance"] = {
            "a1": {"user_id": uid, "course_id": "c_cert", "present": True},
            "a2": {"user_id": uid, "course_id": "c_cert", "present": True},
            "a3": {"user_id": uid, "course_id": "c_cert", "present": False},
            "a4": {"user_id": uid, "course_id": "c_cert", "present": False},
        }
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 409
            detail = resp.json()["detail"].lower()
            assert "75%" in resp.json()["detail"] or "attendance" in detail

    def test_certificate_allowed_at_exactly_75pct_attendance(self, db):
        """Exactly 75% attendance (3/4) must be allowed."""
        uid = "cert_exact75"
        self._setup_eligible_student(db, uid)
        db.store["attendance"] = {
            "a1": {"user_id": uid, "course_id": "c_cert", "present": True},
            "a2": {"user_id": uid, "course_id": "c_cert", "present": True},
            "a3": {"user_id": uid, "course_id": "c_cert", "present": True},
            "a4": {"user_id": uid, "course_id": "c_cert", "present": False},
        }
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 200

    def test_certificate_allowed_with_no_attendance_records(self, db):
        """No attendance records (no live classes) - check is skipped."""
        uid = "cert_noattend"
        self._setup_eligible_student(db, uid)
        db.store["attendance"] = {}
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            resp = client.post("/api/certificates/generate",
                               json={"course_id": "c_cert"},
                               headers={"Authorization": "Bearer test-token"})
            assert resp.status_code == 200

    def test_certificate_idempotent(self, db):
        """Requesting certificate twice returns same certificate_id."""
        uid = "cert_idem"
        self._setup_eligible_student(db, uid)
        from fastapi.testclient import TestClient
        import server
        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", return_value={
                 "uid": uid, "email": "s@test.com", "email_verified": True,
             }):
            client = TestClient(server.app)
            r1 = client.post("/api/certificates/generate",
                             json={"course_id": "c_cert"},
                             headers={"Authorization": "Bearer test-token"})
            r2 = client.post("/api/certificates/generate",
                             json={"course_id": "c_cert"},
                             headers={"Authorization": "Bearer test-token"})
            assert r1.status_code == 200
            assert r2.status_code == 200
            assert r1.json()["certificate_id"] == r2.json()["certificate_id"]


# ===========================================================================
# 6. COURSE PAYMENT ACCESS CONTROL
# ===========================================================================

class TestCoursePaymentAccess:

    def test_free_course_no_payment_required(self):
        from server import _course_requires_payment
        assert _course_requires_payment({"requires_payment": False}) is False
        assert _course_requires_payment({"price": 0}) is False
        assert _course_requires_payment({}) is False

    def test_paid_course_by_requires_payment_flag(self):
        from server import _course_requires_payment
        assert _course_requires_payment({"requires_payment": True}) is True

    def test_paid_course_by_price_field(self):
        from server import _course_requires_payment
        assert _course_requires_payment({"price": 999}) is True
        assert _course_requires_payment({"fee_amount": 1}) is True

    def test_paid_course_by_paid_flag(self):
        from server import _course_requires_payment
        assert _course_requires_payment({"paid": True}) is True

    def test_successful_payment_via_state(self, db):
        from server import _has_successful_course_payment
        db.store["payments"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "state": "succeeded"}
        }
        with patch("server.firebase_db", db):
            assert _has_successful_course_payment("u1", "c1") is True

    def test_successful_payment_via_status_field(self, db):
        """Both state and status fields must work (migration compatibility)."""
        from server import _has_successful_course_payment
        db.store["payments"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "status": "succeeded"}
        }
        with patch("server.firebase_db", db):
            assert _has_successful_course_payment("u1", "c1") is True

    def test_pending_payment_not_sufficient(self, db):
        from server import _has_successful_course_payment
        db.store["payments"] = {
            "p1": {"user_id": "u1", "course_id": "c1", "state": "pending"}
        }
        with patch("server.firebase_db", db):
            assert _has_successful_course_payment("u1", "c1") is False

    def test_payment_for_different_user_not_sufficient(self, db):
        from server import _has_successful_course_payment
        db.store["payments"] = {
            "p1": {"user_id": "other_user", "course_id": "c1", "state": "succeeded"}
        }
        with patch("server.firebase_db", db):
            assert _has_successful_course_payment("u1", "c1") is False


# ===========================================================================
# 7. FIRESTORE RULE SEMANTICS
# ===========================================================================

RULES_PATH = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\firestore.rules"


class TestFirestoreRuleSemantics:

    def _rules(self):
        with open(RULES_PATH, "r") as f:
            return f.read()

    def test_quiz_results_direct_create_blocked(self):
        """quiz_results allow create: if false - students cannot forge scores."""
        content = self._rules()
        assert "match /quiz_results/{resultId}" in content
        start = content.index("match /quiz_results/{resultId}")
        block = content[start:start + 1000]
        assert "allow create: if false" in block, (
            "CRITICAL: quiz_results still allows student direct writes. "
            "Score manipulation is possible."
        )

    def test_lessons_use_enrollment_gated_rule(self):
        """Lessons must use canReadLearningContentForCourse (enrollment required)."""
        content = self._rules()
        start = content.index("match /lessons/{lessonId}")
        block = content[start:start + 200]
        assert "canReadLearningContentForCourse" in block, (
            "Lessons collection uses the old canReadLearningContent - "
            "any approved user can read all lessons without enrollment."
        )

    def test_modules_use_enrollment_gated_rule(self):
        content = self._rules()
        start = content.index("match /modules/{moduleId}")
        block = content[start:start + 200]
        assert "canReadLearningContentForCourse" in block

    def test_assignments_use_enrollment_gated_rule(self):
        content = self._rules()
        start = content.index("match /assignments/{assignmentId}")
        block = content[start:start + 200]
        assert "canReadLearningContentForCourse" in block

    def test_canReadLearningContentForCourse_function_exists(self):
        content = self._rules()
        assert "function canReadLearningContentForCourse" in content
        assert "hasActiveEnrollmentForCourse(data.course_id)" in content

    def test_certificates_cannot_be_created_by_students(self):
        content = self._rules()
        start = content.index("match /certificates/{certificateId}")
        block = content[start:start + 300]
        assert "allow create: if false" in block

    def test_canReadCourseData_function_present(self):
        """Course metadata (browse/discover) is still public to approved users."""
        content = self._rules()
        assert "function canReadCourseData" in content

    def test_enrollments_only_admin_can_write(self):
        """Only admin can create/update enrollments - students cannot self-enroll."""
        content = self._rules()
        start = content.index("match /enrollments/{enrollmentId}")
        block = content[start:start + 400]
        assert "isAdmin()" in block
        # Must NOT allow students to write directly
        assert "isStudent()" not in block.split("allow create")[1].split("\n")[0]


# ===========================================================================
# 8. CONCURRENT STRESS TESTS
# ===========================================================================

class TestConcurrentStress:

    def test_100_concurrent_quiz_submissions_all_succeed(self, db):
        """100 different students submitting concurrently must all get 200 OK."""
        n = 100
        db.store["quizzes"] = {
            "stress_quiz": {
                "questions": [
                    {"id": "q1", "correctOptionIndex": 0},
                    {"id": "q2", "correctOptionIndex": 1},
                ]
            }
        }
        for i in range(n):
            db.store.setdefault("users", {})[f"stress_{i}"] = {
                "role": "student", "status": "approved"
            }

        results = []
        errors = []
        lock = threading.Lock()

        from fastapi.testclient import TestClient
        import server

        def fake_verify(token, *args, **kwargs):
            i = token.split("-")[-1]
            return {"uid": f"stress_{i}", "email": f"s{i}@t.com", "email_verified": True}

        def submit(i):
            client = TestClient(server.app)
            try:
                r = client.post(
                    "/api/lms/quiz/submit",
                    json={
                        "quiz_id": "stress_quiz",
                        "nonce": f"stress_nonce_{i}",
                        "started_at_ms": int(time.time() * 1000) - 60000,
                        "answers": {"q1": 0, "q2": 1},
                    },
                    headers={"Authorization": f"Bearer token-{i}"}
                )
                with lock:
                    results.append(r.status_code)
                    if r.status_code != 200:
                        errors.append(f"Status {r.status_code}: {r.text}")
            except Exception as e:
                with lock:
                    errors.append(str(e))

        with patch.object(server, "firebase_db", db), \
             patch.object(server.firebase_auth, "verify_id_token", side_effect=fake_verify):
            threads = [threading.Thread(target=submit, args=(i,)) for i in range(n)]
            start = time.time()
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            elapsed = time.time() - start

        assert not errors, f"Thread errors: {errors}"
        assert all(s == 200 for s in results), f"Got non-200: {set(results)}"
        assert elapsed < 30, f"100 concurrent submissions took {elapsed:.2f}s (limit: 30s)"

    def test_500_course_completion_checks_under_5s(self, db):
        """_has_completed_course must complete 500 calls under 5 seconds."""
        for i in range(100):
            db.store.setdefault("lessons", {})[f"l{i}"] = {"course_id": "big_course"}
        for i in range(100):
            db.store.setdefault("lesson_progress", {})[f"p{i}"] = {
                "user_id": "bulk_uid", "course_id": "big_course", "completed": True
            }
        import server
        start = time.time()
        with patch.object(server, "firebase_db", db):
            for _ in range(500):
                server._has_completed_course("bulk_uid", "big_course")
        elapsed = time.time() - start
        assert elapsed < 5, f"500 completion checks took {elapsed:.2f}s (limit: 5s)"
