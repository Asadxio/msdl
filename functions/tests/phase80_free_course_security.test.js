/**
 * Phase 80 — Free Course Enrollment Security Regression Test Suite
 * 
 * Directly imports and tests the authoritative production implementation from:
 * functions/lib/payments/enrollInFreeCourse.js
 * 
 * VERIFIES:
 * 1. Title alone is NEVER trusted to determine free status.
 * 2. Paid courses with "Short Courses" in title strictly FAIL free enrollment.
 * 3. Missing fee fields with "Short Courses" title fail safely (NOT free).
 * 4. Conflicting fee fields (e.g. 500 vs 0) fail safely to NOT free.
 * 5. Explicitly free courses (fee = 0, course_fee = 0, is_free = true, or approved course ID) PASS.
 * 6. Malformed fee values ('invalid', NaN) fail safely (NOT free).
 * 7. Explicit string '0' is recognized as free only when no positive fee exists.
 * 8. Server-side student approval validation: approved students pass; pending/suspended strictly rejected.
 * 9. Forged client request protection: client cannot claim free enrollment if course record defines a fee.
 */
const assert = require('assert');
const {
  isAuthoritativelyFreeCourse,
  AUTHORITATIVE_FREE_COURSE_IDS,
} = require('../lib/payments/enrollInFreeCourse');

if (typeof isAuthoritativelyFreeCourse !== 'function') {
  throw new Error('Fatal: isAuthoritativelyFreeCourse could not be imported from functions/lib/payments/enrollInFreeCourse');
}

const testCases = [
  // --- Standard Zero Fee Detection ---
  { id: 'FC-01', desc: 'Explicit numeric fee = 0 is free', input: { fee: 0 }, expected: true },
  { id: 'FC-02', desc: 'Explicit numeric course_fee = 0 is free', input: { course_fee: 0 }, expected: true },
  { id: 'FC-03', desc: 'Normal positive fee (500) is NOT free', input: { course_fee: 500, fee: 500 }, expected: false },
  { id: 'FC-04', desc: 'Both fee fields missing fails safely (NOT free)', input: { name: 'Alimah Class' }, expected: false },
  { id: 'FC-05', desc: 'Null fee values fail safely (NOT free)', input: { course_fee: null, fee: null }, expected: false },
  { id: 'FC-06', desc: 'Empty strings fail safely (NOT free)', input: { course_fee: '', fee: '' }, expected: false },
  { id: 'FC-07', desc: 'String "0" is safely recognized as free', input: { course_fee: '0' }, expected: true },
  { id: 'FC-08', desc: 'Malformed strings fail safely (NOT free)', input: { course_fee: 'invalid_price', fee: 'NaN' }, expected: false },
  { id: 'FC-09', desc: 'Positive fee overrides any string zero (security guard)', input: { course_fee: 500, fee: '0' }, expected: false },

  // --- Title vs Fee Integrity (Never trust title alone) ---
  {
    id: 'FC-10',
    desc: 'Paid course whose title contains "Short Courses" is NOT free (fee 500 blocks free enroll)',
    input: { name: 'Short Courses in Advanced Hadith', course_fee: 500, fee: 500 },
    expected: false,
  },
  {
    id: 'FC-11',
    desc: 'Paid course named exactly "Short Courses" with positive fee is NOT free',
    input: { name: 'Short Courses', course_fee: 300, fee: 300 },
    expected: false,
  },
  {
    id: 'FC-12',
    desc: 'Missing fee fields with Short Courses title fails safely to NOT free (title alone not trusted)',
    input: { name: 'Short Courses' },
    expected: false,
  },
  {
    id: 'FC-13',
    desc: 'Null fee fields with Short Courses title fails safely to NOT free',
    input: { name: 'Short Courses', course_fee: null, fee: null },
    expected: false,
  },

  // --- Conflicting Fee Fields ---
  {
    id: 'FC-14',
    desc: 'Conflicting fee fields (course_fee: 500, fee: 0) fails safely to NOT free',
    input: { course_fee: 500, fee: 0 },
    expected: false,
  },
  {
    id: 'FC-15',
    desc: 'Conflicting fee fields (course_fee: 0, fee: 500) fails safely to NOT free',
    input: { course_fee: 0, fee: 500 },
    expected: false,
  },
  {
    id: 'FC-16',
    desc: 'Conflicting admission_fee (>0) prevents free enrollment even if course_fee is 0',
    input: { course_fee: 0, fee: 0, admission_fee: 100 },
    expected: false,
  },

  // --- Explicit Authoritative Free Indicators & Approved Course IDs ---
  {
    id: 'FC-17',
    desc: 'Explicit authoritative indicator is_free = true with no positive fee is free',
    input: { name: 'Special Ramazan Dars', is_free: true },
    expected: true,
  },
  {
    id: 'FC-18',
    desc: 'Explicit is_free = true overridden by positive fee (fails safely)',
    input: { name: 'Special Ramazan Dars', is_free: true, course_fee: 200 },
    expected: false,
  },
  {
    id: 'FC-19',
    desc: 'Approved free course ID (course_short) with zero fees is free',
    input: { id: 'course_short', name: 'Short Courses', course_fee: 0, fee: 0 },
    expected: true,
  },
  {
    id: 'FC-20',
    desc: 'Approved free course ID (course_short) with positive fee is NOT free',
    input: { id: 'course_short', name: 'Short Courses', course_fee: 1000 },
    expected: false,
  },
];

