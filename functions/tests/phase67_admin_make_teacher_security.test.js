'use strict';

/**
 * PHASE 67 — ADMIN "MAKE TEACHER" SECURITY & RBAC REGRESSION SUITE
 *
 * Verifies that:
 * 1. Admin can change Student -> Teacher across all legitimate profile states
 *    (approved, pending, active, with whatsapp_consent, name_updated_at, imported metadata, moderation metadata).
 * 2. All existing fields on the student document remain preserved.
 * 3. Normal users (students, teachers) cannot self-elevate or modify other users' roles.
 * 4. Regular Admins cannot promote users to Admin/Super Admin (strictly gated to Super Admin).
 * 5. Injection of arbitrary unauthorized fields during role updates is strictly rejected.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-mslb-test';
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const repoRoot = path.resolve(__dirname, '../../');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

async function run() {
  console.log('--- [STARTING PHASE 67 ADMIN "MAKE TEACHER" SECURITY TESTS] ---');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  const ADMIN_UID = 'admin_user_67';
  const SUPER_ADMIN_UID = 'super_admin_user_67';
  const TEACHER_UID = 'teacher_user_67';

  const S_APPROVED = 'student_approved_67';
  const S_PENDING = 'student_pending_67';
  const S_ACTIVE = 'student_active_67';
  const S_WITH_WA = 'student_wa_67';
  const S_NAME_UPDATED = 'student_name_updated_67';
  const S_IMPORTED = 'student_imported_67';
  const S_MODERATED = 'student_moderated_67';
  const S_TARGET_2 = 'student_target_2_67';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Admin
    await db.collection('users').doc(ADMIN_UID).set({
      uid: ADMIN_UID,
      name: 'Operations Admin',
      email: 'admin67@mslb.edu',
      role: 'admin',
      status: 'approved',
      organization_id: 'mslb-main',
      created_at: new Date(),
    });

    // Super Admin
    await db.collection('users').doc(SUPER_ADMIN_UID).set({
      uid: SUPER_ADMIN_UID,
      name: 'Super Admin',
      email: 'super67@mslb.edu',
      role: 'super_admin',
      status: 'approved',
      organization_id: 'mslb-main',
      created_at: new Date(),
    });

    // Teacher
    await db.collection('users').doc(TEACHER_UID).set({
      uid: TEACHER_UID,
      name: 'Teacher Zaynab',
      email: 'zaynab67@mslb.edu',
      role: 'teacher',
      status: 'approved',
      organization_id: 'mslb-main',
      created_at: new Date(),
    });

    // Student 1: Approved
    await db.collection('users').doc(S_APPROVED).set({
      uid: S_APPROVED,
      name: 'Aisha Student',
      email: 'aisha67@mslb.edu',
      role: 'student',
      status: 'approved',
      referral_code: 'AISHA67',
      referred_by: null,
      referral_count: 0,
      created_at: new Date(),
      is_minor: false,
      age_bracket: '18_plus',
      organization_id: 'mslb-main',
    });

    // Student 2: Pending
    await db.collection('users').doc(S_PENDING).set({
      uid: S_PENDING,
      name: 'Khadija Pending',
      email: 'khadija67@mslb.edu',
      role: 'student',
      status: 'pending',
      referral_code: 'KHADIJA67',
      referred_by: null,
      referral_count: 0,
      created_at: new Date(),
      is_minor: false,
      age_bracket: '18_plus',
      organization_id: 'mslb-main',
    });

    // Student 3: Active Status
    await db.collection('users').doc(S_ACTIVE).set({
      uid: S_ACTIVE,
      name: 'Hafsa Active',
      email: 'hafsa67@mslb.edu',
      role: 'student',
      status: 'active',
      referral_code: 'HAFSA67',
      referred_by: null,
      referral_count: 0,
      created_at: new Date(),
      is_minor: false,
      age_bracket: '18_plus',
      organization_id: 'mslb-main',
    });

    // Student 4: With WhatsApp consent
    await db.collection('users').doc(S_WITH_WA).set({
      uid: S_WITH_WA,
      name: 'Fatima WA',
      email: 'fatima67@mslb.edu',
      role: 'student',
      status: 'approved',
      referral_code: 'FATIMA67',
      referred_by: null,
      referral_count: 0,
      created_at: new Date(),
      is_minor: false,
      age_bracket: '18_plus',
      phone: '+919876543210',
      whatsapp_consent: true,
      whatsapp_consent_at: new Date(),
      organization_id: 'mslb-main',
    });

    // Student 5: With name_updated_at
    await db.collection('users').doc(S_NAME_UPDATED).set({
      uid: S_NAME_UPDATED,
      name: 'Maryam Renamed',
      email: 'maryam67@mslb.edu',
      role: 'student',
      status: 'approved',
      referral_code: 'MARYAM67',
      referred_by: null,
      referral_count: 0,
      created_at: new Date(),
      is_minor: false,
      age_bracket: '18_plus',
      name_updated_at: new Date(),
      organization_id: 'mslb-main',
    });

    // Student 6: Imported via CSV
    await db.collection('users').doc(S_IMPORTED).set({
      uid: S_IMPORTED,
      name: 'Asma Imported',
      email: 'asma67@mslb.edu',
      role: 'student',
      status: 'approved',
      imported_by: ADMIN_UID,
      imported_at: new Date(),
      created_at: new Date(),
      organization_id: 'mslb-main',
    });

    // Student 7: Moderated/Warned
    await db.collection('users').doc(S_MODERATED).set({
      uid: S_MODERATED,
      name: 'Sumayya Moderated',
      email: 'sumayya67@mslb.edu',
      role: 'student',
      status: 'approved',
      moderation_state: 'warn_user',
      moderation_reason: 'Spamming message group',
      moderated_at: new Date(),
      created_at: new Date(),
      organization_id: 'mslb-main',
    });

    // Student 8: Another student for cross-user tests
    await db.collection('users').doc(S_TARGET_2).set({
      uid: S_TARGET_2,
      name: 'Target Student',
      email: 'target67@mslb.edu',
      role: 'student',
      status: 'approved',
      created_at: new Date(),
      organization_id: 'mslb-main',
    });
  });

  const adminCtx = testEnv.authenticatedContext(ADMIN_UID, { email: 'admin67@mslb.edu', email_verified: true });
  const adminDb = adminCtx.firestore();

  const superAdminCtx = testEnv.authenticatedContext(SUPER_ADMIN_UID, { email: 'super67@mslb.edu', email_verified: true });
  const superAdminDb = superAdminCtx.firestore();

  const studentCtx = testEnv.authenticatedContext(S_APPROVED, { email: 'aisha67@mslb.edu', email_verified: true });
  const studentDb = studentCtx.firestore();

  const teacherCtx = testEnv.authenticatedContext(TEACHER_UID, { email: 'zaynab67@mslb.edu', email_verified: true });
  const teacherDb = teacherCtx.firestore();

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

  // TEST 1: Approved Student -> Admin makes Teacher -> ALLOW
  await test('TEST 1: Approved Student -> Admin makes Teacher -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_APPROVED).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 2: Pending Student -> Admin makes Teacher -> ALLOW
  await test('TEST 2: Pending Student -> Admin makes Teacher -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_PENDING).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 3: Normal Student -> self changes role to teacher -> DENY
  await test('TEST 3: Normal Student -> self changes role to teacher -> DENY', async () => {
    await assertFails(studentDb.collection('users').doc(S_APPROVED).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 4: Normal Student -> changes another user role -> DENY
  await test('TEST 4: Normal Student -> changes another user role -> DENY', async () => {
    await assertFails(studentDb.collection('users').doc(S_TARGET_2).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 5: Regular Admin making Student -> Admin -> DENY (Super Admin only)
  await test('TEST 5: Regular Admin making Student -> Admin -> DENY', async () => {
    await assertFails(adminDb.collection('users').doc(S_TARGET_2).update({
      role: 'admin',
      updated_at: new Date(),
    }));
  });

  // TEST 5b: Super Admin making Student -> Admin -> ALLOW
  await test('TEST 5b: Super Admin making Student -> Admin -> ALLOW', async () => {
    await assertSucceeds(superAdminDb.collection('users').doc(S_TARGET_2).update({
      role: 'admin',
      updated_at: new Date(),
    }));
  });

  // TEST 6: Teacher -> Admin self-elevation -> DENY
  await test('TEST 6: Teacher -> Admin self-elevation -> DENY', async () => {
    await assertFails(teacherDb.collection('users').doc(TEACHER_UID).update({
      role: 'admin',
      updated_at: new Date(),
    }));
  });

  // TEST 7: Student with whatsapp_consent preserved across role transition -> ALLOW & verify preservation
  await test('TEST 7: Student with whatsapp_consent preserved across role transition -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_WITH_WA).update({
      role: 'teacher',
      updated_at: new Date(),
    }));

    // Verify fields were not overwritten or erased
    let snap;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const docSnap = await ctx.firestore().collection('users').doc(S_WITH_WA).get();
      snap = docSnap.data();
    });
    assert.ok(snap, 'User document must exist');
    assert.strictEqual(snap.role, 'teacher');
    assert.strictEqual(snap.whatsapp_consent, true);
    assert.strictEqual(snap.phone, '+919876543210');
    assert.strictEqual(snap.referral_code, 'FATIMA67');
  });

  // TEST 8: Student with name_updated_at -> Admin makes Teacher -> ALLOW
  await test('TEST 8: Student with name_updated_at -> Admin makes Teacher -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_NAME_UPDATED).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 9: Student with status = 'active' -> Admin makes Teacher -> ALLOW
  await test('TEST 9: Student with status = "active" -> Admin makes Teacher -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_ACTIVE).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 10: Student with moderation / import metadata -> Admin makes Teacher -> ALLOW
  await test('TEST 10: Student with imported metadata -> Admin makes Teacher -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_IMPORTED).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  await test('TEST 10b: Student with moderation metadata -> Admin makes Teacher -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('users').doc(S_MODERATED).update({
      role: 'teacher',
      updated_at: new Date(),
    }));
  });

  // TEST 11: Admin attempting arbitrary unauthorized field injection during role change -> DENY
  await test('TEST 11: Admin attempting unauthorized field injection during role update -> DENY', async () => {
    await assertFails(adminDb.collection('users').doc(S_APPROVED).update({
      role: 'teacher',
      unauthorized_hacked_field: 'exploit',
      updated_at: new Date(),
    }));
  });

  // TEST 12: Role transition audit log write by Admin -> ALLOW
  await test('TEST 12: Admin writes role_transition_audit_logs -> ALLOW', async () => {
    await assertSucceeds(adminDb.collection('role_transition_audit_logs').add({
      actor: 'admin67@mslb.edu',
      actor_role: 'admin',
      target_user: S_APPROVED,
      previous_role: 'student',
      new_role: 'teacher',
      reason: 'Promoted after interview',
      timestamp: new Date(),
      source: 'admin.users',
      request_id: 'req_test_67',
    }));
  });

  // TEST 13: Normal student writing role_transition_audit_logs -> DENY
  await test('TEST 13: Normal student writing role_transition_audit_logs -> DENY', async () => {
    await assertFails(studentDb.collection('role_transition_audit_logs').add({
      actor: 'aisha67@mslb.edu',
      actor_role: 'student',
      target_user: S_APPROVED,
      previous_role: 'student',
      new_role: 'teacher',
      timestamp: new Date(),
    }));
  });

  console.log('\n--- [PHASE 67 TEST SUMMARY] ---');
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
