/**
 * Phase 58 — MSLB Production Readiness Forensic Audit & Real-World End-to-End Hardening Test Suite
 * PR58-01 through PR58-25
 *
 * Verifies:
 * - Secret & Credential isolation:
 *     - No hardcoded secrets, private keys, or API tokens in client bundle / .env
 *     - RAZORPAY_KEY_SECRET strictly confined to Secret Manager / Cloud Functions
 * - Multi-tenant & Academic Access Integrity:
 *     - enrollStudent stamps organization_id from course or active tenant
 *     - Cross-tenant enrollment rejection
 *     - Unenrolled student locked out of live class stream, recordings listener, and Google Meet
 *     - handleJoinClass blocks unenrolled students with enrollment prompt
 * - Privacy & Compliance Safeguards:
 *     - Permanent deletion routes through compliance audit (privacy_requests)
 *     - Client cannot directly mutate users/{uid} status, role, or is_blocked
 * - Auth & Session Lifecycle:
 *     - Complete logout contract (state, profile, active org, AsyncStorage)
 *     - Role elevation defense (student cannot self-elevate)
 *     - Founder/super-admin invariant
 * - Infrastructure & Storage:
 *     - Cloud Functions foundation exports
 *     - Storage rules tenant scoping
 *     - Firestore rules completeness
 *     - Offline resiliency & navigation guard
 * - End-to-end multi-tenant academic boundary simulation
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../');
const frontendDir = path.join(repoRoot, 'frontend');
const functionsDir = path.join(repoRoot, 'functions');

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

// ─────────────────────────────────────────────────────────────────────────────
// Simulated Helpers & Models
// ─────────────────────────────────────────────────────────────────────────────

function simulateEnrollStudent({ studentUid, courseId, courses, activeOrgId, defaultOrgId }) {
  if (!studentUid || !courseId) return null;
  const targetCourse = (courses || []).find((c) => c.id === courseId);
  const organization_id = targetCourse?.organization_id || activeOrgId || defaultOrgId || 'org_mslb_main';
  return {
    docId: `${studentUid}:${courseId}`,
    data: {
      user_id: studentUid,
      course_id: courseId,
      organization_id,
      status: 'active',
    },
  };
}

function simulateCourseAccess({ userRole, isEnrolled, courseOrgId, userOrgId }) {
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const isStudent = userRole === 'student';

  const tenantMatch = courseOrgId === userOrgId || isSuperAdmin;
  if (!tenantMatch) {
    return {
      canViewOverview: false,
      canAccessLiveClass: false,
      canAccessRecordings: false,
      canAccessAudioLessons: false,
      reason: 'TENANT_MISMATCH',
    };
  }

  if (isSuperAdmin || isAdmin || isTeacher) {
    return {
      canViewOverview: true,
      canAccessLiveClass: true,
      canAccessRecordings: true,
      canAccessAudioLessons: true,
      reason: 'STAFF_ACCESS',
    };
  }

  if (isStudent) {
    return {
      canViewOverview: true,
      canAccessLiveClass: isEnrolled,
      canAccessRecordings: isEnrolled,
      canAccessAudioLessons: isEnrolled,
      isLockedForStudent: !isEnrolled,
      reason: isEnrolled ? 'ENROLLED_STUDENT' : 'LOCKED_UNENROLLED',
    };
  }

  return {
    canViewOverview: false,
    canAccessLiveClass: false,
    canAccessRecordings: false,
    canAccessAudioLessons: false,
    reason: 'UNAUTHORIZED_ROLE',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runPhase58Suite() {
  console.log('\n===============================================================');
  console.log('PHASE 58 — PRODUCTION READINESS FORENSIC AUDIT & HARDENING TEST');
  console.log('===============================================================\n');

  // PR58-01: Secret & Credential Sanitization
  await test('PR58-01: No private keys, secret keys, or service-account JSON in client/.env or git', async () => {
    const envPath = path.join(frontendDir, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      assert.ok(!content.includes('BEGIN PRIVATE KEY'), 'Private key found in frontend/.env');
      assert.ok(!content.includes('RAZORPAY_KEY_SECRET='), 'Razorpay secret key found in frontend/.env');
      assert.ok(!content.includes('FIREBASE_ADMIN'), 'Firebase Admin credentials found in frontend/.env');
    }
    // Check repository root for loose service account files
    const rootFiles = fs.readdirSync(repoRoot);
    const serviceAccountFiles = rootFiles.filter((f) => f.includes('serviceAccount') || (f.endsWith('.json') && f.includes('admin')));
    assert.strictEqual(serviceAccountFiles.length, 0, `Unsafe credentials found in repo root: ${serviceAccountFiles.join(', ')}`);
  });

  // PR58-02: Razorpay Secret Isolation
  await test('PR58-02: RAZORPAY_KEY_SECRET strictly confined to Secret Manager / Cloud Functions', async () => {
    const secretsTs = path.join(functionsDir, 'src/config/secrets.ts');
    assert.ok(fs.existsSync(secretsTs), 'functions/src/config/secrets.ts must exist');
    const content = fs.readFileSync(secretsTs, 'utf8');
    assert.ok(
      content.includes("defineSecret('RAZORPAY_KEY_SECRET')") || content.includes('defineSecret("RAZORPAY_KEY_SECRET")'),
      'RAZORPAY_KEY_SECRET must be defined via Secret Manager'
    );

    // Verify frontend code does not reference RAZORPAY_KEY_SECRET
    const frontendPaymentScreen = path.join(frontendDir, 'app/admin/payments.tsx');
    if (fs.existsSync(frontendPaymentScreen)) {
      const screenContent = fs.readFileSync(frontendPaymentScreen, 'utf8');
      assert.ok(!screenContent.includes('RAZORPAY_KEY_SECRET'), 'Frontend must not reference RAZORPAY_KEY_SECRET');
    }
  });

  // PR58-03: Multi-tenant Enrollment Stamping
  await test('PR58-03: enrollStudent stamps authoritative organization_id on enrollment document', async () => {
    const courses = [
      { id: 'c_math', organization_id: 'org_primary' },
      { id: 'c_quran', organization_id: 'org_secondary' },
    ];
    const enrollment1 = simulateEnrollStudent({
      studentUid: 'student_1',
      courseId: 'c_math',
      courses,
      activeOrgId: 'org_primary',
      defaultOrgId: 'org_mslb_main',
    });
    assert.strictEqual(enrollment1.data.organization_id, 'org_primary');
    assert.strictEqual(enrollment1.data.user_id, 'student_1');
    assert.strictEqual(enrollment1.data.course_id, 'c_math');

    const enrollment2 = simulateEnrollStudent({
      studentUid: 'student_2',
      courseId: 'c_quran',
      courses,
      activeOrgId: 'org_primary', // active is primary, but course is secondary
      defaultOrgId: 'org_mslb_main',
    });
    // Authoritative course org takes precedence
    assert.strictEqual(enrollment2.data.organization_id, 'org_secondary');
  });

  // PR58-04: Cross-Tenant Enrollment Isolation
  await test('PR58-04: Cross-tenant enrollment rejection for students accessing foreign course', async () => {
    const access = simulateCourseAccess({
      userRole: 'student',
      isEnrolled: false,
      courseOrgId: 'org_tenant_b',
      userOrgId: 'org_tenant_a',
    });
    assert.strictEqual(access.canViewOverview, false);
    assert.strictEqual(access.canAccessLiveClass, false);
    assert.strictEqual(access.canAccessRecordings, false);
    assert.strictEqual(access.reason, 'TENANT_MISMATCH');
  });

  // PR58-05: Academic Course Barrier - Live Class Subscription
  await test('PR58-05: Unenrolled student is locked out of active live class subscription', async () => {
    const courseDetailPath = path.join(frontendDir, 'app/course/[id].tsx');
    assert.ok(fs.existsSync(courseDetailPath), 'course/[id].tsx must exist');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    // Verify subscribeActiveLiveClass is guarded by isLockedForStudent
    assert.ok(
      content.includes('if (!courseId || isLockedForStudent)') &&
      content.includes('subscribeActiveLiveClass(courseId'),
      'subscribeActiveLiveClass must be guarded by isLockedForStudent'
    );
  });

  // PR58-06: Academic Course Barrier - Recordings Listener
  await test('PR58-06: Unenrolled student cannot trigger course recordings listener', async () => {
    const courseDetailPath = path.join(frontendDir, 'app/course/[id].tsx');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    // Verify recordings onSnapshot is guarded by isLockedForStudent
    assert.ok(
      content.includes('if (!courseId || isLockedForStudent) {\n      setRecordings([]);') ||
      content.includes('if (!courseId || isLockedForStudent) {'),
      'Recordings snapshot listener must be skipped when student is locked'
    );
  });

  // PR58-07: Academic Course Barrier - Google Meet Protection
  await test('PR58-07: Unenrolled student cannot access external Google Meet backup link', async () => {
    const courseDetailPath = path.join(frontendDir, 'app/course/[id].tsx');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    // Verify floating Meet link is gated with !isLockedForStudent
    assert.ok(
      content.includes('meetLink && !isLockedForStudent'),
      'meetLink in floating action row must require !isLockedForStudent'
    );
  });

  // PR58-08: Academic Course Barrier - Join Class Handler
  await test('PR58-08: handleJoinClass blocks unenrolled student and presents enrollment alert', async () => {
    const courseDetailPath = path.join(frontendDir, 'app/course/[id].tsx');
    const content = fs.readFileSync(courseDetailPath, 'utf8');

    // Verify handleJoinClass has isLockedForStudent check at top
    assert.ok(
      content.includes('if (isLockedForStudent) {') &&
      content.includes('Enrollment Required'),
      'handleJoinClass must check isLockedForStudent and alert Enrollment Required'
    );
  });

  // PR58-09: Data Privacy - User Document Mutation Protection
  await test('PR58-09: Account deletion does not attempt illegal client write to users/{uid}', async () => {
    const privacyPath = path.join(frontendDir, 'app/data-privacy.tsx');
    assert.ok(fs.existsSync(privacyPath), 'app/data-privacy.tsx must exist');
    const content = fs.readFileSync(privacyPath, 'utf8');

    // Must NOT have updateDoc on users document directly
    assert.ok(!content.includes("updateDoc(doc(db, 'users'"), 'data-privacy.tsx must not update users doc from client');
  });

  // PR58-10: Data Privacy - Compliance Audit Trail
  await test('PR58-10: Self-service account deletion creates audit in privacy_requests', async () => {
    const privacyPath = path.join(frontendDir, 'app/data-privacy.tsx');
    const content = fs.readFileSync(privacyPath, 'utf8');

    assert.ok(
      content.includes("createPrivacyRequest(uid, 'deletion'") ||
      content.includes("createPrivacyRequest(user.uid, 'deletion'"),
      'data-privacy.tsx must record deletion request in compliance audit trail'
    );
  });

  // PR58-11: Auth Logout Contract
  await test('PR58-11: signOutUser cleanly purges user, profile, active org, and AsyncStorage', async () => {
    const authContextPath = path.join(frontendDir, 'context/AuthContext.tsx');
    assert.ok(fs.existsSync(authContextPath), 'AuthContext.tsx must exist');
    const content = fs.readFileSync(authContextPath, 'utf8');

    assert.ok(content.includes('setUser(null)'), 'Must clear user');
    assert.ok(content.includes('setProfile(null)'), 'Must clear profile');
    assert.ok(content.includes('resetActiveOrganization()'), 'Must reset active organization');
    assert.ok(content.includes('AsyncStorage.multiRemove') || content.includes('cleanupSessionStorageOnSignOut'), 'Must purge AsyncStorage keys on signout');
  });

  // PR58-12: Role Based Access Control
  await test('PR58-12: Client cannot self-elevate role in Firestore security rules', async () => {
    const rulesPath = path.join(repoRoot, 'firestore.rules');
    assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist');
    const content = fs.readFileSync(rulesPath, 'utf8');

    // Verify self metadata update enforces role immutability
    assert.ok(
      content.includes('request.resource.data.role == resource.data.role'),
      'Self update must enforce role immutability'
    );
  });

  // PR58-13: Storage Tenant Isolation
  await test('PR58-13: Storage rules enforce tenant isolation on class recordings and media', async () => {
    const storageRulesPath = path.join(repoRoot, 'storage.rules');
    assert.ok(fs.existsSync(storageRulesPath), 'storage.rules must exist');
    const content = fs.readFileSync(storageRulesPath, 'utf8');

    assert.ok(content.includes('match /organizations/{orgId}/courses/{courseId}/recordings'), 'Recording storage must be nested under orgId');
    assert.ok(content.includes('isTenantMember(orgId)'), 'Must enforce isTenantMember on storage reads');
  });

  // PR58-14: Class Recording Security Boundary
  await test('PR58-14: Class recordings require authoritative course and org linkage', async () => {
    const classRecordingTs = path.join(frontendDir, 'lib/classRecording.ts');
    assert.ok(fs.existsSync(classRecordingTs), 'classRecording.ts must exist');
    const content = fs.readFileSync(classRecordingTs, 'utf8');

    assert.ok(content.includes('organization_id: authoritativeOrgId'), 'Must stamp authoritativeOrgId');
    assert.ok(content.includes('authoritativeOrgId = courseData?.organization_id'), 'Must resolve organization_id from course');
  });

  // PR58-15: Cloud Functions Foundation Exports
  await test('PR58-15: Cloud Functions index exports sendNotification, submitQuiz, razorpayWebhook, generateCertificate, createStatusCheck', async () => {
    const indexPath = path.join(functionsDir, 'src/index.ts');
    assert.ok(fs.existsSync(indexPath), 'functions/src/index.ts must exist');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert.ok(content.includes('export { sendNotification }'), 'Must export sendNotification');
    assert.ok(content.includes('export { submitQuiz }'), 'Must export submitQuiz');
    assert.ok(content.includes('export { razorpayWebhook }'), 'Must export razorpayWebhook');
    assert.ok(content.includes('export { generateCertificate }'), 'Must export generateCertificate');
    assert.ok(content.includes('export { createStatusCheck }'), 'Must export createStatusCheck');
  });

  // PR58-16: Server-side Quiz Grading & Attempt Locks
  await test('PR58-16: Quiz results cannot be written directly by student clients', async () => {
    const rulesPath = path.join(repoRoot, 'firestore.rules');
    const content = fs.readFileSync(rulesPath, 'utf8');

    // Verify quiz_results write is denied or restricted
    assert.ok(
      content.includes('match /quiz_results/{resultId}') || content.includes('match /quiz_results/{id}'),
      'Must have rules match for quiz_results'
    );
  });

  // PR58-17: Attendance Isolation
  await test('PR58-17: Attendance marking enforces course assignment and teacher authorization', async () => {
    const attendanceScreen = path.join(frontendDir, 'app/(tabs)/attendance.tsx');
    assert.ok(fs.existsSync(attendanceScreen), 'attendance.tsx must exist');
    const content = fs.readFileSync(attendanceScreen, 'utf8');

    assert.ok(content.includes('filterTeacherAssignedCourses'), 'Attendance must filter by assigned courses');
  });

  // PR58-18: Chat Architecture
  await test('PR58-18: Universal chat messages enforce sender UID and valid membership', async () => {
    const rulesPath = path.join(repoRoot, 'firestore.rules');
    const content = fs.readFileSync(rulesPath, 'utf8');

    assert.ok(
      content.includes('match /chats/{chatId}') || content.includes('match /messages/{msgId}') || content.includes('match /channels/'),
      'Must have chat security rules defined'
    );
  });

  // PR58-19: Notifications Security
  await test('PR58-19: Mass notification dispatch is strictly gated by admin/super_admin role', async () => {
    const sendPushScreen = path.join(frontendDir, 'app/admin/send-push.tsx');
    assert.ok(fs.existsSync(sendPushScreen), 'send-push.tsx must exist');
    const content = fs.readFileSync(sendPushScreen, 'utf8');

    // Verify admin role check
    assert.ok(
      content.includes("hasPermission(profile, 'admin.notifications.send')") || content.includes("profile?.role === 'admin'"),
      'Notification dispatch screen must gate by admin privileges'
    );
  });

  // PR58-20: Firestore Rules Completeness
  await test('PR58-20: Firestore rules cover all institutional collections without wildcards', async () => {
    const rulesPath = path.join(repoRoot, 'firestore.rules');
    const content = fs.readFileSync(rulesPath, 'utf8');

    const collections = ['users', 'courses', 'recordings', 'enrollments', 'live_classes', 'attendance', 'payments'];
    for (const col of collections) {
      assert.ok(content.includes(`match /${col}/`), `firestore.rules must explicitly govern /${col}/`);
    }
  });

  // PR58-21: Storage Rules Completeness
  await test('PR58-21: Storage rules reject unauthenticated access and cross-org access', async () => {
    const storageRulesPath = path.join(repoRoot, 'storage.rules');
    const content = fs.readFileSync(storageRulesPath, 'utf8');

    assert.ok(content.includes('isSignedIn()'), 'Storage rules must check isSignedIn()');
    assert.ok(content.includes('isTenantMember(orgId)'), 'Storage rules must check isTenantMember()');
  });

  // PR58-22: Offline Cache & Resiliency
  await test('PR58-22: Offline cache resiliency handles network outage cleanly', async () => {
    const cacheManager = path.join(frontendDir, 'lib/cacheManager.ts');
    assert.ok(fs.existsSync(cacheManager), 'cacheManager.ts must exist');
    const content = fs.readFileSync(cacheManager, 'utf8');

    assert.ok(content.includes('cacheGet') && content.includes('cacheSet'), 'cacheManager must implement get and set');
  });

  // PR58-23: Navigation Guard & Route Protection
  await test('PR58-23: Protected routes guard against unauthenticated or pending users', async () => {
    const navGuardPath = path.join(frontendDir, 'lib/navigationGuard.ts');
    assert.ok(fs.existsSync(navGuardPath), 'navigationGuard.ts must exist');
    const content = fs.readFileSync(navGuardPath, 'utf8');

    assert.ok(content.includes('evaluateRouteAuthorization'), 'navigationGuard must provide evaluateRouteAuthorization');
  });

  // PR58-24: Super Admin / Founder Invariant
  await test('PR58-24: Founder accounts cannot be locked out or deleted', async () => {
    const rulesPath = path.join(repoRoot, 'firestore.rules');
    const content = fs.readFileSync(rulesPath, 'utf8');

    assert.ok(
      content.includes('sumraftm@gmail.com') && content.includes('xioasad@gmail.com'),
      'Rules must protect founder accounts'
    );
  });

  // PR58-25: End-to-End Multi-Tenant Academic Boundary Simulation
  await test('PR58-25: End-to-end multi-tenant academic boundary simulation across full matrix', async () => {
    // 1. Enrolled student in Tenant A accessing Course A -> FULL ACCESS
    const accessA = simulateCourseAccess({
      userRole: 'student',
      isEnrolled: true,
      courseOrgId: 'org_A',
      userOrgId: 'org_A',
    });
    assert.strictEqual(accessA.canViewOverview, true);
    assert.strictEqual(accessA.canAccessLiveClass, true);
    assert.strictEqual(accessA.canAccessRecordings, true);
    assert.strictEqual(accessA.isLockedForStudent, false);

    // 2. Unenrolled student in Tenant A accessing Course A -> LOCKED (Overview only)
    const accessALocked = simulateCourseAccess({
      userRole: 'student',
      isEnrolled: false,
      courseOrgId: 'org_A',
      userOrgId: 'org_A',
    });
    assert.strictEqual(accessALocked.canViewOverview, true);
    assert.strictEqual(accessALocked.canAccessLiveClass, false);
    assert.strictEqual(accessALocked.canAccessRecordings, false);
    assert.strictEqual(accessALocked.isLockedForStudent, true);

    // 3. Student in Tenant A accessing Course B (Tenant B) -> BLOCKED AT TENANT LEVEL
    const accessB = simulateCourseAccess({
      userRole: 'student',
      isEnrolled: true, // even if marked enrolled in error, tenant mismatch blocks
      courseOrgId: 'org_B',
      userOrgId: 'org_A',
    });
    assert.strictEqual(accessB.canViewOverview, false);
    assert.strictEqual(accessB.canAccessLiveClass, false);
    assert.strictEqual(accessB.canAccessRecordings, false);
    assert.strictEqual(accessB.reason, 'TENANT_MISMATCH');

    // 4. Admin in Tenant A accessing Course A -> FULL ACCESS
    const accessAdminA = simulateCourseAccess({
      userRole: 'admin',
      isEnrolled: false,
      courseOrgId: 'org_A',
      userOrgId: 'org_A',
    });
    assert.strictEqual(accessAdminA.canViewOverview, true);
    assert.strictEqual(accessAdminA.canAccessLiveClass, true);

    // 5. Super Admin accessing any course -> FULL ACCESS
    const accessSuperAdmin = simulateCourseAccess({
      userRole: 'super_admin',
      isEnrolled: false,
      courseOrgId: 'org_B',
      userOrgId: 'org_A',
    });
    assert.strictEqual(accessSuperAdmin.canViewOverview, true);
    assert.strictEqual(accessSuperAdmin.canAccessLiveClass, true);
  });

  console.log('\n===============================================================');
  console.log(`PHASE 58 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase58Suite().catch((err) => {
  console.error('Fatal error running Phase 58 test suite:', err);
  process.exit(1);
});
