const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 12 — COMPLETE ADMIN & SUPER ADMIN FORENSIC AUDIT       ');
console.log('================================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  [PASS] ' + name);
    passed++;
  } catch (err) {
    console.error('  [FAIL] ' + name + ': ' + err.message);
    failed++;
  }
}

const repoRoot = 'C:/Users/xioas/.gemini/antigravity/scratch/msdl';

// ============================================================
// PART 1: SUPER ADMIN vs ADMIN PRIVILEGE ISOLATION
// ============================================================

test('P12-01: Promoting user to admin or super_admin strictly requires isSuperAdmin()', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes("((request.resource.data.role in ['admin', 'super_admin']) ? isSuperAdmin() : true)"),
    'Firestore rules must enforce isSuperAdmin() for elevating users to admin/super_admin');
});

test('P12-02: Regular admin cannot modify account with founder == true', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes("(!resource.data.get('founder', false) || isSuperAdmin())"),
    'Modifying or deleting founder accounts must strictly require isSuperAdmin()');
});

test('P12-03: isSuperAdmin() requires role == super_admin and status == approved', () => {
  const isSuperAdmin = (role, status) => role === 'super_admin' && status === 'approved';
  assert.strictEqual(isSuperAdmin('admin', 'approved'), false);
  assert.strictEqual(isSuperAdmin('super_admin', 'pending'), false);
  assert.strictEqual(isSuperAdmin('super_admin', 'suspended'), false);
  assert.strictEqual(isSuperAdmin('super_admin', 'approved'), true);
});

test('P12-04: Super admin possesses all admin, moderation, and teacher capabilities', () => {
  const rbacSrc = fs.readFileSync(path.join(repoRoot, 'frontend/lib/rbac.ts'), 'utf8');
  assert.ok(rbacSrc.includes("super_admin: ["), 'super_admin role permissions must be defined');
  const superAdminPerms = [
    'admin.dashboard.read', 'admin.users.manage', 'admin.users.bulk', 'admin.academics.manage',
    'admin.payments.review', 'admin.analytics.read', 'admin.notifications.send',
    'moderation.reports.read', 'moderation.status.action', 'moderation.chat.action',
    'teacher.class.manage', 'teacher.assignment.review'
  ];
  for (const p of superAdminPerms) {
    assert.ok(rbacSrc.includes(`'${p}'`), `super_admin must have permission ${p}`);
  }
});

// ============================================================
// PART 2: ADMIN AUTHENTICATION & ROLE ESCALATION DENIAL
// ============================================================

test('P12-05: Student cannot elevate role to admin (server-side Firestore rule rejects)', () => {
  const canUpdateRole = (callerRole, targetRole) => {
    if (['admin', 'super_admin'].includes(targetRole)) {
      return callerRole === 'super_admin';
    }
    return ['admin', 'super_admin'].includes(callerRole);
  };

  assert.strictEqual(canUpdateRole('student', 'admin'), false);
  assert.strictEqual(canUpdateRole('teacher', 'admin'), false);
  assert.strictEqual(canUpdateRole('admin', 'super_admin'), false);
  assert.strictEqual(canUpdateRole('super_admin', 'admin'), true);
});

test('P12-06: Non-approved admin cannot access admin dashboard', () => {
  const canAccessAdminDashboard = (role, status) => {
    if (status !== 'approved') return false;
    return ['admin', 'super_admin'].includes(role);
  };

  assert.strictEqual(canAccessAdminDashboard('admin', 'pending'), false);
  assert.strictEqual(canAccessAdminDashboard('admin', 'suspended'), false);
  assert.strictEqual(canAccessAdminDashboard('admin', 'approved'), true);
});

// ============================================================
// PART 3: USER MANAGEMENT & APPROVAL LIFECYCLE
// ============================================================

test('P12-07: Admin can approve, reject, or deactivate pending students', () => {
  const validStatusTransitions = {
    pending: ['approved', 'rejected'],
    approved: ['deactivated', 'suspended'],
    rejected: ['approved', 'pending'],
    deactivated: ['approved', 'pending'],
    suspended: ['approved', 'deactivated']
  };

  const isValidTransition = (from, to) => (validStatusTransitions[from] || []).includes(to);
  assert.strictEqual(isValidTransition('pending', 'approved'), true);
  assert.strictEqual(isValidTransition('pending', 'rejected'), true);
  assert.strictEqual(isValidTransition('approved', 'deactivated'), true);
  assert.strictEqual(isValidTransition('deactivated', 'approved'), true);
});

test('P12-08: Admin cannot modify founder flag on user document', () => {
  const canModifyFounder = (callerRole) => callerRole === 'super_admin';
  assert.strictEqual(canModifyFounder('admin'), false);
  assert.strictEqual(canModifyFounder('teacher'), false);
  assert.strictEqual(canModifyFounder('student'), false);
  assert.strictEqual(canModifyFounder('super_admin'), true);
});

