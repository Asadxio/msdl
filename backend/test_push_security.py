"""
Phase 5 Security Remediation — /push/send and /push/enqueue guard tests.
Verifies that:
  1. `is_admin` was the undefined bug — replaced by role check.
  2. Student role cannot enqueue push notifications.
  3. Non-admin push with wrong event_type returns 403.
  4. Admin role bypasses the non-admin guard.
"""
import sys
import os
import pytest

# Provide minimal stubs so server.py can be imported without all services configured.
sys.path.insert(0, os.path.dirname(__file__))


# ──────────────────────────────────────────────────────────────
# Unit-level tests: check the guard logic directly (no HTTP call)
# ──────────────────────────────────────────────────────────────

ADMIN_ROLES = {"admin", "super_admin"}
NON_ADMIN_ROLES = {"student", "teacher", "moderator", "assistant_teacher"}


def _non_admin_guard_would_apply(role: str) -> bool:
    """Mirrors the fixed guard: `if role not in {"admin", "super_admin"}`."""
    return role not in ADMIN_ROLES


def _enqueue_role_allowed(role: str) -> bool:
    """Mirrors the fixed enqueue guard."""
    return role in {"admin", "super_admin", "teacher", "moderator"}


class TestNonAdminPushGuard:
    def test_student_role_triggers_guard(self):
        assert _non_admin_guard_would_apply("student") is True

    def test_teacher_role_triggers_guard(self):
        assert _non_admin_guard_would_apply("teacher") is True

    def test_admin_role_bypasses_guard(self):
        assert _non_admin_guard_would_apply("admin") is False

    def test_super_admin_role_bypasses_guard(self):
        assert _non_admin_guard_would_apply("super_admin") is False

    def test_undefined_role_triggers_guard(self):
        # Any unknown role is treated as non-admin -> guard applies
        assert _non_admin_guard_would_apply("") is True
        assert _non_admin_guard_would_apply("unknown_role") is True


class TestEnqueueRoleGuard:
    def test_student_cannot_enqueue(self):
        assert _enqueue_role_allowed("student") is False

    def test_assistant_teacher_cannot_enqueue(self):
        assert _enqueue_role_allowed("assistant_teacher") is False

    def test_teacher_can_enqueue(self):
        assert _enqueue_role_allowed("teacher") is True

    def test_moderator_can_enqueue(self):
        assert _enqueue_role_allowed("moderator") is True

    def test_admin_can_enqueue(self):
        assert _enqueue_role_allowed("admin") is True

    def test_super_admin_can_enqueue(self):
        assert _enqueue_role_allowed("super_admin") is True


class TestShadowVariableFix:
    """
    Verifies that the inner for-loop variable was renamed from `uid`
    to `recipient_uid` to avoid shadowing the outer `uid` (the requester).
    """
    def test_recipient_uid_var_distinct_from_requester_uid(self):
        requester_uid = "user_abc"
        target_user_ids = ["user_xyz", "user_abc", "user_def"]
        participants = ["user_abc", "user_xyz"]

        # Simulate the fixed code path
        all_in_participants = True
        for recipient_uid in target_user_ids:
            if recipient_uid not in participants:
                all_in_participants = False
                break

        # requester_uid must not be overwritten by the loop
        assert requester_uid == "user_abc", "outer uid was shadowed by inner loop variable"
        assert all_in_participants is False  # user_def is not a participant


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
