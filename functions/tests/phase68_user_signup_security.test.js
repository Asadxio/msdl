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

async function run() {
  console.log('--- [STARTING PHASE 68 USER SIGNUP SECURITY TESTS] ---');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  const UID = 'sheikh_mohiuddin_uid';
  const EMAIL = 'sheikhmohiuddin551@gmail.com';

  // Test 1: Standard payload from AuthContext.tsx with email in auth token
  const studentCtx = testEnv.authenticatedContext(UID, {
    email: EMAIL,
    email_verified: false,
  });
  const db = studentCtx.firestore();

  const standardPayload = {
    name: 'Sheikh Mohiuddin',
    email: EMAIL,
    role: 'student',
    status: 'pending',
    referral_code: 'SHEIKH123',
    referred_by: null,
    referral_count: 0,
    last_login_at: new Date(),
    created_at: new Date(),
    is_minor: false,
    age_bracket: '18_plus',
    phone: '+919739304964',
    whatsapp_consent: true,
    whatsapp_consent_at: new Date(),
  };

  try {
    await assertSucceeds(db.collection('users').doc(UID).set(standardPayload));
    console.log('  [PASS] TEST 1: Standard signup payload with email in auth token -> ALLOW');
  } catch (err) {
    console.error('  [FAIL] TEST 1: Standard signup payload FAILED:', err.message);
  }

  // Test 1b: What if auth token does NOT have email? (e.g. phone or token without email claim)
  const noEmailCtx = testEnv.authenticatedContext('uid_no_email', {
    // email omitted
  });
  const dbNoEmail = noEmailCtx.firestore();
  try {
    await dbNoEmail.collection('users').doc('uid_no_email').set({
      ...standardPayload,
      email: 'noemail@example.com',
    });
    console.log('  [NOTE] TEST 1b: Auth token without email succeeded');
  } catch (err) {
    console.log('  [NOTE] TEST 1b: Auth token without email failed as expected:', err.message);
  }

  // Test 2: What about the next writes in AuthContext.tsx during signup?
  // 1. compliance/legal_acceptance
  try {
    await assertSucceeds(
      db.collection('users').doc(UID).collection('compliance').doc('legal_acceptance').set({
        accepted: {
          terms: { version: '2026-09-v1', acceptedAt: new Date() },
          privacy: { version: '2026-09-v1', acceptedAt: new Date() },
          community: { version: '2026-09-v1', acceptedAt: new Date() },
        },
        acceptance_updated_at: new Date(),
        policy_bundle_version: '2026-09-v1|2026-09-v1|2026-09-v1',
        is_minor: false,
        age_bracket: '18_plus',
      })
    );
    console.log('  [PASS] TEST 2: compliance/legal_acceptance -> ALLOW');
  } catch (err) {
    console.error('  [FAIL] TEST 2: compliance/legal_acceptance FAILED:', err.message);
  }

  // Test 3: public_profiles
  try {
    await assertSucceeds(
      db.collection('public_profiles').doc(UID).set({
        uid: UID,
        name: 'Sheikh Mohiuddin',
        role: 'student',
        status: 'pending',
        searchable: false,
        is_active: false,
        photo_url: '',
        avatar: 'person',
        updated_at: new Date(),
      })
    );
    console.log('  [PASS] TEST 3: public_profiles -> ALLOW');
  } catch (err) {
    console.error('  [FAIL] TEST 3: public_profiles FAILED:', err.message);
  }

  // Test 4: RACE CONDITION — Auto-heal creates minimal doc first, then signup setDoc runs
  const UID_RACE = 'race_user_uid';
  const EMAIL_RACE = 'raceuser@example.com';
  const raceCtx = testEnv.authenticatedContext(UID_RACE, {
    email: EMAIL_RACE,
    email_verified: false,
  });
  const dbRace = raceCtx.firestore();

  // 4a: Auto-heal creates the minimal document
  const autoHealPayload = {
    name: 'طالبہ',
    email: EMAIL_RACE,
    role: 'student',
    status: 'pending',
    referral_code: 'USER1234',
    referred_by: null,
    referral_count: 0,
    last_login_at: new Date(),
    created_at: new Date(),
    is_minor: false,
    age_bracket: '18_plus',
  };
  await assertSucceeds(dbRace.collection('users').doc(UID_RACE).set(autoHealPayload));
  console.log('  [PASS] TEST 4a: Auto-heal created minimal doc -> ALLOW');

  // 4b: Now signup setDoc runs with the real user profile data (name, phone, whatsapp_consent)
  const fullSignupPayload = {
    name: 'Sheikh Mohiuddin',
    email: EMAIL_RACE,
    role: 'student',
    status: 'pending',
    referral_code: 'SHEIKH123',
    referred_by: null,
    referral_count: 0,
    last_login_at: new Date(),
    created_at: new Date(),
    is_minor: false,
    age_bracket: '18_plus',
    phone: '+919739304964',
    whatsapp_consent: true,
    whatsapp_consent_at: new Date(),
  };

  try {
    await assertSucceeds(dbRace.collection('users').doc(UID_RACE).set(fullSignupPayload));
    console.log('  [PASS] TEST 4b: Signup setDoc over auto-healed doc -> ALLOW');
  } catch (err) {
    console.error('  [FAIL] TEST 4b: Signup setDoc over auto-healed doc FAILED:', err.message);
  }

  // TEST 5: Pending student attempting self-approval (status: 'approved') -> DENY
  try {
    await assertFails(dbRace.collection('users').doc(UID_RACE).set({
      ...fullSignupPayload,
      status: 'approved',
    }));
    console.log('  [PASS] TEST 5: Pending student attempting self-approval -> DENY');
  } catch (err) {
    console.error('  [FAIL] TEST 5: Self-approval should have been DENIED:', err.message);
  }

  // TEST 6: Pending student attempting role elevation (role: 'teacher' or 'admin') -> DENY
  try {
    await assertFails(dbRace.collection('users').doc(UID_RACE).set({
      ...fullSignupPayload,
      role: 'admin',
    }));
    console.log('  [PASS] TEST 6: Pending student attempting role escalation -> DENY');
  } catch (err) {
    console.error('  [FAIL] TEST 6: Role escalation should have been DENIED:', err.message);
  }

  // TEST 7: Pending student attempting email modification -> DENY
  try {
    await assertFails(dbRace.collection('users').doc(UID_RACE).set({
      ...fullSignupPayload,
      email: 'hacked@example.com',
    }));
    console.log('  [PASS] TEST 7: Pending student attempting email change -> DENY');
  } catch (err) {
    console.error('  [FAIL] TEST 7: Email change should have been DENIED:', err.message);
  }

  // TEST 8: Other student attempting to modify pending student doc -> DENY
  try {
    await assertFails(db.collection('users').doc(UID_RACE).set(fullSignupPayload));
    console.log('  [PASS] TEST 8: Cross-user pending student doc modification -> DENY');
  } catch (err) {
    console.error('  [FAIL] TEST 8: Cross-user write should have been DENIED:', err.message);
  }

  // TEST 9: Pending student injecting unauthorized key -> DENY
  try {
    await assertFails(dbRace.collection('users').doc(UID_RACE).set({
      ...fullSignupPayload,
      is_admin: true,
    }));
    console.log('  [PASS] TEST 9: Pending student injecting unauthorized key -> DENY');
  } catch (err) {
    console.error('  [FAIL] TEST 9: Unauthorized key should have been DENIED:', err.message);
  }

  await testEnv.cleanup();
  console.log('--- [DONE PHASE 68 USER SIGNUP TESTS] ---');
}

run().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
