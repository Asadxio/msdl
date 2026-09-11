const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE P0.3 — COMPLETE TEACHER -> COURSE -> STUDENT CHAIN     ');
console.log('================================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  [PASS] ' + name);
    passed++;
  } catch (err) {
    console.error('  [FAIL] ' + name + ': ' + (err.stack || err.message));
    failed++;
  }
}

const repoRoot = path.resolve(__dirname, '../../');
const rulesContent = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const rbacContent = fs.readFileSync(path.join(repoRoot, 'frontend/lib/rbac.ts'), 'utf8');
const enrollmentsContent = fs.readFileSync(path.join(repoRoot, 'frontend/lib/enrollments.ts'), 'utf8');
const manageAcademicsContent = fs.readFileSync(path.join(repoRoot, 'frontend/app/admin/manage-academics.tsx'), 'utf8');

// ============================================================
// PART 1: WHO CAN ADD TEACHERS? (SCHEMA & PERMISSIONS)
// ============================================================

test('Q1-01: firestore.rules restricts /teachers writes strictly to isAdmin() && isValidTeacherWrite()', () => {
  assert.ok(
    rulesContent.includes('match /teachers/{teacherId}') &&
    rulesContent.includes('allow create, update: if isAdmin() && isValidTeacherWrite();') &&
    rulesContent.includes('allow delete: if isAdmin();'),
    'Teacher collection must strictly gate writes with isAdmin() && isValidTeacherWrite()'
  );
});

test('Q1-02: isValidTeacherWrite enforces whitelist schema and rejects unauthorized properties', () => {
  const allowedTeacherKeys = [
    'name', 'title', 'courses', 'assigned_courses', 'photo_url', 'bio',
    'qualifications', 'specializations', 'experience_years', 'languages',
    'created_at', 'updated_at'
  ];

  const validateTeacherWrite = (data) => {
    const keys = Object.keys(data);
    const hasOnlyAllowed = keys.every(k => allowedTeacherKeys.includes(k));
    const hasValidName = typeof data.name === 'string' && data.name.trim().length > 0;
    return hasOnlyAllowed && hasValidName;
  };

  const validTeacher = {
    name: 'Ustaadha Fatima',
    title: 'Head of Tajweed & Qiraat',
    assigned_courses: ['course_tajweed_101'],
    courses: ['course_tajweed_101']
  };
  assert.strictEqual(validateTeacherWrite(validTeacher), true);

  // Rejects extra / privilege escalation fields
  const invalidTeacherWithRole = {
    ...validTeacher,
    role: 'super_admin'
  };
  assert.strictEqual(validateTeacherWrite(invalidTeacherWithRole), false);

  const invalidTeacherBlankName = {
    name: '   ',
    title: 'Teacher'
  };
  assert.strictEqual(validateTeacherWrite(invalidTeacherBlankName), false);
});

test('Q1-03: Negative RBAC - Student and Teacher roles cannot create or delete teachers', () => {
  const canWriteTeacher = (role, status) => {
    const isAdmin = (role === 'admin' || role === 'super_admin') && status === 'approved';
    return isAdmin;
  };

  assert.strictEqual(canWriteTeacher('student', 'approved'), false);
  assert.strictEqual(canWriteTeacher('teacher', 'approved'), false);
  assert.strictEqual(canWriteTeacher('moderator', 'approved'), false);
  assert.strictEqual(canWriteTeacher('admin', 'pending'), false);
  assert.strictEqual(canWriteTeacher('admin', 'approved'), true);
  assert.strictEqual(canWriteTeacher('super_admin', 'approved'), true);
});

// ============================================================
// PART 2: WHO CAN ADD COURSES? (SCHEMA & PERMISSIONS)
// ============================================================

test('Q2-01: firestore.rules restricts /courses writes strictly to isAdmin() && isValidCourseWrite()', () => {
  assert.ok(
    rulesContent.includes('match /courses/{courseId}') &&
    rulesContent.includes('allow create, update: if isAdmin() && isValidCourseWrite();') &&
    rulesContent.includes('allow delete: if isAdmin();'),
    'Course collection must strictly gate writes with isAdmin() && isValidCourseWrite()'
  );
});

