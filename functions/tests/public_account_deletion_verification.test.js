const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('--- Testing Public Account Deletion Rules ---');
  const rulesPath = path.resolve(__dirname, '../../firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'madrasa-app-50d6c',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  try {
    // 1. Anonymous user submits valid deletion request with email and unverified status
    const anonContext = testEnv.authenticatedContext('anon_user_123');
    const db = anonContext.firestore();

    const validPublicRequest = {
      user_id: 'anon_user_123',
      anonymous_requester_uid: 'anon_user_123',
      source: 'public_web',
      email: 'user@example.com',
      type: 'deletion',
      reason: 'Please delete my account and associated records.',
      state: 'requested',
      verification_status: 'unverified',
      target_uid: null,
      lifecycle: [{ state: 'requested', at: new Date().toISOString(), source: 'public_account_deletion_page' }],
      created_at: new Date(),
      updated_at: new Date(),
    };

    await assertSucceeds(
      db.collection('privacy_requests').add(validPublicRequest)
    );
    console.log('[PASS] Anonymous user with valid deletion payload can submit deletion request');

    // 2. Anonymous user submits with extra forbidden field -> MUST FAIL
    const invalidExtraFieldRequest = {
      ...validPublicRequest,
      unauthorized_field: 'hack',
    };
    await assertFails(
      db.collection('privacy_requests').add(invalidExtraFieldRequest)
    );
    console.log('[PASS] Submission with extra fields rejected');

    // 3. Anonymous user submits without email -> MUST FAIL
    const missingEmailRequest = {
      user_id: 'anon_user_123',
      type: 'deletion',
      reason: 'Please delete my account and associated records.',
      state: 'requested',
      lifecycle: [{ state: 'requested', at: new Date().toISOString(), source: 'public_account_deletion_page' }],
      created_at: new Date(),
      updated_at: new Date(),
    };
    await assertFails(
      db.collection('privacy_requests').add(missingEmailRequest)
    );
    console.log('[PASS] Anonymous submission without email rejected');

    // 4. Anonymous user attempts to inject a target_uid -> MUST FAIL
    const injectTargetUidRequest = {
      ...validPublicRequest,
      target_uid: 'victim_user_456',
    };
    await assertFails(
      db.collection('privacy_requests').add(injectTargetUidRequest)
    );
    console.log('[PASS] Anonymous attempt to inject target_uid rejected');

    // 5. Anonymous user attempts to self-verify -> MUST FAIL
    const selfVerifyRequest = {
      ...validPublicRequest,
      verification_status: 'verified',
    };
    await assertFails(
      db.collection('privacy_requests').add(selfVerifyRequest)
    );
    console.log('[PASS] Anonymous attempt to self-verify rejected');

    console.log('\nAll public account deletion rule assertions PASSED (5/5)!');
  } finally {
    await testEnv.cleanup();
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
