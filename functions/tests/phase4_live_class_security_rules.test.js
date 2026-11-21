/**
 * Phase 4 — Firestore Live-Class Server-Side Authorization Hardening Test Suite
 *
 * Executes ACTUAL Firebase Firestore security rules against the local Firebase Emulator (port 8080).
 *
 * Verifies:
 * 1. Unauthenticated, pending, or suspended accounts cannot read live classes (DENY).
 * 2. Approved student with active course enrollment can read class document and query by enrolled course (ALLOW).
 * 3. Student without enrollment, or with inactive/revoked enrollment is denied (DENY).
 * 4. Student cannot read classes for courses they are not enrolled in, even by guessing document ID (DENY).
 * 5. Student open collection-wide query without course scoping is rejected (DENY).
 * 6. Host teacher can read their own class document and query by teacher_id (ALLOW).
 * 7. Teacher assigned to course via course.assigned_teachers or teachers.assigned_courses can read class (ALLOW).
 * 8. Unassigned teacher cannot read classes hosted by other teachers (DENY).
 * 9. Tenant A Admin can read Tenant A live classes (ALLOW).
 * 10. Tenant B Admin cannot read Tenant A live classes (DENY).
 * 11. Super Admin can read live classes across tenant boundaries (ALLOW).
 * 12. Subcollection security: enrolled student can read subcollections (/participants, /recordings) (ALLOW);
 *     unenrolled student is denied (DENY).
 * 13. Write rules: Students cannot create/delete classes; teachers cannot forge teacher_id (DENY).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const repoRoot = path.resolve(__dirname, '../../');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-mslb-liveclass-phase4';

// Identities
const SUPER_ADMIN = { uid: 'sa_p4_uid', email: 'sumraftm@gmail.com', role: 'super_admin', status: 'approved' };
const ADMIN_A = { uid: 'admin_a_p4', email: 'admin_a@darulilm.edu', role: 'admin', status: 'approved', organization_id: 'org_a' };
const ADMIN_B = { uid: 'admin_b_p4', email: 'admin_b@noorulilm.edu', role: 'admin', status: 'approved', organization_id: 'org_b' };

const TEACHER_A1 = { uid: 'teacher_a1_p4', email: 'teacher_a1@darulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_a' };
const TEACHER_A2 = { uid: 'teacher_a2_p4', email: 'teacher_a2@darulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_a' };
const TEACHER_A3 = { uid: 'teacher_a3_p4', email: 'teacher_a3@darulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_a' };
const TEACHER_A_UNASSIGNED = { uid: 'teacher_a_unass_p4', email: 'teacher_unass@darulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_a' };
const TEACHER_B = { uid: 'teacher_b_p4', email: 'teacher_b@noorulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_b' };

const STUDENT_A_ENROLLED = { uid: 'student_a_enr_p4', email: 'student_enr@darulilm.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_A_UNENROLLED = { uid: 'student_a_unenr_p4', email: 'student_unenr@darulilm.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_A_INACTIVE = { uid: 'student_a_inact_p4', email: 'student_inact@darulilm.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_A_REVOKED = { uid: 'student_a_rev_p4', email: 'student_rev@darulilm.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_A_PENDING = { uid: 'student_a_pend_p4', email: 'student_pend@darulilm.edu', role: 'student', status: 'pending', organization_id: 'org_a' };
const STUDENT_A_SUSPENDED = { uid: 'student_a_susp_p4', email: 'student_susp@darulilm.edu', role: 'student', status: 'suspended', organization_id: 'org_a' };
const STUDENT_B = { uid: 'student_b_p4', email: 'student_b@noorulilm.edu', role: 'student', status: 'approved', organization_id: 'org_b' };

const COURSE_A = 'course_a_p4';
const COURSE_B = 'course_b_p4';
const CLASS_A_ID = 'class_a_001';
const CLASS_B_ID = 'class_b_001';

let testEnv;
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.stack || err.message}`);
    failed++;
  }
}

async function setupFixtures(adminDb) {
  const users = [
    SUPER_ADMIN,
    ADMIN_A,
    ADMIN_B,
    TEACHER_A1,
    TEACHER_A2,
    TEACHER_A3,
    TEACHER_A_UNASSIGNED,
    TEACHER_B,
    STUDENT_A_ENROLLED,
    STUDENT_A_UNENROLLED,
    STUDENT_A_INACTIVE,
    STUDENT_A_REVOKED,
    STUDENT_A_PENDING,
    STUDENT_A_SUSPENDED,
    STUDENT_B,
  ];

  for (const u of users) {
    await adminDb.collection('users').doc(u.uid).set({
      uid: u.uid,
      name: `${u.role} ${u.uid}`,
      email: u.email,
      role: u.role,
      status: u.status,
      organization_id: u.organization_id || null,
      created_at: new Date(),
    });
  }

  // Organizations
  await adminDb.collection('organizations').doc('org_a').set({
    id: 'org_a',
    name: 'Darul Ilm Madrasa',
    status: 'active',
  });
  await adminDb.collection('organizations').doc('org_b').set({
    id: 'org_b',
    name: 'Noorul Ilm Madrasa',
    status: 'active',
  });

  // Memberships
  const memberships = [
    { id: `org_a_${ADMIN_A.uid}`, org: 'org_a', uid: ADMIN_A.uid, role: 'admin' },
    { id: `org_b_${ADMIN_B.uid}`, org: 'org_b', uid: ADMIN_B.uid, role: 'admin' },
    { id: `org_a_${TEACHER_A1.uid}`, org: 'org_a', uid: TEACHER_A1.uid, role: 'teacher' },
    { id: `org_a_${TEACHER_A2.uid}`, org: 'org_a', uid: TEACHER_A2.uid, role: 'teacher' },
    { id: `org_a_${TEACHER_A3.uid}`, org: 'org_a', uid: TEACHER_A3.uid, role: 'teacher' },
    { id: `org_a_${TEACHER_A_UNASSIGNED.uid}`, org: 'org_a', uid: TEACHER_A_UNASSIGNED.uid, role: 'teacher' },
    { id: `org_b_${TEACHER_B.uid}`, org: 'org_b', uid: TEACHER_B.uid, role: 'teacher' },
    { id: `org_a_${STUDENT_A_ENROLLED.uid}`, org: 'org_a', uid: STUDENT_A_ENROLLED.uid, role: 'student' },
    { id: `org_a_${STUDENT_A_UNENROLLED.uid}`, org: 'org_a', uid: STUDENT_A_UNENROLLED.uid, role: 'student' },
    { id: `org_a_${STUDENT_A_INACTIVE.uid}`, org: 'org_a', uid: STUDENT_A_INACTIVE.uid, role: 'student' },
    { id: `org_a_${STUDENT_A_REVOKED.uid}`, org: 'org_a', uid: STUDENT_A_REVOKED.uid, role: 'student' },
    { id: `org_a_${STUDENT_A_PENDING.uid}`, org: 'org_a', uid: STUDENT_A_PENDING.uid, role: 'student' },
    { id: `org_a_${STUDENT_A_SUSPENDED.uid}`, org: 'org_a', uid: STUDENT_A_SUSPENDED.uid, role: 'student' },
    { id: `org_b_${STUDENT_B.uid}`, org: 'org_b', uid: STUDENT_B.uid, role: 'student' },
  ];

  for (const m of memberships) {
    await adminDb.collection('organization_memberships').doc(m.id).set({
      id: m.id,
      organization_id: m.org,
      user_id: m.uid,
      role: m.role,
      status: 'active',
    });
  }

  // Courses
  // Course A: primary teacher TEACHER_A1, assigned_teachers contains TEACHER_A2
  await adminDb.collection('courses').doc(COURSE_A).set({
    name: 'Tajweed Mastery A',
    organization_id: 'org_a',
    teacher_id: TEACHER_A1.uid,
    assigned_teachers: [TEACHER_A2.uid],
    created_at: new Date(),
  });

  // Course B: primary teacher TEACHER_B
  await adminDb.collection('courses').doc(COURSE_B).set({
    name: 'Fiqh Essentials B',
    organization_id: 'org_b',
    teacher_id: TEACHER_B.uid,
    created_at: new Date(),
  });

  // Teacher Profiles: TEACHER_A3 has COURSE_A in assigned_courses
  await adminDb.collection('teachers').doc(TEACHER_A3.uid).set({
    teacher_id: TEACHER_A3.uid,
    user_uid: TEACHER_A3.uid,
    name: 'Ustaadha Maryam',
    organization_id: 'org_a',
    assigned_courses: [COURSE_A],
    status: 'approved',
  });

  // Enrollments
  // STUDENT_A_ENROLLED: active
  const enrActiveId = `${STUDENT_A_ENROLLED.uid}:${COURSE_A}`;
  await adminDb.collection('enrollments').doc(enrActiveId).set({
    id: enrActiveId,
    user_id: STUDENT_A_ENROLLED.uid,
    course_id: COURSE_A,
    status: 'active',
    enrolled_at: new Date(),
  });

  // STUDENT_A_INACTIVE: inactive
  const enrInactId = `${STUDENT_A_INACTIVE.uid}:${COURSE_A}`;
  await adminDb.collection('enrollments').doc(enrInactId).set({
    id: enrInactId,
    user_id: STUDENT_A_INACTIVE.uid,
    course_id: COURSE_A,
    status: 'inactive',
    enrolled_at: new Date(),
  });

  // STUDENT_A_REVOKED: revoked
  const enrRevId = `${STUDENT_A_REVOKED.uid}:${COURSE_A}`;
  await adminDb.collection('enrollments').doc(enrRevId).set({
    id: enrRevId,
    user_id: STUDENT_A_REVOKED.uid,
    course_id: COURSE_A,
    status: 'revoked',
    enrolled_at: new Date(),
  });

  // STUDENT_B: active in COURSE_B
  const enrBId = `${STUDENT_B.uid}:${COURSE_B}`;
  await adminDb.collection('enrollments').doc(enrBId).set({
    id: enrBId,
    user_id: STUDENT_B.uid,
    course_id: COURSE_B,
    status: 'active',
    enrolled_at: new Date(),
  });

  // Live Classes
  await adminDb.collection('live_classes').doc(CLASS_A_ID).set({
    title: 'Daily Tajweed Live Session',
    course_id: COURSE_A,
    teacher_id: TEACHER_A1.uid,
    teacher_name: 'Ustaadha Fatima',
    organization_id: 'org_a',
    meet_url: 'https://meet.google.com/abc-defg-hij',
    status: 'live',
    created_at: new Date(),
    updated_at: new Date(),
  });

  await adminDb.collection('live_classes').doc(CLASS_B_ID).set({
    title: 'Daily Fiqh Live Session',
    course_id: COURSE_B,
    teacher_id: TEACHER_B.uid,
    teacher_name: 'Ustaadh Zayd',
    organization_id: 'org_b',
    meet_url: 'https://meet.google.com/xyz-uvwx-rst',
    status: 'live',
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Subcollections for CLASS_A_ID
  await adminDb.collection('live_classes').doc(CLASS_A_ID).collection('participants').doc(STUDENT_A_ENROLLED.uid).set({
    user_id: STUDENT_A_ENROLLED.uid,
    agora_uid: 1001,
    name: 'Student Enrolled',
    role: 'student',
    joined: true,
  });

  await adminDb.collection('live_classes').doc(CLASS_A_ID).collection('recordings').doc('rec_sub_01').set({
    title: 'Tajweed Session Recording',
    url: 'https://storage.googleapis.com/org_a/rec1.mp4',
  });
}

(async () => {
  console.log('================================================================');
  console.log('   MSLB PHASE 4 — FIRESTORE LIVE-CLASS AUTHORIZATION HARDENING  ');
  console.log('================================================================');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setupFixtures(ctx.firestore());
  });

  // Contexts
  const unauthCtx = testEnv.unauthenticatedContext();
  const unauthDb = unauthCtx.firestore();

  const saCtx = testEnv.authenticatedContext(SUPER_ADMIN.uid, { email: SUPER_ADMIN.email, email_verified: true });
  const saDb = saCtx.firestore();

  const adminACtx = testEnv.authenticatedContext(ADMIN_A.uid, { email: ADMIN_A.email, email_verified: true });
  const adminADb = adminACtx.firestore();

  const adminBCtx = testEnv.authenticatedContext(ADMIN_B.uid, { email: ADMIN_B.email, email_verified: true });
  const adminBDb = adminBCtx.firestore();

  const teacherA1Ctx = testEnv.authenticatedContext(TEACHER_A1.uid, { email: TEACHER_A1.email, email_verified: true });
  const teacherA1Db = teacherA1Ctx.firestore();

  const teacherA2Ctx = testEnv.authenticatedContext(TEACHER_A2.uid, { email: TEACHER_A2.email, email_verified: true });
  const teacherA2Db = teacherA2Ctx.firestore();

  const teacherA3Ctx = testEnv.authenticatedContext(TEACHER_A3.uid, { email: TEACHER_A3.email, email_verified: true });
  const teacherA3Db = teacherA3Ctx.firestore();

  const teacherAUnassignedCtx = testEnv.authenticatedContext(TEACHER_A_UNASSIGNED.uid, { email: TEACHER_A_UNASSIGNED.email, email_verified: true });
  const teacherAUnassignedDb = teacherAUnassignedCtx.firestore();

  const teacherBCtx = testEnv.authenticatedContext(TEACHER_B.uid, { email: TEACHER_B.email, email_verified: true });
  const teacherBDb = teacherBCtx.firestore();

  const studentEnrolledCtx = testEnv.authenticatedContext(STUDENT_A_ENROLLED.uid, { email: STUDENT_A_ENROLLED.email, email_verified: true });
  const studentEnrolledDb = studentEnrolledCtx.firestore();

  const studentUnenrolledCtx = testEnv.authenticatedContext(STUDENT_A_UNENROLLED.uid, { email: STUDENT_A_UNENROLLED.email, email_verified: true });
  const studentUnenrolledDb = studentUnenrolledCtx.firestore();

  const studentInactiveCtx = testEnv.authenticatedContext(STUDENT_A_INACTIVE.uid, { email: STUDENT_A_INACTIVE.email, email_verified: true });
  const studentInactiveDb = studentInactiveCtx.firestore();

  const studentRevokedCtx = testEnv.authenticatedContext(STUDENT_A_REVOKED.uid, { email: STUDENT_A_REVOKED.email, email_verified: true });
  const studentRevokedDb = studentRevokedCtx.firestore();

  const studentPendingCtx = testEnv.authenticatedContext(STUDENT_A_PENDING.uid, { email: STUDENT_A_PENDING.email, email_verified: false });
  const studentPendingDb = studentPendingCtx.firestore();

  const studentSuspendedCtx = testEnv.authenticatedContext(STUDENT_A_SUSPENDED.uid, { email: STUDENT_A_SUSPENDED.email, email_verified: true });
  const studentSuspendedDb = studentSuspendedCtx.firestore();

  const studentBCtx = testEnv.authenticatedContext(STUDENT_B.uid, { email: STUDENT_B.email, email_verified: true });
  const studentBDb = studentBCtx.firestore();

  console.log('\n--- GROUP 1: UNAUTHENTICATED & UNAPPROVED ACCOUNT GATING ---');

  await runTest('SEC-01: Unauthenticated request cannot read live class (DENY)', async () => {
    await assertFails(unauthDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-02: Pending/unapproved student cannot read live class (DENY)', async () => {
    await assertFails(studentPendingDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-03: Suspended student cannot read live class (DENY)', async () => {
    await assertFails(studentSuspendedDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  console.log('\n--- GROUP 2: STUDENT ACADEMIC ENROLLMENT GATING ---');

  await runTest('SEC-04: Enrolled student can read live class for Course A (ALLOW)', async () => {
    await assertSucceeds(studentEnrolledDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-05: Unenrolled student cannot read live class for Course A (DENY)', async () => {
    await assertFails(studentUnenrolledDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-06: Student with inactive enrollment cannot read live class for Course A (DENY)', async () => {
    await assertFails(studentInactiveDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-07: Student with revoked enrollment cannot read live class for Course A (DENY)', async () => {
    await assertFails(studentRevokedDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-08: Student enrolled in Course A cannot read Course B live class by guessing ID (DENY)', async () => {
    await assertFails(studentEnrolledDb.collection('live_classes').doc(CLASS_B_ID).get());
  });

  console.log('\n--- GROUP 3: STUDENT QUERY SCOPING ---');

  await runTest('SEC-09: Student query scoped to enrolled course where("course_id", "in", [COURSE_A]) succeeds (ALLOW)', async () => {
    const q = studentEnrolledDb.collection('live_classes').where('course_id', 'in', [COURSE_A]);
    await assertSucceeds(q.get());
  });

  await runTest('SEC-10: Student open collection-wide query without course filter fails (DENY)', async () => {
    await assertFails(studentEnrolledDb.collection('live_classes').get());
  });

  await runTest('SEC-11: Student query scoped to non-enrolled course fails (DENY)', async () => {
    const q = studentUnenrolledDb.collection('live_classes').where('course_id', 'in', [COURSE_A]);
    await assertFails(q.get());
  });

  console.log('\n--- GROUP 4: TEACHER ASSIGNMENT & HOST PRIVILEGES ---');

  await runTest('SEC-12: Host teacher can read their own live class (ALLOW)', async () => {
    await assertSucceeds(teacherA1Db.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-13: Host teacher query scoped to where("teacher_id", "==", uid) succeeds (ALLOW)', async () => {
    const q = teacherA1Db.collection('live_classes').where('teacher_id', '==', TEACHER_A1.uid);
    await assertSucceeds(q.get());
  });

  await runTest('SEC-14: Teacher A2 assigned via course.assigned_teachers can read Course A class (ALLOW)', async () => {
    await assertSucceeds(teacherA2Db.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-15: Teacher A3 assigned via teachers.assigned_courses can read Course A class (ALLOW)', async () => {
    await assertSucceeds(teacherA3Db.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-16: Teacher with no assigned courses cannot read Teacher A1 live class (DENY)', async () => {
    await assertFails(teacherAUnassignedDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-17: Teacher with no assigned courses open query fails (DENY)', async () => {
    await assertFails(teacherAUnassignedDb.collection('live_classes').get());
  });

  await runTest('SEC-18: Teacher from Tenant B cannot read Tenant A live class (DENY)', async () => {
    await assertFails(teacherBDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  console.log('\n--- GROUP 5: ADMINISTRATIVE ACCESS & TENANT ISOLATION ---');

  await runTest('SEC-19: Tenant A Admin can read Tenant A live class (ALLOW)', async () => {
    await assertSucceeds(adminADb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-20: Tenant B Admin cannot read Tenant A live class (DENY)', async () => {
    await assertFails(adminBDb.collection('live_classes').doc(CLASS_A_ID).get());
  });

  await runTest('SEC-21: Super Admin can read live classes across tenant boundaries (ALLOW)', async () => {
    await assertSucceeds(saDb.collection('live_classes').doc(CLASS_A_ID).get());
    await assertSucceeds(saDb.collection('live_classes').doc(CLASS_B_ID).get());
  });

  console.log('\n--- GROUP 6: SUBCOLLECTION SECURITY ---');

  await runTest('SEC-22: Enrolled student can read participants in authorized live class (ALLOW)', async () => {
    await assertSucceeds(studentEnrolledDb.collection('live_classes').doc(CLASS_A_ID).collection('participants').doc(STUDENT_A_ENROLLED.uid).get());
  });

  await runTest('SEC-23: Enrolled student can read recordings subcollection in authorized live class (ALLOW)', async () => {
    await assertSucceeds(studentEnrolledDb.collection('live_classes').doc(CLASS_A_ID).collection('recordings').doc('rec_sub_01').get());
  });

  await runTest('SEC-24: Unenrolled student cannot read subcollections of unauthorized live class (DENY)', async () => {
    await assertFails(studentUnenrolledDb.collection('live_classes').doc(CLASS_A_ID).collection('recordings').doc('rec_sub_01').get());
  });

  console.log('\n--- GROUP 7: WRITE RULE INTEGRITY ---');

  await runTest('SEC-25: Student cannot create live class (DENY)', async () => {
    await assertFails(studentEnrolledDb.collection('live_classes').add({
      title: 'Hacked Class',
      course_id: COURSE_A,
      teacher_id: STUDENT_A_ENROLLED.uid,
      status: 'live',
      updated_at: new Date(),
    }));
  });

  await runTest('SEC-26: Teacher cannot forge teacher_id on create (DENY)', async () => {
    await assertFails(teacherA1Db.collection('live_classes').add({
      title: 'Forged Class',
      course_id: COURSE_A,
      teacher_id: TEACHER_A2.uid, // Spoofing Teacher A2
      status: 'live',
      updated_at: new Date(),
    }));
  });

  await runTest('SEC-27: Non-admin cannot delete live class (DENY)', async () => {
    await assertFails(teacherA1Db.collection('live_classes').doc(CLASS_A_ID).delete());
  });

  console.log('================================================================');
  console.log(`EMULATOR TEST RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
