/**
 * teacherScoping.ts
 *
 * Phase 70B — Complete Teacher Teaching Workflow
 * Authoritative scoping logic for teachers at both Course and Subject levels.
 *
 * Prevents cross-course and cross-subject data leakage.
 * If Teacher A teaches Rabiya -> Tajweed, Teacher A MUST NOT see
 * Rabiya -> Fiqh or Ula -> all subjects unless explicitly assigned.
 */

import { Course, CourseSubject, Teacher } from '@/context/DataContext';

export interface TeacherAcademicScope {
  teacherUid: string;
  teacherId?: string;
  teacherName: string;
  assignedCourses: Course[];
  assignedCourseIds: Set<string>;
  assignedCourseNames: Set<string>;
  subjectsByCourseId: Map<string, CourseSubject[]>;
  isCourseLevelTeacherByCourseId: Map<string, boolean>;
}

/**
 * Normalizes strings for robust matching.
 */
function norm(str?: string | null): string {
  return String(str || '').trim().toLowerCase();
}

/**
 * Checks if a teacher is assigned at the course-level.
 * Course-level assignment means the teacher oversees or teaches the entire course.
 */
export function isTeacherAssignedToCourse(
  course: Course,
  teacher: Teacher | null | undefined,
  userUid?: string
): boolean {
  if (!course) return false;
  if (!teacher && !userUid) return false;

  const uid = norm(userUid);
  const teacherDocId = norm(teacher?.id);
  const teacherInstId = norm(teacher?.teacher_id);
  const teacherUserUid = norm(teacher?.user_uid);
  const teacherName = norm(teacher?.name);

  // 1. Direct course teacher_id / assigned_teacher_id matching
  const cTeacherIds = [
    course.teacher_id,
    (course as any).assigned_teacher_id,
    (course as any).instructor_id,
    ...(Array.isArray((course as any).teacher_ids) ? (course as any).teacher_ids : []),
  ].map(norm).filter(Boolean);

  if (cTeacherIds.some((cId) =>
    (uid && cId === uid) ||
    (teacherDocId && cId === teacherDocId) ||
    (teacherInstId && cId === teacherInstId) ||
    (teacherUserUid && cId === teacherUserUid)
  )) {
    return true;
  }

  // 2. Direct course teacher_name matching
  const cTeacherName = norm(course.teacher_name);
  if (teacherName && cTeacherName && (cTeacherName === teacherName || cTeacherName.includes(teacherName) || teacherName.includes(cTeacherName))) {
    return true;
  }

  // 3. Teacher assigned_courses or courses array contains course ID or name
  const assignedList = [
    ...(Array.isArray(teacher?.assigned_courses) ? teacher.assigned_courses : []),
    ...(Array.isArray(teacher?.courses) ? teacher.courses : []),
  ].map(norm);

  const cId = norm(course.id);
  const cName = norm(course.name);
  if (assignedList.some((a) => a === cId || a === cName || (cName && cName.includes(a)))) {
    return true;
  }

  // 4. Any subject in the course is assigned to this teacher
  if (Array.isArray(course.subjects)) {
    const hasSubject = course.subjects.some((sub) =>
      isTeacherAssignedToSubject(course, sub, teacher, userUid)
    );
    if (hasSubject) return true;
  }

  return false;
}

/**
 * Checks if a teacher is specifically assigned to a subject within a course.
 */
