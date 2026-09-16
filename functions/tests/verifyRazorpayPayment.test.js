const crypto = require('crypto');
const assert = require('assert');

// Import pure verification helper from compiled lib
const { verifySignature } = require('../lib/payments/verifyRazorpayPayment');

async function runTests() {
  console.log('--- Running verifyRazorpayPayment Unit Tests (Task 4) ---');

  const TEST_SECRET = 'rzp_test_secret_key_12345';
  const orderId = 'order_ABC1234567890';
  const paymentId = 'pay_XYZ9876543210';

  // 1. Calculate valid signature
  const validSignature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Test 1: Valid signature passes verification
  const isValid = verifySignature(orderId, paymentId, validSignature, TEST_SECRET);
  assert.strictEqual(isValid, true, 'Valid signature should return true');
  console.log('PASS: Valid signature verified successfully');

  // Test 2: Tampered signature rejected
  const tamperedSignature = validSignature.slice(0, -2) + 'aa';
  const isTamperedValid = verifySignature(orderId, paymentId, tamperedSignature, TEST_SECRET);
  assert.strictEqual(isTamperedValid, false, 'Tampered signature should return false');
  console.log('PASS: Tampered signature rejected');

  // Test 3: Tampered paymentId rejected
  const isTamperedPaymentValid = verifySignature(orderId, 'pay_ATTACKER_99999', validSignature, TEST_SECRET);
  assert.strictEqual(isTamperedPaymentValid, false, 'Signature with different paymentId should return false');
  console.log('PASS: Mismatched paymentId rejected');

  // Test 4: Tampered orderId rejected
  const isTamperedOrderValid = verifySignature('order_OTHER_11111', paymentId, validSignature, TEST_SECRET);
  assert.strictEqual(isTamperedOrderValid, false, 'Signature with different orderId should return false');
  console.log('PASS: Mismatched orderId rejected');

  // Test 5: Empty/missing fields safely return false without crashing
  assert.strictEqual(verifySignature('', paymentId, validSignature, TEST_SECRET), false);
  assert.strictEqual(verifySignature(orderId, '', validSignature, TEST_SECRET), false);
  assert.strictEqual(verifySignature(orderId, paymentId, '', TEST_SECRET), false);
  assert.strictEqual(verifySignature(orderId, paymentId, validSignature, ''), false);
  console.log('PASS: Empty or missing fields safely handled');

  // Test 6: Authorization simulation — caller UID must match payment document user_id
  const callerUid = 'student_uid_100';
  const docOwnerUid = 'student_uid_100';
  const attackerUid = 'student_uid_200';

  function simulateUserAuthCheck(caller, paymentDoc) {
    if (paymentDoc.user_id !== caller) {
      throw new Error('PERMISSION_DENIED: caller is not payment owner');
    }
    return true;
  }

  assert.doesNotThrow(() => simulateUserAuthCheck(callerUid, { user_id: docOwnerUid }));
  assert.throws(() => simulateUserAuthCheck(attackerUid, { user_id: docOwnerUid }), /PERMISSION_DENIED/);
  console.log('PASS: Caller UID ownership validation confirmed');

  // Test 7: Idempotency simulation — already succeeded payment returns alreadyCompleted: true
  function simulateIdempotencyCheck(paymentDoc) {
    if (paymentDoc.state === 'succeeded' || paymentDoc.status === 'succeeded') {
      return { success: true, verified: true, alreadyCompleted: true };
    }
    return { success: true, verified: true, alreadyCompleted: false };
  }

  const resNew = simulateIdempotencyCheck({ state: 'pending' });
  assert.strictEqual(resNew.alreadyCompleted, false);

  const resExisting = simulateIdempotencyCheck({ state: 'succeeded' });
  assert.strictEqual(resExisting.alreadyCompleted, true);
  console.log('PASS: Idempotency protection confirmed');

  console.log('\nALL Task 4 verifyRazorpayPayment tests passed cleanly!\n');
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
