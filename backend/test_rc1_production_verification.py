import json
import time
import pytest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

import server
from server import app
from test_lms_integrity import FakeFirestoreDB


@pytest.fixture
def rc1_client():
    fake_db = FakeFirestoreDB()
    # Pre-seed approved user documents with status='approved'
    fake_db.collection("users").document("rc1_student_01").set({
        "name": "RC1 Student",
        "role": "student",
        "status": "approved"
    })
    fake_db.collection("users").document("rc1_admin_01").set({
        "name": "RC1 Admin",
        "role": "admin",
        "status": "approved"
    })
    fake_db.collection("quizzes").document("quiz_tajweed_midterm").set({
        "course_id": "tajweed_101",
        "time_limit_sec": 1800,
        "questions": [{"id": "q1", "text": "Q1", "options": ["A", "B"], "correct_index": 0}]
    })
    fake_db.collection("courses").document("tajweed_101").set({
        "title": "Tajweed 101",
        "lessons_count": 1,
        "required_attendance_pct": 75
    })
    fake_db.collection("enrollments").document("rc1_student_01:tajweed_101").set({
        "user_id": "rc1_student_01",
        "course_id": "tajweed_101",
        "status": "active"
    })
    fake_db.collection("lessons").document("lesson_1").set({
        "course_id": "tajweed_101",
        "title": "Lesson 1"
    })
    fake_db.collection("lesson_progress").document("rc1_prog_1").set({
        "user_id": "rc1_student_01",
        "course_id": "tajweed_101",
        "completed": True
    })
    fake_db.collection("attendance").document("rc1_att_1").set({
        "user_id": "rc1_student_01",
        "course_id": "tajweed_101",
        "present": True
    })
    original_db = server.firebase_db
    server.firebase_db = fake_db
    yield TestClient(app), fake_db
    server.firebase_db = original_db


class TestE2EStudentJourney:
    """SIMULATED: Complete End-to-End Student Workflow Verification."""

    @patch("server.firebase_auth.verify_id_token")
    def test_complete_student_lifecycle(self, mock_verify, rc1_client):
        client, fake_db = rc1_client
        mock_verify.return_value = {
            "uid": "rc1_student_01",
            "role": "student",
            "email_verified": True,
            "auth_time": int(time.time()),
        }

        # 1. Quiz attempt submission
        quiz_resp = client.post(
            "/api/lms/quiz/submit",
            json={
                "quiz_id": "quiz_tajweed_midterm",
                "nonce": "rc1_nonce_123",
                "started_at_ms": int(time.time() * 1000) - 60000,
                "answers": {"q1": 0}
            },
            headers={"Authorization": "Bearer valid_student_token"}
        )
        assert quiz_resp.status_code == 200
        data_quiz = quiz_resp.json()
        assert data_quiz.get("ok") is True
        assert "score" in data_quiz

        # 2. Certificate generation attempt
        cert_resp = client.post(
            "/api/certificates/generate",
            json={"course_id": "tajweed_101"},
            headers={"Authorization": "Bearer valid_student_token"}
        )
        assert cert_resp.status_code == 200, cert_resp.json()
        data_cert = cert_resp.json()
        assert data_cert.get("ok") is True
        assert "certificate_id" in data_cert


class TestE2EAdminOperations:
    """SIMULATED: Complete End-to-End Admin Management & Observability Verification."""

    @patch("server.firebase_auth.verify_id_token")
    def test_admin_observability_and_analytics(self, mock_verify, rc1_client):
        client, fake_db = rc1_client
        mock_verify.return_value = {
            "uid": "rc1_admin_01",
            "role": "admin",
            "email_verified": True,
            "auth_time": int(time.time()),
        }

        # 1. Admin ops health diagnosis endpoint (requires capability + x-action-nonce)
        health_resp = client.get(
            "/api/ops/health",
            headers={
                "Authorization": "Bearer valid_admin_token",
                "x-action-nonce": "rc1_admin_nonce_001"
            }
        )
        assert health_resp.status_code == 200
        assert "ok" in health_resp.json()

        # 2. Root Health check endpoint
        root_health = client.get("/health")
        assert root_health.status_code == 200

        # 3. Analytics Daily Ingestion endpoint
        analytics_resp = client.post(
            "/api/analytics/ingest",
            json={"events": [{"name": "admin_audit", "ts": int(time.time() * 1000)}]},
            headers={"Authorization": "Bearer valid_admin_token"}
        )
        assert analytics_resp.status_code == 200
        assert analytics_resp.json().get("accepted") >= 1


class TestResilienceSimulations:
    """SIMULATED: Failure, Token Rejection, and Error State Simulations."""

    @patch("server.firebase_auth.verify_id_token")
    def test_revoked_token_rejection(self, mock_verify, rc1_client):
        client, _ = rc1_client
        from firebase_admin import auth as fb_auth
        mock_verify.side_effect = fb_auth.RevokedIdTokenError("token revoked")
        resp = client.post(
            "/api/certificates/generate",
            json={"course_id": "tajweed_101"},
            headers={"Authorization": "Bearer revoked_token"}
        )
        assert resp.status_code == 401


class TestPlayStoreReadiness:
    """STATIC INSPECTION: Android Release Configuration & Permissions Verification."""

    def test_app_json_release_configuration(self):
        app_json_path = Path(__file__).parent.parent / "frontend" / "app.json"
        assert app_json_path.exists(), "frontend/app.json must exist"

        data = json.loads(app_json_path.read_text(encoding="utf-8"))
        expo = data.get("expo", {})

        # Verify Android package
        android_cfg = expo.get("android", {})
        assert android_cfg.get("package") == "com.madrasatussalikat.lilbanat"
        assert isinstance(android_cfg.get("versionCode"), int)
        assert android_cfg.get("versionCode") >= 1

        # Verify required operational permissions
        permissions = android_cfg.get("permissions", [])
        assert "android.permission.INTERNET" in permissions
        assert "android.permission.POST_NOTIFICATIONS" in permissions

        # Verify splash & icons configured
        assert expo.get("icon") == "./assets/images/icon.png"
        assert expo.get("splash", {}).get("image") == "./assets/images/splash.png"
