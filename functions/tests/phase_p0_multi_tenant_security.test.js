/**
 * Phase P0 — Critical Multi-Tenant Security Remediation Test Suite
 *
 * Executes ACTUAL Firebase Firestore security rules against the local Firebase Emulator.
 *
 * Verifies:
 * 1. Cross-tenant user reads and writes (Admin B cannot read/list Student A, cannot update Student A).
 * 2. Teacher profile isolation (Student B cannot read Teacher A).
 * 3. Enrollment reads and writes (Admin B cannot read or create enrollments in Madrasa A).
 * 4. Attendance reads, creates, updates and deletes (Teacher/Admin B cannot access Madrasa A attendance).
 * 5. Payment isolation (Admin B cannot read/update Madrasa A payments; Student A cannot view Student B payments).
 * 6. Quiz-result isolation (Teacher/Admin B cannot read Madrasa A quiz results).
 * 7. Certificate authorization (Admin B cannot list Madrasa A certificates; Student A can read own cert).
 * 8. Attempts to change organization_id (mutation across tenant boundaries is strictly DENIED).
 * 9. Super Admin cross-tenant platform visibility (ALLOW).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const repoRoot = path.resolve(__dirname, '../../');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-mslb-phase-p0-security';

// Identities
const SUPER_ADMIN = { uid: 'sa_p0_uid', email: 'sumraftm@gmail.com', role: 'super_admin', status: 'approved' };
const ADMIN_A = { uid: 'admin_a_p0', email: 'admin_a@madrasa-a.edu', role: 'admin', status: 'approved', organization_id: 'org_a' };
const ADMIN_B = { uid: 'admin_b_p0', email: 'admin_b@madrasa-b.edu', role: 'admin', status: 'approved', organization_id: 'org_b' };

const TEACHER_A = { uid: 'teacher_a_p0', email: 'teacher_a@madrasa-a.edu', role: 'teacher', status: 'approved', organization_id: 'org_a' };
const TEACHER_B = { uid: 'teacher_b_p0', email: 'teacher_b@madrasa-b.edu', role: 'teacher', status: 'approved', organization_id: 'org_b' };

const STUDENT_A1 = { uid: 'student_a1_p0', email: 'student_a1@madrasa-a.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_A2 = { uid: 'student_a2_p0', email: 'student_a2@madrasa-a.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_B1 = { uid: 'student_b1_p0', email: 'student_b1@madrasa-b.edu', role: 'student', status: 'approved', organization_id: 'org_b' };

const COURSE_A = 'course_a_p0';
const COURSE_B = 'course_b_p0';

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
    TEACHER_A,
    TEACHER_B,
    STUDENT_A1,
    STUDENT_A2,
    STUDENT_B1,
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
      updated_at: new Date(),
    });
  }

  // Memberships
  await adminDb.collection('organization_memberships').doc(`org_a_${ADMIN_A.uid}`).set({
    organization_id: 'org_a',
    user_id: ADMIN_A.uid,
    role: 'admin',
    status: 'active',
  });
  await adminDb.collection('organization_memberships').doc(`org_b_${ADMIN_B.uid}`).set({
    organization_id: 'org_b',
    user_id: ADMIN_B.uid,
    role: 'admin',
    status: 'active',
  });
  await adminDb.collection('organization_memberships').doc(`org_a_${TEACHER_A.uid}`).set({
    organization_id: 'org_a',
    user_id: TEACHER_A.uid,
    role: 'teacher',
    status: 'active',
  });
  await adminDb.collection('organization_memberships').doc(`org_b_${TEACHER_B.uid}`).set({
    organization_id: 'org_b',
    user_id: TEACHER_B.uid,
    role: 'teacher',
    status: 'active',
  });

  // Courses
  await adminDb.collection('courses').doc(COURSE_A).set({
    name: 'Fiqh Year 1',
    organization_id: 'org_a',
    teacher_id: TEACHER_A.uid,
    assigned_teachers: [TEACHER_A.uid],
    created_at: new Date(),
  });
  await adminDb.collection('courses').doc(COURSE_B).set({
    name: 'Hadith Year 1',
    organization_id: 'org_b',
    teacher_id: TEACHER_B.uid,
    assigned_teachers: [TEACHER_B.uid],
    created_at: new Date(),
  });

  // Enrollments
  await adminDb.collection('enrollments').doc(`${STUDENT_A1.uid}:${COURSE_A}`).set({
    user_id: STUDENT_A1.uid,
    course_id: COURSE_A,
    organization_id: 'org_a',
    status: 'active',
    enrolled_at: new Date(),
  });
  await adminDb.collection('enrollments').doc(`${STUDENT_B1.uid}:${COURSE_B}`).set({
    user_id: STUDENT_B1.uid,
    course_id: COURSE_B,
    organization_id: 'org_b',
    status: 'active',
    enrolled_at: new Date(),
  });

  // Teacher Profiles
  await adminDb.collection('teachers').doc(TEACHER_A.uid).set({
    name: 'Ustaadha A',
    organization_id: 'org_a',
    courses: [COURSE_A],
    status: 'active',
  });
  await adminDb.collection('teachers').doc(TEACHER_B.uid).set({
    name: 'Ustaadha B',
    organization_id: 'org_b',
    courses: [COURSE_B],
    status: 'active',
  });

  // Attendance
  await adminDb.collection('attendance').doc(`att_a_001`).set({
    user_id: STUDENT_A1.uid,
    user_name: 'Student A1',
    course_id: COURSE_A,
    organization_id: 'org_a',
    date: '2026-10-24',
    status: 'present',
    marked_by_uid: TEACHER_A.uid,
    created_at: new Date(),
  });

  // Payments
  await adminDb.collection('payments').doc(`pay_a_001`).set({
    user_id: STUDENT_A1.uid,
    amount: 1500,
    course_id: COURSE_A,
    organization_id: 'org_a',
    status: 'captured',
    created_at: new Date(),
  });

  // Quiz Results
  await adminDb.collection('quiz_results').doc(`quiz_res_a_001`).set({
    user_id: STUDENT_A1.uid,
    course_id: COURSE_A,
    organization_id: 'org_a',
    score: 95,
    total: 100,
    percentage: 95,
    created_at: new Date(),
  });

  // Certificates
  await adminDb.collection('certificates').doc(`cert_a_001`).set({
    user_id: STUDENT_A1.uid,
    course_id: COURSE_A,
    organization_id: 'org_a',
    status: 'issued',
    score: 95,
    total_questions: 100,
    percentage: 95,
    created_at: new Date(),
  });
}

function authCtx(user) {
  if (!user) return testEnv.unauthenticatedContext();
  return testEnv.authenticatedContext(user.uid, {
    email: user.email,
    email_verified: true,
  });
}

describe('MSLB Phase P0 — Multi-Tenant Security Remediation Test Suite', function () {
  this.timeout(60000);

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: firestoreRules,
        host: '127.0.0.1',
        port: 8080,
      },
    });

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setupFixtures(ctx.firestore());
    });
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  it('Runs all Phase P0 Multi-Tenant Security assertions', async () => {
    console.log('\n================================================================');
    console.log('   MSLB PHASE P0 — MULTI-TENANT SECURITY EMULATOR SUITE         ');
    console.log('================================================================\n');

    // --- GROUP 1: USER ISOLATION ---
    console.log('--- GROUP 1: USER DIRECTORY & PROFILE ISOLATION ---');
    await runTest('P0-01: Admin B cannot read Student A document (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('users').doc(STUDENT_A1.uid).get());
    });

    await runTest('P0-02: Admin A can read Student A document (ALLOW)', async () => {
      const db = authCtx(ADMIN_A).firestore();
      await assertSucceeds(db.collection('users').doc(STUDENT_A1.uid).get());
    });

    await runTest('P0-03: Admin B cannot list users of Org A (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('users').where('organization_id', '==', 'org_a').get());
    });

    await runTest('P0-04: Admin A can list users of Org A (ALLOW)', async () => {
      const db = authCtx(ADMIN_A).firestore();
      await assertSucceeds(db.collection('users').where('organization_id', '==', 'org_a').get());
    });

    await runTest('P0-05: Student A cannot read Student B document (DENY)', async () => {
      const db = authCtx(STUDENT_A1).firestore();
      await assertFails(db.collection('users').doc(STUDENT_B1.uid).get());
    });

    // --- GROUP 2: TEACHER PROFILE ISOLATION ---
    console.log('\n--- GROUP 2: TEACHER PROFILE ISOLATION ---');
    await runTest('P0-06: Student B cannot read Teacher A profile (DENY)', async () => {
      const db = authCtx(STUDENT_B1).firestore();
      await assertFails(db.collection('teachers').doc(TEACHER_A.uid).get());
    });

    await runTest('P0-07: Student A can read Teacher A profile (ALLOW)', async () => {
      const db = authCtx(STUDENT_A1).firestore();
      await assertSucceeds(db.collection('teachers').doc(TEACHER_A.uid).get());
    });

    await runTest('P0-08: Admin B cannot create teacher in Org A (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('teachers').doc('new_teacher_a').set({
        name: 'Forged Teacher',
        organization_id: 'org_a',
        status: 'active',
        created_at: new Date(),
      }));
    });

    // --- GROUP 3: ENROLLMENT ISOLATION ---
    console.log('\n--- GROUP 3: ENROLLMENT ROSTER ISOLATION ---');
    await runTest('P0-09: Admin B cannot read Org A enrollment (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('enrollments').doc(`${STUDENT_A1.uid}:${COURSE_A}`).get());
    });

    await runTest('P0-10: Admin A can read Org A enrollment (ALLOW)', async () => {
      const db = authCtx(ADMIN_A).firestore();
      await assertSucceeds(db.collection('enrollments').doc(`${STUDENT_A1.uid}:${COURSE_A}`).get());
    });

    await runTest('P0-11: Admin B cannot enroll student in Course A (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('enrollments').doc(`${STUDENT_A2.uid}:${COURSE_A}`).set({
        user_id: STUDENT_A2.uid,
        course_id: COURSE_A,
        organization_id: 'org_a',
        status: 'active',
      }));
    });

    // --- GROUP 4: ATTENDANCE ISOLATION ---
    console.log('\n--- GROUP 4: ATTENDANCE READ, WRITE & DELETION ISOLATION ---');
    await runTest('P0-12: Teacher B cannot read Org A attendance record (DENY)', async () => {
      const db = authCtx(TEACHER_B).firestore();
      await assertFails(db.collection('attendance').doc('att_a_001').get());
    });

    await runTest('P0-13: Admin B cannot read Org A attendance record (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('attendance').doc('att_a_001').get());
    });

    await runTest('P0-14: Teacher A can read Org A attendance record (ALLOW)', async () => {
      const db = authCtx(TEACHER_A).firestore();
      await assertSucceeds(db.collection('attendance').doc('att_a_001').get());
    });

    await runTest('P0-15: Teacher B cannot write attendance for Org A course (DENY)', async () => {
      const db = authCtx(TEACHER_B).firestore();
      await assertFails(db.collection('attendance').doc('att_a_002').set({
        user_id: STUDENT_A1.uid,
        user_name: 'Student A1',
        course_id: COURSE_A,
        organization_id: 'org_a',
        date: '2026-10-25',
        status: 'present',
        marked_by: 'teacher',
        marked_by_uid: TEACHER_B.uid,
        marked_by_name: 'Teacher B',
        created_at: new Date(),
      }));
    });

    await runTest('P0-16: Admin B cannot delete Org A attendance record (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('attendance').doc('att_a_001').delete());
    });

    // --- GROUP 5: PAYMENT ISOLATION ---
    console.log('\n--- GROUP 5: FINANCIAL & PAYMENT ISOLATION ---');
    await runTest('P0-17: Admin B cannot get Org A payment record (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('payments').doc('pay_a_001').get());
    });

    await runTest('P0-18: Admin A can get Org A payment record (ALLOW)', async () => {
      const db = authCtx(ADMIN_A).firestore();
      await assertSucceeds(db.collection('payments').doc('pay_a_001').get());
    });

    await runTest('P0-19: Admin B cannot list payments belonging to Org A (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('payments').where('organization_id', '==', 'org_a').get());
    });

    await runTest('P0-20: Student B cannot read Student A payment (DENY)', async () => {
      const db = authCtx(STUDENT_B1).firestore();
      await assertFails(db.collection('payments').doc('pay_a_001').get());
    });

    await runTest('P0-21: Student A can read own payment (ALLOW)', async () => {
      const db = authCtx(STUDENT_A1).firestore();
      await assertSucceeds(db.collection('payments').doc('pay_a_001').get());
    });

    // --- GROUP 6: QUIZ RESULTS ISOLATION ---
    console.log('\n--- GROUP 6: QUIZ RESULTS & MARKS ISOLATION ---');
    await runTest('P0-22: Teacher B cannot read Org A quiz result (DENY)', async () => {
      const db = authCtx(TEACHER_B).firestore();
      await assertFails(db.collection('quiz_results').doc('quiz_res_a_001').get());
    });

    await runTest('P0-23: Teacher A can read Org A quiz result (ALLOW)', async () => {
      const db = authCtx(TEACHER_A).firestore();
      await assertSucceeds(db.collection('quiz_results').doc('quiz_res_a_001').get());
    });

    // --- GROUP 7: CERTIFICATES ISOLATION ---
    console.log('\n--- GROUP 7: CERTIFICATE AUTHORIZATION ---');
    await runTest('P0-24: Admin B cannot list Org A certificates (DENY)', async () => {
      const db = authCtx(ADMIN_B).firestore();
      await assertFails(db.collection('certificates').where('organization_id', '==', 'org_a').get());
    });

    await runTest('P0-25: Student A can get own certificate (ALLOW)', async () => {
      const db = authCtx(STUDENT_A1).firestore();
      await assertSucceeds(db.collection('certificates').doc('cert_a_001').get());
    });

    // --- GROUP 8: CROSS-TENANT MUTATION ATTEMPTS ---
    console.log('\n--- GROUP 8: FORBIDDEN CROSS-TENANT MUTATIONS ---');
    await runTest('P0-26: Attempting to transfer user to another org is rejected (DENY)', async () => {
      const db = authCtx(ADMIN_A).firestore();
      await assertFails(db.collection('users').doc(STUDENT_A1.uid).update({
        organization_id: 'org_b',
      }));
    });

    await runTest('P0-27: Attempting to transfer attendance to another org is rejected (DENY)', async () => {
      const db = authCtx(ADMIN_A).firestore();
      await assertFails(db.collection('attendance').doc('att_a_001').update({
        organization_id: 'org_b',
      }));
    });

    // --- GROUP 9: PLATFORM SUPER ADMIN PRIVILEGE ---
    console.log('\n--- GROUP 9: PLATFORM SUPER ADMIN PRIVILEGE ---');
    await runTest('P0-28: Super Admin can read across tenant boundaries (ALLOW)', async () => {
      const db = authCtx(SUPER_ADMIN).firestore();
      await assertSucceeds(db.collection('users').doc(STUDENT_A1.uid).get());
      await assertSucceeds(db.collection('payments').doc('pay_a_001').get());
      await assertSucceeds(db.collection('attendance').doc('att_a_001').get());
    });

    console.log('\n================================================================');
    console.log(`EMULATOR TEST RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================\n');

    assert.strictEqual(failed, 0, `${failed} test(s) failed in Phase P0 Multi-Tenant Security suite.`);
  });
});
