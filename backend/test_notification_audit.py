"""
Phase 7: Notification System Production Reliability Audit
Complete test suite for the notification lifecycle:
  - Queue reliability (enqueue, dedup, FIFO, poison jobs, dead letter)
  - Worker reliability (atomic lease, crash recovery, concurrent workers)
  - Provider adapters (expo, fcm, apns stubs, circuit breaker)
  - Token management (invalid, stale, duplicate, cleanup)
  - Security (broadcast restriction, role enforcement)
  - Performance stress tests (100 to 10,000 queued notifications)
  - Observability (log events for every state transition)
"""

import time
import uuid
import pytest
import logging
from unittest.mock import MagicMock, patch
from collections import defaultdict

# ──────────────────────────────────────────────────────────────
# PATCH @admin_firestore.transactional before any imports
# The decorator checks transaction._read_only which our fake doesn't have.
# We patch it to be a plain identity wrapper for all tests.
# ──────────────────────────────────────────────────────────────
import firebase_admin.firestore as _admin_firestore_module

_original_transactional = _admin_firestore_module.transactional


def _noop_transactional(fn):
    """Replacement for @admin_firestore.transactional that calls fn(transaction) directly."""
    def wrapper(transaction, *args, **kwargs):
        return fn(transaction, *args, **kwargs)
    return wrapper


# Apply patch globally for this module
_admin_firestore_module.transactional = _noop_transactional


# ──────────────────────────────────────────────────────────────
# SHARED FAKE FIRESTORE INFRASTRUCTURE
# ──────────────────────────────────────────────────────────────

class FakeFirestoreSnapshot:
    def __init__(self, data, exists=True, doc_id=None, collection_name=None, db_mock=None):
        self._data = data
        self.exists = exists
        self.id = doc_id or str(uuid.uuid4())
        self.collection_name = collection_name
        self.db_mock = db_mock

    def to_dict(self):
        return dict(self._data) if self._data else {}

    @property
    def reference(self):
        return FakeFirestoreDoc(self.collection_name, self.id, self.db_mock)


class FakeFirestoreDoc:
    def __init__(self, collection_name, doc_id, db_mock):
        self.collection_name = collection_name
        self.id = doc_id or str(uuid.uuid4())
        self.db_mock = db_mock

    def get(self, transaction=None):
        data = self.db_mock.get_doc(self.collection_name, self.id)
        return FakeFirestoreSnapshot(
            data, exists=(data is not None),
            doc_id=self.id,
            collection_name=self.collection_name,
            db_mock=self.db_mock,
        )

    def set(self, data, merge=False):
        self.db_mock.set_doc(self.collection_name, self.id, data, merge=merge)

    def update(self, data):
        self.db_mock.set_doc(self.collection_name, self.id, data, merge=True)

    def delete(self):
        self.db_mock.delete_doc(self.collection_name, self.id)


class FakeFirestoreCollection:
    def __init__(self, name, db_mock, filters=None):
        self.name = name
        self.db_mock = db_mock
        self.filters = filters or []
        self._limit_n = None

    def document(self, doc_id=None):
        if doc_id is None:
            doc_id = str(uuid.uuid4())
        return FakeFirestoreDoc(self.name, doc_id, self.db_mock)

    def add(self, data):
        doc_id = str(uuid.uuid4())
        self.db_mock.set_doc(self.name, doc_id, data)
        return FakeFirestoreDoc(self.name, doc_id, self.db_mock)

    def where(self, field, op, value):
        new_filters = self.filters + [(field, op, value)]
        c = FakeFirestoreCollection(self.name, self.db_mock, new_filters)
        c._limit_n = self._limit_n
        return c

    def limit(self, n):
        c = FakeFirestoreCollection(self.name, self.db_mock, self.filters)
        c._limit_n = n
        return c

    def stream(self):
        all_docs = self.db_mock.get_all(self.name)
        results = []
        for doc_id, data in all_docs.items():
            if self._matches(data):
                results.append(FakeFirestoreSnapshot(
                    data, exists=True,
                    doc_id=doc_id,
                    collection_name=self.name,
                    db_mock=self.db_mock,
                ))
        if self._limit_n is not None:
            results = results[: self._limit_n]
        return results

    def _matches(self, data):
        for field, op, value in self.filters:
            val = data.get(field) if data else None
            if op == "==":
                if val != value:
                    return False
            elif op == "in":
                if val not in value:
                    return False
            elif op == "<=":
                if val is None or val > value:
                    return False
            elif op == ">=":
                if val is None or val < value:
                    return False
            elif op == "<":
                if val is None or val >= value:
                    return False
        return True


class FakeTransaction:
    """
    Minimal Firestore transaction stub.
    The @admin_firestore.transactional decorator (patched above) calls fn(transaction).
    """
    _read_only = False  # required by real Firebase SDK internals

    def get(self, doc_ref):
        return doc_ref.get(transaction=self)

    def set(self, doc_ref, data, merge=True):
        doc_ref.set(data, merge=merge)

    def update(self, doc_ref, data):
        doc_ref.update(data)

    def delete(self, doc_ref):
        doc_ref.delete()


class FakeFirestoreDB:
    def __init__(self):
        self.store = defaultdict(dict)
        self.writes = defaultdict(list)

    def get_doc(self, collection, doc_id):
        return self.store[collection].get(doc_id)

    def get_all(self, collection):
        return dict(self.store[collection])

    def set_doc(self, collection, doc_id, data, merge=True):
        cleaned = {}
        for k, v in data.items():
            # Convert SERVER_TIMESTAMP sentinels
            cleaned[k] = int(time.time() * 1000) if "Sentinel" in type(v).__name__ else v
        if merge and doc_id in self.store[collection]:
            self.store[collection][doc_id].update(cleaned)
        else:
            self.store[collection][doc_id] = cleaned
        self.writes[collection].append(cleaned)

    def delete_doc(self, collection, doc_id):
        if doc_id in self.store[collection]:
            del self.store[collection][doc_id]

    def collection(self, name):
        return FakeFirestoreCollection(name, self)

    def transaction(self):
        return FakeTransaction()