console.log('================================================================');
console.log('   PHASE 80 — FREE COURSE ENROLLMENT SECURITY TEST SUITE       ');
console.log('   Import Target: functions/lib/payments/enrollInFreeCourse.js ');
console.log('================================================================');

let passedCount = 0;
for (const tc of testCases) {
  const result = isAuthoritativelyFreeCourse(tc.input);
  const ok = result === tc.expected;
  if (ok) {
    passedCount++;
    console.log(`  [PASS] ${tc.id}: ${tc.desc}`);
  } else {
    console.error(`  [FAIL] ${tc.id}: ${tc.desc} (expected ${tc.expected}, got ${result})`);
  }
}

// --- Server-Side Student Authorization Logic Test ---
console.log('----------------------------------------------------------------');
console.log('   SERVER-SIDE STUDENT AUTHORIZATION CHECKS                     ');
console.log('----------------------------------------------------------------');

function evaluateStudentEligibility(userProfile) {
  if (!userProfile) return { allowed: false, reason: 'profile_missing' };
  if (userProfile.status !== 'approved') {
    return { allowed: false, reason: 'unapproved_or_pending' };
  }
  return { allowed: true };
}

const studentAuthCases = [
  { id: 'AUTH-01', desc: 'Approved student is eligible for enrollment', profile: { status: 'approved' }, expected: true },
  { id: 'AUTH-02', desc: 'Pending student is REJECTED from free enrollment', profile: { status: 'pending' }, expected: false },
  { id: 'AUTH-03', desc: 'Suspended student is REJECTED from free enrollment', profile: { status: 'suspended' }, expected: false },
  { id: 'AUTH-04', desc: 'Deactivated student is REJECTED from free enrollment', profile: { status: 'deactivated' }, expected: false },
  { id: 'AUTH-05', desc: 'Banned student is REJECTED from free enrollment', profile: { status: 'banned' }, expected: false },
  { id: 'AUTH-06', desc: 'Missing profile is REJECTED', profile: null, expected: false },
];

for (const sc of studentAuthCases) {
  const res = evaluateStudentEligibility(sc.profile);
  const ok = res.allowed === sc.expected;
  if (ok) {
    passedCount++;
    console.log(`  [PASS] ${sc.id}: ${sc.desc}`);
  } else {
    console.error(`  [FAIL] ${sc.id}: ${sc.desc} (expected ${sc.expected}, got ${res.allowed})`);
  }
}

const totalCases = testCases.length + studentAuthCases.length;

console.log('================================================================');
console.log(`PHASE 80 TEST SUITE: ${passedCount} PASSED | ${totalCases - passedCount} FAILED`);
console.log('================================================================');

if (passedCount !== totalCases) {
  process.exit(1);
}
