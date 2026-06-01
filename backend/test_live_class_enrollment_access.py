import os

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test")

from server import _enrollment_doc_id, _is_active_enrollment, _is_live_class_member


class FakeSnapshot:
    def __init__(self, data=None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data or {})


class FakeDocument:
    def __init__(self, store, doc_id):
        self.store = store
        self.id = doc_id

    def get(self):
        return FakeSnapshot(self.store.get(self.id))


class FakeCollection:
    def __init__(self, store):
        self.store = store

    def document(self, doc_id):
        return FakeDocument(self.store, doc_id)


class FakeDb:
    def __init__(self, enrollments):
        self.enrollments = enrollments

    def collection(self, name):
        assert name == "enrollments"
        return FakeCollection(self.enrollments)


def test_canonical_enrollment_doc_id_is_user_course():
    assert _enrollment_doc_id(" student_uid ", " course_123 ") == "student_uid:course_123"


def test_active_enrollment_predicate_requires_user_course_and_active_status():
    assert _is_active_enrollment({"user_id": "student_uid", "course_id": "course_123", "status": "active"}, "student_uid", "course_123") is True
    assert _is_active_enrollment({"user_id": "student_uid", "course_id": "course_123", "status": "pending"}, "student_uid", "course_123") is False
    assert _is_active_enrollment({"user_id": "other", "course_id": "course_123", "status": "active"}, "student_uid", "course_123") is False
    assert _is_active_enrollment({"user_id": "student_uid", "course_id": "other", "status": "active"}, "student_uid", "course_123") is False


def test_enrolled_before_class_creation_can_join_without_student_ids(monkeypatch):
    enrollments = {
        "student_uid:course_123": {"user_id": "student_uid", "course_id": "course_123", "status": "active", "source": "admin"}
    }
    import server
    monkeypatch.setattr(server, "firebase_db", FakeDb(enrollments))

    assert _is_live_class_member("student_uid", "student", {"course_id": "course_123", "student_ids": []}) is True


def test_enrolled_after_class_creation_can_join_without_student_ids(monkeypatch):
    # The class snapshot remains stale (student_ids is empty), but the canonical
    # enrollment document created after class start is now sufficient.
    enrollments = {
        "student_uid:course_123": {"user_id": "student_uid", "course_id": "course_123", "status": "active", "source": "admin"}
    }
    import server
    monkeypatch.setattr(server, "firebase_db", FakeDb(enrollments))

    stale_live_class = {"course_id": "course_123", "student_ids": []}
    assert _is_live_class_member("student_uid", "student", stale_live_class) is True


def test_admin_manual_enrollment_can_join(monkeypatch):
    enrollments = {
        "student_uid:course_123": {"user_id": "student_uid", "course_id": "course_123", "status": "active", "source": "admin"}
    }
    import server
    monkeypatch.setattr(server, "firebase_db", FakeDb(enrollments))

    assert _is_live_class_member("student_uid", "student", {"course_id": "course_123"}) is True


def test_payment_enrollment_can_join(monkeypatch):
    enrollments = {
        "student_uid:course_123": {"user_id": "student_uid", "course_id": "course_123", "status": "active", "source": "payment", "payment_id": "pay_1"}
    }
    import server
    monkeypatch.setattr(server, "firebase_db", FakeDb(enrollments))

    assert _is_live_class_member("student_uid", "student", {"course_id": "course_123"}) is True


def test_stale_student_ids_alone_no_longer_grants_student_access(monkeypatch):
    import server
    monkeypatch.setattr(server, "firebase_db", FakeDb({}))

    assert _is_live_class_member("student_uid", "student", {"course_id": "course_123", "student_ids": ["student_uid"]}) is False