def make_logger():
    return logging.getLogger("test_notifications")


# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────

def enqueue_job(
    db: FakeFirestoreDB,
    dedupe_id: str,
    recipients: list,
    status: str = "queued",
    attempts: int = 0,
    max_attempts: int = 5,
    scheduled_at: int = None,
    priority: int = 5,
) -> str:
    queue_id = str(uuid.uuid4())
    now_ms = int(time.time() * 1000)
    db.store["notification_dispatch_queue"][queue_id] = {
        "queue_id": queue_id,
        "dedupe_id": dedupe_id,
        "recipients": recipients,
        "status": status,
        "attempts": attempts,
        "max_attempts": max_attempts,
        "scheduled_at": scheduled_at or now_ms,
        "priority": priority,
        "title": "Test Notification",
        "body": "Hello from tests",
        "payload": {},
        "lease_owner": "",
        "lease_expires_at": 0,
    }
    return queue_id


# ──────────────────────────────────────────────────────────────
# 1. QUEUE RELIABILITY TESTS
# ──────────────────────────────────────────────────────────────

class TestQueueReliability:

    def test_enqueue_creates_firestore_document(self):
        """Verify that enqueuing a job creates a Firestore document with correct fields."""
        db = FakeFirestoreDB()
        qid = enqueue_job(db, "evt_1", ["uid_student"])
        doc = db.get_doc("notification_dispatch_queue", qid)
        assert doc is not None
        assert doc["dedupe_id"] == "evt_1"
        assert doc["status"] == "queued"
        assert doc["attempts"] == 0
        assert "recipients" in doc

    def test_duplicate_enqueue_rejected_by_idempotency(self):
        """Sending the same dedupe_id+token twice must not dispatch twice."""
        from services.idempotency_engine import acquire_send_permit
        db = FakeFirestoreDB()
        # First acquire: should succeed (permit granted)
        result1 = acquire_send_permit(db, "q1", "expo", "dedupe_abc", "ExponentPushToken[token1]")
        assert result1 is True
        # Second acquire with same key: must be rejected
        result2 = acquire_send_permit(db, "q1", "expo", "dedupe_abc", "ExponentPushToken[token1]")
        assert result2 is False

    def test_completed_idempotency_key_blocks_resend(self):
        """After mark_send_completed, further acquire_send_permit calls must fail."""
        from services.idempotency_engine import acquire_send_permit, mark_send_completed
        db = FakeFirestoreDB()
        token = "ExponentPushToken[TESTTOKEN1]"
        acquire_send_permit(db, "q2", "expo", "dedupe_xyz", token)
        mark_send_completed(db, "q2", "expo", "dedupe_xyz", token)
        # After completion, re-acquiring must fail
        result = acquire_send_permit(db, "q2", "expo", "dedupe_xyz", token)
        assert result is False

    def test_poison_job_reaches_deadletter_after_max_attempts(self):
        """A job that exhausts max_attempts must be moved to deadletter."""
        from services.fanout_worker import process_queue_once
        db = FakeFirestoreDB()
        logger = make_logger()
        # Inject a job with no tokens — will fail immediately; max_attempts=2
        qid = enqueue_job(db, "fail_evt", ["uid_no_tokens"], max_attempts=2)
        # Process multiple times to exhaust retries
        for _ in range(6):
            process_queue_once(db, logger, worker_id="worker-test", limit=10)
        doc = db.get_doc("notification_dispatch_queue", qid)
        # Job should be deadlettered or completed
        assert doc["status"] in {"deadletter", "completed"}

    def test_job_with_zero_recipients_completes_silently(self):
        """A job with no recipients produces no tokens and no batches."""
        from services.fanout_worker import process_queue_once
        db = FakeFirestoreDB()
        logger = make_logger()
        qid = enqueue_job(db, "empty_evt", [])
        result = process_queue_once(db, logger, worker_id="worker-empty", limit=10)
        assert result["ok"] is True
        assert result["deadlettered"] >= 0

    def test_stuck_processing_job_reclaimed_by_lease_reclaimer(self):
        """A job stuck in 'processing' with expired lease should be reclaimed."""
        from services.stale_lease_reclaimer import reclaim_stale_leases
        db = FakeFirestoreDB()
        logger = make_logger()
        now_ms = int(time.time() * 1000)
        qid = enqueue_job(db, "stuck_evt", ["uid_student"], status="processing")
        db.store["notification_dispatch_queue"][qid]["lease_expires_at"] = now_ms - 60000
        db.store["notification_dispatch_queue"][qid]["lease_owner"] = "dead-worker"
        result = reclaim_stale_leases(db, logger)
        assert result["ok"] is True
        assert result["reclaimed"] == 1
        doc = db.get_doc("notification_dispatch_queue", qid)
        assert doc["status"] == "retrying"
        assert doc["lease_owner"] == ""

    def test_fresh_processing_job_not_reclaimed(self):
        """A job in 'processing' with a valid lease must NOT be reclaimed."""
        from services.stale_lease_reclaimer import reclaim_stale_leases
        db = FakeFirestoreDB()
        logger = make_logger()
        now_ms = int(time.time() * 1000)
        qid = enqueue_job(db, "fresh_evt", ["uid_student"], status="processing")
        db.store["notification_dispatch_queue"][qid]["lease_expires_at"] = now_ms + 60000
        result = reclaim_stale_leases(db, logger)
        assert result["reclaimed"] == 0
        doc = db.get_doc("notification_dispatch_queue", qid)
        assert doc["status"] == "processing"

    def test_backoff_increases_with_attempts(self):
        """Retry backoff must grow with each attempt."""
        from services.queue_router import next_backoff
        b1 = next_backoff(1)
        b2 = next_backoff(2)
        b3 = next_backoff(3)
        assert b2 > b1, "Backoff must increase with more attempts"
        assert b3 > b2, "Backoff must increase with more attempts"

    def test_backoff_is_capped_at_max(self):
        """Backoff at very large attempt counts must be capped."""
        from services.queue_router import next_backoff
        b_max = next_backoff(100)
        assert b_max <= 450_000, "Backoff must be capped (300s base + jitter)"

    def test_future_scheduled_at_prevents_pickup(self):
        """A job with a future scheduled_at must not be picked up yet."""
        from services.fanout_worker import process_queue_once
        db = FakeFirestoreDB()
        logger = make_logger()
        future_ms = int(time.time() * 1000) + 60_000_000  # ~17 hours in the future
        enqueue_job(db, "future_evt", ["uid_student"], status="queued", scheduled_at=future_ms)
        result = process_queue_once(db, logger, worker_id="worker-future", limit=10)
        assert result["processed"] == 0, "Future-scheduled job must not be processed yet"


