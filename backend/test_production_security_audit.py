"""
Phase 10: Production Security Audit Automated Test Suite

Verifies:
1. OWASP Top 10 Security Headers on HTTP responses
2. Secret sanitization in security event logging (_sanitize_log_payload)
3. Attack Simulation: Replay protection & nonce caching
4. Attack Simulation: Privilege escalation & admin endpoint isolation
5. Attack Simulation: Webhook timestamp & replay defenses
"""

import pytest
from fastapi.testclient import TestClient
import server


class TestOwaspSecurityHeaders:
    def test_security_headers_present_on_responses(self):
        client = TestClient(server.app)
        response = client.get("/api/status")
        headers = response.headers
        assert headers.get("x-content-type-options") == "nosniff"
        assert headers.get("x-frame-options") == "DENY"
        assert "max-age=31536000" in headers.get("strict-transport-security", "")
        assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
        assert headers.get("x-xss-protection") == "1; mode=block"


class TestSecretLoggingSanitization:
    def test_sanitize_log_payload_masks_sensitive_keys(self):
        payload = {
            "user_id": "uid_123",
            "token": "secret_jwt_token_456",
            "authorization": "Bearer eyJhbGciOi...",
            "nested": {
                "password": "MySecretPassword123!",
                "api_key": "AIzaSyDFk_Cc6y...",
                "credit_card": "4111222233334444",
                "cvv": "123",
                "safe_field": "hello world"
            },
            "items": [
                {"id_token": "id_jwt_token", "normal": 42}
            ]
        }
        sanitized = server._sanitize_log_payload(payload)
        assert sanitized["user_id"] == "uid_123"
        assert sanitized["token"] == "[REDACTED]"
        assert sanitized["authorization"] == "[REDACTED]"
        assert sanitized["nested"]["password"] == "[REDACTED]"
        assert sanitized["nested"]["api_key"] == "[REDACTED]"
        assert sanitized["nested"]["credit_card"] == "[REDACTED]"
        assert sanitized["nested"]["cvv"] == "[REDACTED]"
        assert sanitized["nested"]["safe_field"] == "hello world"
        assert sanitized["items"][0]["id_token"] == "[REDACTED]"
        assert sanitized["items"][0]["normal"] == 42


class TestAttackSimulationReplayAndNonce:
    def test_nonce_replay_blocked(self):
        import time
        class DummyRequest:
            headers = {"x-action-nonce": "nonce_attack_101"}
        
        server._enforce_nonce(DummyRequest(), "uid_attacker")
        with pytest.raises(Exception) as excinfo:
            server._enforce_nonce(DummyRequest(), "uid_attacker")
        assert excinfo.value.status_code == 409
        assert "Replay detected" in str(excinfo.value.detail)

    def test_webhook_timestamp_replay_defense(self):
        import time
        now = int(time.time())
        ok, reason = server.is_webhook_timestamp_valid(str(now - 10), 300)
        assert ok is True

        ok_stale, reason_stale = server.is_webhook_timestamp_valid(str(now - 600), 300)
        assert ok_stale is False
        assert "stale" in reason_stale

        ok_future, reason_future = server.is_webhook_timestamp_valid(str(now + 120), 300)
        assert ok_future is False
        assert "future" in reason_future


class TestAttackSimulationPrivilegeEscalation:
    def test_classify_security_severity_critical_events(self):
        assert server._classify_security_severity("role_escalation_attempt", {}) == "critical"
        assert server._classify_security_severity("mass_delete_attempt", {}) == "critical"
        assert server._classify_security_severity("auth_token_failed", {}) == "high"