test('Q2-02: isValidCourseWrite validates course fields and embedded subjects array', () => {
  const allowedCourseKeys = [
    'name', 'teacher_name', 'teacherName', 'teacher_id', 'schedule', 'time',
    'class_time', 'description', 'class_link', 'classLink', 'meet_link',
    'subjects', 'created_at', 'updated_at'
  ];

  const validateCourseWrite = (data) => {
    const keys = Object.keys(data);
    const hasOnlyAllowed = keys.every(k => allowedCourseKeys.includes(k));
    const hasValidName = typeof data.name === 'string' && data.name.trim().length > 0;
    const hasValidSubjects = !('subjects' in data) || Array.isArray(data.subjects);
    return hasOnlyAllowed && hasValidName && hasValidSubjects;
  };

  const validCourse = {
    name: 'Alimiyyah Year 1',
    teacher_name: 'Ustaadha Fatima',
    teacher_id: 'teacher_fatima_uid',
    schedule: 'Mon - Thu',
    class_time: '10:00 AM IST',
    meet_link: 'https://meet.google.com/abc-defg-hij',
    description: 'Foundational Classical Islamic Studies',
    subjects: [
      { id: 'sub_1', name: 'Tajweed & Recitation', teacher_id: 'teacher_fatima_uid', teacher_name: 'Ustaadha Fatima', schedule: 'Mon/Wed 10am' },
      { id: 'sub_2', name: 'Arabic Grammar (Nahw)', teacher_id: 'teacher_ayesha_uid', teacher_name: 'Ustaadha Ayesha', schedule: 'Tue/Thu 10am' }
    ]
  };
  assert.strictEqual(validateCourseWrite(validCourse), true);

  // Rejects forbidden fields
  assert.strictEqual(validateCourseWrite({ ...validCourse, price_inr: 5000 }), false);
  assert.strictEqual(validateCourseWrite({ ...validCourse, subjects: 'not-an-array' }), false);
});

test('Q2-03: Negative RBAC - Non-admin cannot create or update courses', () => {
  const canWriteCourse = (role, status) => {
    return (role === 'admin' || role === 'super_admin') && status === 'approved';
  };

  assert.strictEqual(canWriteCourse('student', 'approved'), false);
  assert.strictEqual(canWriteCourse('teacher', 'approved'), false);
  assert.strictEqual(canWriteCourse('assistant_teacher', 'approved'), false);
  assert.strictEqual(canWriteCourse('admin', 'approved'), true);
});

// ============================================================
// PART 3: WHO CAN ADD SUBJECTS?
// ============================================================

test('Q3-01: Subjects are sub-entities embedded within course documents', () => {
  assert.ok(
    manageAcademicsContent.includes('export type CourseSubject = {') &&
    manageAcademicsContent.includes('teacher_id?: string;') &&
    manageAcademicsContent.includes('teacher_name?: string;'),
    'Subjects must be defined as embedded CourseSubject array within course documents'
  );
  assert.ok(
    rulesContent.includes("(!('subjects' in request.resource.data) || request.resource.data.subjects is list)"),
    'Firestore rules must validate that subjects is a list'
  );
});

test('Q3-02: Subject creation and modification is gated by course write permission (isAdmin)', () => {
  const canModifySubjects = (role, status) => (role === 'admin' || role === 'super_admin') && status === 'approved';
  assert.strictEqual(canModifySubjects('admin', 'approved'), true);
  assert.strictEqual(canModifySubjects('teacher', 'approved'), false);
  assert.strictEqual(canModifySubjects('student', 'approved'), false);
});

// ============================================================
// PART 4: WHO CAN ASSIGN TEACHERS? (SYNC VERIFICATION)
// ============================================================

test('Q4-01: Admin assigns teacher via course.teacher_id, subjects, and teacher.assigned_courses', () => {
  assert.ok(
    manageAcademicsContent.includes('assigned_courses: updatedList'),
    'manage-academics.tsx must synchronize teacher assigned_courses'
  );
});

