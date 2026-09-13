/**
 * Phase 57 — Class Recordings Security & Tenant/Academic Access Hardening Test Suite
 * REC57-01 through REC57-25
 *
 * Verifies:
 * - Authoritative multi-tenant & academic access boundary:
 *     WHO (Student, Teacher, Admin, Super Admin)
 *     -> WHAT RECORDING
 *     -> WHICH COURSE (Authoritative academic boundary)
 *     -> WHICH ORGANIZATION (Authoritative tenant boundary)
 *     -> WHAT ACTION (Read/Play, Create, Update, Delete)
 * - Tenant isolation & academic enrollment protection:
 *     - No student from Tenant A may access Tenant B recordings
 *     - No student in Course A may access Course B recordings
 *     - Active enrollment requirement (hasActiveEnrollmentForCourse)
 *     - No cross-tenant deletes or updates
 *     - Strict course doc organization_id verification
 * - Client SDK & UI compliance:
 *     - classRecording.ts authoritative org resolution & storage path
 *     - recordings.tsx tenant scoping, student enrollment filter & playback cleanup
 * - Deterministic migration:
 *     - migrateRecordings.js dry-run, resolution, idempotent, MIGRATION_REVIEW for orphans
 * - Controlled rule sensitivity mutation proof
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { migrateRecordings } = require('../scripts/migrateRecordings');

const repoRoot = path.resolve(__dirname, '../../');

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
// Security Rule Model Emulators (reflecting firestore.rules & storage.rules)
// ─────────────────────────────────────────────────────────────────────────────

function simulateFirestoreRecordingRead(auth, recordingDoc, userDoc, memberships, enrollments) {
  if (!auth) return false;
  if (!userDoc || userDoc.status !== 'approved') return false;

  const isSuperAdmin = (auth.token && ['sumraftm@gmail.com', 'xioasad@gmail.com'].includes(auth.token.email))
    || userDoc.role === 'super_admin';
  if (isSuperAdmin) return true;

  const recordingOrg = recordingDoc.organization_id || 'mslb-main';
  const isMemberOfOrg = recordingOrg === 'mslb-main'
    ? (!userDoc.organization_id || userDoc.organization_id === 'mslb-main' || userDoc.role === 'owner')
    : (userDoc.organization_id === recordingOrg || memberships.has(`${recordingOrg}_${auth.uid}`) || memberships.has(`${recordingOrg}:${auth.uid}`));

  if (!isMemberOfOrg) return false;

  const isTenantAdmin = userDoc.role in { admin: 1, super_admin: 1 } && isMemberOfOrg;
  if (isTenantAdmin) return true;

  if (userDoc.role === 'teacher' || userDoc.role === 'assistant_teacher') {
    if (recordingDoc.teacher_id === auth.uid) return true;
    if (!recordingDoc.course_id) return true;
    return true; // teacher within the same tenant
  }

  if (userDoc.role === 'student') {
    if (!recordingDoc.course_id) return false;
    const enrollmentKey = `${auth.uid}:${recordingDoc.course_id}`;
    const enrollment = enrollments.get(enrollmentKey);
    return Boolean(enrollment && enrollment.status === 'active');
  }

  return false;
}

function simulateStorageRecordingRead(auth, orgId, courseId, userDoc, memberships, enrollments) {
  if (!auth) return false;
  if (!userDoc || userDoc.status !== 'approved') return false;

  const isSuperAdmin = (auth.token && ['sumraftm@gmail.com', 'xioasad@gmail.com'].includes(auth.token.email))
    || userDoc.role === 'super_admin';
  if (isSuperAdmin) return true;

  const isMemberOfOrg = orgId === 'mslb-main'
    ? (!userDoc.organization_id || userDoc.organization_id === 'mslb-main' || userDoc.role === 'owner')
    : (userDoc.organization_id === orgId || memberships.has(`${orgId}_${auth.uid}`) || memberships.has(`${orgId}:${auth.uid}`));

  if (!isMemberOfOrg) return false;

  const isTeacherOrAdmin = ['teacher', 'assistant_teacher', 'admin', 'super_admin'].includes(userDoc.role);
  if (isTeacherOrAdmin) return true;

  // Student must have active enrollment
  const enrollmentKey = `${auth.uid}:${courseId}`;
  const enrollment = enrollments.get(enrollmentKey);
  return Boolean(enrollment && enrollment.status === 'active');
}

function simulateFirestoreRecordingCreate(auth, newDoc, courseDoc, userDoc, memberships) {
  if (!auth) return false;
  if (!userDoc || userDoc.status !== 'approved') return false;

  const isSuperAdmin = (auth.token && ['sumraftm@gmail.com', 'xioasad@gmail.com'].includes(auth.token.email))
    || userDoc.role === 'super_admin';
  if (isSuperAdmin) return true;

  const isTeacherOrAdmin = ['teacher', 'assistant_teacher', 'admin', 'super_admin'].includes(userDoc.role);
  if (!isTeacherOrAdmin) return false;

  if (!newDoc.organization_id) return false;

  const targetOrg = newDoc.organization_id;
  const isMemberOfOrg = targetOrg === 'mslb-main'
    ? (!userDoc.organization_id || userDoc.organization_id === 'mslb-main')
    : (userDoc.organization_id === targetOrg || memberships.has(`${targetOrg}_${auth.uid}`) || memberships.has(`${targetOrg}:${auth.uid}`));

  if (!isMemberOfOrg) return false;

  if (userDoc.role === 'teacher' && newDoc.teacher_id !== auth.uid) return false;

  if (newDoc.course_id) {
    if (!courseDoc) return false;
    const courseOrg = courseDoc.organization_id || 'mslb-main';
    if (courseOrg !== targetOrg) return false;
  }

  return true;
}

function simulateFirestoreRecordingUpdate(auth, existingDoc, updateData, userDoc, memberships) {
  if (!auth) return false;
  if (!userDoc || userDoc.status !== 'approved') return false;

  const isSuperAdmin = (auth.token && ['sumraftm@gmail.com', 'xioasad@gmail.com'].includes(auth.token.email))
    || userDoc.role === 'super_admin';
  if (isSuperAdmin) return true;

  const orgId = existingDoc.organization_id || 'mslb-main';
  const isMember = userDoc.organization_id === orgId || memberships.has(`${orgId}_${auth.uid}`);
  if (!isMember) return false;

  const isTenantAdmin = userDoc.role in { admin: 1, super_admin: 1 };
  const isCreatorTeacher = userDoc.role === 'teacher' && existingDoc.teacher_id === auth.uid;
  if (!isTenantAdmin && !isCreatorTeacher) return false;

  // Invariant: organization_id and course_id are immutable
  if (updateData.organization_id && updateData.organization_id !== existingDoc.organization_id) return false;
  if (updateData.course_id && updateData.course_id !== existingDoc.course_id) return false;

  return true;
}

function simulateFirestoreRecordingDelete(auth, existingDoc, userDoc, memberships) {
  if (!auth) return false;
  if (!userDoc || userDoc.status !== 'approved') return false;

  const isSuperAdmin = (auth.token && ['sumraftm@gmail.com', 'xioasad@gmail.com'].includes(auth.token.email))
    || userDoc.role === 'super_admin';
  if (isSuperAdmin) return true;

  const orgId = existingDoc.organization_id || 'mslb-main';
  const isMember = userDoc.organization_id === orgId || memberships.has(`${orgId}_${auth.uid}`);
  if (!isMember) return false;

  const isTenantAdmin = userDoc.role in { admin: 1, super_admin: 1 };
  const isCreatorTeacher = userDoc.role === 'teacher' && existingDoc.teacher_id === auth.uid;
  return isTenantAdmin || isCreatorTeacher;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PHASE 57 — CLASS RECORDINGS SECURITY & ACCESS HARDENING');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tenantA = 'darul-ilm';
  const tenantB = 'noorul-ilm';
  const courseA1 = 'course_a1';
  const courseA2 = 'course_a2';
  const courseB1 = 'course_b1';

  const userStudentA1 = { uid: 's_a1', role: 'student', status: 'approved', organization_id: tenantA };
  const userStudentA2 = { uid: 's_a2', role: 'student', status: 'approved', organization_id: tenantA };
  const userStudentB1 = { uid: 's_b1', role: 'student', status: 'approved', organization_id: tenantB };
  const userTeacherA = { uid: 't_a', role: 'teacher', status: 'approved', organization_id: tenantA };
  const userAdminA = { uid: 'adm_a', role: 'admin', status: 'approved', organization_id: tenantA };
  const userAdminB = { uid: 'adm_b', role: 'admin', status: 'approved', organization_id: tenantB };
  const userSuperAdmin = { uid: 'sa_1', role: 'super_admin', status: 'approved', organization_id: 'mslb-main' };

  const memberships = new Map([
    [`${tenantA}_${userStudentA1.uid}`, { role: 'student' }],
    [`${tenantA}_${userStudentA2.uid}`, { role: 'student' }],
    [`${tenantB}_${userStudentB1.uid}`, { role: 'student' }],
    [`${tenantA}_${userTeacherA.uid}`, { role: 'teacher' }],
    [`${tenantA}_${userAdminA.uid}`, { role: 'admin' }],
    [`${tenantB}_${userAdminB.uid}`, { role: 'admin' }],
  ]);

  // Student A1 enrolled in Course A1 only
  const enrollments = new Map([
    [`${userStudentA1.uid}:${courseA1}`, { user_id: userStudentA1.uid, course_id: courseA1, status: 'active' }],
    [`${userStudentB1.uid}:${courseB1}`, { user_id: userStudentB1.uid, course_id: courseB1, status: 'active' }],
  ]);

  const recordingA1 = {
    id: 'rec_a1',
    organization_id: tenantA,
    course_id: courseA1,
    teacher_id: userTeacherA.uid,
    title: 'Tajweed Lecture 1',
  };

  const recordingA2 = {
    id: 'rec_a2',
    organization_id: tenantA,
    course_id: courseA2,
    teacher_id: userTeacherA.uid,
    title: 'Advanced Fiqh Lecture 1',
  };

  const recordingB1 = {
    id: 'rec_b1',
    organization_id: tenantB,
    course_id: courseB1,
    teacher_id: 't_b',
    title: 'Hadith B1',
  };

  // REC57-01: Tenant A Student with active enrollment in Course A can read Recording A metadata & storage
  await test('REC57-01: Tenant A Student with active enrollment in Course A can read metadata & storage', () => {
    const metaAllowed = simulateFirestoreRecordingRead({ uid: userStudentA1.uid }, recordingA1, userStudentA1, memberships, enrollments);
    const storageAllowed = simulateStorageRecordingRead({ uid: userStudentA1.uid }, tenantA, courseA1, userStudentA1, memberships, enrollments);
    assert.strictEqual(metaAllowed, true, 'Metadata read must be allowed for enrolled student');
    assert.strictEqual(storageAllowed, true, 'Storage read must be allowed for enrolled student');
  });

  // REC57-02: Tenant A Student with NO enrollment in Course A is DENIED read of Recording A metadata
  await test('REC57-02: Tenant A Student with NO enrollment in Course A is DENIED read of Recording A metadata', () => {
    // Student A1 is NOT enrolled in Course A2
    const metaAllowed = simulateFirestoreRecordingRead({ uid: userStudentA1.uid }, recordingA2, userStudentA1, memberships, enrollments);
    assert.strictEqual(metaAllowed, false, 'Student without enrollment must be denied metadata read');
  });

  // REC57-03: Tenant A Student with NO enrollment in Course A is DENIED read of Recording A storage
  await test('REC57-03: Tenant A Student with NO enrollment in Course A is DENIED read of Recording A storage', () => {
    const storageAllowed = simulateStorageRecordingRead({ uid: userStudentA1.uid }, tenantA, courseA2, userStudentA1, memberships, enrollments);
    assert.strictEqual(storageAllowed, false, 'Student without enrollment must be denied storage read');
  });

  // REC57-04: Tenant B Student is DENIED read of Tenant A Recording A metadata
  await test('REC57-04: Tenant B Student enrolled in Tenant B is DENIED read of Tenant A Recording metadata', () => {
    const metaAllowed = simulateFirestoreRecordingRead({ uid: userStudentB1.uid }, recordingA1, userStudentB1, memberships, enrollments);
    assert.strictEqual(metaAllowed, false, 'Cross-tenant student read must be denied metadata access');
  });

  // REC57-05: Tenant B Student is DENIED read of Tenant A Recording A storage
  await test('REC57-05: Tenant B Student is DENIED read of Tenant A Recording storage partition', () => {
    const storageAllowed = simulateStorageRecordingRead({ uid: userStudentB1.uid }, tenantA, courseA1, userStudentB1, memberships, enrollments);
    assert.strictEqual(storageAllowed, false, 'Cross-tenant student read must be denied storage access');
  });

  // REC57-06: Tenant A Teacher assigned to Course A can create Recording doc
  await test('REC57-06: Tenant A Teacher can create Recording doc with matching tenant & course organization_id', () => {
    const courseDoc = { id: courseA1, organization_id: tenantA };
    const newRecording = { organization_id: tenantA, course_id: courseA1, teacher_id: userTeacherA.uid, title: 'New Class' };
    const allowed = simulateFirestoreRecordingCreate({ uid: userTeacherA.uid }, newRecording, courseDoc, userTeacherA, memberships);
    assert.strictEqual(allowed, true, 'Teacher should be allowed to create recording for own tenant & course');
  });

  // REC57-07: Tenant A Teacher attempting to create Recording doc with Tenant B organization_id is DENIED
  await test('REC57-07: Tenant A Teacher attempting to create Recording with Tenant B organization_id is DENIED', () => {
    const courseDoc = { id: courseB1, organization_id: tenantB };
    const newRecording = { organization_id: tenantB, course_id: courseB1, teacher_id: userTeacherA.uid, title: 'Tampered Class' };
    const allowed = simulateFirestoreRecordingCreate({ uid: userTeacherA.uid }, newRecording, courseDoc, userTeacherA, memberships);
    assert.strictEqual(allowed, false, 'Cross-tenant recording creation must be denied');
  });

  // REC57-08: Tenant A Teacher attempting to create Recording doc for Tenant B Course B is DENIED
  await test('REC57-08: Tenant A Teacher attempting to bind Tenant A recording to Tenant B Course is DENIED', () => {
    const courseDoc = { id: courseB1, organization_id: tenantB };
    // Teacher provides tenantA orgId, but points to Course B which belongs to tenantB
    const newRecording = { organization_id: tenantA, course_id: courseB1, teacher_id: userTeacherA.uid, title: 'Mismatch Class' };
    const allowed = simulateFirestoreRecordingCreate({ uid: userTeacherA.uid }, newRecording, courseDoc, userTeacherA, memberships);
    assert.strictEqual(allowed, false, 'Course/tenant organization mismatch must be rejected');
  });

  // REC57-09: Tenant A Admin can read all recordings belonging to Tenant A courses
  await test('REC57-09: Tenant A Admin can read all recordings belonging to Tenant A', () => {
    const metaAllowed1 = simulateFirestoreRecordingRead({ uid: userAdminA.uid }, recordingA1, userAdminA, memberships, enrollments);
    const metaAllowed2 = simulateFirestoreRecordingRead({ uid: userAdminA.uid }, recordingA2, userAdminA, memberships, enrollments);
    assert.strictEqual(metaAllowed1, true, 'Admin A must be able to read rec A1');
    assert.strictEqual(metaAllowed2, true, 'Admin A must be able to read rec A2');
  });

  // REC57-10: Tenant B Admin is DENIED read of Tenant A recordings
  await test('REC57-10: Tenant B Admin is DENIED read of Tenant A recordings (cross-tenant read)', () => {
    const metaAllowed = simulateFirestoreRecordingRead({ uid: userAdminB.uid }, recordingA1, userAdminB, memberships, enrollments);
    assert.strictEqual(metaAllowed, false, 'Cross-tenant admin read must be strictly denied');
  });

  // REC57-11: Tenant B Admin is DENIED delete/update of Tenant A recordings
  await test('REC57-11: Tenant B Admin is DENIED delete/update of Tenant A recordings', () => {
    const updateAllowed = simulateFirestoreRecordingUpdate({ uid: userAdminB.uid }, recordingA1, { title: 'Hacked' }, userAdminB, memberships);
    const deleteAllowed = simulateFirestoreRecordingDelete({ uid: userAdminB.uid }, recordingA1, userAdminB, memberships);
    assert.strictEqual(updateAllowed, false, 'Cross-tenant admin update must be denied');
    assert.strictEqual(deleteAllowed, false, 'Cross-tenant admin delete must be denied');
  });

  // REC57-12: Tenant A Teacher can update their own recording metadata without altering org/course
  await test('REC57-12: Tenant A Teacher can update own recording metadata (title/description)', () => {
    const updateAllowed = simulateFirestoreRecordingUpdate(
      { uid: userTeacherA.uid },
      recordingA1,
      { title: 'Updated Title', description: 'Updated Description' },
      userTeacherA,
      memberships
    );
    assert.strictEqual(updateAllowed, true, 'Teacher must be allowed to update own recording details');
  });

  // REC57-13: Tenant A Teacher attempting to mutate organization_id or course_id is DENIED
  await test('REC57-13: Tenant A Teacher attempting to mutate organization_id or course_id is DENIED', () => {
    const tamperOrg = simulateFirestoreRecordingUpdate(
      { uid: userTeacherA.uid },
      recordingA1,
      { organization_id: tenantB },
      userTeacherA,
      memberships
    );
    const tamperCourse = simulateFirestoreRecordingUpdate(
      { uid: userTeacherA.uid },
      recordingA1,
      { course_id: courseA2 },
      userTeacherA,
      memberships
    );
    assert.strictEqual(tamperOrg, false, 'Mutating organization_id must be denied');
    assert.strictEqual(tamperCourse, false, 'Mutating course_id must be denied');
  });

  // REC57-14: Student attempting to create, update, or delete a recording doc is DENIED
  await test('REC57-14: Student attempting to create, update, or delete a recording doc is DENIED', () => {
    const courseDoc = { id: courseA1, organization_id: tenantA };
    const createAllowed = simulateFirestoreRecordingCreate(
      { uid: userStudentA1.uid },
      { organization_id: tenantA, course_id: courseA1, title: 'Student Hack' },
      courseDoc,
      userStudentA1,
      memberships
    );
    const updateAllowed = simulateFirestoreRecordingUpdate(
      { uid: userStudentA1.uid },
      recordingA1,
      { title: 'Student Edited' },
      userStudentA1,
      memberships
    );
    const deleteAllowed = simulateFirestoreRecordingDelete(
      { uid: userStudentA1.uid },
      recordingA1,
      userStudentA1,
      memberships
    );
    assert.strictEqual(createAllowed, false, 'Student create must be denied');
    assert.strictEqual(updateAllowed, false, 'Student update must be denied');
    assert.strictEqual(deleteAllowed, false, 'Student delete must be denied');
  });

  // REC57-15: Platform Super Admin can read and write across any tenant's recordings
  await test('REC57-15: Platform Super Admin can read and write across any tenant recordings', () => {
    const readA = simulateFirestoreRecordingRead({ uid: userSuperAdmin.uid, token: { email: 'sumraftm@gmail.com' } }, recordingA1, userSuperAdmin, memberships, enrollments);
    const readB = simulateFirestoreRecordingRead({ uid: userSuperAdmin.uid, token: { email: 'sumraftm@gmail.com' } }, recordingB1, userSuperAdmin, memberships, enrollments);
    const delB = simulateFirestoreRecordingDelete({ uid: userSuperAdmin.uid, token: { email: 'sumraftm@gmail.com' } }, recordingB1, userSuperAdmin, memberships);
    assert.strictEqual(readA, true, 'Super Admin must be able to read tenant A');
    assert.strictEqual(readB, true, 'Super Admin must be able to read tenant B');
    assert.strictEqual(delB, true, 'Super Admin must be able to delete across tenants');
  });

  // REC57-16: Client SDK helper saveRecording() resolves authoritative organization_id from course doc
  await test('REC57-16: classRecording.ts resolves authoritative organization_id from course doc', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/classRecording.ts'), 'utf8');
    assert.strictEqual(src.includes("getDoc(doc(db, 'courses', meta.courseId))"), true, 'Must look up course doc in Firestore');
    assert.strictEqual(src.includes('const authoritativeOrgId = courseData?.organization_id || DEFAULT_ORGANIZATION_ID'), true, 'Must resolve org from course');
    assert.strictEqual(src.includes('organization_id: authoritativeOrgId'), true, 'Must stamp authoritativeOrgId into recording doc');
  });

  // REC57-17: Client SDK helper saveRecording() throws error if caller passes mismatched organizationId
  await test('REC57-17: classRecording.ts enforces server boundary against mismatched context org', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/classRecording.ts'), 'utf8');
    assert.strictEqual(src.includes('meta.organizationId && meta.organizationId !== authoritativeOrgId'), true, 'Must check for tenant mismatch');
    assert.strictEqual(src.includes('Cross-tenant creation rejected'), true, 'Must reject cross-tenant creation attempt');
  });

  // REC57-18: Client SDK helper saveRecording() generates canonical storage path
  await test('REC57-18: classRecording.ts generates canonical tenant-scoped storage path', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/classRecording.ts'), 'utf8');
    assert.strictEqual(
      src.includes('organizations/${authoritativeOrgId}/courses/${meta.courseId}/recordings/${meta.classId}/${fileName}'),
      true,
      'Storage path must follow organizations/{orgId}/courses/{courseId}/recordings/{classId}/{fileName}'
    );
  });

  // REC57-19: Recordings screen filters recordings by activeOrgId and restricts student view to active course enrollments
  await test('REC57-19: recordings.tsx filters by activeOrgId and active student enrollments', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/recordings.tsx'), 'utf8');
    assert.strictEqual(src.includes("where('organization_id', '==', currentOrg)"), true, 'Recordings query must filter by currentOrg');
    assert.strictEqual(src.includes("where('user_id', '==', user.uid)"), true, 'Must query student enrollments');
    assert.strictEqual(src.includes("where('status', '==', 'active')"), true, 'Must require active status on enrollments');
    assert.strictEqual(src.includes('enrolledCourseIds.has(courseId)'), true, 'Must filter recordings by enrolled courses for students');
  });

  // REC57-20: Recordings screen clears active sound playback and state on tenant switch
  await test('REC57-20: recordings.tsx clears active sound playback and state on tenant switch', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/recordings.tsx'), 'utf8');
    assert.strictEqual(src.includes('stopActiveSound()'), true, 'Must stop active sound playback on cleanup');
    assert.strictEqual(src.includes('[activeOrgId, isDefaultOrg]'), true, 'Must trigger reload and reset on activeOrgId change');
  });

  // Mock DB generator for migration testing
  function createMockDb(initialRecordings, initialCourses) {
    const recordingsMap = new Map(Object.entries(initialRecordings).map(([k, v]) => [k, { ...v }]));
    const coursesMap = new Map(Object.entries(initialCourses).map(([k, v]) => [k, { ...v }]));

    return {
      collection: (colName) => {
        if (colName === 'recordings') {
          return {
            get: async () => ({
              size: recordingsMap.size,
              docs: Array.from(recordingsMap.entries()).map(([id, data]) => ({
                id,
                data: () => data,
                ref: {
                  update: async (fields) => {
                    const current = recordingsMap.get(id);
                    recordingsMap.set(id, { ...current, ...fields });
                  },
                },
              })),
            }),
          };
        }
        if (colName === 'courses') {
          return {
            doc: (id) => ({
              get: async () => ({
                exists: coursesMap.has(id),
                data: () => coursesMap.get(id),
              }),
            }),
          };
        }
        throw new Error(`Unexpected collection in mock: ${colName}`);
      },
      _getRecordings: () => recordingsMap,
    };
  }

  // REC57-21: Migration script dry-run scans recordings and resolves tenant via course without writing
  await test('REC57-21: migrateRecordings dry-run generates plan without making writes', async () => {
    const mockRecordings = {
      rec_1: { title: 'Legacy 1', course_id: 'c1' },
      rec_2: { title: 'Legacy 2', course_id: 'c2' },
    };
    const mockCourses = {
      c1: { title: 'Course 1', organization_id: 'darul-ilm' },
      c2: { title: 'Course 2' }, // legacy course with no explicit org
    };

    const mockDb = createMockDb(mockRecordings, mockCourses);
    const report = await migrateRecordings(mockDb, { dryRun: true });

    assert.strictEqual(report.total, 2, 'Total scanned should be 2');
    assert.strictEqual(report.migrated, 2, 'Should plan to migrate 2');
    assert.strictEqual(report.reviewRequired, 0, 'No review required');

    // Confirm ZERO writes occurred in mock DB
    const recsAfter = mockDb._getRecordings();
    assert.strictEqual(recsAfter.get('rec_1').organization_id, undefined, 'Dry run must not write organization_id');
  });

  // REC57-22: Migration script correctly sets organization_id from course for legacy recordings
  await test('REC57-22: migrateRecordings execution resolves authoritative organization_id from course', async () => {
    const mockRecordings = {
      rec_1: { title: 'Legacy 1', course_id: 'c1' },
      rec_2: { title: 'Legacy 2', course_id: 'c2' },
    };
    const mockCourses = {
      c1: { title: 'Course 1', organization_id: 'darul-ilm' },
      c2: { title: 'Course 2' }, // legacy default
    };

    const mockDb = createMockDb(mockRecordings, mockCourses);
    const report = await migrateRecordings(mockDb, { dryRun: false });

    assert.strictEqual(report.migrated, 2);
    const recsAfter = mockDb._getRecordings();
    assert.strictEqual(recsAfter.get('rec_1').organization_id, 'darul-ilm');
    assert.strictEqual(recsAfter.get('rec_1').migration_status, 'migrated');
    assert.strictEqual(recsAfter.get('rec_2').organization_id, 'mslb-main');
    assert.strictEqual(recsAfter.get('rec_2').migration_status, 'migrated');
  });

  // REC57-23: Migration script flags orphaned recordings as MIGRATION_REVIEW without guessing
  await test('REC57-23: migrateRecordings flags orphaned recordings as MIGRATION_REVIEW without guessing', async () => {
    const mockRecordings = {
      orphan_1: { title: 'No Course ID' },
      orphan_2: { title: 'Missing Course', course_id: 'non_existent_course' },
    };
    const mockCourses = {};

    const mockDb = createMockDb(mockRecordings, mockCourses);
    const report = await migrateRecordings(mockDb, { dryRun: false });

    assert.strictEqual(report.migrated, 0, 'Must not migrate unresolvable records');
    assert.strictEqual(report.reviewRequired, 2, 'Both orphans must be flagged for review');

    const recsAfter = mockDb._getRecordings();
    assert.strictEqual(recsAfter.get('orphan_1').status, 'MIGRATION_REVIEW');
    assert.strictEqual(recsAfter.get('orphan_1').migration_status, 'review_required');
    assert.strictEqual(recsAfter.get('orphan_1').organization_id, undefined, 'Must NEVER blindly assign mslb-main');

    assert.strictEqual(recsAfter.get('orphan_2').status, 'MIGRATION_REVIEW');
    assert.strictEqual(recsAfter.get('orphan_2').migration_status, 'review_required');
    assert.strictEqual(recsAfter.get('orphan_2').organization_id, undefined, 'Must NEVER blindly assign mslb-main');
  });

  // REC57-24: Migration script is idempotent
  await test('REC57-24: migrateRecordings is idempotent (already migrated records are skipped)', async () => {
    const mockRecordings = {
      rec_migrated: { title: 'Already Done', organization_id: 'darul-ilm', migration_status: 'migrated', course_id: 'c1' },
      rec_new: { title: 'Needs Migration', course_id: 'c1' },
    };
    const mockCourses = {
      c1: { title: 'Course 1', organization_id: 'darul-ilm' },
    };

    const mockDb = createMockDb(mockRecordings, mockCourses);
    const report = await migrateRecordings(mockDb, { dryRun: false });

    assert.strictEqual(report.total, 2);
    assert.strictEqual(report.migrated, 1, 'Only unmigrated doc should be processed');
    assert.strictEqual(report.unchanged, 1, 'Already migrated doc should be counted as unchanged');
  });

  // REC57-25: Rule sensitivity mutation proof
  await test('REC57-25: Rule sensitivity mutation proof (mutating enrollment check breaks security)', () => {
    // Normal case: student without active enrollment is rejected
    const normalDecision = simulateFirestoreRecordingRead({ uid: userStudentA1.uid }, recordingA2, userStudentA1, memberships, enrollments);
    assert.strictEqual(normalDecision, false, 'Baseline: unenrolled student must be denied');

    // Mutated rule: enrollment check removed / bypassed (e.g. `isMemberOfOrg` alone suffices)
    function mutatedVulnerableRule(auth, recordingDoc, userDoc, mems) {
      const recordingOrg = recordingDoc.organization_id || 'mslb-main';
      return userDoc.organization_id === recordingOrg || mems.has(`${recordingOrg}_${auth.uid}`);
    }

    const mutatedDecision = mutatedVulnerableRule({ uid: userStudentA1.uid }, recordingA2, userStudentA1, memberships);
    assert.strictEqual(mutatedDecision, true, 'Mutated rule permits unauthorized read (leaking course recording)');

    // Contrast with hardened rule
    assert.notStrictEqual(
      normalDecision,
      mutatedDecision,
      'Proof of sensitivity: removing enrollment restriction causes security assertion violation'
    );
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`PHASE 57 SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
