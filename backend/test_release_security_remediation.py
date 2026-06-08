import os
from pathlib import Path

import pytest
from fastapi import HTTPException

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test")

ROOT = Path(__file__).resolve().parents[1]
FIRESTORE_RULES = (ROOT / "firestore.rules").read_text()
STORAGE_RULES = (ROOT / "storage.rules").read_text()
SERVER = (ROOT / "backend" / "server.py").read_text()


def _block(text: str, marker: str, next_marker: str = "\n    match ") -> str:
    start = text.index(marker)
    end = text.find(next_marker, start + len(marker))
    return text[start:] if end == -1 else text[start:end]


def test_firestore_requires_verified_approved_users_for_privileged_roles_and_enrollments():
    assert "function isVerified()" in FIRESTORE_RULES
    assert "request.auth.token.email_verified == true" in FIRESTORE_RULES
    assert "function isApprovedVerifiedUser()" in FIRESTORE_RULES
    assert "function isAdmin() {\n      return isVerified()" in FIRESTORE_RULES
    assert "function isTeacherOrAdmin() {\n      return isVerified()" in FIRESTORE_RULES
    assert "function hasActiveEnrollmentForCourse(courseId) {\n      return isApprovedVerifiedUser()" in FIRESTORE_RULES


def test_firestore_learning_content_no_longer_uses_broad_signed_in_reads():
    for marker in [
        "match /courses/{courseId}",
        "match /categories/{categoryId}",
        "match /quizzes/{quizId}",
        "match /modules/{moduleId}",
        "match /lessons/{lessonId}",
        "match /assignments/{assignmentId}",
        "match /audio_lessons/{lessonId}",
    ]:
        block = _block(FIRESTORE_RULES, marker)
        assert "allow read: if isSignedIn()" not in block
        assert "allow read, list: if isSignedIn()" not in block
    assert "allow read: if canReadCourseData(courseId, resource.data);" in FIRESTORE_RULES
    assert "allow read: if canReadLearningContent(resource.data);" in FIRESTORE_RULES
    assert "allow read, list: if canReadLearningContent(resource.data);" in FIRESTORE_RULES


def test_firestore_blocks_public_profile_role_spoofing_certificate_self_create_and_submission_review_escalation():
    public_profiles = _block(FIRESTORE_RULES, "match /public_profiles/{uid}")
    assert "request.resource.data.role == userDoc(uid).role" in public_profiles
    assert "request.resource.data.status == userDoc(uid).status" in public_profiles
    assert "request.resource.data.role in ['student', 'teacher', 'assistant_teacher', 'moderator', 'admin', 'super_admin']" not in public_profiles

    certificates = _block(FIRESTORE_RULES, "match /certificates/{certificateId}")
    assert "allow create: if false;" in certificates

    submissions = _block(FIRESTORE_RULES, "match /submissions/{submissionId}")
    assert "request.resource.data.status == 'submitted'" in submissions
    assert "request.resource.data.status in ['submitted', 'reviewed']" not in submissions
    assert "reviewed_at" not in submissions.split("|| (isApprovedVerifiedUser()", 1)[1]


def test_storage_requires_verified_approved_enrollment_for_course_and_live_class_files():
    assert "function isVerified()" in STORAGE_RULES
    assert "request.auth.token.email_verified == true" in STORAGE_RULES
    assert "function isApprovedVerifiedUser()" in STORAGE_RULES
    assert "function canReadCourseStorage(courseId)" in STORAGE_RULES
    assert "enrollments/$(enrollmentDocId(request.auth.uid, courseId))" in STORAGE_RULES
    assert "allow read: if canReadCourseStorage(courseId);" in STORAGE_RULES
    live_storage = _block(STORAGE_RULES, "function canReadLiveClassStorage", "\n\n    function isSafeAudioLessonUpload")
    assert "student_ids" not in live_storage
    assert "enrollments/$(enrollmentDocId(request.auth.uid" in live_storage


def test_backend_auth_requires_email_verification_and_secures_formerly_public_endpoints(monkeypatch):
    import server

    monkeypatch.setattr(server.firebase_auth, "verify_id_token", lambda token: {"uid": "u1", "email_verified": False})
    monkeypatch.setattr(server, "_bearer_token", lambda authorization: "token")
    monkeypatch.setattr(server, "_fetch_user_role", lambda uid: "student")

    with pytest.raises(HTTPException) as exc:
        server._verify_firebase_request("Bearer token")
    assert exc.value.status_code == 403
    assert "Verified email required" in str(exc.value.detail)

    for route in [
        'async def ingest_live_ops_event(payload: LiveOpsEventRequest, request: Request, authorization: str | None = Header(default=None))',
        'async def analytics_ingest(payload: AnalyticsIngestRequest, request: Request, authorization: str | None = Header(default=None))',
        'async def ai_infer(payload: AIInferRequest, request: Request, authorization: str | None = Header(default=None))',
        'async def ops_health(request: Request, authorization: str | None = Header(default=None))',
        'async def create_status_check(input: StatusCheckCreate, request: Request, authorization: str | None = Header(default=None))',
        'async def get_status_checks(request: Request, authorization: str | None = Header(default=None))',
    ]:
        assert route in SERVER
    assert 'uid = "anonymous"' not in SERVER
    assert 'if role not in {"admin", "super_admin", "moderator"}' in SERVER


def test_backend_certificate_generation_validates_enrollment_completion_and_payment():
    assert '@api_router.post("/certificates/generate")' in SERVER
    assert 'Active enrollment required' in SERVER
    assert 'Course completion required' in SERVER
    assert 'Successful payment required' in SERVER
    assert 'firebase_db.collection("certificates").document(cert_id)' in SERVER
