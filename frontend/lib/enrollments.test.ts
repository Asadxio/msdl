import { allowsLegacyCourseAccessWhenEnrollmentMissing, getEnrollmentDocId, isActiveEnrollmentForUserCourse } from './enrollments';

describe('canonical live-class enrollment access', () => {
  const userId = 'student_uid';
  const courseId = 'course_123';

  it('uses one deterministic enrollment document path for before/after class creation and admin/payment writes', () => {
    expect(getEnrollmentDocId(userId, courseId)).toBe('student_uid:course_123');
  });

  it('passes active enrollment without relying on stale liveClass.student_ids', () => {
    const enrollment = { user_id: userId, course_id: courseId, status: 'active' };
    const staleStudentIds: string[] = [];

    expect(staleStudentIds.includes(userId)).toBe(false);
    expect(isActiveEnrollmentForUserCourse(enrollment, userId, courseId)).toBe(true);
  });

  it('fails missing, inactive, wrong-user, and wrong-course records', () => {
    expect(isActiveEnrollmentForUserCourse(null, userId, courseId)).toBe(false);
    expect(isActiveEnrollmentForUserCourse({ user_id: userId, course_id: courseId, status: 'pending' }, userId, courseId)).toBe(false);
    expect(isActiveEnrollmentForUserCourse({ user_id: 'other', course_id: courseId, status: 'active' }, userId, courseId)).toBe(false);
    expect(isActiveEnrollmentForUserCourse({ user_id: userId, course_id: 'other_course', status: 'active' }, userId, courseId)).toBe(false);
  });

  it('allows legacy course access only when the live class was not sourced from enrollments', () => {
    expect(allowsLegacyCourseAccessWhenEnrollmentMissing(undefined)).toBe(true);
    expect(allowsLegacyCourseAccessWhenEnrollmentMissing('none')).toBe(true);
    expect(allowsLegacyCourseAccessWhenEnrollmentMissing('course_student_ids')).toBe(true);
    expect(allowsLegacyCourseAccessWhenEnrollmentMissing('enrollments')).toBe(false);
  });
});