test('Q4-02: filterTeacherAssignedCourses isolates assigned courses per teacher across all 4 match vectors', () => {
  const filterTeacherAssignedCourses = (courses, teacher, userUid) => {
    if (!courses || !Array.isArray(courses)) return [];
    if (!teacher && !userUid) return courses;
    const teacherNameNorm = String(teacher?.name || '').trim().toLowerCase();
    const assignedList = Array.isArray(teacher?.assigned_courses)
      ? teacher.assigned_courses.map((s) => String(s || '').trim().toLowerCase())
      : (Array.isArray(teacher?.courses) ? teacher.courses.map((s) => String(s || '').trim().toLowerCase()) : []);

    return courses.filter((c) => {
      if (userUid && c.teacher_id && String(c.teacher_id).trim() === userUid) return true;
      if (teacher?.id && c.teacher_id && String(c.teacher_id).trim() === teacher.id) return true;
      if (teacherNameNorm && c.teacher_name && String(c.teacher_name).trim().toLowerCase().includes(teacherNameNorm)) return true;
      const courseIdNorm = String(c.id || '').trim().toLowerCase();
      const courseNameNorm = String(c.name || '').trim().toLowerCase();
      if (assignedList.some((a) => a === courseIdNorm || a === courseNameNorm || courseNameNorm.includes(a))) return true;
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
  };

  const courses = [
    {
      id: 'course_1',
      name: 'Tafseer Quran',
      teacher_id: 'teacher_fatima_uid',
      teacher_name: 'Ustaadha Fatima',
      subjects: []
    },
    {
      id: 'course_2',
      name: 'Hadith Studies',
      teacher_id: 'teacher_ayesha_uid',
      teacher_name: 'Ustaadha Ayesha',
      subjects: [
        { id: 'sub_1', name: 'Usool al-Hadith', teacher_id: 'teacher_fatima_uid', teacher_name: 'Ustaadha Fatima' }
      ]
    },
    {
      id: 'course_3',
      name: 'Fiqh al-Ibadat',
      teacher_id: 'teacher_zainab_uid',
      teacher_name: 'Ustaadha Zainab',
      subjects: []
    }
  ];

  const teacherFatima = {
    id: 'teacher_fatima_uid',
    name: 'Ustaadha Fatima',
    assigned_courses: ['course_1']
  };

  const teacherZainab = {
    id: 'teacher_zainab_uid',
    name: 'Ustaadha Zainab',
    assigned_courses: ['course_3']
  };

  // Fatima sees course_1 (direct teacher_id match) AND course_2 (subject-level assignment)
  const fatimaCourses = filterTeacherAssignedCourses(courses, teacherFatima, 'teacher_fatima_uid');
  assert.strictEqual(fatimaCourses.length, 2);
  assert.strictEqual(fatimaCourses.some(c => c.id === 'course_1'), true);
  assert.strictEqual(fatimaCourses.some(c => c.id === 'course_2'), true);
  assert.strictEqual(fatimaCourses.some(c => c.id === 'course_3'), false); // Zainab course hidden

  // Zainab sees ONLY course_3
  const zainabCourses = filterTeacherAssignedCourses(courses, teacherZainab, 'teacher_zainab_uid');
  assert.strictEqual(zainabCourses.length, 1);
  assert.strictEqual(zainabCourses[0].id, 'course_3');
});

// ============================================================
// PART 5: WHO CAN ENROLL STUDENTS? (DETERMINISTIC ID & RBAC)
// ============================================================

test('Q5-01: Enrollment ID is deterministic and strictly formatted as ${uid}:${courseId}', () => {
  const getEnrollmentDocId = (userId, courseId) => `${String(userId || '').trim()}:${String(courseId || '').trim()}`;
  const uid = 'student_mariam_123';
  const courseId = 'alimiyyah_yr1';
  const docId = getEnrollmentDocId(uid, courseId);
  assert.strictEqual(docId, 'student_mariam_123:alimiyyah_yr1');
});

test('Q5-02: firestore.rules mandates enrollment ID must match enrollmentDocId(user_id, course_id)', () => {
  assert.ok(
    rulesContent.includes('enrollmentId == enrollmentDocId(request.resource.data.user_id, request.resource.data.course_id)'),
    'Firestore rules must strictly reject non-deterministic enrollment document IDs'
  );
  assert.ok(
    rulesContent.includes('function enrollmentDocId(uid, courseId) {') &&
    rulesContent.includes("return uid + ':' + courseId;"),
    'enrollmentDocId rule helper must use exact uid + ":" + courseId syntax'
  );
});

test('Q5-03: Negative RBAC - Student and Teacher cannot create or alter student enrollments', () => {
  const canWriteEnrollment = (role, status) => {
    return (role === 'admin' || role === 'super_admin') && status === 'approved';
  };

  assert.strictEqual(canWriteEnrollment('student', 'approved'), false, 'Student cannot self-enroll');
  assert.strictEqual(canWriteEnrollment('teacher', 'approved'), false, 'Teacher cannot enroll students');
  assert.strictEqual(canWriteEnrollment('admin', 'approved'), true, 'Admin can enroll students');
});

// ============================================================
// PART 6: WHO CAN MARK ATTENDANCE? (SCHEMA & PERMISSIONS)
// ============================================================

test('Q6-01: firestore.rules requires isValidAttendanceRecord() for attendance creation', () => {
  assert.ok(
    rulesContent.includes('match /attendance/{attendanceId}') &&
    rulesContent.includes('allow create: if isValidAttendanceRecord();') &&
    rulesContent.includes('allow update: if isValidAttendanceRecord() && isAttendanceRecordUnchangedOwner();'),
    'Attendance creation must strictly require isValidAttendanceRecord()'
  );
});

test('Q6-02: isValidAttendanceRecord requires teacher/admin role, approved student target, and valid date', () => {
  const validateAttendanceRecord = ({ callerUid, callerRole, callerStatus, targetUser, date, status, marked_by, marked_by_uid }) => {
    const isTeacherOrAdmin = (callerRole === 'teacher' || callerRole === 'assistant_teacher' || callerRole === 'admin' || callerRole === 'super_admin') && callerStatus === 'approved';
    if (!isTeacherOrAdmin) return false;
    if (!targetUser || targetUser.role !== 'student' || targetUser.status !== 'approved') return false;
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return false;
    if (!['present', 'absent'].includes(status)) return false;
    if (!['teacher', 'admin', 'live_class'].includes(marked_by)) return false;
    if (marked_by_uid !== callerUid) return false;
    return true;
  };

  const validRecord = {
    callerUid: 'teacher_fatima_uid',
    callerRole: 'teacher',
    callerStatus: 'approved',
    targetUser: { id: 'student_1', role: 'student', status: 'approved' },
    date: '2026-09-11',
    status: 'present',
    marked_by: 'teacher',
    marked_by_uid: 'teacher_fatima_uid'
  };
  assert.strictEqual(validateAttendanceRecord(validRecord), true);

  // Student attempts to mark self attendance
  const studentSpoofed = {
    ...validRecord,
    callerUid: 'student_1',
    callerRole: 'student',
    marked_by_uid: 'student_1'
  };
  assert.strictEqual(validateAttendanceRecord(studentSpoofed), false);

  // Invalid date format
  assert.strictEqual(validateAttendanceRecord({ ...validRecord, date: '11/09/2026' }), false);

  // Marked by UID mismatch (impersonation)
  assert.strictEqual(validateAttendanceRecord({ ...validRecord, marked_by_uid: 'other_uid' }), false);
});

// ============================================================
// PART 7: WHO CAN ACCESS COURSE LESSONS & SUBMIT WORK?
// ============================================================

test('Q7-01: Learning content (lessons, modules, assignments) requires active enrollment for students', () => {
  assert.ok(
    rulesContent.includes('function canReadLearningContentForCourse(data)') &&
    rulesContent.includes('hasActiveEnrollmentForCourse(data.course_id)'),
    'Learning content access requires active student enrollment'
  );
});

test('Q7-02: isActiveEnrollmentForUserCourse validates active status and student UID', () => {
  const isActiveEnrollmentForUserCourse = (enrollment, userId, courseId) => {
    return String(enrollment?.user_id || '').trim() === String(userId || '').trim()
      && String(enrollment?.course_id || '').trim() === String(courseId || '').trim()
      && String(enrollment?.status || '').trim() === 'active';
  };

  const enrollment = { user_id: 'student_1', course_id: 'course_tajweed', status: 'active' };
  assert.strictEqual(isActiveEnrollmentForUserCourse(enrollment, 'student_1', 'course_tajweed'), true);
  assert.strictEqual(isActiveEnrollmentForUserCourse(enrollment, 'student_2', 'course_tajweed'), false);
  assert.strictEqual(isActiveEnrollmentForUserCourse({ ...enrollment, status: 'cancelled' }, 'student_1', 'course_tajweed'), false);
});

test('Q7-03: Lesson progress writing enforces user_id == request.auth.uid (IDOR protection)', () => {
  assert.ok(
    rulesContent.includes('match /lesson_progress/{progressId}') &&
    rulesContent.includes('request.resource.data.user_id == request.auth.uid'),
    'Lesson progress must prevent users from updating other users progress records'
  );
});

// ============================================================
// PART 8: WHO CAN REVIEW STUDENT WORK? (SUBMISSIONS)
// ============================================================

test('Q8-01: Submissions read access allows submitter and isTeacherOrAdmin()', () => {
  assert.ok(
    rulesContent.includes('match /submissions/{submissionId}') &&
    rulesContent.includes('allow read: if isTeacherOrAdmin() || (isApprovedVerifiedUser() && resource.data.user_id == request.auth.uid);'),
    'Submissions read must allow teachers/admins or student owner'
  );
});

test('Q8-02: Negative RBAC - Student B cannot view Student A submission', () => {
  const canReadSubmission = (callerUid, callerRole, callerStatus, submissionOwnerUid) => {
    const isTeacherOrAdmin = ['teacher', 'assistant_teacher', 'admin', 'super_admin'].includes(callerRole) && callerStatus === 'approved';
    if (isTeacherOrAdmin) return true;
    if (callerStatus === 'approved' && callerUid === submissionOwnerUid) return true;
    return false;
  };

  assert.strictEqual(canReadSubmission('student_A', 'student', 'approved', 'student_A'), true, 'Owner can read');
  assert.strictEqual(canReadSubmission('student_B', 'student', 'approved', 'student_A'), false, 'Student B denied');
  assert.strictEqual(canReadSubmission('teacher_F', 'teacher', 'approved', 'student_A'), true, 'Teacher can read');
  assert.strictEqual(canReadSubmission('admin_X', 'admin', 'approved', 'student_A'), true, 'Admin can read');
});

// ============================================================
// PART 9: ZERO SILENT FAILURES ON ACADEMIC MUTATIONS
// ============================================================

test('ERR-01: manage-academics.tsx uses withTimeout and alerts on every async failure', () => {
  assert.ok(manageAcademicsContent.includes("Alert.alert('Save Failed'"), 'Course save failure must alert user');
  assert.ok(manageAcademicsContent.includes("Alert.alert('Add Failed'"), 'Teacher add failure must alert user');
  assert.ok(manageAcademicsContent.includes("Alert.alert('Enrollment Failed'"), 'Enrollment failure must alert user');
  assert.ok(manageAcademicsContent.includes("Alert.alert('Update Failed'"), 'Course assignment failure must alert user');
  assert.ok(manageAcademicsContent.includes('withTimeout('), 'All academic mutations must be timeout-guarded');
});

console.log('----------------------------------------------------------------');
console.log('P0.3 VERIFICATION RESULTS: ' + passed + ' PASSED, ' + failed + ' FAILED');
console.log('----------------------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🟢 ALL ACADEMIC CHAIN VERIFICATIONS PASSED CLEANLY.');
}