export function isTeacherAssignedToSubject(
  course: Course,
  subject: CourseSubject,
  teacher: Teacher | null | undefined,
  userUid?: string
): boolean {
  if (!subject) return false;
  if (!teacher && !userUid) return false;

  const uid = norm(userUid);
  const teacherDocId = norm(teacher?.id);
  const teacherInstId = norm(teacher?.teacher_id);
  const teacherUserUid = norm(teacher?.user_uid);
  const teacherName = norm(teacher?.name);

  const subTeacherId = norm(subject.teacher_id);
  if (subTeacherId) {
    if (uid && subTeacherId === uid) return true;
    if (teacherDocId && subTeacherId === teacherDocId) return true;
    if (teacherInstId && subTeacherId === teacherInstId) return true;
    if (teacherUserUid && subTeacherId === teacherUserUid) return true;
  }

  const subTeacherName = norm(subject.teacher_name);
  if (teacherName && subTeacherName && (subTeacherName === teacherName || subTeacherName.includes(teacherName) || teacherName.includes(subTeacherName))) {
    return true;
  }

  // If the subject has no specific teacher assigned, but the teacher is the course-level teacher
  if (!subTeacherId && !subTeacherName) {
    const cTeacherId = norm(course?.teacher_id);
    if (cTeacherId && (cTeacherId === uid || cTeacherId === teacherDocId || cTeacherId === teacherInstId || cTeacherId === teacherUserUid)) {
      return true;
    }
    const cTeacherName = norm(course?.teacher_name);
    if (teacherName && cTeacherName && (cTeacherName === teacherName || cTeacherName.includes(teacherName))) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the list of subjects within a course that are specifically taught by this teacher.
 */
export function getTeacherAssignedSubjects(
  course: Course,
  teacher: Teacher | null | undefined,
  userUid?: string
): CourseSubject[] {
  if (!course || !Array.isArray(course.subjects)) return [];

  // Check if teacher is course-level teacher
  const isCourseLevel = (() => {
    const uid = norm(userUid);
    const teacherDocId = norm(teacher?.id);
    const teacherInstId = norm(teacher?.teacher_id);
    const teacherUserUid = norm(teacher?.user_uid);
    const teacherName = norm(teacher?.name);

    const cTeacherIds = [
      course.teacher_id,
      (course as any).assigned_teacher_id,
      (course as any).instructor_id,
      ...(Array.isArray((course as any).teacher_ids) ? (course as any).teacher_ids : []),
    ].map(norm).filter(Boolean);

    if (cTeacherIds.some((cId) =>
      (uid && cId === uid) ||
      (teacherDocId && cId === teacherDocId) ||
      (teacherInstId && cId === teacherInstId) ||
      (teacherUserUid && cId === teacherUserUid)
    )) {
      return true;
    }
    const cTeacherName = norm(course.teacher_name);
    if (teacherName && cTeacherName && (cTeacherName === teacherName || cTeacherName.includes(teacherName))) {
      return true;
    }

    const assignedList = [
      ...(Array.isArray(teacher?.assigned_courses) ? teacher.assigned_courses : []),
      ...(Array.isArray(teacher?.courses) ? teacher.courses : []),
    ].map(norm);
    const cId = norm(course.id);
    const cName = norm(course.name);
    return assignedList.some((a) => a === cId || a === cName || (cName && cName.includes(a)));
  })();

  return course.subjects.filter((sub) => {
    // Direct subject assignment
    if (isTeacherAssignedToSubject(course, sub, teacher, userUid)) {
      return true;
    }
    // If course-level teacher and subject doesn't belong to another teacher
    if (isCourseLevel && !sub.teacher_id && !sub.teacher_name) {
      return true;
    }
    return false;
  });
}

/**
 * Builds the complete academic scope for a teacher across all courses.
 */
export function getTeacherAcademicScope(
  courses: Course[],
  teacher: Teacher | null | undefined,
  userUid?: string
): TeacherAcademicScope {
  const assignedCourses: Course[] = [];
  const assignedCourseIds = new Set<string>();
  const assignedCourseNames = new Set<string>();
  const subjectsByCourseId = new Map<string, CourseSubject[]>();
  const isCourseLevelTeacherByCourseId = new Map<string, boolean>();

  if (!courses || !Array.isArray(courses)) {
    return {
      teacherUid: userUid || '',
      teacherId: teacher?.teacher_id || teacher?.id,
      teacherName: teacher?.name || 'Faculty',
      assignedCourses,
      assignedCourseIds,
      assignedCourseNames,
      subjectsByCourseId,
      isCourseLevelTeacherByCourseId,
    };
  }

  for (const course of courses) {
    if (isTeacherAssignedToCourse(course, teacher, userUid)) {
      assignedCourses.push(course);
      if (course.id) {
        assignedCourseIds.add(course.id);
        assignedCourseIds.add(course.id.toLowerCase());
      }
      if (course.name) {
        assignedCourseNames.add(course.name);
        assignedCourseNames.add(course.name.toLowerCase());
      }

      const assignedSubs = getTeacherAssignedSubjects(course, teacher, userUid);
      subjectsByCourseId.set(course.id, assignedSubs);

      // Check if course-level
      const uid = norm(userUid);
      const teacherDocId = norm(teacher?.id);
      const teacherInstId = norm(teacher?.teacher_id);
      const teacherUserUid = norm(teacher?.user_uid);
      const teacherName = norm(teacher?.name);
      const cTeacherIds = [
        course.teacher_id,
        (course as any).assigned_teacher_id,
        (course as any).instructor_id,
        ...(Array.isArray((course as any).teacher_ids) ? (course as any).teacher_ids : []),
      ].map(norm).filter(Boolean);
      const cTeacherName = norm(course.teacher_name);

      const isCourseLevel = Boolean(
        cTeacherIds.some((cId) =>
          (uid && cId === uid) ||
          (teacherDocId && cId === teacherDocId) ||
          (teacherInstId && cId === teacherInstId) ||
          (teacherUserUid && cId === teacherUserUid)
        ) ||
        (teacherName && cTeacherName && (cTeacherName === teacherName || cTeacherName.includes(teacherName)))
      );
      isCourseLevelTeacherByCourseId.set(course.id, isCourseLevel);
    }
  }

  return {
    teacherUid: userUid || teacher?.user_uid || '',
    teacherId: teacher?.teacher_id || teacher?.id,
    teacherName: teacher?.name || 'Faculty',
    assignedCourses,
    assignedCourseIds,
    assignedCourseNames,
    subjectsByCourseId,
    isCourseLevelTeacherByCourseId,
  };
}

/**
 * Filter students from the active enrollments list down to ONLY those in this teacher's assigned courses.
 */
export function filterEnrollmentsForTeacher<T extends { course_id?: string; status?: string }>(
  enrollments: T[],
  scope: TeacherAcademicScope
): T[] {
  if (!enrollments || !Array.isArray(enrollments)) return [];
  return enrollments.filter((e) => {
    if (e.status !== 'active') return false;
    const cid = norm(e.course_id);
    return scope.assignedCourseIds.has(cid);
  });
}

/**
 * Filter submissions to only those that belong to an assignment in the teacher's assigned course/subject.
 */
export function filterSubmissionsForTeacher<T extends { course_id?: string; assignment_id?: string }>(
  submissions: T[],
  scope: TeacherAcademicScope,
  assignmentsMap?: Map<string, { course_id: string; subject_id?: string }>
): T[] {
  if (!submissions || !Array.isArray(submissions)) return [];
  return submissions.filter((sub) => {
    // 1. Direct course_id on submission
    if (sub.course_id && scope.assignedCourseIds.has(norm(sub.course_id))) {
      return true;
    }
    // 2. Lookup via assignment
    if (sub.assignment_id && assignmentsMap) {
      const a = assignmentsMap.get(sub.assignment_id);
      if (a && scope.assignedCourseIds.has(norm(a.course_id))) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Filter quiz results to only those matching the teacher's assigned courses.
 */
export function filterQuizResultsForTeacher<T extends { course_id?: string; category?: string }>(
  results: T[],
  scope: TeacherAcademicScope
): T[] {
  if (!results || !Array.isArray(results)) return [];
  return results.filter((r) => {
    if (r.course_id && scope.assignedCourseIds.has(norm(r.course_id))) return true;
    if (r.category && scope.assignedCourseNames.has(norm(r.category))) return true;
    return false;
  });
}

/**
 * Filter live classes to only those hosted by this teacher or in this teacher's assigned courses.
 */
export function filterLiveClassesForTeacher<T extends { course_id?: string; teacher_id?: string; host_uid?: string }>(
  liveClasses: T[],
  scope: TeacherAcademicScope,
  userUid?: string
): T[] {
  if (!liveClasses || !Array.isArray(liveClasses)) return [];
  const uid = norm(userUid || scope.teacherUid);
  const teacherInstId = norm(scope.teacherId);

  return liveClasses.filter((cls) => {
    const hostId = norm(cls.host_uid || cls.teacher_id || (cls as any).instructor_id);
    if (hostId && ((uid && hostId === uid) || (teacherInstId && hostId === teacherInstId))) {
      return true;
    }
    if (cls.course_id && scope.assignedCourseIds.has(norm(cls.course_id))) {
      return true;
    }
    return false;
  });
}
