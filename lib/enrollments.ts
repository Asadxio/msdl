export const ENROLLMENT_DOC_ID_SEPARATOR = ':';

export type EnrollmentLike = { user_id?: unknown; course_id?: unknown; status?: unknown } | null | undefined;

export function getEnrollmentDocId(userId: string, courseId: string): string {
  return `${String(userId || '').trim()}${ENROLLMENT_DOC_ID_SEPARATOR}${String(courseId || '').trim()}`;
}

export function isActiveEnrollmentForUserCourse(enrollment: EnrollmentLike, userId: string, courseId: string): boolean {
  return String(enrollment?.user_id || '') === String(userId || '').trim()
    && String(enrollment?.course_id || '') === String(courseId || '').trim()
    && String(enrollment?.status || '') === 'active';
}