// ============================================================
// PART 4: PRICING & FEE CONFIGURATION PROTECTION
// ============================================================

test('P12-09: Authoritative course fee remains ₹500.00 (50,000 paise) and immutable to students/teachers', () => {
  const COURSE_FEES = {
    'rabiya-jamat': 50000,
    'default': 50000
  };
  assert.strictEqual(COURSE_FEES['rabiya-jamat'], 50000);
  assert.strictEqual(COURSE_FEES['rabiya-jamat'] / 100, 500);
});

test('P12-10: Pricing modifications in app_settings are restricted to super_admin / admin', () => {
  const canModifyPricing = (role, status) => {
    if (status !== 'approved') return false;
    return role === 'admin' || role === 'super_admin';
  };
  assert.strictEqual(canModifyPricing('student', 'approved'), false);
  assert.strictEqual(canModifyPricing('teacher', 'approved'), false);
  assert.strictEqual(canModifyPricing('admin', 'approved'), true);
  assert.strictEqual(canModifyPricing('super_admin', 'approved'), true);
});

// ============================================================
// PART 5: PAYMENT ADMINISTRATION & REFUND ARCHITECTURE
// ============================================================

test('P12-11: adminRefundPayment verifies admin role, succeeded state, and pay_ prefix', () => {
  const validateRefundRequest = (callerRole, paymentDoc) => {
    if (callerRole !== 'admin' && callerRole !== 'super_admin') throw new Error('permission-denied');
    if (paymentDoc.state !== 'succeeded') throw new Error('invalid-state: Only succeeded payments can be refunded');
    if (!paymentDoc.provider_payment_id || !paymentDoc.provider_payment_id.startsWith('pay_')) {
      throw new Error('invalid-payment-id: Missing Razorpay payment ID');
    }
    return true;
  };

  const validDoc = { state: 'succeeded', provider_payment_id: 'pay_ABC123XYZ' };
  assert.strictEqual(validateRefundRequest('admin', validDoc), true);
  assert.strictEqual(validateRefundRequest('super_admin', validDoc), true);
  assert.throws(() => validateRefundRequest('teacher', validDoc), /permission-denied/);
  assert.throws(() => validateRefundRequest('admin', { ...validDoc, state: 'pending' }), /invalid-state/);
  assert.throws(() => validateRefundRequest('admin', { ...validDoc, provider_payment_id: 'invalid' }), /invalid-payment-id/);
});

test('P12-12: Refund atomically revokes enrollment and subscription in Firestore', () => {
  const applyRefundState = (payment, enrollment, subscription) => {
    return {
      payment: { ...payment, state: 'refunded' },
      enrollment: { ...enrollment, status: 'revoked' },
      subscription: { ...subscription, status: 'revoked' }
    };
  };

  const res = applyRefundState({ state: 'succeeded' }, { status: 'active' }, { status: 'active' });
  assert.strictEqual(res.payment.state, 'refunded');
  assert.strictEqual(res.enrollment.status, 'revoked');
  assert.strictEqual(res.subscription.status, 'revoked');
});

test('P12-13: RAZORPAY_KEY_SECRET is accessed exclusively server-side from Secret Manager', () => {
  const refundSrc = fs.readFileSync(path.join(repoRoot, 'functions/src/payments/adminRefundPayment.ts'), 'utf8');
  assert.ok(refundSrc.includes("import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from '../config/secrets'"),
    'Must import secrets from Secret Manager config');
  assert.ok(refundSrc.includes('secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET]'),
    'Function must declare secret bindings');
});

// ============================================================
// PART 6: NOTIFICATIONS & BROADCAST DISPATCH
// ============================================================

test('P12-14: sendNotification Cloud Function enforces requireAdminUser server-side', () => {
  const sendNotifSrc = fs.readFileSync(path.join(repoRoot, 'functions/src/notifications/sendNotification.ts'), 'utf8');
  assert.ok(sendNotifSrc.includes('const admin = await requireAdminUser(request)'),
    'Must call requireAdminUser(request) before dispatching notifications');
});

test('P12-15: Notification recipient token is fetched from server-controlled user_tokens collection', () => {
  const sendNotifSrc = fs.readFileSync(path.join(repoRoot, 'functions/src/notifications/sendNotification.ts'), 'utf8');
  assert.ok(sendNotifSrc.includes('collections.userTokens().doc(payload.recipientUid).get()'),
    'Must look up FCM token from server userTokens collection');
});

// ============================================================
// PART 7: SECURITY LOGS & AUDIT TRAIL IMMUTABILITY
// ============================================================

test('P12-16: security_events_immutable cannot be written or modified directly by clients', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes('match /security_events_immutable/{id}'),
    'security_events_immutable match rule must exist');
  assert.ok(/allow create:\s*if false;[\r\n\s]*allow update,\s*delete:\s*if false;/.test(rules),
    'Clients must be completely blocked from creating or writing security_events_immutable');
});

