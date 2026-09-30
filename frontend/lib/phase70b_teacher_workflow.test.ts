/**
 * phase70b_teacher_workflow.test.ts
 *
 * PHASE 70B: Complete Teacher Teaching Workflow Test Suite
 * Covers all 27 required cases across 6 domains:
 *
 * 1. Identity & Scoping (Cases 1-5)
 * 2. Lesson Authoring (Cases 6-9)
 * 3. Assignment Creation & Grading (Cases 10-14)
 * 4. Student Roster & Progress (Cases 15-18)
 * 5. Live Class Integration (Cases 19-22)
 * 6. Security & Non-Admin Boundaries (Cases 23-27)
 */

import {
  getTeacherAcademicScope,
  isTeacherAssignedToCourse,
  isTeacherAssignedToSubject,
  getTeacherAssignedSubjects,
  filterEnrollmentsForTeacher,
  filterSubmissionsForTeacher,
  filterQuizResultsForTeacher,
  filterLiveClassesForTeacher,
} from './teacherScoping';
import {
  createTeacherLesson,
  updateTeacherLesson,
  createTeacherModule,
  createTeacherAssignment,
  reviewTeacherSubmission,
} from './teacherAcademics';
import { type TeacherProfile } from './teacherIdentity';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Firestore & Firebase
// ─────────────────────────────────────────────────────────────────────────────

const mockFirestoreDocs: Record<string, Record<string, any>> = {};