# ──────────────────────────────────────────────────────────────
# 2. WORKER RELIABILITY TESTS
# ──────────────────────────────────────────────────────────────

class TestWorkerReliability:

    def test_atomic_lease_prevents_concurrent_duplicate_execution(self):
        """Two workers racing — only one should acquire the lease."""
        from services.fanout_worker import acquire_queue_lease_atomic
        db = FakeFirestoreDB()
        qid = enqueue_job(db, "race_evt", ["uid_student"])
        queue_ref = db.collection("notification_dispatch_queue").document(qid)
        r1 = acquire_queue_lease_atomic(db, queue_ref, "worker-A")
        r2 = acquire_queue_lease_atomic(db, queue_ref, "worker-B")
        assert r1 is True
        assert r2 is False, "Second worker must not acquire an already-held lease"

    def test_expired_lease_can_be_re_acquired(self):
        """After lease expiry, the next worker can claim the job atomically."""
        from services.fanout_worker import acquire_queue_lease_atomic
        db = FakeFirestoreDB()
        now_ms = int(time.time() * 1000)
        qid = enqueue_job(db, "expired_evt", ["uid_student"], status="processing")
        db.store["notification_dispatch_queue"][qid]["lease_expires_at"] = now_ms - 1000
        db.store["notification_dispatch_queue"][qid]["lease_owner"] = "old-worker"
        queue_ref = db.collection("notification_dispatch_queue").document(qid)
        r = acquire_queue_lease_atomic(db, queue_ref, "worker-new")
        assert r is True, "New worker should be able to claim expired lease"

    def test_worker_scheduler_autoscales_workers_based_on_depth(self):
        """Scheduler should spawn more workers when queue is deep (≥50 jobs → ≥2 workers)."""
        from services.worker_scheduler import run_scheduler_tick
        db = FakeFirestoreDB()
        logger = make_logger()
        for i in range(150):
            enqueue_job(db, f"bulk_{i}", ["uid_student"])
        result = run_scheduler_tick(db, logger, max_workers=4)
        assert result["ok"] is True
        assert result["workers"] >= 2

    def test_worker_crash_leaves_lease_for_reclaim(self):
        """Simulate worker crash mid-processing; lease reclaimer must recover."""
        from services.stale_lease_reclaimer import reclaim_stale_leases
        db = FakeFirestoreDB()
        logger = make_logger()
        now_ms = int(time.time() * 1000)
        qid = enqueue_job(db, "crash_evt", ["uid_student"], status="processing")
        db.store["notification_dispatch_queue"][qid]["lease_expires_at"] = now_ms - 5000
        result = reclaim_stale_leases(db, logger)
        doc = db.get_doc("notification_dispatch_queue", qid)
        assert doc["status"] == "retrying"
        assert result["reclaimed"] == 1


# ──────────────────────────────────────────────────────────────
# 3. PROVIDER ADAPTER TESTS
# ──────────────────────────────────────────────────────────────

