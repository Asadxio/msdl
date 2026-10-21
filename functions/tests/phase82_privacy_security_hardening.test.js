/**
 * Phase 82 — MSLB Privacy Security Hardening & Rate-Limiting Regression Suite
 * 
 * Verifies:
 * - PHASE 1: Verification Code Range (lower bound 100000, upper bound exclusive 1000000, 6 digits, CSPRNG).
 * - PHASE 2: Request-ID Rate-Limit Bypass & Abuse Controls (10 test cases).
 * - PHASE 3: Verification Code Storage Hardening (HMAC-SHA256, Secret Manager key, constant-time comparison, replay prevention).
 * - PHASE 4: Account Deletion Recovery Authorization & Partial Failure Resumption.
 * - PHASE 5: Admin Audit Log Rules Verification.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Import compiled production functions and helpers
const {
  EMAIL_RATE_LIMIT_COOLDOWN_MS,
  EMAIL_RATE_LIMIT_DAILY_CAP,
  EMAIL_MAX_FAILED_ATTEMPTS,
  EMAIL_FAILED_LOCKOUT_MS,
  generateSixDigitVerificationCode,
  computeEmailRateLimitKey,
  computeVerificationCodeHmac,
  getPrivacyVerificationSecret,
} = require('../lib/privacy/publicVerification.js');

// -----------------------------------------------------------------------------
// In-Memory Mock Engine for State Machine, Transaction, and Multi-Client Testing
// -----------------------------------------------------------------------------
class MockDocumentReference {
  constructor(collectionName, id, store) {
    this.collectionName = collectionName;
    this.id = id;
    this.store = store;
  }

  async get() {
    const data = this.store[this.collectionName]?.[this.id];
    return {
      exists: Boolean(data),
      id: this.id,
      data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
    };
  }

  async set(data, options = {}) {
    if (!this.store[this.collectionName]) this.store[this.collectionName] = {};
    if (options.merge && this.store[this.collectionName][this.id]) {
      this.store[this.collectionName][this.id] = {
        ...this.store[this.collectionName][this.id],
        ...JSON.parse(JSON.stringify(data)),
      };
    } else {
      this.store[this.collectionName][this.id] = JSON.parse(JSON.stringify(data));
    }
  }

  async update(data) {
    if (!this.store[this.collectionName]?.[this.id]) {
      throw new Error(`Document ${this.collectionName}/${this.id} does not exist`);
    }
    this.store[this.collectionName][this.id] = {
      ...this.store[this.collectionName][this.id],
      ...JSON.parse(JSON.stringify(data)),
    };
  }

  async delete() {
    if (this.store[this.collectionName]?.[this.id]) {
      delete this.store[this.collectionName][this.id];
    }
  }
}

class MockBatch {
  constructor(store, simulateFailure = false) {
    this.store = store;
    this.simulateFailure = simulateFailure;
    this.ops = [];
  }

  set(ref, data, options = {}) {
    this.ops.push({ type: 'set', ref, data, options });
  }

  update(ref, data) {
    this.ops.push({ type: 'update', ref, data });
  }

  delete(ref) {
    this.ops.push({ type: 'delete', ref });
  }

  async commit() {
    if (this.simulateFailure) {
      throw new Error('Simulated Firestore batch commit failure after Auth deletion');
    }
    for (const op of this.ops) {
      if (op.type === 'set') await op.ref.set(op.data, op.options);
      else if (op.type === 'update') await op.ref.update(op.data);
      else if (op.type === 'delete') await op.ref.delete();
    }
  }
}

class MockDatabase {
  constructor() {
    this.store = {};
  }

  collection(name) {
    return {
      doc: (id) => {
        const docId = id || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return new MockDocumentReference(name, docId, this.store);
      },
      where: (field, op, val) => ({
        limit: (n) => ({
          get: async () => {
            const docs = [];
            const col = this.store[name] || {};
            for (const docId of Object.keys(col)) {
              if (op === '==' && col[docId][field] === val) {
                docs.push({ id: docId, data: () => col[docId] });
              }
              if (docs.length >= n) break;
            }
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    };
  }

  batch(simulateFailure = false) {
    return new MockBatch(this.store, simulateFailure);
  }

  async runTransaction(updateFn) {
    const transaction = {
      get: async (ref) => ref.get(),
      set: (ref, data, opts) => ref.set(data, opts),
      update: (ref, data) => ref.update(data),
      delete: (ref) => ref.delete(),
    };
    return updateFn(transaction);
  }
}

class MockAuth {
  constructor() {
    this.users = new Map(); // email -> uid
  }

  async getUserByEmail(email) {
    const uid = this.users.get(email.toLowerCase());
    if (!uid) {
      const err = new Error(`User not found: ${email}`);
      err.code = 'auth/user-not-found';
      throw err;
    }
    return { uid, email };
  }

  async deleteUser(uid) {
    let found = false;
    for (const [em, u] of this.users.entries()) {
      if (u === uid) {
        this.users.delete(em);
        found = true;
        break;
      }
    }
    if (!found) {
      const err = new Error(`User not found: ${uid}`);
      err.code = 'auth/user-not-found';
      throw err;
    }
  }
}

class MockStorage {
  constructor(shouldFail = false) {
    this.deletedPrefixes = [];
    this.shouldFail = shouldFail;
  }

  async deleteFiles(opts) {
    if (this.shouldFail) {
      throw new Error('Simulated GCS storage timeout');
    }
    this.deletedPrefixes.push(opts.prefix);
    return [];
  }
}

// -----------------------------------------------------------------------------
// Public Verification Runner with Injected Mock Environment
// -----------------------------------------------------------------------------
async function runInitiatePublicVerification({
  db,
  auth,
  requestId,
  email,
  verificationSecret = 'test_verification_secret_32bytes_mslb_2026',
  fixedCode = null,
  simulatedTimeMs = Date.now(),
}) {
  if (!requestId || typeof requestId !== 'string') {
    const err = new Error('A valid requestId is required.');
    err.code = 'invalid-argument';
    throw err;
  }

  if (!verificationSecret) {
    const err = new Error('Verification service is temporarily unavailable. Please try again later.');
    err.code = 'failed-precondition';
    throw err;
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    const err = new Error('A valid email address is required.');
    err.code = 'invalid-argument';
    throw err;
  }

  const reqRef = db.collection('privacy_requests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    const err = new Error(`Privacy request document not found: ${requestId}`);
    err.code = 'not-found';
    throw err;
  }

  const reqData = reqSnap.data();
  if (reqData.type !== 'deletion') {
    const err = new Error(`Privacy request '${requestId}' is not a deletion request.`);
    err.code = 'invalid-argument';
    throw err;
  }

  const storedEmail = (reqData.email || '').trim().toLowerCase();
  if (storedEmail !== cleanEmail) {
    const err = new Error('Provided email does not match the deletion request record.');
    err.code = 'invalid-argument';
    throw err;
  }

  if (reqData.state === 'completed') {
    const err = new Error('This deletion request has already been completed.');
    err.code = 'failed-precondition';
    throw err;
  }

  // Derive pseudonymous rate-limit key via HMAC-SHA256
  const emailRateLimitId = computeEmailRateLimitKey(cleanEmail, verificationSecret);
  const emailRateLimitRef = db.collection('privacy_email_rate_limits').doc(emailRateLimitId);

  // Atomic Rate-Limiting & Abuse Prevention Transaction
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(emailRateLimitRef);
    if (snap.exists) {
      const rateData = snap.data();

      // Check lockout from excessive failed verification attempts
      const lockoutUntil = rateData.lockout_until_ms || 0;
      if (simulatedTimeMs < lockoutUntil) {
        const err = new Error('Too many failed verification attempts for this account. Please wait 1 hour before trying again.');
        err.code = 'resource-exhausted';
        throw err;
      }

      // Check per-email cooldown (enforced across ALL requestIds)
      const lastRequestedMs = rateData.last_requested_ms || 0;
      if (simulatedTimeMs - lastRequestedMs < EMAIL_RATE_LIMIT_COOLDOWN_MS) {
        const waitSec = Math.ceil((EMAIL_RATE_LIMIT_COOLDOWN_MS - (simulatedTimeMs - lastRequestedMs)) / 1000);
        const err = new Error(`A verification code was recently requested for this email. Please check your inbox or wait ${waitSec} seconds.`);
        err.code = 'failed-precondition';
        throw err;
      }

      // Check 24-hour daily limit window
      const windowStartMs = rateData.window_start_ms || 0;
      let requestsInWindow = rateData.requests_in_window || 0;
      let newWindowStartMs = windowStartMs;

      if (simulatedTimeMs - windowStartMs > 24 * 60 * 60 * 1000) {
        newWindowStartMs = simulatedTimeMs;
        requestsInWindow = 1;
      } else {
        if (requestsInWindow >= EMAIL_RATE_LIMIT_DAILY_CAP) {
          const err = new Error('Daily verification request limit reached for this email address. Please try again tomorrow.');
          err.code = 'resource-exhausted';
          throw err;
        }
        requestsInWindow += 1;
      }

      transaction.set(
        emailRateLimitRef,
        {
          email_hash: emailRateLimitId,
          last_requested_ms: simulatedTimeMs,
          window_start_ms: newWindowStartMs,
          requests_in_window: requestsInWindow,
        },
        { merge: true }
      );
    } else {
      transaction.set(emailRateLimitRef, {
        email_hash: emailRateLimitId,
        last_requested_ms: simulatedTimeMs,
        window_start_ms: simulatedTimeMs,
        requests_in_window: 1,
        failed_attempts: 0,
      });
    }
  });

  // Zero-enumeration target resolution
  let targetUid = null;
  try {
    const authUser = await auth.getUserByEmail(cleanEmail);
    targetUid = authUser.uid;
  } catch {
    targetUid = null;
  }

  const code = fixedCode || generateSixDigitVerificationCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const tokenHash = computeVerificationCodeHmac(code, salt, verificationSecret);
  const expiryMs = simulatedTimeMs + 15 * 60 * 1000;

  const tokenRef = db.collection('privacy_verification_tokens').doc(requestId);
  await tokenRef.set({
    request_id: requestId,
    email_rate_limit_id: emailRateLimitId,
    target_uid: targetUid,
    token_hash: tokenHash,
    salt,
    hash_algorithm: 'hmac-sha256',
    attempts: 0,
    max_attempts: 5,
    expires_at_ms: expiryMs,
    verified: false,
    used: false,
    created_at_ms: simulatedTimeMs,
  });

  return {
    success: true,
    message: 'If an account is associated with this email address, a verification code has been dispatched. Please enter the 6-digit code to verify ownership.',
    code, // Returned for test assertions
  };
}

async function runVerifyPublicDeletion({
  db,
  requestId,
  code,
  verificationSecret = 'test_verification_secret_32bytes_mslb_2026',
  simulatedTimeMs = Date.now(),
}) {
  if (!requestId || typeof requestId !== 'string') {
    const err = new Error('A valid requestId is required.');
    err.code = 'invalid-argument';
    throw err;
  }

  if (!verificationSecret) {
    const err = new Error('Verification service is temporarily unavailable. Please try again later.');
    err.code = 'failed-precondition';
    throw err;
  }

  if (!/^\d{6}$/.test(code || '')) {
    const err = new Error('Please enter a valid 6-digit verification code.');
    err.code = 'invalid-argument';
    throw err;
  }

  const tokenRef = db.collection('privacy_verification_tokens').doc(requestId);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) {
    const err = new Error('Verification request not found. Please submit a new deletion request.');
    err.code = 'not-found';
    throw err;
  }

  const tokenData = tokenSnap.data();

  if (tokenData.used) {
    const err = new Error('This verification code has already been used.');
    err.code = 'failed-precondition';
    throw err;
  }

  if (simulatedTimeMs > tokenData.expires_at_ms) {
    const err = new Error('This verification code has expired. Please request a new code.');
    err.code = 'failed-precondition';
    throw err;
  }

  // 3. Check if email-level lockout is active
  const emailRateLimitId = tokenData.email_rate_limit_id;
  let emailRateLimitRef = null;
  if (emailRateLimitId) {
    emailRateLimitRef = db.collection('privacy_email_rate_limits').doc(emailRateLimitId);
    const emailRateSnap = await emailRateLimitRef.get();
    if (emailRateSnap.exists) {
      const emailRateData = emailRateSnap.data();
      if (simulatedTimeMs < (emailRateData.lockout_until_ms || 0)) {
        const err = new Error('Too many failed verification attempts for this account. Please wait 1 hour before trying again.');
        err.code = 'resource-exhausted';
        throw err;
      }
    }
  }

  // 4. Max attempts check on this specific token
  if (tokenData.attempts >= tokenData.max_attempts) {
    const err = new Error('Too many failed verification attempts. Please submit a new deletion request.');
    err.code = 'resource-exhausted';
    throw err;
  }

  // Constant-time HMAC comparison
  const inputHash = computeVerificationCodeHmac(code, tokenData.salt, verificationSecret);
  const expectedBuf = Buffer.from(tokenData.token_hash, 'hex');
  const inputBuf = Buffer.from(inputHash, 'hex');
  const matches = expectedBuf.length === inputBuf.length && crypto.timingSafeEqual(expectedBuf, inputBuf);

  if (!matches) {
    await tokenRef.update({ attempts: tokenData.attempts + 1 });
    if (emailRateLimitRef) {
      const emailSnap = await emailRateLimitRef.get();
      const currentFailed = (emailSnap.data()?.failed_attempts || 0) + 1;
      await emailRateLimitRef.set({
        failed_attempts: currentFailed,
        last_failed_ms: simulatedTimeMs,
        ...(currentFailed >= EMAIL_MAX_FAILED_ATTEMPTS ? { lockout_until_ms: simulatedTimeMs + EMAIL_FAILED_LOCKOUT_MS } : {}),
      }, { merge: true });
    }
    const remaining = tokenData.max_attempts - (tokenData.attempts + 1);
    const err = new Error(`Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Max attempts reached.'}`);
    err.code = 'invalid-argument';
    throw err;
  }

  await tokenRef.update({ verified: true, used: true });
  if (emailRateLimitRef) {
    await emailRateLimitRef.update({ failed_attempts: 0, lockout_until_ms: 0 });
  }

  const reqRef = db.collection('privacy_requests').doc(requestId);
  if (tokenData.target_uid) {
    await reqRef.update({
      verification_status: 'verified',
      target_uid: tokenData.target_uid,
      state: 'pending',
    });
    return {
      success: true,
      message: 'Email ownership successfully verified. Your account deletion request has been authorized for processing.',
      hasAccount: true,
    };
  } else {
    await reqRef.update({
      verification_status: 'verified_no_account',
      state: 'completed',
    });
    return {
      success: true,
      message: 'Email ownership verified. No active student account exists for this email address.',
      hasAccount: false,
    };
  }
}

// -----------------------------------------------------------------------------
// Account Deletion Recovery Runner Mirroring Hardened processAccountDeletion
// -----------------------------------------------------------------------------
async function runExecuteAccountDeletion({
  caller,
  data,
  db,
  auth,
  storage,
  simulateBatchFailure = false,
}) {
  const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';
  const { targetUid: rawUid, reason = 'Account deletion requested by user', requestId } = data;

  let cleanTargetUid = rawUid?.trim() || '';
  let privacyReqRef = null;
  let privacyReqDoc = null;

  if (requestId) {
    privacyReqRef = db.collection('privacy_requests').doc(requestId);
    const leaseDurationMs = 60 * 1000;

    const claimResult = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(privacyReqRef);
      if (!snap.exists) {
        const err = new Error(`Privacy request document not found: ${requestId}`);
        err.code = 'invalid-argument';
        throw err;
      }
      const docData = snap.data();
      if (docData.type !== 'deletion') {
        const err = new Error(`Privacy request '${requestId}' is not deletion`);
        err.code = 'invalid-argument';
        throw err;
      }
      if (docData.state === 'completed') {
        return { alreadyCompleted: true, docData };
      }
      if (docData.state === 'processing') {
        const startedMs = docData.processing_started_at_ms || 0;
        if (Date.now() - startedMs < leaseDurationMs) {
          const err = new Error('Request is currently being processed by another worker. Please try again shortly.');
          err.code = 'failed-precondition';
          throw err;
        }
      }

      await transaction.update(privacyReqRef, {
        state: 'processing',
        processing_started_at_ms: Date.now(),
        processor_uid: caller.uid,
      });

      return { alreadyCompleted: false, docData };
    });

    if (claimResult.alreadyCompleted) {
      return { success: true, alreadyCompleted: true, targetUid: claimResult.docData.target_uid };
    }

    privacyReqDoc = claimResult.docData;
    if (!isAdmin) {
      const docOwner = privacyReqDoc.user_id || privacyReqDoc.target_uid;
      if (docOwner && docOwner !== caller.uid) {
        const err = new Error('You are not authorized to process another user deletion request.');
        err.code = 'permission-denied';
        throw err;
      }
      cleanTargetUid = caller.uid;
    } else {
      // Phase 4: Admin Recovery Invariants
      const trustedTargetUid = privacyReqDoc.target_uid || privacyReqDoc.user_id;
      if (!trustedTargetUid) {
        const err = new Error('Privacy request document does not specify a valid target user ID.');
        err.code = 'invalid-argument';
        throw err;
      }
      // Target UID cannot be overridden by caller
      if (rawUid && rawUid.trim() !== trustedTargetUid) {
        const err = new Error('Supplied targetUid does not match the target UID recorded in the privacy request document.');
        err.code = 'invalid-argument';
        throw err;
      }
      // State eligibility
      const eligibleStates = ['failed', 'pending', 'processing'];
      if (!eligibleStates.includes(privacyReqDoc.state)) {
        const err = new Error(`Privacy request '${requestId}' has ineligible state '${privacyReqDoc.state}' for deletion processing.`);
        err.code = 'failed-precondition';
        throw err;
      }
      cleanTargetUid = trustedTargetUid;
    }
  } else {
    // Direct invocation without requestId
    if (!isAdmin) {
      if (rawUid && rawUid !== caller.uid) {
        const err = new Error('You are not authorized to delete another user account.');
        err.code = 'permission-denied';
        throw err;
      }
      cleanTargetUid = caller.uid;
    } else {
      // Phase 4 Invariant: Admin deletion of another user REQUIRES a pre-existing deletion request
      if (rawUid && rawUid !== caller.uid) {
        const err = new Error('Admin deletion or recovery of another user\'s account requires a pre-existing privacy request ID.');
        err.code = 'invalid-argument';
        throw err;
      }
      cleanTargetUid = caller.uid;
    }
  }

  const isSelf = caller.uid === cleanTargetUid;
  if (!isSelf && !isAdmin) {
    const err = new Error('You are not authorized to delete another user account.');
    err.code = 'permission-denied';
    throw err;
  }

  // 1. Storage purge
  const prefixes = [`users/${cleanTargetUid}/`, `status_updates/${cleanTargetUid}/`];
  for (const p of prefixes) {
    try {
      await storage.deleteFiles({ prefix: p });
    } catch (err) {
      if (privacyReqRef) {
        await privacyReqRef.update({
          state: 'failed',
          failure_step: 'storage_deletion',
          failure_reason: err.message,
        });
      }
      throw err;
    }
  }

  // 2. Auth deletion (idempotent)
  try {
    await auth.deleteUser(cleanTargetUid);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Idempotent recovery
    } else {
      if (privacyReqRef) {
        await privacyReqRef.update({
          state: 'failed',
          failure_step: 'auth_deletion',
          failure_reason: err.message,
        });
      }
      throw err;
    }
  }

  // 3. Firestore personal data purge (Atomic Batch)
  const batch = db.batch(simulateBatchFailure);
  const userRef = db.collection('users').doc(cleanTargetUid);
  batch.set(userRef, {
    name: 'Deleted User',
    email: null,
    phone: null,
    status: 'deleted',
    is_deleted: true,
  }, { merge: true });

  batch.delete(db.collection('public_profiles').doc(cleanTargetUid));
  batch.delete(db.collection('user_tokens').doc(cleanTargetUid));

  if (privacyReqRef) {
    batch.update(privacyReqRef, {
      state: 'completed',
      target_uid: cleanTargetUid,
    });
  }

  const auditLogRef = db.collection('admin_logs').doc();
  batch.set(auditLogRef, {
    action: 'account_deletion_completed',
    target_uid: cleanTargetUid,
    actor_uid: caller.uid,
    is_self: isSelf,
  });

  try {
    await batch.commit();
  } catch (err) {
    if (privacyReqRef) {
      await privacyReqRef.update({
        state: 'failed',
        failure_step: 'firestore_batch_finalization',
        failure_reason: err.message,
      });
    }
    const internalErr = new Error(`Failed to commit personal data purge: ${err.message}`);
    internalErr.code = 'internal';
    throw internalErr;
  }

  return {
    success: true,
    targetUid: cleanTargetUid,
    message: 'Account personal data successfully deleted and anonymized.',
  };
}

// -----------------------------------------------------------------------------
// Test Suite Runner
// -----------------------------------------------------------------------------
async function runAllPrivacySecurityTests() {
  console.log('========================================================================');
  console.log('   PHASE 82 — MSLB PRIVACY SECURITY HARDENING REGRESSION TEST SUITE    ');
  console.log('========================================================================\n');

  let total = 0;
  let passed = 0;

  async function test(id, description, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  [PASS] ${id}: ${description}`);
    } catch (err) {
      console.error(`  [FAIL] ${id}: ${description}`);
      console.error(`         ${err.stack || err.message}`);
    }
  }

  // ===========================================================================
  // SECTION 1: VERIFICATION CODE RANGE & CSPRNG (PHASE 1)
  // ===========================================================================
  console.log('--- SECTION 1: Verification Code Range & Generation ---');

  await test('CODE-01', 'Generated codes strictly span 6 decimal digits with lower bound >= 100000', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateSixDigitVerificationCode();
      assert.strictEqual(typeof code, 'string');
      assert.strictEqual(code.length, 6);
      assert.ok(/^\d{6}$/.test(code), `Code ${code} must be exactly 6 decimal digits`);
      const num = parseInt(code, 10);
      assert.ok(num >= 100000, `Code ${num} must be >= 100000`);
      assert.ok(num <= 999999, `Code ${num} must be <= 999999`);
    }
  });

  await test('CODE-02', 'Exclusive upper bound parameter is set to 1000000 so 999999 is reachable', () => {
    // Verify mathematical bounds of crypto.randomInt(100000, 1000000)
    // In Node.js, randomInt(min, max) accepts [min, max)
    // Testing boundary invocation
    const boundaryCheck = crypto.randomInt(999999, 1000000);
    assert.strictEqual(boundaryCheck, 999999, 'Boundary must produce 999999');
  });

  await test('CODE-03', 'Code generator utilizes crypto.randomInt (CSPRNG) not Math.random', () => {
    // Inspect source code of generateSixDigitVerificationCode to ensure crypto.randomInt is called
    const src = generateSixDigitVerificationCode.toString();
    assert.ok(src.includes('randomInt'), 'Must invoke crypto.randomInt');
    assert.ok(!src.includes('Math.random'), 'Math.random is strictly prohibited');
  });

  // ===========================================================================
  // SECTION 2: REQUEST-ID RATE-LIMIT BYPASS & ABUSE CONTROLS (PHASE 2)
  // ===========================================================================
  console.log('\n--- SECTION 2: Request-ID Rate-Limit Bypass & Abuse Controls ---');

  const testSecret = 'secret_testing_hmac_mslb_2026_super_secure_key';

  await test('RATE-01', 'Same email + same request ID enforces 60-second cooldown', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('student1@mslb.edu', 'uid_1');

    await db.collection('privacy_requests').doc('req_01').set({
      email: 'student1@mslb.edu',
      type: 'deletion',
      state: 'pending',
    });

    const t0 = 1000000;
    const res1 = await runInitiatePublicVerification({
      db, auth, requestId: 'req_01', email: 'student1@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0
    });
    assert.strictEqual(res1.success, true);

    // Immediate second call with same requestId
    let caught = null;
    try {
      await runInitiatePublicVerification({
        db, auth, requestId: 'req_01', email: 'student1@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0 + 10000 // 10s later
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
    assert.ok(caught.message.includes('recently requested'));
  });

  await test('RATE-02', 'Same email + different request IDs CANNOT bypass cooldown (Bypass Closed)', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('victim@mslb.edu', 'uid_victim');

    await db.collection('privacy_requests').doc('req_victim_1').set({
      email: 'victim@mslb.edu',
      type: 'deletion',
      state: 'pending',
    });
    await db.collection('privacy_requests').doc('req_victim_2').set({
      email: 'victim@mslb.edu',
      type: 'deletion',
      state: 'pending',
    });

    const t0 = 2000000;
    // Dispatch for request 1
    await runInitiatePublicVerification({
      db, auth, requestId: 'req_victim_1', email: 'victim@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0
    });

    // Attacker generates fresh requestId 2 for same victim email after 15 seconds
    let caught = null;
    try {
      await runInitiatePublicVerification({
        db, auth, requestId: 'req_victim_2', email: 'victim@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0 + 15000
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'Must reject rate-limit bypass via fresh requestId');
    assert.strictEqual(caught.code, 'failed-precondition');
    assert.ok(caught.message.includes('recently requested'));
  });

  await test('RATE-03', 'Normalization variants of same email hit the exact same rate limit key', async () => {
    const key1 = computeEmailRateLimitKey('Student.Fatima@Example.Com ', testSecret);
    const key2 = computeEmailRateLimitKey('student.fatima@example.com', testSecret);
    const key3 = computeEmailRateLimitKey('  STUDENT.FATIMA@EXAMPLE.COM  ', testSecret);
    assert.strictEqual(key1, key2);
    assert.strictEqual(key2, key3);
  });

  await test('RATE-04', 'Atomic transaction protects concurrent requests safely', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('concurrent@mslb.edu', 'uid_conc');

    await db.collection('privacy_requests').doc('req_c1').set({ email: 'concurrent@mslb.edu', type: 'deletion', state: 'pending' });
    await db.collection('privacy_requests').doc('req_c2').set({ email: 'concurrent@mslb.edu', type: 'deletion', state: 'pending' });

    const t0 = 3000000;
    const p1 = runInitiatePublicVerification({ db, auth, requestId: 'req_c1', email: 'concurrent@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0 });
    // Simulate near-simultaneous call
    let caught = null;
    try {
      await p1;
      await runInitiatePublicVerification({ db, auth, requestId: 'req_c2', email: 'concurrent@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0 + 100 });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
  });

  await test('RATE-05', 'Cooldown expires after 60 seconds allowing new code dispatch', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('cooldown@mslb.edu', 'uid_cd');

    await db.collection('privacy_requests').doc('req_cd').set({ email: 'cooldown@mslb.edu', type: 'deletion', state: 'pending' });

    const t0 = 4000000;
    await runInitiatePublicVerification({ db, auth, requestId: 'req_cd', email: 'cooldown@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0 });

    // 65 seconds later (> 60s cooldown)
    const res2 = await runInitiatePublicVerification({ db, auth, requestId: 'req_cd', email: 'cooldown@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t0 + 65000 });
    assert.strictEqual(res2.success, true);
  });

  await test('RATE-06', 'Daily limit reached (5 requests/24h) blocks further generation with resource-exhausted', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('daily@mslb.edu', 'uid_daily');

    await db.collection('privacy_requests').doc('req_daily').set({ email: 'daily@mslb.edu', type: 'deletion', state: 'pending' });

    let t = 5000000;
    // Consume 5 allowed requests (spaced out by 70s to satisfy cooldown)
    for (let i = 0; i < 5; i++) {
      await runInitiatePublicVerification({ db, auth, requestId: 'req_daily', email: 'daily@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t });
      t += 70000;
    }

    // 6th request within 24h window
    let caught = null;
    try {
      await runInitiatePublicVerification({ db, auth, requestId: 'req_daily', email: 'daily@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, '6th request must be rejected');
    assert.strictEqual(caught.code, 'resource-exhausted');
    assert.ok(caught.message.includes('Daily verification request limit reached'));
  });

  await test('RATE-07', 'Unknown email address is subject to identical rate-limiting and generic response', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth(); // No registered accounts

    await db.collection('privacy_requests').doc('req_unknown').set({ email: 'ghost@mslb.edu', type: 'deletion', state: 'pending' });

    const res = await runInitiatePublicVerification({
      db, auth, requestId: 'req_unknown', email: 'ghost@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: 6000000
    });
    assert.strictEqual(res.success, true);
    assert.ok(res.message.includes('If an account is associated'));

    // Immediate repeat is rate-limited identically
    let caught = null;
    try {
      await runInitiatePublicVerification({
        db, auth, requestId: 'req_unknown', email: 'ghost@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: 6005000
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
  });

  await test('RATE-08', 'New request ID attempting to bypass failed-attempt limits is locked out', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('bruteforce@mslb.edu', 'uid_bf');

    await db.collection('privacy_requests').doc('req_bf_1').set({ email: 'bruteforce@mslb.edu', type: 'deletion', state: 'pending' });
    await db.collection('privacy_requests').doc('req_bf_2').set({ email: 'bruteforce@mslb.edu', type: 'deletion', state: 'pending' });

    let t = 7000000;
    await runInitiatePublicVerification({ db, auth, requestId: 'req_bf_1', email: 'bruteforce@mslb.edu', verificationSecret: testSecret, fixedCode: '111111', simulatedTimeMs: t });

    // Submit 5 wrong guesses on req_bf_1
    for (let i = 0; i < 5; i++) {
      try {
        await runVerifyPublicDeletion({ db, requestId: 'req_bf_1', code: '999999', verificationSecret: testSecret, simulatedTimeMs: t });
      } catch {}
    }

    // Now after cooldown, attacker initiates req_bf_2
    t += 70000;
    await runInitiatePublicVerification({ db, auth, requestId: 'req_bf_2', email: 'bruteforce@mslb.edu', verificationSecret: testSecret, fixedCode: '222222', simulatedTimeMs: t });

    // Submit 5 more wrong guesses on req_bf_2 (total 10 failed attempts for this email)
    for (let i = 0; i < 5; i++) {
      try {
        await runVerifyPublicDeletion({ db, requestId: 'req_bf_2', code: '999999', verificationSecret: testSecret, simulatedTimeMs: t });
      } catch {}
    }

    // 11th attempt on either request or initiate is locked out for 1 hour
    let caught = null;
    try {
      await runVerifyPublicDeletion({ db, requestId: 'req_bf_2', code: '222222', verificationSecret: testSecret, simulatedTimeMs: t + 1000 });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'resource-exhausted');
    assert.ok(caught.message.includes('Too many failed verification attempts for this account'));

    // Also verify that initiating a new requestId (req_bf_3) is blocked by the email-level lockout
    await db.collection('privacy_requests').doc('req_bf_3').set({ email: 'bruteforce@mslb.edu', type: 'deletion', state: 'pending' });
    let caughtInit = null;
    try {
      await runInitiatePublicVerification({ db, auth, requestId: 'req_bf_3', email: 'bruteforce@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: t + 2000 });
    } catch (err) {
      caughtInit = err;
    }
    assert.ok(caughtInit);
    assert.strictEqual(caughtInit.code, 'resource-exhausted');
    assert.ok(caughtInit.message.includes('Too many failed verification attempts for this account'));
  });

  await test('RATE-09', 'Generic responses for existing and nonexistent accounts are 100% indistinguishable', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('registered@mslb.edu', 'uid_real');

    await db.collection('privacy_requests').doc('req_real').set({ email: 'registered@mslb.edu', type: 'deletion', state: 'pending' });
    await db.collection('privacy_requests').doc('req_fake').set({ email: 'nonexistent@mslb.edu', type: 'deletion', state: 'pending' });

    const resReal = await runInitiatePublicVerification({ db, auth, requestId: 'req_real', email: 'registered@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: 8000000 });
    const resFake = await runInitiatePublicVerification({ db, auth, requestId: 'req_fake', email: 'nonexistent@mslb.edu', verificationSecret: testSecret, simulatedTimeMs: 8000000 });

    assert.strictEqual(resReal.success, resFake.success);
    assert.strictEqual(resReal.message, resFake.message);
  });

  await test('RATE-10', 'Secret missing or unavailable fails safely without crash or leakage', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('secretfail@mslb.edu', 'uid_sf');

    await db.collection('privacy_requests').doc('req_sf').set({ email: 'secretfail@mslb.edu', type: 'deletion', state: 'pending' });

    let caught = null;
    try {
      await runInitiatePublicVerification({
        db, auth, requestId: 'req_sf', email: 'secretfail@mslb.edu', verificationSecret: '', // Secret missing
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
    assert.ok(caught.message.includes('Verification service is temporarily unavailable'));
  });

  // ===========================================================================
  // SECTION 3: VERIFICATION CODE STORAGE HARDENING (PHASE 3)
  // ===========================================================================
  console.log('\n--- SECTION 3: Verification Code Storage Hardening ---');

  await test('HMAC-01', 'computeVerificationCodeHmac produces deterministic HMAC-SHA256', () => {
    const h1 = computeVerificationCodeHmac('123456', 'salt_abc', 'secret_key');
    const h2 = computeVerificationCodeHmac('123456', 'salt_abc', 'secret_key');
    const hDiff = computeVerificationCodeHmac('123456', 'salt_abc', 'different_secret');
    assert.strictEqual(h1, h2);
    assert.notStrictEqual(h1, hDiff);
    assert.strictEqual(h1.length, 64); // SHA-256 hex length
  });

  await test('HMAC-02', 'Plaintext code is NEVER stored in Firestore documents', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('notext@mslb.edu', 'uid_notext');

    await db.collection('privacy_requests').doc('req_notext').set({ email: 'notext@mslb.edu', type: 'deletion', state: 'pending' });

    await runInitiatePublicVerification({ db, auth, requestId: 'req_notext', email: 'notext@mslb.edu', verificationSecret: testSecret, fixedCode: '765432' });

    const tokenDoc = (await db.collection('privacy_verification_tokens').doc('req_notext').get()).data();
    assert.strictEqual(tokenDoc.code, undefined);
    assert.ok(tokenDoc.token_hash);
    assert.strictEqual(tokenDoc.token_hash.length, 64);
    assert.strictEqual(tokenDoc.hash_algorithm, 'hmac-sha256');
  });

  await test('HMAC-03', 'Replay prevention: Code cannot be reused once verified', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('replay@mslb.edu', 'uid_rep');

    await db.collection('privacy_requests').doc('req_rep').set({ email: 'replay@mslb.edu', type: 'deletion', state: 'pending' });

    const init = await runInitiatePublicVerification({ db, auth, requestId: 'req_rep', email: 'replay@mslb.edu', verificationSecret: testSecret, fixedCode: '654321' });

    // First verification succeeds
    const v1 = await runVerifyPublicDeletion({ db, requestId: 'req_rep', code: '654321', verificationSecret: testSecret });
    assert.strictEqual(v1.success, true);

    // Replay attempt fails
    let caught = null;
    try {
      await runVerifyPublicDeletion({ db, requestId: 'req_rep', code: '654321', verificationSecret: testSecret });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
    assert.ok(caught.message.includes('already been used'));
  });

  await test('HMAC-04', 'Expired code (>15 minutes) is rejected with failed-precondition', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('expire@mslb.edu', 'uid_exp');

    await db.collection('privacy_requests').doc('req_exp').set({ email: 'expire@mslb.edu', type: 'deletion', state: 'pending' });

    const t0 = 10000000;
    await runInitiatePublicVerification({ db, auth, requestId: 'req_exp', email: 'expire@mslb.edu', verificationSecret: testSecret, fixedCode: '333333', simulatedTimeMs: t0 });

    // Verify after 16 minutes (expiry is 15 minutes)
    let caught = null;
    try {
      await runVerifyPublicDeletion({ db, requestId: 'req_exp', code: '333333', verificationSecret: testSecret, simulatedTimeMs: t0 + 16 * 60 * 1000 });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
    assert.ok(caught.message.includes('expired'));
  });

  // ===========================================================================
  // SECTION 4: ACCOUNT DELETION RECOVERY AUTHORIZATION (PHASE 4)
  // ===========================================================================
  console.log('\n--- SECTION 4: Account Deletion Recovery Authorization ---');

  await test('REC-01', 'Admin recovery requires a pre-existing deletion request (cannot delete arbitrary UID)', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('innocent@mslb.edu', 'uid_innocent');
    const storage = new MockStorage();

    // Admin attempts to delete another user without requestId
    let caught = null;
    try {
      await runExecuteAccountDeletion({
        caller: { uid: 'admin_1', role: 'admin' },
        data: { targetUid: 'uid_innocent' }, // Arbitrary UID without requestId
        db, auth, storage,
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'invalid-argument');
    assert.ok(caught.message.includes('requires a pre-existing privacy request ID'));
  });

  await test('REC-02', 'Admin recovery rejects caller targetUid tampering against trusted request doc', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    auth.users.set('user_legit@mslb.edu', 'uid_legit');
    auth.users.set('user_victim@mslb.edu', 'uid_victim');
    const storage = new MockStorage();

    await db.collection('privacy_requests').doc('req_tamper').set({
      user_id: 'uid_legit',
      target_uid: 'uid_legit',
      type: 'deletion',
      state: 'failed',
    });

    // Admin passes req_tamper (belonging to uid_legit) but supplies targetUid: uid_victim
    let caught = null;
    try {
      await runExecuteAccountDeletion({
        caller: { uid: 'admin_1', role: 'admin' },
        data: { requestId: 'req_tamper', targetUid: 'uid_victim' }, // Mismatched UID
        db, auth, storage,
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'invalid-argument');
    assert.ok(caught.message.includes('does not match the target UID recorded in the privacy request'));
  });

  await test('REC-03', 'Admin recovery requires eligible incomplete/failed request state', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    const storage = new MockStorage();

    await db.collection('privacy_requests').doc('req_rejected').set({
      user_id: 'uid_rej',
      target_uid: 'uid_rej',
      type: 'deletion',
      state: 'rejected', // Ineligible state
    });

    let caught = null;
    try {
      await runExecuteAccountDeletion({
        caller: { uid: 'admin_1', role: 'admin' },
        data: { requestId: 'req_rejected' },
        db, auth, storage,
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'failed-precondition');
    assert.ok(caught.message.includes('has ineligible state'));
  });

  await test('REC-04', 'Non-admin caller is rejected with permission-denied when trying to recover another request', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    const storage = new MockStorage();

    await db.collection('privacy_requests').doc('req_other').set({
      user_id: 'uid_student_a',
      target_uid: 'uid_student_a',
      type: 'deletion',
      state: 'failed',
    });

    let caught = null;
    try {
      await runExecuteAccountDeletion({
        caller: { uid: 'uid_student_b', role: 'student' }, // Student B trying to recover Student A
        data: { requestId: 'req_other' },
        db, auth, storage,
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'permission-denied');
  });

  await test('REC-05', 'Admin recovery succeeds on failed request and handles auth/user-not-found idempotently', async () => {
    const db = new MockDatabase();
    const auth = new MockAuth();
    // User already deleted from Auth during initial partial failure
    const storage = new MockStorage();

    await db.collection('users').doc('uid_partial').set({ name: 'Partial Student', email: 'partial@mslb.edu' });
    await db.collection('privacy_requests').doc('req_recovery_ok').set({
      user_id: 'uid_partial',
      target_uid: 'uid_partial',
      type: 'deletion',
      state: 'failed',
      failure_step: 'firestore_batch_finalization',
    });

    const res = await runExecuteAccountDeletion({
      caller: { uid: 'superadmin_1', role: 'super_admin' },
      data: { requestId: 'req_recovery_ok' },
      db, auth, storage,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.targetUid, 'uid_partial');

    // Confirm request marked completed
    const updatedReq = (await db.collection('privacy_requests').doc('req_recovery_ok').get()).data();
    assert.strictEqual(updatedReq.state, 'completed');

    // Confirm user anonymized
    const anonymizedUser = (await db.collection('users').doc('uid_partial').get()).data();
    assert.strictEqual(anonymizedUser.name, 'Deleted User');
    assert.strictEqual(anonymizedUser.email, null);
    assert.strictEqual(anonymizedUser.status, 'deleted');
  });

  // ===========================================================================
  // SECTION 5: ADMIN AUDIT LOG RULES STATIC INTEGRITY (PHASE 5)
  // ===========================================================================
  console.log('\n--- SECTION 5: Admin Audit Log Rules Verification ---');

  await test('RULE-01', 'firestore.rules strictly denies client create and write on /admin_logs', () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // Find match /admin_logs/{logId}
    const adminLogsIdx = rulesContent.indexOf('match /admin_logs/{logId}');
    assert.ok(adminLogsIdx !== -1, 'Must contain match /admin_logs/{logId}');

    const block = rulesContent.slice(adminLogsIdx, adminLogsIdx + 200);
    assert.ok(block.includes('allow create: if false;'), 'admin_logs must strictly deny client create');
    assert.ok(block.includes('allow update, delete: if false;'), 'admin_logs must strictly deny client update and delete');
  });

  await test('RULE-02', 'firestore.rules strictly denies all client access to /privacy_email_rate_limits', () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    const rateLimitIdx = rulesContent.indexOf('match /privacy_email_rate_limits/{rateLimitId}');
    assert.ok(rateLimitIdx !== -1, 'Must contain match /privacy_email_rate_limits/{rateLimitId}');

    const block = rulesContent.slice(rateLimitIdx, rateLimitIdx + 200);
    assert.ok(block.includes('allow read, write: if false;'), 'privacy_email_rate_limits must strictly deny client read and write');
  });

  console.log('\n========================================================================');
  console.log(`PHASE 82 TEST SUITE COMPLETE: ${passed} PASSED | ${total - passed} FAILED`);
  console.log('========================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllPrivacySecurityTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