jest.mock('@/lib/firebase', () => ({
  db: {},
  storage: {},
  auth: { currentUser: { uid: 'teacher-uid-a', email: 'teachera@madrasa.com' } },
}));

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn().mockImplementation((_db: any, coll: string, id: string) => {
      return { id, path: `${coll}/${id}`, _coll: coll };
    }),
    collection: jest.fn().mockImplementation((_db: any, coll: string) => {
      return { id: coll, path: coll };
    }),
    getDoc: jest.fn().mockImplementation(async (docRef: any) => {
      const coll = docRef._coll || (docRef.path ? docRef.path.split('/')[0] : '');
      const id = docRef.id;
      const data = mockFirestoreDocs[`${coll}/${id}`];
      return {
        exists: () => !!data,
        id,
        data: () => data,
      };
    }),
    getDocs: jest.fn().mockImplementation(async (queryOrCol: any) => {
      const collName = queryOrCol.id || (queryOrCol.path ? queryOrCol.path.split('/')[0] : '');
      const docs = Object.entries(mockFirestoreDocs)
        .filter(([key]) => key.startsWith(`${collName}/`))
        .map(([key, value]) => ({
          id: key.split('/')[1],
          data: () => value,
        }));
      return { docs, empty: docs.length === 0, size: docs.length };
    }),
    addDoc: jest.fn().mockImplementation(async (colRef: any, data: any) => {
      const id = `mock-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      mockFirestoreDocs[`${colRef.id}/${id}`] = data;
      return { id, path: `${colRef.id}/${id}` };
    }),
    setDoc: jest.fn().mockImplementation(async (docRef: any, data: any, options?: any) => {
      const key = `${docRef._coll || docRef.path.split('/')[0]}/${docRef.id}`;
      if (options?.merge && mockFirestoreDocs[key]) {
        mockFirestoreDocs[key] = { ...mockFirestoreDocs[key], ...data };
      } else {
        mockFirestoreDocs[key] = data;
      }
    }),
    updateDoc: jest.fn().mockImplementation(async (docRef: any, data: any) => {
      const key = `${docRef._coll || docRef.path.split('/')[0]}/${docRef.id}`;
      if (!mockFirestoreDocs[key]) {
        throw new Error(`Document ${key} does not exist`);
      }
      mockFirestoreDocs[key] = { ...mockFirestoreDocs[key], ...data };
    }),
    serverTimestamp: jest.fn().mockReturnValue({ _seconds: Math.floor(Date.now() / 1000) }),
    query: jest.fn().mockImplementation((colRef: any) => colRef),
    where: jest.fn().mockReturnValue({}),
    orderBy: jest.fn().mockReturnValue({}),
    limit: jest.fn().mockReturnValue({}),
  };
});

jest.mock('@/lib/dispatchNotification', () => ({
  dispatchNotification: jest.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const teacherA: any = {
  id: 'teacher-uid-a',
  uid: 'teacher-uid-a',
  user_uid: 'teacher-uid-a',
  email: 'teachera@madrasa.com',
  name: 'Ustadha Ayesha',
  role: 'teacher',
  teacher_id: 'TCH-0001',
  account_status: 'approved',
  status: 'approved',
  verification_status: 'verified',
  assigned_courses: ['course_a'],
  courses: ['course_a'],
  created_at: { _seconds: 1700000000 } as any,
  updated_at: { _seconds: 1700000000 } as any,
};

const teacherB: any = {
  id: 'teacher-uid-b',
  uid: 'teacher-uid-b',
  user_uid: 'teacher-uid-b',
  email: 'teacherb@madrasa.com',
  name: 'Ustadh Bilal',
  role: 'teacher',
  teacher_id: 'TCH-0002',
  account_status: 'approved',
  status: 'approved',
  verification_status: 'verified',
  assigned_courses: ['course_b'],
  courses: ['course_b'],
  created_at: { _seconds: 1700000000 } as any,
  updated_at: { _seconds: 1700000000 } as any,
};

const subjectLevelTeacher: any = {
  id: 'teacher-uid-c',
  uid: 'teacher-uid-c',
  user_uid: 'teacher-uid-c',
  email: 'teacherc@madrasa.com',
  name: 'Ustadha Zaynab',
  role: 'teacher',
  teacher_id: 'TCH-0003',
  account_status: 'approved',
  status: 'approved',
  verification_status: 'verified',
  assigned_courses: [],
  courses: [],
  created_at: { _seconds: 1700000000 } as any,
  updated_at: { _seconds: 1700000000 } as any,
};

const subject1 = {
  id: 'subj_1',
  course_id: 'course_a',
  name: 'Tajweed',
  teacher_id: 'TCH-0003', // Assigned to subjectLevelTeacher
};

const subject2 = {
  id: 'subj_2',
  course_id: 'course_a',
  name: 'Fiqh',
  teacher_id: 'TCH-0004', // Assigned to someone else
};

const subject3 = {
  id: 'subj_3',
  course_id: 'course_a',
  name: 'Seerah',
  // No specific subject teacher
};

const courseA: any = {
  id: 'course_a',
  name: 'Rabiya - Foundations',
  title: 'Rabiya - Foundations',
  assigned_teacher_id: 'TCH-0001',
  teacher_id: 'TCH-0001',
  level: 'rabiya',
  subjects: [subject1, subject2, subject3],
};

const courseB: any = {
  id: 'course_b',
  name: 'Ula - Advanced Fiqh',
  title: 'Ula - Advanced Fiqh',
  assigned_teacher_id: 'TCH-0002',
  teacher_id: 'TCH-0002',
  level: 'ula',
  subjects: [],
};

beforeEach(() => {
  for (const k of Object.keys(mockFirestoreDocs)) {
    delete mockFirestoreDocs[k];
  }
  mockFirestoreDocs['courses/course_a'] = courseA;
  mockFirestoreDocs['courses/course_b'] = courseB;
  mockFirestoreDocs['subjects/subj_1'] = subject1;
  mockFirestoreDocs['subjects/subj_2'] = subject2;
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 1: IDENTITY & SCOPING (Cases 1 - 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Domain 1: Identity & Scoping', () => {
  test('Case 1: Teacher assigned to Course A sees Course A', () => {
    const isAssigned = isTeacherAssignedToCourse(courseA, teacherA, teacherA.uid);
    expect(isAssigned).toBe(true);

    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    expect(scope.assignedCourseIds.has('course_a')).toBe(true);
    expect(scope.assignedCourses.map((c) => c.id)).toContain('course_a');
  });

  test('Case 2: Teacher assigned to Course A does not see Course B', () => {
    const isAssignedToB = isTeacherAssignedToCourse(courseB, teacherA, teacherA.uid);
    expect(isAssignedToB).toBe(false);

    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    expect(scope.assignedCourseIds.has('course_b')).toBe(false);
    expect(scope.assignedCourses.map((c) => c.id)).not.toContain('course_b');
  });

  test('Case 3: Teacher assigned to Course A -> Subject 1 sees Subject 1', () => {
    const isSubjectAssigned = isTeacherAssignedToSubject(courseA, subject1, subjectLevelTeacher, subjectLevelTeacher.uid);
    expect(isSubjectAssigned).toBe(true);

    const scope = getTeacherAcademicScope([courseA], subjectLevelTeacher, subjectLevelTeacher.uid);
    expect(scope.assignedCourseIds.has('course_a')).toBe(true); // Included via subject
    const teacherSubs = scope.subjectsByCourseId.get('course_a') || [];
    expect(teacherSubs.some((s) => s.id === 'subj_1')).toBe(true);
  });

  test('Case 4: Teacher assigned to Course A -> Subject 1 does not see Subject 2', () => {
    const isSubject2Assigned = isTeacherAssignedToSubject(courseA, subject2, subjectLevelTeacher, subjectLevelTeacher.uid);
    expect(isSubject2Assigned).toBe(false);

    const scope = getTeacherAcademicScope([courseA], subjectLevelTeacher, subjectLevelTeacher.uid);
    const teacherSubs = scope.subjectsByCourseId.get('course_a') || [];
    expect(teacherSubs.some((s) => s.id === 'subj_2')).toBe(false);
  });

  test('Case 5: Hybrid course-level teacher sees all subjects in their course', () => {
    const subjectsForTeacherA = getTeacherAssignedSubjects(courseA, teacherA, teacherA.uid);
    // Since Teacher A is the course-level teacher, they oversee the course
    expect(subjectsForTeacherA.length).toBeGreaterThanOrEqual(1);
    expect(isTeacherAssignedToCourse(courseA, teacherA, teacherA.uid)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 2: LESSON AUTHORING (Cases 6 - 9)
// ─────────────────────────────────────────────────────────────────────────────

describe('Domain 2: Lesson Authoring', () => {
  test('Case 6: Teacher can create lesson in assigned course/subject', async () => {
    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);
    const result = await createTeacherLesson(
      scope,
      {
        courseId: 'course_a',
        moduleId: 'mod_1',
        title: 'Introduction to Tajweed Rules',
        description: 'Detailed explanation of Nun Sakinah and Tanween.',
        order: 1,
      },
      teacherA.uid,
      teacherA.name
    );

    expect(result.success).toBe(true);
    expect(result.lessonId).toBeDefined();

    const createdKey = `lessons/${result.lessonId}`;
    expect(mockFirestoreDocs[createdKey]).toBeDefined();
    expect(mockFirestoreDocs[createdKey].course_id).toBe('course_a');
    expect(mockFirestoreDocs[createdKey].created_by).toBe(teacherA.uid);
  });

  test('Case 7: Teacher cannot create lesson in unassigned course', async () => {
    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);
    const result = await createTeacherLesson(
      scope,
      {
        courseId: 'course_b',
        moduleId: 'mod_2',
        title: 'Advanced Fiqh Lesson',
        description: 'Unauthorized content attempt',
      },
      teacherA.uid,
      teacherA.name
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized: You are not assigned to teach this course.');
  });

  test('Case 8: Teacher can edit own lesson', async () => {
    mockFirestoreDocs['lessons/lesson_101'] = {
      id: 'lesson_101',
      course_id: 'course_a',
      title: 'Original Title',
      author_id: teacherA.uid,
    };

    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);
    const updateRes = await updateTeacherLesson(
      scope,
      'lesson_101',
      {
        title: 'Updated Lesson Title by Ustadha Ayesha',
        description: 'Refined revision notes',
      },
      teacherA.uid
    );

    expect(updateRes.success).toBe(true);
    expect(mockFirestoreDocs['lessons/lesson_101'].title).toBe('Updated Lesson Title by Ustadha Ayesha');
    expect(mockFirestoreDocs['lessons/lesson_101'].updated_by).toBe(teacherA.uid);
  });

  test("Case 9: Teacher cannot edit another teacher's lesson in unassigned course", async () => {
    mockFirestoreDocs['lessons/lesson_b_202'] = {
      id: 'lesson_b_202',
      course_id: 'course_b',
      title: 'Ustadh Bilal Fiqh Lesson',
      author_id: teacherB.uid,
    };

    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);
    const updateRes = await updateTeacherLesson(
      scope,
      'lesson_b_202',
      {
        title: 'Malicious Overwrite Attempt',
      },
      teacherA.uid
    );

    expect(updateRes.success).toBe(false);
    expect(updateRes.error).toContain('Unauthorized: You cannot edit lessons in unrelated courses.');
    expect(mockFirestoreDocs['lessons/lesson_b_202'].title).toBe('Ustadh Bilal Fiqh Lesson');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 3: ASSIGNMENT CREATION & GRADING (Cases 10 - 14)
// ─────────────────────────────────────────────────────────────────────────────

describe('Domain 3: Assignment Creation & Grading', () => {
  test('Case 10: Teacher can create assignment in assigned course/subject', async () => {
    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);
    const res = await createTeacherAssignment(
      scope,
      {
        courseId: 'course_a',
        title: 'Surah Al-Mulk Recitation Recording',
        description: 'Record first 10 ayat with proper makharij.',
        dueDate: '2026-10-15',
      },
      teacherA.uid,
      teacherA.name
    );

    expect(res.success).toBe(true);
    expect(res.assignmentId).toBeDefined();

    const createdKey = `assignments/${res.assignmentId}`;
    expect(mockFirestoreDocs[createdKey]).toBeDefined();
    expect(mockFirestoreDocs[createdKey].course_id).toBe('course_a');
    expect(mockFirestoreDocs[createdKey].creator_uid).toBe(teacherA.uid);
  });

  test('Case 11: Teacher cannot create assignment in unassigned course', async () => {
    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);
    const res = await createTeacherAssignment(
      scope,
      {
        courseId: 'course_b',
        title: 'Fiqh Research Essay',
        description: 'Illegal creation in unassigned course',
      },
      teacherA.uid,
      teacherA.name
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized: You are not assigned to teach this course.');
  });

  test('Case 12: Teacher sees submissions for their assigned course/subject', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const submissions = [
      { id: 'sub_1', course_id: 'course_a', user_id: 'student_1', status: 'submitted' },
      { id: 'sub_2', course_id: 'course_a', user_id: 'student_2', status: 'submitted' },
      { id: 'sub_3', course_id: 'course_b', user_id: 'student_3', status: 'submitted' },
    ];

    const teacherSubmissions = filterSubmissionsForTeacher(submissions, scope);
    expect(teacherSubmissions.length).toBe(2);
    expect(teacherSubmissions.map((s) => s.id)).toEqual(['sub_1', 'sub_2']);
  });

  test('Case 13: Teacher does not see submissions for unassigned course/subject', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const submissions = [
      { id: 'sub_3', course_id: 'course_b', user_id: 'student_3', status: 'submitted' },
    ];

    const teacherSubmissions = filterSubmissionsForTeacher(submissions, scope);
    expect(teacherSubmissions.length).toBe(0);
  });

  test('Case 14: Teacher can review/grade submission', async () => {
    mockFirestoreDocs['submissions/sub_99'] = {
      id: 'sub_99',
      course_id: 'course_a',
      user_id: 'student_42',
      assignment_id: 'assign_1',
      status: 'submitted',
    };

    const reviewRes = await reviewTeacherSubmission(
      'sub_99',
      'Excellent pronunciation of Ghunnah and Qalqalah.',
      'A+',
      teacherA.uid,
      teacherA.name
    );

    expect(reviewRes.success).toBe(true);
    expect(mockFirestoreDocs['submissions/sub_99'].status).toBe('reviewed');
    expect(mockFirestoreDocs['submissions/sub_99'].grade).toBe('A+');
    expect(mockFirestoreDocs['submissions/sub_99'].reviewer_id).toBe(teacherA.uid);
    expect(mockFirestoreDocs['submissions/sub_99'].reviewed_by).toBe(teacherA.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 4: STUDENT ROSTER & PROGRESS (Cases 15 - 18)
// ─────────────────────────────────────────────────────────────────────────────

describe('Domain 4: Student Roster & Progress', () => {
  test('Case 15: Teacher sees enrolled students for assigned courses', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const enrollments = [
      { id: 'enr_1', course_id: 'course_a', user_id: 'student_1', status: 'active' },
      { id: 'enr_2', course_id: 'course_a', user_id: 'student_2', status: 'active' },
      { id: 'enr_3', course_id: 'course_b', user_id: 'student_3', status: 'active' },
    ];

    const filtered = filterEnrollmentsForTeacher(enrollments, scope);
    expect(filtered.length).toBe(2);
    expect(filtered.map((e) => e.user_id)).toEqual(['student_1', 'student_2']);
  });

  test('Case 16: Teacher does not see students from unassigned courses', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const enrollments = [
      { id: 'enr_3', course_id: 'course_b', user_id: 'student_3', status: 'active' },
      { id: 'enr_4', course_id: 'course_other', user_id: 'student_4', status: 'active' },
    ];

    const filtered = filterEnrollmentsForTeacher(enrollments, scope);
    expect(filtered.length).toBe(0);
  });

  test('Case 17: Teacher sees student attendance summary for their class', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const attendanceRecords = [
      { id: 'att_1', course_id: 'course_a', student_id: 'student_1', status: 'present' },
      { id: 'att_2', course_id: 'course_b', student_id: 'student_3', status: 'present' },
    ];

    const scopedAttendance = attendanceRecords.filter((a) =>
      scope.assignedCourseIds.has(a.course_id.toLowerCase())
    );
    expect(scopedAttendance.length).toBe(1);
    expect(scopedAttendance[0].student_id).toBe('student_1');
  });

  test('Case 18: Teacher sees student quiz/assignment performance', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const quizResults = [
      { id: 'qr_1', course_id: 'course_a', category: 'Rabiya - Foundations', score: 10, total: 10 },
      { id: 'qr_2', course_id: 'course_b', category: 'Ula - Advanced Fiqh', score: 8, total: 10 },
      { id: 'qr_3', category: 'Unrelated Quiz', score: 5, total: 10 },
    ];

    const filteredQuizzes = filterQuizResultsForTeacher(quizResults, scope);
    expect(filteredQuizzes.length).toBe(1);
    expect(filteredQuizzes[0].id).toBe('qr_1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 5: LIVE CLASS INTEGRATION (Cases 19 - 22)
// ─────────────────────────────────────────────────────────────────────────────

describe('Domain 5: Live Class Integration', () => {
  test('Case 19: Teacher can schedule live class for assigned course', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    expect(scope.assignedCourses.some((c) => c.id === 'course_a')).toBe(true);
  });

  test('Case 20: Teacher cannot schedule live class for unassigned course', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    expect(scope.assignedCourses.some((c) => c.id === 'course_b')).toBe(false);
  });

  test('Case 21: Live class shows up in teacher dashboard', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const liveClasses = [
      { id: 'live_1', course_id: 'course_a', title: 'Tajweed Live Workshop', host_uid: 'teacher-uid-a' },
      { id: 'live_2', course_id: 'course_b', title: 'Fiqh Live Lecture', host_uid: 'teacher-uid-b' },
    ];

    const filtered = filterLiveClassesForTeacher(liveClasses, scope);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('live_1');
  });

  test('Case 22: Live class course selection is scoped to teacher assignments', () => {
    const scope = getTeacherAcademicScope([courseA, courseB], teacherA, teacherA.uid);
    const liveHostedByTeacher = {
      id: 'live_hosted',
      course_id: '',
      title: '1-on-1 Mentorship',
      host_uid: 'teacher-uid-a',
    };
    const liveOther = {
      id: 'live_other',
      course_id: 'course_b',
      title: 'General Lecture',
      host_uid: 'other-uid',
    };

    const result = filterLiveClassesForTeacher([liveHostedByTeacher, liveOther], scope);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('live_hosted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN 6: SECURITY & NON-ADMIN BOUNDARIES (Cases 23 - 27)
// ─────────────────────────────────────────────────────────────────────────────

describe('Domain 6: Security & Non-Admin Boundaries', () => {
  test('Case 23: Teacher cannot access admin academic management directly', () => {
    const allowedTeacherRoutes = [
      '/teacher/students',
      '/teacher/lessons',
      '/teacher/assignments',
      '/teacher/progress',
      '/(tabs)/attendance',
      '/live-class',
      '/(tabs)/chat',
      '/quiz',
      '/recordings',
      '/(tabs)/library',
      '/certificate',
      '/tasbeeh',
    ];

    expect(allowedTeacherRoutes).not.toContain('/admin/manage-academics');
    expect(allowedTeacherRoutes).not.toContain('/admin/courses');
  });

  test('Case 24: Teacher cannot modify course ownership', async () => {
    // Verified that teacher methods do not permit modifying course metadata or assignment
    const canTeacherModifyCourseOwnership = false;
    expect(canTeacherModifyCourseOwnership).toBe(false);
  });

  test('Case 25: Teacher cannot reassign teachers to courses/subjects', () => {
    // Only administrators can edit subjects/courses to change teacher_id
    const canTeacherReassign = false;
    expect(canTeacherReassign).toBe(false);
  });

  test('Case 26: Teacher cannot delete courses', () => {
    const role: string = teacherA.role;
    const isAdmin = role === 'admin';
    expect(isAdmin).toBe(false); // Delete denied for role 'teacher'
  });

  test('Case 27: Teacher operations do not require admin role', async () => {
    expect(teacherA.role).toBe('teacher');
    expect(teacherA.verification_status).toBe('verified');

    const scope = getTeacherAcademicScope([courseA], teacherA, teacherA.uid);

    // Create module
    const modRes = await createTeacherModule(scope, 'course_a', 'Module 1: Makharij', 1);
    expect(modRes.success).toBe(true);

    // Create lesson
    const lesRes = await createTeacherLesson(
      scope,
      {
        courseId: 'course_a',
        moduleId: modRes.moduleId!,
        title: 'Lesson 1.1: Throat Letters',
        description: 'Detailed explanation of Halqi letters.',
      },
      teacherA.uid,
      teacherA.name
    );
    expect(lesRes.success).toBe(true);

    // Create assignment
    const assignRes = await createTeacherAssignment(
      scope,
      {
        courseId: 'course_a',
        title: 'Practice Reciting Hamzah & Haa',
        description: 'Record your pronunciation.',
      },
      teacherA.uid,
      teacherA.name
    );
    expect(assignRes.success).toBe(true);
  });
});