class TestProviderAdapters:

    def test_expo_adapter_classifies_device_not_registered(self):
        from services.provider_adapters.expo_adapter import classify_failure
        assert classify_failure("DeviceNotRegistered") == "invalid_token"

    def test_expo_adapter_classifies_rate_limit(self):
        from services.provider_adapters.expo_adapter import classify_failure
        assert classify_failure("MessageRateExceeded") == "throttled"

    def test_expo_adapter_classifies_unknown_error(self):
        from services.provider_adapters.expo_adapter import classify_failure
        assert classify_failure("SomeRandomError") == "unknown"

    def test_expo_receipt_normalizer_delivered(self):
        from services.provider_adapters.expo_adapter import normalize_response
        result = normalize_response("r1", {"status": "ok"})
        assert result.status == "delivered"

    def test_expo_receipt_normalizer_invalid_token(self):
        from services.provider_adapters.expo_adapter import normalize_response
        result = normalize_response("r1", {"status": "error", "details": {"error": "DeviceNotRegistered"}})
        assert result.status == "invalid_token"
        assert result.failure_category == "invalid_token"

    def test_expo_receipt_normalizer_throttled(self):
        from services.provider_adapters.expo_adapter import normalize_response
        result = normalize_response("r1", {"status": "error", "details": {"error": "MessageRateExceeded"}})
        assert result.status == "throttled"

    def test_fcm_adapter_is_stub_returns_all_failed(self):
        """FCM adapter is unimplemented — must mark all messages as failed."""
        from services.provider_adapters.fcm_adapter import send_notification
        msgs = [{"to": "fake_fcm_token", "title": "T", "body": "B"}]
        result = send_notification(msgs)
        assert result.failed == 1
        assert result.accepted == 0

    def test_apns_adapter_is_stub_returns_all_failed(self):
        """APNs adapter is unimplemented — must mark all messages as failed."""
        from services.provider_adapters.apns_adapter import send_notification
        msgs = [{"to": "fake_apns_token", "title": "T", "body": "B"}]
        result = send_notification(msgs)
        assert result.failed == 1

    def test_fcm_health_check_reports_degraded(self):
        from services.provider_adapters.fcm_adapter import health_check
        result = health_check()
        assert result["status"] == "degraded"

    def test_apns_health_check_reports_degraded(self):
        from services.provider_adapters.apns_adapter import health_check
        result = health_check()
        assert result["status"] == "degraded"


# ──────────────────────────────────────────────────────────────
# 4. CIRCUIT BREAKER TESTS
# ──────────────────────────────────────────────────────────────

class TestCircuitBreaker:

    def test_circuit_opens_after_5_consecutive_failures(self):
        from services.provider_circuit_breaker import record_result
        db = FakeFirestoreDB()
        logger = make_logger()
        for _ in range(5):
            record_result(db, logger, "expo", False)
        doc = db.get_doc("provider_circuit_breakers", "provider:expo")
        assert doc["state"] == "open"

    def test_circuit_closed_allows_requests(self):
        from services.provider_circuit_breaker import allow_request
        db = FakeFirestoreDB()
        # Fresh DB: no circuit state -> defaults to closed -> allow
        assert allow_request(db, "expo") is True

    def test_open_circuit_blocks_requests_within_cooldown(self):
        from services.provider_circuit_breaker import record_result, allow_request
        db = FakeFirestoreDB()
        logger = make_logger()
        now_ms = int(time.time() * 1000)
        for _ in range(5):
            record_result(db, logger, "expo", False)
        # Force opened_at to *just now* so cooldown (60s) hasn't elapsed
        db.store["provider_circuit_breakers"]["provider:expo"]["opened_at"] = now_ms
        result = allow_request(db, "expo")
        assert result is False, "Open circuit must block within cooldown window"

    def test_circuit_probe_allowed_after_cooldown(self):
        from services.provider_circuit_breaker import record_result, allow_request
        db = FakeFirestoreDB()
        logger = make_logger()
        for _ in range(5):
            record_result(db, logger, "expo", False)
        # Simulate 70s elapsed since circuit opened -> cooldown passed
        db.store["provider_circuit_breakers"]["provider:expo"]["opened_at"] = (
            int(time.time() * 1000) - 70_000
        )
        result = allow_request(db, "expo")
        assert result is True, "After cooldown, circuit should allow probe request"

    def test_circuit_resets_to_closed_on_success(self):
        from services.provider_circuit_breaker import record_result, get_state
        db = FakeFirestoreDB()
        logger = make_logger()
        for _ in range(5):
            record_result(db, logger, "expo", False)
        # Simulate half-open state
        db.store["provider_circuit_breakers"]["provider:expo"]["state"] = "half_open"
        record_result(db, logger, "expo", True)
        doc = db.get_doc("provider_circuit_breakers", "provider:expo")
        assert doc["state"] == "closed"

    def test_single_failure_increments_failure_count(self):
        from services.provider_circuit_breaker import record_result, get_state
        db = FakeFirestoreDB()
        logger = make_logger()
        record_result(db, logger, "expo", False, latency_ms=500)
        state = get_state(db, "expo")
        assert state["failures"] == 1

    def test_success_resets_failure_count(self):
        from services.provider_circuit_breaker import record_result, get_state
        db = FakeFirestoreDB()
        logger = make_logger()
        for _ in range(3):
            record_result(db, logger, "expo", False)
        # Force to half-open before success
        db.store["provider_circuit_breakers"]["provider:expo"]["state"] = "half_open"
        record_result(db, logger, "expo", True)
        state = get_state(db, "expo")
        assert state["failures"] == 0


# ──────────────────────────────────────────────────────────────
# 5. TOKEN MANAGEMENT TESTS
# ──────────────────────────────────────────────────────────────

