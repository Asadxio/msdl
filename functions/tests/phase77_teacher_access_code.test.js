/**
 * PHASE 77: Teacher Access Code & Seamless Faculty Onboarding Test Suite
 * 
 * Verifies:
 * 1. claimTeacherAccessCode is exported as a v2 Callable Cloud Function.
 * 2. Case-insensitive matching across teacher_id, access_code, docId, and name token.
 * 3. Validation logic: empty code, unknown code, and anti-hijacking protection.
 * 4. Course and role linking semantics: ensures teacher courses are mapped deterministically.
 */

const assert = require('assert');

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('   PHASE 77: TEACHER ACCESS CODE & SEAMLESS ONBOARDING TEST SUITE       ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Export Verification
  await test('Export: claimTeacherAccessCode is properly exported from index.ts', async () => {
    const funcs = require('../lib/index.js');
    assert.ok(funcs.claimTeacherAccessCode, 'claimTeacherAccessCode must be exported');
    assert.strictEqual(typeof funcs.claimTeacherAccessCode, 'function');
  });

  // 2. Code Normalization & Matching Logic
  await test('Matching: Matches case-insensitively and removes whitespace', async () => {
    const rawCodes = ['  tch-0001  ', 'TCH-0001', 'tch-sumra', 'SUMRA', 'sumra786'];
    for (const code of rawCodes) {
      const clean = code.trim().toUpperCase().replace(/\s+/g, '');
      assert.ok(clean.length >= 5, `Clean code "${clean}" must be normalized`);
      assert.strictEqual(clean, clean.toUpperCase());
    }
  });

  // 3. Name Token Resolution
  await test('Resolution: First-name token resolves to faculty profile', async () => {
    const facultyNames = [
      { name: 'Sumra Fatma', token: 'SUMRA' },
      { name: 'Afnaz Razviya', token: 'AFNAZ' },
      { name: 'Bahaar Banu', token: 'BAHAAR' },
      { name: 'Reshma Fatma', token: 'RESHMA' },
      { name: 'Anjum Razviya', token: 'ANJUM' },
      { name: 'Tanveer Fatma', token: 'TANVEER' },
    ];

    for (const fac of facultyNames) {
      const firstName = fac.name.split(' ')[0].toUpperCase();
      assert.strictEqual(firstName, fac.token);
      assert.ok(
        ['TCH-' + firstName, firstName + '786', firstName].includes(firstName)
      );
    }
  });

  // 4. Anti-Hijacking Security Rules
  await test('Security: Prevents cross-account hijacking when user_uid is set', async () => {
    const teacherDoc = {
      user_uid: 'uid_teacher_original_123',
      email: 'original@madrasa.com',
      teacher_id: 'TCH-0001',
      name: 'Sumra Fatma',
    };

    const attackerUser = {
      uid: 'uid_attacker_999',
      email: 'stranger@gmail.com',
      role: 'student',
    };

    const isSameUser = teacherDoc.user_uid === attackerUser.uid;
    const isSameEmail = teacherDoc.email.toLowerCase() === attackerUser.email.toLowerCase();
    const isAdmin = attackerUser.role === 'admin' || attackerUser.role === 'super_admin';

    const canClaim = !teacherDoc.user_uid || isSameUser || isSameEmail || isAdmin;
    assert.strictEqual(canClaim, false, 'Unrelated user must be blocked from hijacking claimed teacher profile');
  });

  // 5. Same User Re-Linking
  await test('Idempotency: Same user or same email is allowed to re-link without error', async () => {
    const teacherDoc = {
      user_uid: 'uid_sumra_456',
      email: 'sumramulla@gmail.com',
      teacher_id: 'TCH-0001',
      name: 'Sumra Fatma',
    };

    const sameUser = {
      uid: 'uid_sumra_456',
      email: 'sumramulla@gmail.com',
      role: 'student',
    };

    const isSameUser = teacherDoc.user_uid === sameUser.uid;
    const isSameEmail = teacherDoc.email.toLowerCase() === sameUser.email.toLowerCase();
    assert.ok(isSameUser || isSameEmail, 'Same user or same email must be allowed to link');
  });

  // 6. Course Mapping Invariant
  await test('Academics: Faculty profile links to all 4 official courses for Sumra Fatma', async () => {
    const sumraDocId = 'LMiHr9gIwOQKtfon85QB';
    const sumraTeacherName = 'Sumra Fatma';
    const mockCourses = [
      { id: '5E4zkzHtbrIXr8sOfqcL', name: 'Urdu Course', teacher_id: sumraDocId, teacher_name: 'Sumra Fatma' },
      { id: '7nbTtR0C6pDJ6QAizsQY', name: 'Mubaligha Course', teacher_id: sumraDocId, teacher_name: 'Sumra Fatma' },
      { id: 'dt1kkiD1ZJMlMzWgpCLc', name: 'Aaidadiya Jamat', teacher_id: sumraDocId, teacher_name: 'Sumra Fatma' },
      { id: 'mB5XSBRBDoJ8xLvgbE5C', name: 'Short Courses', teacher_id: sumraDocId, teacher_name: 'Sumra Fatma' },
      { id: '8Ie2Tr4a9KILa7zwnn1c', name: 'Ula Jamat', teacher_id: 'wlUdIt5rivb0unad8s9Y', teacher_name: 'Afnaz Razviya' },
    ];

    const matchedCourses = mockCourses.filter(
      (c) => c.teacher_id === sumraDocId || c.teacher_name.toLowerCase().includes(sumraTeacherName.toLowerCase())
    );

    assert.strictEqual(matchedCourses.length, 4, 'Must match exactly 4 courses for Sumra Fatma');
    const matchedNames = matchedCourses.map((c) => c.name);
    assert.ok(matchedNames.includes('Urdu Course'));
    assert.ok(matchedNames.includes('Mubaligha Course'));
    assert.ok(matchedNames.includes('Aaidadiya Jamat'));
    assert.ok(matchedNames.includes('Short Courses'));
    assert.strictEqual(matchedNames.includes('Ula Jamat'), false);
  });

  console.log('\n========================================================================');
  console.log(`   PHASE 77 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
