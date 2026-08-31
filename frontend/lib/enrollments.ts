export const ENROLLMENT_DOC_ID_SEPARATOR = ':';

export type CourseSubject = {
  id: string;
  name: string;
  teacher_id?: string;
  teacher_name?: string;
  schedule?: string;
};

export type EnrollmentLike = {
  user_id?: unknown;
  course_id?: unknown;
  status?: unknown;
  enrolled_at?: unknown;
  created_at?: unknown;
} | null | undefined;

export function getEnrollmentDocId(userId: string, courseId: string): string {
  return `${String(userId || '').trim()}${ENROLLMENT_DOC_ID_SEPARATOR}${String(courseId || '').trim()}`;
}

export function isActiveEnrollmentForUserCourse(enrollment: EnrollmentLike, userId: string, courseId: string): boolean {
  return String(enrollment?.user_id || '').trim() === String(userId || '').trim()
    && String(enrollment?.course_id || '').trim() === String(courseId || '').trim()
    && String(enrollment?.status || '').trim() === 'active';
}

export function allowsLegacyCourseAccessWhenEnrollmentMissing(enrollmentSource: unknown): boolean {
  return String(enrollmentSource || '').trim() !== 'enrollments';
}

/**
 * Filter courses to only those the student has an active enrollment in.
 */
export function filterEnrolledCourses<T extends { id: string }>(
  courses: T[],
  userEnrollments: Record<string, boolean>
): T[] {
  if (!courses || !Array.isArray(courses)) return [];
  return courses.filter((c) => Boolean(userEnrollments[c.id]));
}

/**
 * Filter courses to those assigned to a teacher.
 * Checks teacher_id, teacher_name, assigned_courses, and course subjects.
 */
export function filterTeacherAssignedCourses<T extends { id: string; name?: string; teacher_name?: string; teacher_id?: string; subjects?: Array<{ teacher_id?: string; teacher_name?: string }> }>(
  courses: T[],
  teacher: { id?: string; name?: string; assigned_courses?: string[]; courses?: string[] } | null | undefined,
  userUid?: string
): T[] {
  if (!courses || !Array.isArray(courses)) return [];
  if (!teacher && !userUid) return courses;

  const teacherNameNorm = String(teacher?.name || '').trim().toLowerCase();
  const assignedList = Array.isArray(teacher?.assigned_courses)
    ? teacher.assigned_courses.map((s) => String(s || '').trim().toLowerCase())
    : (Array.isArray(teacher?.courses) ? teacher.courses.map((s) => String(s || '').trim().toLowerCase()) : []);

  return courses.filter((c) => {
    // 1. Direct teacher_id match
    if (userUid && c.teacher_id && String(c.teacher_id).trim() === userUid) return true;
    if (teacher?.id && c.teacher_id && String(c.teacher_id).trim() === teacher.id) return true;

    // 2. Direct teacher_name match
    if (teacherNameNorm && c.teacher_name && String(c.teacher_name).trim().toLowerCase().includes(teacherNameNorm)) return true;

    // 3. Assigned course ID or course name match
    const courseIdNorm = String(c.id || '').trim().toLowerCase();
    const courseNameNorm = String(c.name || '').trim().toLowerCase();
    if (assignedList.some((a) => a === courseIdNorm || a === courseNameNorm || courseNameNorm.includes(a))) return true;

    // 4. Subject-level teacher assignment
    if (Array.isArray(c.subjects)) {
      const subjectMatch = c.subjects.some((sub) => {
        if (userUid && sub.teacher_id && String(sub.teacher_id).trim() === userUid) return true;
        if (teacherNameNorm && sub.teacher_name && String(sub.teacher_name).trim().toLowerCase().includes(teacherNameNorm)) return true;
        return false;
      });
      if (subjectMatch) return true;
    }

    return false;
  });
}