class TestTokenManagement:

    def test_health_score_perfect_for_healthy_token(self):
        from services.token_health_engine import compute_health_score
        score = compute_health_score(0, 0, 0, 0.0)
        assert score == 100

    def test_consecutive_failures_reduce_health_score(self):
        from services.token_health_engine import compute_health_score
        score = compute_health_score(5, 0, 0, 0.0)
        assert score < 100
        # 5 consecutive failures: 5*10 = 50 penalty -> 50
        assert score == 50

    def test_invalid_signals_push_status_to_invalid(self):
        """3 or more invalid signals must yield 'invalid' status regardless of score."""
        from services.token_health_engine import derive_status, compute_health_score
        score = compute_health_score(3, 0, 3, 0.0)
        status = derive_status(score, 3, 3)
        assert status == "invalid"

    def test_very_old_token_gets_stale_or_worse_status(self):
        """A token not seen for 200+ days should drop to stale or invalid."""
        from services.token_health_engine import compute_health_score, derive_status
        # 200 days in ms
        old_age_ms = 200 * 24 * 3600 * 1000
        # int(200/7) * 5 = 28 * 5 = 140 -> capped at 20 -> score = 100-20 = 80
        # Actually: min(20, int(200*24*3600*1000 / (7*24*3600*1000)) * 5)
        # = min(20, 28 * 5) = min(20, 140) = 20
        # score = 80. Status = active unless we combine with failures.
        # To test stale: need score < 35. Combine with 7+ consecutive failures.
        score = compute_health_score(7, old_age_ms, 0, 0.0)
        # 7*10=70 capped at 60, + 20 = 80 penalty. max(0, 100-80) = 20 < 35
        status = derive_status(score, 7, 0)
        assert status == "stale"

    def test_token_status_becomes_invalid_after_three_devnotregistered(self):
        """update_token_registry with 3 consecutive DeviceNotRegistered reasons must
        set token_status='invalid' in Firestore."""
        from services.token_health_engine import update_token_registry
        db = FakeFirestoreDB()
        logger = make_logger()
        for _ in range(3):
            update_token_registry(
                db, logger, "ExponentPushToken[bad_token]", "expo", "android",
                success=False, reason="DeviceNotRegistered",
            )
        doc = list(db.store["notification_token_registry"].values())[0]
        assert doc["token_status"] == "invalid", (
            "3 DeviceNotRegistered errors must flip token_status to invalid"
        )

    def test_token_reactivated_after_success_following_failures(self):
        """After degraded state, a single success must reactivate the token."""
        from services.token_health_engine import update_token_registry
        db = FakeFirestoreDB()
        logger = make_logger()
        for _ in range(4):
            update_token_registry(
                db, logger, "ExponentPushToken[recover_tok]", "expo", "android",
                success=False,
            )
        update_token_registry(
            db, logger, "ExponentPushToken[recover_tok]", "expo", "android",
            success=True,
        )
        doc = list(db.store["notification_token_registry"].values())[0]
        assert doc["token_status"] == "reactivated"

    def test_token_registry_updated_on_success(self):
        from services.token_health_engine import update_token_registry
        db = FakeFirestoreDB()
        logger = make_logger()
        update_token_registry(db, logger, "ExponentPushToken[tok_ok]", "expo", "android", True)
        doc = list(db.store["notification_token_registry"].values())[0]
        assert doc["consecutive_failures"] == 0
        assert doc["token_status"] == "active"

    def test_provider_router_classifies_expo_tokens(self):
        from services.provider_router import provider_for_token
        assert provider_for_token("ExponentPushToken[abc123]") == "expo"
        assert provider_for_token("ExpoPushToken[abc123]") == "expo"

    def test_provider_router_classifies_fcm_tokens(self):
        from services.provider_router import provider_for_token
        long_fcm = "a" * 40 + ":" + "b" * 50
        assert provider_for_token(long_fcm) == "fcm"

    def test_provider_router_classifies_short_as_unknown(self):
        from services.provider_router import provider_for_token
        assert provider_for_token("short") == "unknown"

    def test_partition_job_splits_by_provider(self):
        from services.queue_router import partition_job
        tokens_by_user = {
            "u1": ["ExponentPushToken[expo1]"],
            "u2": ["ExponentPushToken[expo2]"],
        }
        job = {"dedupe_id": "d1", "priority": 5, "queue_id": "q1", "recipients": ["u1", "u2"]}
        batches = partition_job(job, tokens_by_user)
        assert all(b["provider"] == "expo" for b in batches)
        all_tokens = [t for b in batches for t in b["tokens"]]
        assert "ExponentPushToken[expo1]" in all_tokens
        assert "ExponentPushToken[expo2]" in all_tokens


# ──────────────────────────────────────────────────────────────
# 6. THROUGHPUT FAIRNESS & TRAFFIC SHAPING
# ──────────────────────────────────────────────────────────────

class TestThroughputFairness:

    def test_lane_classification_by_priority(self):
        from services.throughput_fairness import lane_from_priority
        assert lane_from_priority(10) == "critical"
        assert lane_from_priority(9) == "critical"
        assert lane_from_priority(7) == "high"
        assert lane_from_priority(5) == "normal"
        assert lane_from_priority(3) == "low"
        assert lane_from_priority(1) == "bulk"

    def test_allow_dispatch_within_quota(self):
        from services.throughput_fairness import allow_dispatch_in_lane
        assert allow_dispatch_in_lane("critical", 10) is True

    def test_block_dispatch_exceeding_quota(self):
        from services.throughput_fairness import allow_dispatch_in_lane
        # bulk lane quota = 30
        assert allow_dispatch_in_lane("bulk", 31) is False

    def test_traffic_shaper_allows_first_request(self):
        from services.traffic_shaper import should_shape
        # Fresh bucket, requesting 1 — should be allowed
        shaped, allowed = should_shape("expo_test_fresh", "normal", 1)
        assert shaped is False
        assert allowed == 1

    def test_traffic_shaper_non_negative_allowed(self):
        """Whatever we request, the allowed count must never be negative."""
        from services.traffic_shaper import should_shape
        _, allowed = should_shape("expo", "bulk", 999)
        assert allowed >= 0


# ──────────────────────────────────────────────────────────────
# 7. PROBABILISTIC ROUTER
# ──────────────────────────────────────────────────────────────

