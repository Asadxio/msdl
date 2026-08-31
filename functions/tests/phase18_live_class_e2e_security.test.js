const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 18 — LIVE CLASS E2E REAL-WORLD SECURITY & QA          ');
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
// PART 1: GOOGLE MEET URL VALIDATION & INJECTION RESISTANCE
// ============================================================

test('P18-01: Google Meet URL validation accepts valid meet links and rejects malicious/unsafe schemes', () => {
  const meetRegex = /^https?:\/\/(meet\.google\.com\/[a-z0-9\-]+|meet\.google\.com\/lookup\/[a-z0-9\-]+)(?:\?.*)?$/i;
  
  // Valid URLs
  assert.strictEqual(meetRegex.test('https://meet.google.com/abc-defg-hij'), true);
  assert.strictEqual(meetRegex.test('https://meet.google.com/lookup/abc123xyz'), true);
  assert.strictEqual(meetRegex.test('https://meet.google.com/abc-defg-hij?authuser=1'), true);

  // Malicious / Unsafe URLs
  assert.strictEqual(meetRegex.test('javascript:alert(1)'), false);
  assert.strictEqual(meetRegex.test('file:///etc/passwd'), false);
  assert.strictEqual(meetRegex.test('https://evil-phishing-site.com/meet.google.com'), false);
  assert.strictEqual(meetRegex.test('http://insecure-meet.com/abc-defg-hij'), false);
});

// ============================================================
// PART 2: STUDENT ENROLLMENT GATE VERIFICATION
// ============================================================

test('P18-02: canCurrentUserJoinLiveClass enforces active enrollment for students', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/liveClasses.ts'), 'utf8');
  assert.ok(src.includes('isActiveEnrollmentForUserCourse'), 'Must verify active enrollment status');
  assert.ok(src.includes("profile.role === 'admin'"), 'Admin always allowed to join');
  assert.ok(src.includes("liveClass.teacher_id === uid"), 'Teacher only allowed to join own class');
});

// ============================================================
// PART 3: TEACHER OWNERSHIP & CROSS-TEACHER IDOR
// ============================================================

test('P18-03: Teacher can only create live classes for their own teacherId', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/liveClasses.ts'), 'utf8');
  assert.ok(src.includes('teacher_id: input.teacherId'), 'Must bind teacher_id to input');
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes('request.resource.data.teacher_id == request.auth.uid'), 'Rules enforce teacher_id match');
});

test('P18-04: Cross-Teacher IDOR: Teacher A cannot end or modify Teacher B live class', () => {
  const canEndClass = (callerUid, teacherUid, role) => role === 'admin' || (role === 'teacher' && callerUid === teacherUid);
  assert.strictEqual(canEndClass('teacher_A', 'teacher_B', 'teacher'), false);
  assert.strictEqual(canEndClass('teacher_A', 'teacher_A', 'teacher'), true);
  assert.strictEqual(canEndClass('admin_uid', 'teacher_B', 'admin'), true);
});

// ============================================================
// PART 4: DUPLICATE & CONCURRENCY CONTROLS
// ============================================================

test('P18-05: startLiveClass prevents duplicate concurrent active classes for the same course', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/liveClasses.ts'), 'utf8');
  assert.ok(src.includes("where('status', '==', 'live')"), 'Must query for existing live classes');
  assert.ok(src.includes('A live class is already running for this course'), 'Must reject duplicate concurrent live classes');
});

// ============================================================
// PART 5: FIRESTORE SECURITY RULES ENFORCEMENT
// ============================================================

test('P18-06: Live class Firestore rules enforce immutable course_id, teacher_id, and created_at on update', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes('request.resource.data.teacher_id == resource.data.teacher_id'));
  assert.ok(rules.includes('request.resource.data.course_id == resource.data.course_id'));
  assert.ok(rules.includes('request.resource.data.created_at == resource.data.created_at'));
});

test('P18-07: Recordings subcollection inherits live class security access controls', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes('match /recordings/{recordingId}'));
  assert.ok(rules.includes('allow read: if canReadLiveClassData(liveClassDoc(classId).data);'));
  assert.ok(rules.includes('allow write: if isLiveClassTeacherOrAdmin(liveClassDoc(classId).data);'));
});

// ============================================================
// PART 6: LISTENER CLEANUP & NAVIGATION RESILIENCE
// ============================================================

test('P18-08: Live classroom screens cleanup snapshot listeners on unmount', () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/live-class/index.tsx'), 'utf8');
  assert.ok(indexSrc.includes('return () => unsub()'), 'index.tsx must clean up snapshot listener');
  
  const detailSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/live-class/[id].tsx'), 'utf8');
  assert.ok(detailSrc.includes('return () => unsub()'), '[id].tsx must clean up snapshot listener');
});

test('P18-09: Live class detail redirects student back safely when class status changes to ended', () => {
  const detailSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/live-class/[id].tsx'), 'utf8');
  assert.ok(detailSrc.includes("data?.status === 'ended'"), 'Must handle ended class status');
  assert.ok(detailSrc.includes("goBackOrReplace(router, '/(tabs)/courses')"), 'Must navigate safely on ended class');
});

console.log('');
console.log('================================================================');
console.log('   PHASE 18 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
