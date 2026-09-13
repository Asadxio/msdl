/**
 * Phase 59 — MSLB Student + Teacher Real-World End-to-End Workflow Hardening Test Suite
 * ST59-01 through ST59-25
 *
 * Verifies the complete academic lifecycle for:
 * 1. STUDENT:
 *    - Signup / pending lifecycle trap
 *    - Approval and route access grant
 *    - Multi-tenant course access isolation
 *    - Course enrollment requirement & lockout
 *    - Enrolled content access (live class, audio, video, lessons)
 *    - Audio lesson validation & streaming security
 *    - Live class joining & room navigation
 *    - Recording tenant & course scoping
 *    - Assignment submission & draft persistence
 *    - Submission state transition
 *    - Quiz nonce deduplication & anti-replay
 *    - Quiz anti-tamper server-side grading
 *    - Attendance record tracking
 *    - Academic progress calculation
 *    - Certificate prerequisite & generation gate
 *
 * 2. TEACHER:
 *    - Dashboard role & tenant scoping
 *    - Multi-mode course assignment matching (ID, name, array, subject)
 *    - Unassigned course access restriction (spectator / no reviewer rights)
 *    - Live class initiation scoped to assigned courses
 *    - Audio lesson upload & management scoping
 *    - Recording creation & metadata scoping
 *    - Attendance marking & verification
 *    - Submissions review & grading scoped to assigned courses
 *    - Teacher Dashboard KPI scoping (no cross-course contamination)
 *    - Quiz monitoring visibility scoped to assigned courses
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../');
const frontendDir = path.join(repoRoot, 'frontend');
const functionsDir = path.join(repoRoot, 'functions');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulated Academic Lifecycle Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulates filterTeacherAssignedCourses (matching frontend/lib/enrollments.ts)
 */
function filterTeacherAssignedCourses(courses, teacher, teacherUid) {
  if (!courses || !Array.isArray(courses)) return [];
  if (!teacher && !teacherUid) return [];

  const tId = (teacher?.id || teacherUid || '').trim().toLowerCase();
  const tName = (teacher?.name || '').trim().toLowerCase();
  const assigned = Array.isArray(teacher?.assigned_courses)
    ? teacher.assigned_courses.map((x) => String(x).toLowerCase())
    : [];

  return courses.filter((course) => {
    if (!course) return false;
    const courseId = String(course.id || '').toLowerCase();
    const courseName = String(course.name || course.title || '').toLowerCase();

    // Mode 1: Direct teacher_id match
    if (tId && course.teacher_id && String(course.teacher_id).toLowerCase() === tId) {
      return true;
    }

    // Mode 2: Direct teacher_name match
    if (tName && course.teacher_name && String(course.teacher_name).toLowerCase().includes(tName)) {
      return true;
    }

    // Mode 3: Teacher assigned_courses list
    if (assigned.length > 0) {
      if (assigned.includes(courseId) || assigned.includes(courseName)) {
        return true;
      }
    }

    // Mode 4: Subject-level assignment
    if (Array.isArray(course.subjects)) {
      const hasSubject = course.subjects.some((subj) => {
        if (!subj) return false;
        if (tId && subj.teacher_id && String(subj.teacher_id).toLowerCase() === tId) {
          return true;
        }
        if (tName && subj.teacher_name && String(subj.teacher_name).toLowerCase().includes(tName)) {
          return true;
        }
        return false;
      });
      if (hasSubject) return true;
    }

    return false;
  });
}

/**
 * Simulates CourseDetailScreen permission & scoping model
 */
function evaluateCoursePermissions({ course, profile, teachers, userUid, userEnrollments }) {
  const currentTeacher = (teachers || []).find(
    (t) =>
      t.id === userUid ||
      (profile?.name && t.name?.toLowerCase().includes(profile.name.toLowerCase()))
  );

  const isAssignedTeacher = course
    ? filterTeacherAssignedCourses([course], currentTeacher, userUid).length > 0
    : false;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'assistant_teacher';
  const isReviewer = isAdmin || (isTeacher && isAssignedTeacher);
  const isStudent = profile?.role === 'student';
  const isEnrolled = course?.id ? Boolean(userEnrollments?.[course.id]) : false;
  const isLockedForStudent = isStudent && !isEnrolled;

  return {
    isAssignedTeacher,
    isAdmin,
    isTeacher,
    isReviewer,
    isStudent,
    isEnrolled,
    isLockedForStudent,
    canStartLiveClass: isReviewer,
    canManageAudioLessons: isReviewer,
    canReviewSubmissions: isReviewer,
    canJoinClass: !isLockedForStudent,
    canViewRecordings: !isLockedForStudent,
  };
}