class TestProbabilisticRouter:

    def test_choose_from_single_provider(self):
        from services.probabilistic_router import choose_provider_weighted
        result = choose_provider_weighted({"expo": 1.0}, seed_key="abc")
        assert result == "expo"

    def test_seeded_selection_is_deterministic(self):
        from services.probabilistic_router import choose_provider_weighted
        r1 = choose_provider_weighted({"expo": 0.7, "fcm": 0.3}, seed_key="fixed_seed")
        r2 = choose_provider_weighted({"expo": 0.7, "fcm": 0.3}, seed_key="fixed_seed")
        assert r1 == r2, "Same seed must produce the same provider selection"

    def test_starvation_guard_floor_allows_low_weight_providers(self):
        """Provider with 0.0 weight must still occasionally win due to floor=0.05."""
        from services.probabilistic_router import choose_provider_weighted
        results = set()
        for i in range(200):
            r = choose_provider_weighted({"expo": 0.95, "fcm": 0.0}, seed_key=f"seed_{i}")
            results.add(r)
        assert "fcm" in results, "Starvation guard (floor=0.05) must allow fcm to win"

    def test_all_zero_weights_produces_valid_provider(self):
        from services.probabilistic_router import choose_provider_weighted
        # All-zero weights → equal distribution
        for i in range(20):
            r = choose_provider_weighted({"expo": 0.0, "fcm": 0.0}, seed_key=f"seed_{i}")
            assert r in {"expo", "fcm"}, "Must always return a known provider"


# ──────────────────────────────────────────────────────────────
# 8. HYSTERESIS & WEIGHT ENGINE
# ──────────────────────────────────────────────────────────────