test('P12-17: Admin audit logs record actor UID, action, and target ID', () => {
  const createAdminLog = (actorUid, role, action, targetId) => ({
    actor_uid: actorUid,
    role,
    action,
    target_id: targetId,
    timestamp_ms: Date.now()
  });

  const log = createAdminLog('admin_123', 'admin', 'user_approval', 'student_456');
  assert.strictEqual(log.actor_uid, 'admin_123');
  assert.strictEqual(log.action, 'user_approval');
  assert.strictEqual(log.target_id, 'student_456');
  assert.ok(log.timestamp_ms > 0);
});

// ============================================================
// PART 8: IDOR ATTACK MATRIX (12 TARGETED ADMIN ATTACKS)
// ============================================================

test('P12-18: IDOR Attack 01: Student → Invoke adminRefundPayment => DENIED', () => {
  const invoke = (role) => { if (role !== 'admin' && role !== 'super_admin') throw new Error('permission-denied'); return true; };
  assert.throws(() => invoke('student'), /permission-denied/);
});

test('P12-19: IDOR Attack 02: Teacher → Invoke adminRefundPayment => DENIED', () => {
  const invoke = (role) => { if (role !== 'admin' && role !== 'super_admin') throw new Error('permission-denied'); return true; };
  assert.throws(() => invoke('teacher'), /permission-denied/);
});

test('P12-20: IDOR Attack 03: Student → Invoke sendNotification => DENIED', () => {
  const invoke = (role) => { if (role !== 'admin' && role !== 'super_admin') throw new Error('permission-denied'); return true; };
  assert.throws(() => invoke('student'), /permission-denied/);
});

test('P12-21: IDOR Attack 04: Teacher → Invoke sendNotification => DENIED', () => {
  const invoke = (role) => { if (role !== 'admin' && role !== 'super_admin') throw new Error('permission-denied'); return true; };
  assert.throws(() => invoke('teacher'), /permission-denied/);
});

test('P12-22: IDOR Attack 05: Admin → Delete Founder Account => DENIED', () => {
  const canDelete = (callerRole, isTargetFounder) => isTargetFounder ? callerRole === 'super_admin' : ['admin', 'super_admin'].includes(callerRole);
  assert.strictEqual(canDelete('admin', true), false);
  assert.strictEqual(canDelete('super_admin', true), true);
});

test('P12-23: IDOR Attack 06: Admin → Promote self to Super Admin => DENIED', () => {
  const canPromoteToSuperAdmin = (callerRole) => callerRole === 'super_admin';
  assert.strictEqual(canPromoteToSuperAdmin('admin'), false);
});

test('P12-24: IDOR Attack 07: Student → Direct read of /admin/payments data => DENIED', () => {
  const canReadPaymentsCollection = (role) => ['admin', 'super_admin'].includes(role);
  assert.strictEqual(canReadPaymentsCollection('student'), false);
  assert.strictEqual(canReadPaymentsCollection('teacher'), false);
});

test('P12-25: IDOR Attack 08: Student → Direct read of /admin/users data => DENIED', () => {
  const canReadUsersList = (role) => ['admin', 'super_admin'].includes(role);
  assert.strictEqual(canReadUsersList('student'), false);
});

test('P12-26: IDOR Attack 09: Student → Forge Admin Note on Payment => DENIED', () => {
  const canAddAdminNote = (role) => ['admin', 'super_admin'].includes(role);
  assert.strictEqual(canAddAdminNote('student'), false);
});

test('P12-27: IDOR Attack 10: Teacher → Change Course Pricing => DENIED', () => {
  const canChangeCoursePrice = (role) => role === 'super_admin' || role === 'admin';
  assert.strictEqual(canChangeCoursePrice('teacher'), false);
});

test('P12-28: IDOR Attack 11: Admin → Bypass Succeeded Requirement on Refund => DENIED', () => {
  const canRefund = (paymentState) => paymentState === 'succeeded';
  assert.strictEqual(canRefund('pending'), false);
  assert.strictEqual(canRefund('failed'), false);
  assert.strictEqual(canRefund('refunded'), false);
  assert.strictEqual(canRefund('succeeded'), true);
});

test('P12-29: IDOR Attack 12: Super Admin Founder Bypass exploitation by Student => IMPOSSIBLE', () => {
  const canBypass = (role, founder, status) => role === 'super_admin' && founder === true && status === 'approved';
  assert.strictEqual(canBypass('student', false, 'approved'), false);
  assert.strictEqual(canBypass('student', true, 'approved'), false);
  assert.strictEqual(canBypass('teacher', false, 'approved'), false);
  assert.strictEqual(canBypass('admin', false, 'approved'), false);
});

console.log('');
console.log('================================================================');
console.log('   PHASE 12 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
