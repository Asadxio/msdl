/**
 * PHASE 66 — TEACHER APPROVAL & WHATSAPP CONSENT SECURITY REGRESSION TEST SUITE
 * 
 * Verifies all 10 required security invariants:
 * TEST 1: Admin approving pending Teacher -> ALLOW
 * TEST 2: Admin approving Teacher containing whatsapp_consent=true -> ALLOW
 * TEST 3: Admin approving Teacher containing whatsapp_consent_at timestamp -> ALLOW
 * TEST 4: Normal Teacher attempting to change own status (pending -> approved) -> DENY
 * TEST 5: Student attempting to change own status to approved -> Intended behavior (ALLOW only if email_verified + student + pending; DENY if unverified or wrong fields)
 * TEST 6: Normal user attempting to modify another user's role -> DENY
 * TEST 7: Normal user attempting to modify another user's status -> DENY
 * TEST 8: Admin attempting to add an arbitrary unauthorized field -> DENY
 * TEST 9: User/Admin attempting whatsapp_consent = "true" (string instead of boolean) -> DENY
 * TEST 10: User/Admin attempting whatsapp_consent_at = "2026-09-30" (string instead of timestamp) -> DENY
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-mslb-test';
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const repoRoot = path.resolve(__dirname, '../../');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

async function runTests() {
  console.log('--- [STARTING PHASE 66 TEACHER APPROVAL SECURITY TESTS] ---');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  // Test identities
  const ADMIN = { uid: 'admin_user_66', email: 'admin@mslb.edu', role: 'admin', status: 'approved' };
  const TEACHER_1 = { uid: 'teacher_pending_1', email: 'teacher1@mslb.edu', role: 'teacher', status: 'pending' };
  const TEACHER_2 = { uid: 'teacher_wa_consent', email: 'teacher2@mslb.edu', role: 'teacher', status: 'pending' };
  const TEACHER_3 = { uid: 'teacher_wa_ts', email: 'teacher3@mslb.edu', role: 'teacher', status: 'pending' };
  const TEACHER_SELF = { uid: 'teacher_self_66', email: 'teacherself@mslb.edu', role: 'teacher', status: 'pending' };
  const STUDENT_UNVERIFIED = { uid: 'student_unverified', email: 'studentunverified@mslb.edu', role: 'student', status: 'pending' };
  const STUDENT_VERIFIED = { uid: 'student_verified', email: 'studentverified@mslb.edu', role: 'student', status: 'pending' };
  const NORMAL_USER = { uid: 'normal_user_66', email: 'normal@mslb.edu', role: 'student', status: 'approved' };
  const TARGET_USER = { uid: 'target_user_66', email: 'target@mslb.edu', role: 'student', status: 'pending' };

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Admin
    await db.collection('users').doc(ADMIN.uid).set({
      uid: ADMIN.uid,
      name: 'Admin User',
      email: ADMIN.email,
      role: ADMIN.role,
      status: ADMIN.status,
      organization_id: 'mslb-main',
      created_at: new Date(),
    });

    // Teacher 1: Standard pending teacher without WA
    await db.collection('users').doc(TEACHER_1.uid).set({
      uid: TEACHER_1.uid,
      name: 'Teacher One',
      email: TEACHER_1.email,
      role: TEACHER_1.role,
      status: TEACHER_1.status,
      created_at: new Date(),
    });

    // Teacher 2: Pending teacher with whatsapp_consent = true
    await db.collection('users').doc(TEACHER_2.uid).set({
      uid: TEACHER_2.uid,
      name: 'Teacher Two WA',
      email: TEACHER_2.email,
      role: TEACHER_2.role,
      status: TEACHER_2.status,
      created_at: new Date(),
      whatsapp_consent: true,
    });

    // Teacher 3: Pending teacher with whatsapp_consent_at timestamp + whatsapp_consent = true (Real signup)
    await db.collection('users').doc(TEACHER_3.uid).set({
      uid: TEACHER_3.uid,
      name: 'Teacher Three WA Full',
      email: TEACHER_3.email,
      role: TEACHER_3.role,
      status: TEACHER_3.status,
      referral_code: 'TEACH3',
      referred_by: null,
      referral_count: 0,
      last_login_at: new Date(),
      created_at: new Date(),
      is_minor: false,
      age_bracket: '18_plus',
      phone: '+919876543210',
      whatsapp_consent: true,
      whatsapp_consent_at: new Date(),
    });

    // Teacher Self: for self-approve testing
    await db.collection('users').doc(TEACHER_SELF.uid).set({
      uid: TEACHER_SELF.uid,
      name: 'Teacher Self',
      email: TEACHER_SELF.email,
      role: TEACHER_SELF.role,
      status: TEACHER_SELF.status,
      created_at: new Date(),
    });

    // Student Unverified
    await db.collection('users').doc(STUDENT_UNVERIFIED.uid).set({
      uid: STUDENT_UNVERIFIED.uid,
      name: 'Student Unverified',
      email: STUDENT_UNVERIFIED.email,
      role: STUDENT_UNVERIFIED.role,
      status: STUDENT_UNVERIFIED.status,
      created_at: new Date(),
    });

    // Student Verified
    await db.collection('users').doc(STUDENT_VERIFIED.uid).set({
      uid: STUDENT_VERIFIED.uid,
      name: 'Student Verified',
      email: STUDENT_VERIFIED.email,
      role: STUDENT_VERIFIED.role,
      status: STUDENT_VERIFIED.status,
      created_at: new Date(),
    });

    // Normal User
    await db.collection('users').doc(NORMAL_USER.uid).set({
      uid: NORMAL_USER.uid,
      name: 'Normal User',
      email: NORMAL_USER.email,
      role: NORMAL_USER.role,
      status: NORMAL_USER.status,
      created_at: new Date(),
    });

    // Target User
    await db.collection('users').doc(TARGET_USER.uid).set({
      uid: TARGET_USER.uid,
      name: 'Target User',
      email: TARGET_USER.email,
      role: TARGET_USER.role,
      status: TARGET_USER.status,
      created_at: new Date(),
    });
  });

  const adminDb = testEnv.authenticatedContext(ADMIN.uid, { email: ADMIN.email, email_verified: true }).firestore();
  const teacherSelfDb = testEnv.authenticatedContext(TEACHER_SELF.uid, { email: TEACHER_SELF.email, email_verified: true }).firestore();
  const studentUnverifiedDb = testEnv.authenticatedContext(STUDENT_UNVERIFIED.uid, { email: STUDENT_UNVERIFIED.email, email_verified: false }).firestore();
  const studentVerifiedDb = testEnv.authenticatedContext(STUDENT_VERIFIED.uid, { email: STUDENT_VERIFIED.email, email_verified: true }).firestore();
  const normalUserDb = testEnv.authenticatedContext(NORMAL_USER.uid, { email: NORMAL_USER.email, email_verified: true }).firestore();

  let passedCount = 0;
  let failedCount = 0;

  async function check(testId, description, expected, fn) {
    try {
      if (expected === 'ALLOW') {
        await assertSucceeds(fn());
      } else {
        await assertFails(fn());
      }
      console.log(`  [PASS] ${testId}: ${description} -> ${expected}`);
      passedCount++;
    } catch (err) {
      console.error(`  [FAIL] ${testId}: ${description} -> Expected ${expected} but got error: ${err.message}`);
      failedCount++;
    }
  }

  // TEST 1: Admin approving pending Teacher
  await check('TEST 1', 'Admin approving pending Teacher without extra fields', 'ALLOW', () =>
    adminDb.collection('users').doc(TEACHER_1.uid).update({
      status: 'approved',
      organization_id: 'mslb-main',
      updated_at: new Date(),
    })
  );

  // TEST 2: Admin approving Teacher containing whatsapp_consent=true
  await check('TEST 2', 'Admin approving Teacher containing whatsapp_consent=true', 'ALLOW', () =>
    adminDb.collection('users').doc(TEACHER_2.uid).update({
      status: 'approved',
      organization_id: 'mslb-main',
      updated_at: new Date(),
    })
  );

  // TEST 3: Admin approving Teacher containing whatsapp_consent_at timestamp
  await check('TEST 3', 'Admin approving Teacher containing whatsapp_consent_at timestamp', 'ALLOW', () =>
    adminDb.collection('users').doc(TEACHER_3.uid).update({
      status: 'approved',
      organization_id: 'mslb-main',
      updated_at: new Date(),
    })
  );

  // TEST 4: Normal Teacher attempting to change own status
  await check('TEST 4', 'Normal Teacher attempting to self-approve (pending -> approved)', 'DENY', () =>
    teacherSelfDb.collection('users').doc(TEACHER_SELF.uid).update({
      status: 'approved',
    })
  );

  // TEST 5: Student attempting to change own status to approved
  // 5a: Unverified student attempting to approve self -> DENY
  await check('TEST 5a', 'Unverified Student attempting to self-approve', 'DENY', () =>
    studentUnverifiedDb.collection('users').doc(STUDENT_UNVERIFIED.uid).update({
      status: 'approved',
      updated_at: new Date(),
    })
  );

  // 5b: Email verified student using isValidEmailVerifiedStudentActivation flow -> ALLOW
  await check('TEST 5b', 'Email-verified Student using legitimate activation flow', 'ALLOW', () =>
    studentVerifiedDb.collection('users').doc(STUDENT_VERIFIED.uid).update({
      status: 'approved',
      updated_at: new Date(),
    })
  );

  // TEST 6: Normal user attempting to modify another user's role
  await check('TEST 6', 'Normal user attempting to modify another user role to admin', 'DENY', () =>
    normalUserDb.collection('users').doc(TARGET_USER.uid).update({
      role: 'admin',
    })
  );

  // TEST 7: Normal user attempting to modify another user's status
  await check('TEST 7', 'Normal user attempting to modify another user status to approved', 'DENY', () =>
    normalUserDb.collection('users').doc(TARGET_USER.uid).update({
      status: 'approved',
    })
  );

  // TEST 8: Admin attempting to add an arbitrary unauthorized field
  await check('TEST 8', 'Admin attempting to write arbitrary unauthorized field (hacked_field)', 'DENY', () =>
    adminDb.collection('users').doc(TARGET_USER.uid).update({
      hacked_field: 'unauthorized_payload',
      updated_at: new Date(),
    })
  );

  // TEST 9: Attempting whatsapp_consent = "true" (string instead of boolean)
  await check('TEST 9', 'Attempting whatsapp_consent as string "true" instead of bool', 'DENY', () =>
    adminDb.collection('users').doc(TARGET_USER.uid).update({
      whatsapp_consent: 'true',
      updated_at: new Date(),
    })
  );

  // TEST 10: Attempting whatsapp_consent_at = "2026-09-30" (string instead of timestamp)
  await check('TEST 10', 'Attempting whatsapp_consent_at as string "2026-09-30" instead of timestamp', 'DENY', () =>
    adminDb.collection('users').doc(TARGET_USER.uid).update({
      whatsapp_consent_at: '2026-09-30',
      updated_at: new Date(),
    })
  );

  await testEnv.cleanup();

  console.log('\n--- [TEST SUMMARY] ---');
  console.log(`Total tests: ${passedCount + failedCount}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