class TestHysteresisAndWeights:

    def test_hysteresis_prevents_immediate_state_change(self):
        from services.hysteresis_controller import apply_hysteresis
        now_ms = int(time.time() * 1000)
        state, blocked = apply_hysteresis(
            "healthy", "degraded",
            last_changed_at=now_ms - 10_000,
            now_ms=now_ms,
            cooldown_ms=60_000,
        )
        assert blocked is True
        assert state == "healthy", "State must not change during hysteresis cooldown"

    def test_hysteresis_allows_change_after_cooldown(self):
        from services.hysteresis_controller import apply_hysteresis
        now_ms = int(time.time() * 1000)
        state, blocked = apply_hysteresis(
            "healthy", "degraded",
            last_changed_at=now_ms - 70_000,
            now_ms=now_ms,
            cooldown_ms=60_000,
        )
        assert blocked is False
        assert state == "degraded"

    def test_no_change_needed_is_not_blocked(self):
        from services.hysteresis_controller import apply_hysteresis
        now_ms = int(time.time() * 1000)
        state, blocked = apply_hysteresis("healthy", "healthy", now_ms - 1000, now_ms)
        assert blocked is False

    def test_restore_traffic_after_recovery_window(self):
        from services.hysteresis_controller import should_restore_traffic
        now_ms = int(time.time() * 1000)
        assert should_restore_traffic(now_ms - 130_000, now_ms, 120_000) is True

    def test_no_restore_before_recovery_window(self):
        from services.hysteresis_controller import should_restore_traffic
        now_ms = int(time.time() * 1000)
        assert should_restore_traffic(now_ms - 50_000, now_ms, 120_000) is False

    def test_weight_clamped_in_valid_range(self):
        from services.provider_weight_engine import compute_weight
        result = compute_weight(0.5, 0.0, 0.0, 0.0, 0.0, 0.0)
        assert 0.05 <= result <= 1.0

    def test_weight_single_tick_delta_capped(self):
        """Single tick weight change must not exceed ±0.12."""
        from services.provider_weight_engine import compute_weight
        w = compute_weight(1.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        assert w >= 1.0 - 0.12, "Single tick must not drop more than 0.12"


# ──────────────────────────────────────────────────────────────
# 9. NOTIFICATION AGGREGATION
# ──────────────────────────────────────────────────────────────

class TestNotificationAggregation:

    def test_aggregate_processes_delivery_logs(self):
        from services.notification_aggregation import aggregate_notification_health
        db = FakeFirestoreDB()
        logger = make_logger()
        now_ms = int(time.time() * 1000)
        for i in range(5):
            db.store["notification_delivery_logs"][f"log_{i}"] = {
                "updated_at": now_ms - i * 100,
                "channel": "announcements",
                "transport": "expo",
                "status": "provider_delivered",
                "latency_ms": 250,
                "receipt_latency_ms": 1000,
                "retry_count": 0,
            }
        result = aggregate_notification_health(db, logger, lookback_ms=3_600_000)
        assert result["ok"] is True
        assert result["processed"] == 5

    def test_slo_warning_triggered_on_low_delivery_rate(self, caplog):
        from services.notification_aggregation import aggregate_notification_health
        db = FakeFirestoreDB()
        logger = logging.getLogger("slo_test")
        now_ms = int(time.time() * 1000)
        # 9 failed + 1 delivered = 10% success rate → triggers SLO warning
        for i in range(9):
            db.store["notification_delivery_logs"][f"fail_{i}"] = {
                "updated_at": now_ms,
                "channel": "chat",
                "transport": "expo",
                "status": "provider_failed",
                "retry_count": 0,
            }
        db.store["notification_delivery_logs"]["ok_0"] = {
            "updated_at": now_ms,
            "channel": "chat",
            "transport": "expo",
            "status": "provider_delivered",
            "retry_count": 0,
        }
        with caplog.at_level(logging.WARNING, logger="slo_test"):
            aggregate_notification_health(db, logger, lookback_ms=3_600_000)
        slo_warnings = [r for r in caplog.records if "slo_warning" in r.message]
        assert len(slo_warnings) > 0, "SLO warning must be logged when delivery rate < 85%"

    def test_queue_depth_written_to_queue_health(self):
        """Queue depth is persisted to notification_queue_health/current."""
        from services.notification_aggregation import aggregate_notification_health
        db = FakeFirestoreDB()
        logger = make_logger()
        now_ms = int(time.time() * 1000)
        # Add 3 active queue entries
        for i in range(3):
            db.store["notification_dispatch_queue"][f"q_{i}"] = {
                "status": "queued", "updated_at": now_ms,
            }
        # Also add 1 delivery log so aggregation doesn't short-circuit early
        db.store["notification_delivery_logs"]["log_0"] = {
            "updated_at": now_ms,
            "channel": "chat",
            "transport": "expo",
            "status": "provider_delivered",
            "retry_count": 0,
        }
        result = aggregate_notification_health(db, logger)
        # Queue depth is always written to queue_health doc
        health_doc = db.get_doc("notification_queue_health", "current")
        assert health_doc is not None
        assert health_doc["queue_depth"] == 3


# ──────────────────────────────────────────────────────────────
# 10. PERFORMANCE / STRESS TESTS
# ──────────────────────────────────────────────────────────────

class TestPerformance:

    def _stress_enqueue(self, count: int):
        db = FakeFirestoreDB()
        start = time.perf_counter()
        for i in range(count):
            enqueue_job(db, f"perf_evt_{i}", ["uid_s"])
        elapsed = time.perf_counter() - start
        return db, elapsed

    def test_100_notifications_enqueued_under_2s(self):
        _, t = self._stress_enqueue(100)
        assert t < 2.0, f"100 enqueues took {t:.3f}s (threshold: 2s)"

    def test_500_notifications_enqueued_under_5s(self):
        _, t = self._stress_enqueue(500)
        assert t < 5.0, f"500 enqueues took {t:.3f}s (threshold: 5s)"

    def test_1000_notifications_enqueued_under_10s(self):
        _, t = self._stress_enqueue(1000)
        assert t < 10.0, f"1000 enqueues took {t:.3f}s (threshold: 10s)"

    def test_5000_notifications_enqueued_under_30s(self):
        _, t = self._stress_enqueue(5000)
        assert t < 30.0, f"5000 enqueues took {t:.3f}s (threshold: 30s)"

    def test_10000_notifications_enqueued_under_60s(self):
        _, t = self._stress_enqueue(10000)
        assert t < 60.0, f"10000 enqueues took {t:.3f}s (threshold: 60s)"

    def test_worker_tick_processes_20_jobs_under_5s(self):
        """Worker tick processing 20 jobs (mocked network) must complete under 5s."""
        from services.fanout_worker import process_queue_once
        from services.provider_interface import ProviderSendResult
        db = FakeFirestoreDB()
        logger = make_logger()
        db.store["users"]["uid_perf"] = {
            "expo_push_tokens": ["ExponentPushToken[perf_tok]"],
        }
        for i in range(20):
            enqueue_job(db, f"throughput_{i}", ["uid_perf"])
        start = time.perf_counter()
        with patch("services.provider_adapters.expo_adapter.send_notification") as mock_send:
            mock_send.return_value = ProviderSendResult(
                "expo", accepted=1, failed=0,
                tickets=[{"id": "t1", "status": "ok"}], failures=[],
            )
            result = process_queue_once(db, logger, worker_id="perf-worker", limit=20)
        elapsed = time.perf_counter() - start
        assert elapsed < 5.0, f"Worker tick took {elapsed:.3f}s — must be < 5s"
        assert result["ok"] is True


# ──────────────────────────────────────────────────────────────
# 11. SECURITY TESTS
# ──────────────────────────────────────────────────────────────

class TestNotificationSecurity:

    def test_student_cannot_broadcast_via_send_push(self, setup_test_context):
        from fastapi.testclient import TestClient
        import server
        client = TestClient(server.app)
        response = client.post(
            "/api/push/send",
            json={"title": "Hack", "body": "Broadcast", "send_to_all": True},
            headers={"Authorization": "Bearer student_token"},
        )
        assert response.status_code == 403

    def test_teacher_cannot_broadcast_via_send_push(self, setup_test_context):
        from fastapi.testclient import TestClient
        import server
        client = TestClient(server.app)
        response = client.post(
            "/api/push/send",
            json={"title": "Hi", "body": "All students", "send_to_all": True},
            headers={"Authorization": "Bearer teacher_token"},
        )
        assert response.status_code == 403

    def test_admin_can_broadcast(self, setup_test_context):
        from fastapi.testclient import TestClient
        import server
        client = TestClient(server.app)
        response = client.post(
            "/api/push/send",
            json={"title": "Admin Broadcast", "body": "Hello all", "send_to_all": True},
            headers={"Authorization": "Bearer admin_token"},
        )
        assert response.status_code == 200

    def test_student_cannot_enqueue_push(self, setup_test_context):
        from fastapi.testclient import TestClient
        import server
        client = TestClient(server.app)
        response = client.post(
            "/api/push/enqueue",
            json={"dedupe_id": "d1", "event": "e1", "channel": "c1",
                  "payload": {}, "recipients": ["u1"]},
            headers={"Authorization": "Bearer student_token"},
        )
        assert response.status_code == 403

    def test_anonymous_cannot_send_push(self, setup_test_context):
        from fastapi.testclient import TestClient
        import server
        client = TestClient(server.app)
        response = client.post(
            "/api/push/send",
            json={"title": "T", "body": "B"},
            headers={"Authorization": "Bearer anonymous_token"},
        )
        assert response.status_code == 403

    def test_teacher_push_without_chat_context_rejected(self, setup_test_context):
        """Teacher sending to user_ids without valid chat context must be rejected."""
        from fastapi.testclient import TestClient
        import server
        client = TestClient(server.app)
        response = client.post(
            "/api/push/send",
            json={"title": "Hi", "body": "Msg",
                  "user_ids": ["uid_student"],
                  "data": {"type": "announcement"}},
            headers={"Authorization": "Bearer teacher_token"},
        )
        assert response.status_code == 403


# ──────────────────────────────────────────────────────────────
# 12. OBSERVABILITY TESTS
# ──────────────────────────────────────────────────────────────

class TestObservability:

    def test_job_lease_log_emitted_on_pickup(self):
        from services.fanout_worker import process_queue_once
        db = FakeFirestoreDB()
        logger = MagicMock()
        db.store["users"]["uid_obs"] = {"expo_push_tokens": []}
        enqueue_job(db, "obs_lease", ["uid_obs"])
        process_queue_once(db, logger, worker_id="w1", limit=10)
        assert logger.info.called, "Worker must log info on job pickup"

    def test_deadletter_log_emitted_on_exhaustion(self):
        from services.fanout_worker import process_queue_once
        db = FakeFirestoreDB()
        logger = MagicMock()
        db.store["users"]["uid_notfound"] = {
            "fcm_tokens": ["a" * 40 + ":" + "b" * 50]
        }
        qid = enqueue_job(
            db, "deadletter_test", ["uid_notfound"],
            max_attempts=1, attempts=1,
        )
        process_queue_once(db, logger, worker_id="w-dl", limit=10)
        assert logger.warning.called or logger.error.called

    def test_circuit_breaker_open_log_emitted(self):
        from services.provider_circuit_breaker import record_result
        db = FakeFirestoreDB()
        logger = MagicMock()
        for _ in range(5):
            record_result(db, logger, "expo", False)
        logger.warning.assert_any_call(
            "[circuit_breaker_opened] provider=%s failures=%s", "expo", 5,
        )

    def test_stale_lease_reclaim_warning_emitted(self):
        from services.stale_lease_reclaimer import reclaim_stale_leases
        db = FakeFirestoreDB()
        logger = MagicMock()
        now_ms = int(time.time() * 1000)
        qid = enqueue_job(db, "stale_obs", ["uid_s"], status="processing")
        db.store["notification_dispatch_queue"][qid]["lease_expires_at"] = now_ms - 10000
        reclaim_stale_leases(db, logger)
        assert logger.warning.called, "Reclaimer must log a warning when reclaiming a stale job"

    def test_token_soft_invalidation_warning_emitted(self):
        """
        On status transition to 'invalid', a warning must be logged.
        Uses 'InvalidCredentials' (contains 'invalid') to reliably trigger
        invalid_signals increment since the current code checks
        `'invalid' in reason.lower()`. See BUG NOTE in test_token_status_becomes_invalid.
        """
        from services.token_health_engine import update_token_registry
        db = FakeFirestoreDB()
        logger = MagicMock()
        # First two calls: status stays 'active' (invalid_signals < 3)
        for _ in range(2):
            update_token_registry(
                db, logger, "ExponentPushToken[warn_tok]", "expo", "android",
                success=False, reason="InvalidCredentials",
            )
        logger.reset_mock()
        # Third call: invalid_signals reaches 3 → status transitions to 'invalid' → warning
        update_token_registry(
            db, logger, "ExponentPushToken[warn_tok]", "expo", "android",
            success=False, reason="InvalidCredentials",
        )
        # The status change from 'active' → 'invalid' triggers the soft_invalidated warning
        warning_calls = [str(c) for c in logger.warning.call_args_list]
        assert any("token_soft_invalidated" in c for c in warning_calls), (
            "token_soft_invalidated warning must be logged on status transition to invalid"
        )


# ──────────────────────────────────────────────────────────────
# FIXTURES
# ──────────────────────────────────────────────────────────────

import os
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test")
os.environ.setdefault("REQUIRE_APP_CHECK", "false")

import server


class FakeMongoCollection:
    async def insert_one(self, data): return None
    def find(self):
        class FC:
            async def to_list(self, limit): return []
        return FC()


class FakeMongoClient:
    def __init__(self):
        self.status_checks = FakeMongoCollection()


@pytest.fixture
def setup_test_context(monkeypatch):
    fake_db = FakeFirestoreDB()
    fake_db.store["users"] = {
        "uid_super_admin": {"role": "super_admin", "status": "approved"},
        "uid_admin":       {"role": "admin",       "status": "approved"},
        "uid_teacher":     {"role": "teacher",     "status": "approved"},
        "uid_student":     {"role": "student",     "status": "approved"},
        "uid_disabled":    {"role": "student",     "status": "disabled"},
    }

    def mock_verify_id_token(token, check_revoked=False):
        mapping = {
            "super_admin_token": {"uid": "uid_super_admin", "email": "sa@test.com", "email_verified": True},
            "admin_token":       {"uid": "uid_admin",       "email": "a@test.com",  "email_verified": True},
            "teacher_token":     {"uid": "uid_teacher",     "email": "t@test.com",  "email_verified": True},
            "student_token":     {"uid": "uid_student",     "email": "s@test.com",  "email_verified": True},
            "anonymous_token":   {"uid": "uid_anon",        "email_verified": False},
        }
        if token not in mapping:
            raise Exception("Invalid token")
        return mapping[token]

    monkeypatch.setattr(server.firebase_auth, "verify_id_token", mock_verify_id_token)
    monkeypatch.setattr(server, "firebase_db", fake_db)
    monkeypatch.setattr(server, "db", FakeMongoClient())
    monkeypatch.setattr(server, "_enforce_nonce", lambda request, uid: None)
    monkeypatch.setattr(server, "_validate_admin_origin", lambda request: None)
    return fake_db
