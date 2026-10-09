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
    // 1. Anonymous user (not in /users/{uid}) submits valid deletion request with email
    const anonContext = testEnv.authenticatedContext('anon_user_123');
    const db = anonContext.firestore();

    const validPublicRequest = {
      user_id: 'anon_user_123',
      email: 'user@example.com',
      type: 'deletion',
      reason: 'Please delete my account and associated records.',
      state: 'requested',
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

    console.log('\nAll public account deletion rule assertions PASSED (3/3)!');
  } finally {
    await testEnv.cleanup();
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
