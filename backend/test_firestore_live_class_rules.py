from pathlib import Path


RULES = Path(__file__).resolve().parents[1] / "firestore.rules"


def _function_body(name: str) -> str:
    text = RULES.read_text()
    marker = f"function {name}"
    start = text.index(marker)
    next_function = text.find("\n    function ", start + len(marker))
    next_match = text.find("\n    match ", start + len(marker))
    candidates = [pos for pos in [next_function, next_match] if pos != -1]
    end = min(candidates) if candidates else len(text)
    return text[start:end]


def test_live_class_rules_use_active_enrollment_as_student_source_of_truth():
    join_body = _function_body("canJoinLiveClassData")
    read_body = _function_body("canReadLiveClassData")

    assert "hasActiveEnrollmentForCourse(data.course_id)" in join_body
    assert "hasActiveEnrollmentForCourse(data.course_id)" in read_body
    assert "student_ids" not in join_body
    assert "student_ids" not in read_body


def test_live_class_rules_check_canonical_enrollment_document():
    active_body = _function_body("hasActiveEnrollmentForCourse")
    enrollment_match = RULES.read_text()[RULES.read_text().index("match /enrollments/{enrollmentId}"):]

    assert "enrollments/$(enrollmentDocId(request.auth.uid, courseId))" in active_body
    assert "activeEnrollmentDoc(courseId).data.user_id == request.auth.uid" in active_body
    assert "activeEnrollmentDoc(courseId).data.course_id == courseId" in active_body
    assert "activeEnrollmentDoc(courseId).data.status == 'active'" in active_body
    assert "enrollmentId == enrollmentDocId(request.resource.data.user_id, request.resource.data.course_id)" in enrollment_match
