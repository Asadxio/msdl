from payments.payment_finalizer import finalize_successful_payment


class FakeSnapshot:
    def __init__(self, data=None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data or {})


class FakeDocument:
    def __init__(self, collection, doc_id):
        self.collection = collection
        self.id = doc_id

    def get(self, transaction=None):
        return FakeSnapshot(self.collection.store.get(self.id))


class FakeCollection:
    def __init__(self, name, root):
        self.name = name
        self.root = root
        self.store = root.setdefault(name, {})
        self.auto = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self.auto += 1
            doc_id = f"auto_{self.auto}"
        return FakeDocument(self, doc_id)


class FakeDb:
    def __init__(self):
        self.root = {}

    def collection(self, name):
        return FakeCollection(name, self.root)


class FakeTransaction:
    def get(self, doc):
        return doc.get(transaction=self)

    def set(self, doc, data, merge=False):
        existing = doc.collection.store.get(doc.id, {}) if merge else {}
        existing.update(data)
        doc.collection.store[doc.id] = existing


def fake_transactional(fn):
    return fn


def test_succeeded_without_entitlement_is_finalized(monkeypatch):
    import payments.payment_finalizer as module

    monkeypatch.setattr(module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    monkeypatch.setattr(module.admin_firestore, "transactional", fake_transactional)
    monkeypatch.setattr(module.admin_firestore, "SERVER_TIMESTAMP", "SERVER_TIMESTAMP")

    db = FakeDb()
    db.root["payments"] = {
        "p1": {
            "state": "succeeded",
            "user_id": "student_1",
            "type": "fees",
            "course_id": "course_1",
        }
    }

    result = finalize_successful_payment(db, "p1", "admin", "regression")

    assert result["ok"] is True
    assert result["entitlement_granted"] is True
    assert db.root["payments"]["p1"]["entitlement_granted"] is True
    assert db.root["subscriptions"]["student_1"]["status"] == "active"
    assert db.root["enrollments"]["student_1:course_1"]["course_id"] == "course_1"


def test_finalized_payment_remains_idempotent(monkeypatch):
    import payments.payment_finalizer as module

    monkeypatch.setattr(module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    monkeypatch.setattr(module.admin_firestore, "transactional", fake_transactional)
    monkeypatch.setattr(module.admin_firestore, "SERVER_TIMESTAMP", "SERVER_TIMESTAMP")

    db = FakeDb()
    db.root["payments"] = {
        "p2": {
            "state": "succeeded",
            "entitlement_granted": True,
            "user_id": "student_2",
            "type": "fees",
            "course_id": "course_2",
        }
    }

    result = finalize_successful_payment(db, "p2", "admin", "again")

    assert result["ok"] is True
    assert result["idempotent"] is True
    assert db.root.get("enrollments", {}) == {}


def test_processing_payment_success_grants_course_access(monkeypatch):
    import payments.payment_finalizer as module

    monkeypatch.setattr(module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    monkeypatch.setattr(module.admin_firestore, "transactional", fake_transactional)
    monkeypatch.setattr(module.admin_firestore, "SERVER_TIMESTAMP", "SERVER_TIMESTAMP")

    db = FakeDb()
    db.root["payments"] = {
        "p3": {
            "state": "processing",
            "user_id": "student_3",
            "type": "fees",
            "course_id": "course_3",
        }
    }

    result = finalize_successful_payment(db, "p3", "admin", "manual_approve")

    assert result["ok"] is True
    assert db.root["payments"]["p3"]["state"] == "succeeded"
    assert db.root["payments"]["p3"]["entitlement_granted"] is True
    assert db.root["enrollments"]["student_3:course_3"]["status"] == "active"
    assert db.root["enrollments"]["student_3:course_3"]["user_id"] == "student_3"
    assert db.root["enrollments"]["student_3:course_3"]["course_id"] == "course_3"
    assert db.root["subscriptions"]["student_3"]["status"] == "active"


def test_pending_manual_approval_grants_course_access(monkeypatch):
    import payments.payment_finalizer as module

    monkeypatch.setattr(module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    monkeypatch.setattr(module.admin_firestore, "transactional", fake_transactional)
    monkeypatch.setattr(module.admin_firestore, "SERVER_TIMESTAMP", "SERVER_TIMESTAMP")

    db = FakeDb()
    db.root["payments"] = {
        "p4": {
            "state": "pending",
            "user_id": "student_4",
            "type": "fees",
            "course_id": "course_4",
        }
    }

    result = finalize_successful_payment(db, "p4", "admin", "manual_pending_approve")

    assert result["ok"] is True
    assert db.root["payments"]["p4"]["state"] == "succeeded"
    assert db.root["payments"]["p4"]["entitlement_granted"] is True
    assert db.root["enrollments"]["student_4:course_4"]["status"] == "active"
    assert db.root["enrollments"]["student_4:course_4"]["course_id"] == "course_4"
    assert db.root["subscriptions"]["student_4"]["status"] == "active"


def test_legacy_fee_payment_without_course_id_activates_subscription_only(monkeypatch):
    import payments.payment_finalizer as module

    monkeypatch.setattr(module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    monkeypatch.setattr(module.admin_firestore, "transactional", fake_transactional)
    monkeypatch.setattr(module.admin_firestore, "SERVER_TIMESTAMP", "SERVER_TIMESTAMP")

    db = FakeDb()
    db.root["payments"] = {
        "p_missing_course": {
            "state": "processing",
            "user_id": "student_missing",
            "type": "fees",
        }
    }

    result = finalize_successful_payment(db, "p_missing_course", "admin", "manual_approve")

    assert result["ok"] is True
    assert result["entitlement_granted"] is True
    assert result["course_access_granted"] is False
    assert db.root["payments"]["p_missing_course"]["state"] == "succeeded"
    assert db.root["payments"]["p_missing_course"]["status"] == "succeeded"
    assert db.root["subscriptions"]["student_missing"]["status"] == "active"
    assert db.root.get("enrollments", {}) == {}


def test_donation_payment_does_not_create_course_enrollment(monkeypatch):
    import payments.payment_finalizer as module

    monkeypatch.setattr(module.admin_firestore, "transaction", lambda: FakeTransaction(), raising=False)
    monkeypatch.setattr(module.admin_firestore, "transactional", fake_transactional)
    monkeypatch.setattr(module.admin_firestore, "SERVER_TIMESTAMP", "SERVER_TIMESTAMP")

    db = FakeDb()
    db.root["payments"] = {
        "p_donation": {
            "state": "processing",
            "user_id": "donor_1",
            "type": "sadqa",
        }
    }

    result = finalize_successful_payment(db, "p_donation", "admin", "manual_approve")

    assert result["ok"] is True
    assert result["entitlement_granted"] is False
    assert db.root["payments"]["p_donation"]["state"] == "succeeded"
    assert db.root["payments"]["p_donation"]["entitlement_granted"] is False
    assert db.root.get("enrollments", {}) == {}
    assert db.root.get("subscriptions", {}) == {}