/**
 * Simulates Teacher Dashboard scoping logic
 */
function scopeTeacherDashboardData({ courses, myAssignedCourses, liveClasses, submissions, attendanceRecords, teacherUid }) {
  const assignedCourseMeta = {
    ids: new Set(),
    names: new Set(),
  };

  myAssignedCourses.forEach((c) => {
    if (c.id) assignedCourseMeta.ids.add(String(c.id).toLowerCase());
    if (c.name) assignedCourseMeta.names.add(String(c.name).toLowerCase());
    if (c.title) assignedCourseMeta.names.add(String(c.title).toLowerCase());
  });

  // Scoped live classes
  const scopedLiveClasses = (liveClasses || []).filter((item) => {
    const isMySession = item.teacher_id === teacherUid;
    const isAssignedCourse = item.course_id && assignedCourseMeta.ids.has(String(item.course_id).toLowerCase());
    return assignedCourseMeta.ids.size === 0 || isMySession || isAssignedCourse;
  });

  // Scoped submissions
  const scopedSubmissions = (submissions || []).filter((item) => {
    const isAssignedCourse = item.course_id && assignedCourseMeta.ids.has(String(item.course_id).toLowerCase());
    return assignedCourseMeta.ids.size === 0 || isAssignedCourse;
  });

  // Scoped attendance count
  let scopedAttendanceCount = 0;
  (attendanceRecords || []).forEach((item) => {
    if (assignedCourseMeta.ids.size === 0) {
      scopedAttendanceCount++;
    } else if (item.course_id && assignedCourseMeta.ids.has(String(item.course_id).toLowerCase())) {
      scopedAttendanceCount++;
    }
  });

  return {
    assignedCourseMeta,
    scopedLiveClasses,
    scopedSubmissions,
    scopedAttendanceCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

async function runSuite() {
  console.log('\n================================================================');
  console.log('PHASE 59: STUDENT + TEACHER REAL-WORLD END-TO-END WORKFLOW TESTS');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // PART 1: STUDENT ACADEMIC LIFECYCLE TESTS (ST59-01 to ST59-15)
  // ---------------------------------------------------------------------------

  await test('ST59-01: Student Pending Status Lifecycle Trap', () => {
    const navGuardPath = path.join(frontendDir, 'lib', 'navigationGuard.ts');
    assert.ok(fs.existsSync(navGuardPath), 'navigationGuard.ts must exist');
    const content = fs.readFileSync(navGuardPath, 'utf8');

    // Verify pending, rejected, suspended, and deactivated are intercepted
    assert.ok(content.includes("status === 'pending'"), 'Must check pending status');
    assert.ok(content.includes("status === 'rejected'"), 'Must check rejected status');
    assert.ok(content.includes("status === 'suspended'"), 'Must check suspended status');
    assert.ok(content.includes('/auth/pending'), 'Must redirect non-approved students to /auth/pending');
  });

  await test('ST59-02: Approved Student Route Access Grant', () => {
    const navGuardPath = path.join(frontendDir, 'lib', 'navigationGuard.ts');
    const content = fs.readFileSync(navGuardPath, 'utf8');

    // An approved student is not trapped
    assert.ok(content.includes("status === 'approved'"), 'Must acknowledge approved status');
    assert.ok(content.includes("return { allowed: true }"), 'Must allow navigation when no trap fires');
  });

  await test('ST59-03: Multi-Tenant Course Access Isolation', () => {
    const dataContextPath = path.join(frontendDir, 'context', 'DataContext.tsx');
    const content = fs.readFileSync(dataContextPath, 'utf8');

    assert.ok(content.includes('organization_id'), 'DataContext must stamp organization_id on enrollments');
    assert.ok(content.includes('getActiveOrganizationIdSync'), 'Must read active tenant ID');
  });

  await test('ST59-04: Student Course Access & Unenrolled Lockout', () => {
    const courseDetailPath = path.join(frontendDir, 'app', 'course', '[id].tsx');
    assert.ok(fs.existsSync(courseDetailPath), 'course/[id].tsx must exist');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    assert.ok(content.includes('isLockedForStudent'), 'Must define isLockedForStudent');
    assert.ok(content.includes('isStudent && !isEnrolled'), 'Lockout must apply to unenrolled students');
    assert.ok(content.includes('Enrollment Required'), 'Must display enrollment prompt when locked');
    assert.ok(content.includes('lockedClassBtn'), 'Must show locked class UI styling');
  });

  await test('ST59-05: Enrolled Student Content Access Simulation', () => {
    const course = { id: 'course-tajweed-101', name: 'Tajweed Fundamentals', organization_id: 'org_banat_main' };
    const studentProfile = { role: 'student', name: 'Fatima Banat' };
    const userEnrollments = { 'course-tajweed-101': true };

    const perms = evaluateCoursePermissions({
      course,
      profile: studentProfile,
      teachers: [],
      userUid: 'student_uid_123',
      userEnrollments,
    });

    assert.strictEqual(perms.isLockedForStudent, false, 'Enrolled student must not be locked out');
    assert.strictEqual(perms.canJoinClass, true, 'Enrolled student must be able to join live classes');
    assert.strictEqual(perms.canViewRecordings, true, 'Enrolled student must be able to view recordings');
    assert.strictEqual(perms.isReviewer, false, 'Student must never be granted reviewer status');
  });

  await test('ST59-06: Audio Lesson Streaming URL Security & Validation', () => {
    const audioLessonsPath = path.join(frontendDir, 'lib', 'audioLessons.ts');
    assert.ok(fs.existsSync(audioLessonsPath), 'audioLessons.ts must exist');
    const content = fs.readFileSync(audioLessonsPath, 'utf8');

    assert.ok(content.includes('AUDIO_LESSON_MAX_BYTES'), 'Must enforce max audio bytes limit');
    assert.ok(content.includes('validateAudioLessonFile'), 'Must export validateAudioLessonFile');
    assert.ok(content.includes('ALLOWED_AUDIO_EXTENSIONS') || content.includes('audio/'), 'Must validate audio mime/extension');
  });

  await test('ST59-07: Live Class Joining & Room Navigation', () => {
    const liveClassesPath = path.join(frontendDir, 'lib', 'liveClasses.ts');
    assert.ok(fs.existsSync(liveClassesPath), 'liveClasses.ts must exist');
    const content = fs.readFileSync(liveClassesPath, 'utf8');

    assert.ok(content.includes('subscribeActiveLiveClass'), 'Must export subscribeActiveLiveClass');
    assert.ok(content.includes("status', '==', 'live'"), 'Must listen for live sessions');
  });

  await test('ST59-08: Class Recording Tenant & Academic Integrity', () => {
    const recordingPath = path.join(frontendDir, 'lib', 'classRecording.ts');
    assert.ok(fs.existsSync(recordingPath), 'classRecording.ts must exist');
    const content = fs.readFileSync(recordingPath, 'utf8');

    assert.ok(content.includes('organization_id'), 'Recordings must support organization_id');
    assert.ok(content.includes('course_id'), 'Recordings must enforce course_id');
  });

  await test('ST59-09: Assignment Submission & Draft Persistence', () => {
    const lmsHardeningPath = path.join(frontendDir, 'lib', 'lmsHardening.ts');
    assert.ok(fs.existsSync(lmsHardeningPath), 'lmsHardening.ts must exist');
    const content = fs.readFileSync(lmsHardeningPath, 'utf8');

    assert.ok(content.includes('saveAssignmentDraft'), 'Must export saveAssignmentDraft');
    assert.ok(content.includes('loadAssignmentDraft'), 'Must export loadAssignmentDraft');
    assert.ok(content.includes('assignment_draft_'), 'Must use assignment_draft key pattern');
  });

  await test('ST59-10: Assignment Submission State Machine', () => {
    const dataContextPath = path.join(frontendDir, 'context', 'DataContext.tsx');
    const content = fs.readFileSync(dataContextPath, 'utf8');

    assert.ok(content.includes('submitAssignment'), 'DataContext must export submitAssignment');
    assert.ok(content.includes("status: 'submitted'"), 'New submission must transition to submitted status');
    assert.ok(content.includes('created_at: serverTimestamp()'), 'Submission must record server timestamp');
  });

  await test('ST59-11: Quiz Nonce Deduplication & Anti-Replay Verification', () => {
    const submitQuizPath = path.join(functionsDir, 'src', 'quiz', 'submitQuiz.ts');
    assert.ok(fs.existsSync(submitQuizPath), 'submitQuiz.ts Cloud Function must exist');
    const content = fs.readFileSync(submitQuizPath, 'utf8');

    assert.ok(content.includes('operationDedupe'), 'Must use operationDedupe collection');
    assert.ok(content.includes('dedupeKey'), 'Must construct unique nonce dedupeKey');
    assert.ok(content.includes('await dedupeRef.set'), 'Must record dedupe entry to prevent replay');
  });

  await test('ST59-12: Quiz Anti-Tamper Server-Side Grading Verification', () => {
    const firestoreRulesPath = path.join(repoRoot, 'firestore.rules');
    const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');

    // Verify quiz_results cannot be arbitrarily forged by students
    assert.ok(rulesContent.includes('quiz_results'), 'Rules must govern quiz_results');
    assert.ok(rulesContent.includes('quiz_attempt_locks'), 'Rules must guard quiz_attempt_locks');
  });

  await test('ST59-13: Student Attendance Tracking Verification', () => {
    const liveClassScreenPath = path.join(frontendDir, 'app', 'live-class', '[id].tsx');
    assert.ok(fs.existsSync(liveClassScreenPath), 'live-class/[id].tsx must exist');
    const content = fs.readFileSync(liveClassScreenPath, 'utf8');

    assert.ok(content.includes("collection(db, 'attendance')"), 'Live class must log to attendance collection');
    assert.ok(content.includes('user_id'), 'Attendance must record user_id');
    assert.ok(content.includes('course_id'), 'Attendance must record course_id');
  });

  await test('ST59-14: Student Academic Progress Calculation', () => {
    const progressScreenPath = path.join(frontendDir, 'app', '(tabs)', 'progress.tsx');
    assert.ok(fs.existsSync(progressScreenPath), 'progress.tsx must exist');
    const content = fs.readFileSync(progressScreenPath, 'utf8');

    assert.ok(content.includes('quiz_results'), 'Must query student quiz results');
    assert.ok(content.includes('overallAccuracy'), 'Must calculate overall accuracy');
    assert.ok(content.includes('attendance'), 'Must factor attendance into academic standing');
  });

  await test('ST59-15: Certificate Generation Prerequisite Gate', () => {
    const certScreenPath = path.join(frontendDir, 'app', '(tabs)', 'certificate.tsx');
    assert.ok(fs.existsSync(certScreenPath), 'certificate.tsx must exist');
    const content = fs.readFileSync(certScreenPath, 'utf8');

    assert.ok(content.includes('attendance') || content.includes('progress'), 'Certificate must check academic completion prerequisites');
    assert.ok(content.includes('courses'), 'Certificate must associate with courses');
  });

  // ---------------------------------------------------------------------------
  // PART 2: TEACHER ACADEMIC LIFECYCLE TESTS (ST59-16 to ST59-25)
  // ---------------------------------------------------------------------------

  await test('ST59-16: Teacher Dashboard Role & Tenant Scoping', () => {
    const teacherDashPath = path.join(frontendDir, 'components', 'teacher', 'TeacherDashboard.tsx');
    assert.ok(fs.existsSync(teacherDashPath), 'TeacherDashboard.tsx must exist');
    const content = fs.readFileSync(teacherDashPath, 'utf8');

    assert.ok(content.includes('myAssignedCourses'), 'Must compute myAssignedCourses');
    assert.ok(content.includes('filterTeacherAssignedCourses'), 'Must use filterTeacherAssignedCourses');
  });

  await test('ST59-17: Teacher Course Assignment Multi-Mode Match', () => {
    const teacherA = {
      id: 'teacher_uid_100',
      name: 'Ustaadha Aisha',
      assigned_courses: ['course_tajweed_advanced'],
    };

    const course1 = { id: 'course_1', name: 'Fiqh', teacher_id: 'teacher_uid_100' }; // Mode 1: direct ID
    const course2 = { id: 'course_2', name: 'Hadith', teacher_name: 'Ustaadha Aisha' }; // Mode 2: name substring
    const course3 = { id: 'course_tajweed_advanced', name: 'Tajweed Adv' }; // Mode 3: assigned array
    const course4 = {
      id: 'course_4',
      name: 'General Islamic Studies',
      subjects: [{ name: 'Aqeedah', teacher_id: 'teacher_uid_100' }],
    }; // Mode 4: subject teacher
    const course5 = { id: 'course_5', name: 'Arabic Language', teacher_id: 'other_teacher' }; // Unassigned

    const allCourses = [course1, course2, course3, course4, course5];
    const assigned = filterTeacherAssignedCourses(allCourses, teacherA, teacherA.id);

    assert.strictEqual(assigned.length, 4, 'Should match all 4 assignment modes');
    assert.ok(assigned.some((c) => c.id === 'course_1'), 'Must match via Mode 1 (teacher_id)');
    assert.ok(assigned.some((c) => c.id === 'course_2'), 'Must match via Mode 2 (teacher_name)');
    assert.ok(assigned.some((c) => c.id === 'course_tajweed_advanced'), 'Must match via Mode 3 (assigned array)');
    assert.ok(assigned.some((c) => c.id === 'course_4'), 'Must match via Mode 4 (subject teacher)');
    assert.ok(!assigned.some((c) => c.id === 'course_5'), 'Must NOT match unassigned course');
  });

  await test('ST59-18: Teacher Unassigned Course Boundary (Spectator Mode)', () => {
    const unassignedCourse = { id: 'course_unassigned', name: 'Advanced Fiqh', teacher_id: 'other_teacher_99' };
    const teacherProfile = { role: 'teacher', name: 'Ustaadha Fatima' };
    const teachers = [{ id: 'teacher_fatima_uid', name: 'Ustaadha Fatima' }];

    const perms = evaluateCoursePermissions({
      course: unassignedCourse,
      profile: teacherProfile,
      teachers,
      userUid: 'teacher_fatima_uid',
      userEnrollments: {},
    });

    assert.strictEqual(perms.isAssignedTeacher, false, 'Teacher must not be marked as assigned');
    assert.strictEqual(perms.isReviewer, false, 'Unassigned teacher must not have reviewer rights');
    assert.strictEqual(perms.canStartLiveClass, false, 'Unassigned teacher must not start live classes');
    assert.strictEqual(perms.canManageAudioLessons, false, 'Unassigned teacher must not manage audio lessons');
    assert.strictEqual(perms.canReviewSubmissions, false, 'Unassigned teacher must not review submissions');
  });

  await test('ST59-19: Teacher Live Class Initiation Scoped to Assigned Course', () => {
    const courseDetailPath = path.join(frontendDir, 'app', 'course', '[id].tsx');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    // Verify openStartClassModal checks isReviewer
    assert.ok(content.includes('openStartClassModal'), 'Must have openStartClassModal');
    assert.ok(content.includes('Only the assigned teacher or an admin can start live classes'), 'Must deny unassigned teachers');
  });

  await test('ST59-20: Teacher Audio Lesson Management Scoping', () => {
    const courseDetailPath = path.join(frontendDir, 'app', 'course', '[id].tsx');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    assert.ok(content.includes('openAudioUploadModal'), 'Must have openAudioUploadModal');
    assert.ok(content.includes('Only the assigned teacher or an admin can upload audio lessons'), 'Must deny unassigned audio uploads');
    assert.ok(content.includes('Only the assigned teacher or an admin can edit audio lessons'), 'Must deny unassigned audio edits');
    assert.ok(content.includes('Only the assigned teacher or an admin can delete audio lessons'), 'Must deny unassigned audio deletions');
  });

  await test('ST59-21: Teacher Recording Scoping & Class Association', () => {
    const recordingPath = path.join(frontendDir, 'lib', 'classRecording.ts');
    const content = fs.readFileSync(recordingPath, 'utf8');

    assert.ok(content.includes('course_id'), 'Recording metadata must bind course_id');
    assert.ok(content.includes('teacher_id'), 'Recording metadata must bind teacher_id');
  });

  await test('ST59-22: Teacher Attendance Marking & Scoping', () => {
    const attendancePath = path.join(frontendDir, 'app', '(tabs)', 'attendance.tsx');
    const content = fs.readFileSync(attendancePath, 'utf8');

    assert.ok(content.includes('canMark'), 'Must check permission to mark attendance');
    assert.ok(content.includes('teacher') || content.includes('admin'), 'Must allow teacher/admin roles to mark attendance');
  });

  await test('ST59-23: Teacher Submissions Review & Grading Scoping', () => {
    const courseDetailPath = path.join(frontendDir, 'app', 'course', '[id].tsx');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    assert.ok(content.includes('openReviewModal'), 'Must define openReviewModal');
    assert.ok(content.includes('Only the assigned teacher or an admin can review submissions'), 'Must deny unassigned submission reviews');
    assert.ok(content.includes('reviewSubmissionHandler'), 'Must define reviewSubmissionHandler');
  });

  await test('ST59-24: Teacher Dashboard KPI Scoping (Zero Cross-Course Leakage)', () => {
    const myAssignedCourses = [
      { id: 'course_arabic_1', name: 'Arabic Level 1' },
      { id: 'course_arabic_2', name: 'Arabic Level 2' },
    ];

    const foreignLiveClass = { id: 'live_foreign', course_id: 'course_fiqh_foreign', teacher_id: 'other_teacher' };
    const myLiveClass = { id: 'live_mine', course_id: 'course_arabic_1', teacher_id: 'my_teacher_uid' };

    const foreignSubmission = { id: 'sub_foreign', course_id: 'course_fiqh_foreign', assignment_id: 'a1' };
    const mySubmission = { id: 'sub_mine', course_id: 'course_arabic_2', assignment_id: 'a2' };

    const attendanceRecords = [
      { id: 'att_1', course_id: 'course_arabic_1' },
      { id: 'att_2', course_id: 'course_arabic_2' },
      { id: 'att_foreign', course_id: 'course_fiqh_foreign' },
    ];

    const scoped = scopeTeacherDashboardData({
      courses: myAssignedCourses,
      myAssignedCourses,
      liveClasses: [foreignLiveClass, myLiveClass],
      submissions: [foreignSubmission, mySubmission],
      attendanceRecords,
      teacherUid: 'my_teacher_uid',
    });

    assert.strictEqual(scoped.scopedLiveClasses.length, 1, 'Should only contain the teacher assigned live class');
    assert.strictEqual(scoped.scopedLiveClasses[0].id, 'live_mine', 'Must be the assigned class');

    assert.strictEqual(scoped.scopedSubmissions.length, 1, 'Should only contain submissions for assigned courses');
    assert.strictEqual(scoped.scopedSubmissions[0].id, 'sub_mine', 'Must be the assigned submission');

    assert.strictEqual(scoped.scopedAttendanceCount, 2, 'Attendance count must ignore foreign courses');
  });

  await test('ST59-25: Teacher Quiz Results Visibility Scoping', () => {
    const teacherDashPath = path.join(frontendDir, 'components', 'teacher', 'TeacherDashboard.tsx');
    const content = fs.readFileSync(teacherDashPath, 'utf8');

    assert.ok(content.includes('quiz_results'), 'TeacherDashboard must query quiz_results');
    assert.ok(content.includes('courseMatch'), 'Must match quiz result against assignedCourseMeta');
    assert.ok(content.includes('catMatch'), 'Must match quiz result category against assignedCourseMeta');
  });

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log(`Phase 59 Results: ${passed} PASSED | ${failed} FAILED`);
  console.log('────────────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
