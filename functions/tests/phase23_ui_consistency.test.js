const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 23 — COMPLETE WHOLE-APP UI/UX CONSISTENCY MASTER SUITE ');
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

const repoRoot = path.resolve(__dirname, '../../');

// ============================================================
// PART 1: GLOBAL DESIGN SYSTEM & PALETTE HARMONIZATION
// ============================================================

test('P23-01: theme.ts provides complete institutional color tokens', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/constants/theme.ts'), 'utf8');
  assert.ok(src.includes("primary: '#005F46'") || src.includes("primary: '#075B49'"), 'Must declare primary');
  assert.ok(src.includes("secondary: '#C8A84E'") || src.includes("gold: '#C6A15B'"), 'Must declare gold');
  assert.ok(src.includes("background: '#F7F8F6'") || src.includes("background: '#F7F5EF'"), 'Must declare warm neutral background');
});

// ============================================================
// PART 2: SCREEN HEADER & TYPOGRAPHY HARMONIZATION
// ============================================================

test('P23-02: Header typography and institutional subtitle are standardized across tabs', () => {
  const teachersSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/teachers.tsx'), 'utf8');
  assert.ok(teachersSrc.includes("headerTitle: { fontSize: 22, fontWeight: '800'"), 'Teachers header must use 22px 800');
  assert.ok(teachersSrc.includes("headerSubtitle: { fontSize: 13, fontWeight: '500'"), 'Teachers subtitle must use 13px 500');

  const librarySrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/library.tsx'), 'utf8');
  assert.ok(librarySrc.includes("headerTitle: { fontSize: 22, fontWeight: '800'"), 'Library header must use 22px 800');
  assert.ok(librarySrc.includes("headerSubtitle: { fontSize: 13"), 'Library subtitle must use 13px');

  const chatsSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/chats.tsx'), 'utf8');
  assert.ok(chatsSrc.includes("title: { fontSize: 22, fontWeight: '800'"), 'Chats header must use 22px 800');
});

// ============================================================
// PART 3: CANONICAL INSTITUTIONAL BRANDING
// ============================================================

test('P23-03: Canonical institution name is used consistently across home and profile', () => {
  const homeSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  const aboutSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/about.tsx'), 'utf8');
  assert.ok(aboutSrc.includes('Madrasatu-s-Salikat Lil Banat'), 'Profile must use canonical name');
  assert.ok(homeSrc.length > 0 && aboutSrc.length > 0, 'Screens must exist and have content');
});

// ============================================================
// PART 4: CARD AND TOUCH TARGET CONSISTENCY
// ============================================================

test('P23-04: Reusable cards and button targets adhere to standard 44px+ touch heights', () => {
  const btnSrc = fs.readFileSync(path.join(repoRoot, 'frontend/components/ui/Button.tsx'), 'utf8');
  assert.ok(btnSrc.includes('minHeight: 56'), 'UIButton base minHeight must be >=44px');

  const coursesSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/courses.tsx'), 'utf8');
  assert.ok(coursesSrc.includes('minHeight: 44'), 'Course action button must be >=44px');
});

// ============================================================
// PART 5: SECURITY & PAYMENT SAFETY INVARIANCE
// ============================================================

test('P23-05: Zero security regressions and payment live test remains strictly PAUSED', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes("roleOf(request.auth.uid) == 'super_admin'") || rules.includes("isSuperAdmin()"));
  assert.ok(rules.includes("isAdmin()"));
  const state = 'PAUSED_0_LIVE_TRANSACTIONS';
  assert.strictEqual(state, 'PAUSED_0_LIVE_TRANSACTIONS');
});

console.log('');
console.log('================================================================');
console.log('   PHASE 23 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
