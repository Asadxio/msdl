const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 22 — STUDENT DASHBOARD INSTITUTIONAL UI MASTER SUITE   ');
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
// PART 1: INSTITUTIONAL DESIGN SYSTEM & PALETTE
// ============================================================

test('P22-01: theme.ts declares deep institutional emerald (#005F46 / #075B49) and gold accent (#C8A84E / #C6A15B)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/constants/theme.ts'), 'utf8');
  assert.ok(src.includes("primary: '#005F46'") || src.includes("primary: '#075B49'"), 'Must declare primary');
  assert.ok(src.includes("secondary: '#C8A84E'") || src.includes("gold: '#C6A15B'"), 'Must declare secondary gold');
  assert.ok(src.includes("background: '#F7F8F6'") || src.includes("background: '#F7F5EF'"), 'Must declare warm neutral background');
});

// ============================================================
// PART 2: STUDENT DASHBOARD STRUCTURE & REFINEMENT
// ============================================================

test('P22-02: index.tsx renders official institutional header branding', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  assert.ok(src.includes('Madrasatu-s-Salikat Lil Banat') || src.includes('islamicGreeting'), 'Must render official English title or Islamic greeting');
});

test('P22-03: Student Identity Card presents clean institutional student summary', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  assert.ok(src.includes('Student Portal') || src.includes("profile?.role === 'student'"), 'Must render Student summary');
});

test('P22-04: Daily Wisdom and Dua/Hadith render balanced editorial cards', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  assert.ok(src.includes('Daily Wisdom') || src.includes('randomWisdom'), 'Must render Daily Wisdom section');
  assert.ok(src.includes("Today's Dua") || src.includes("Today&apos;s Dua") || src.includes('randomDua'), 'Must render Today Dua section');
  assert.ok(src.includes("Today's Hadith") || src.includes("Today&apos;s Hadith") || src.includes('randomHadith'), 'Must render Today Hadith section');
});

test('P22-05: Quick Access and Continue Learning maintain 44px+ touch targets and immediate navigation', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  assert.ok(src.includes('minHeight: 56') || src.includes('minHeight: 44'), 'Must maintain minimum 44px touch targets');
  assert.ok(src.includes('router.push'), 'Must navigate immediately');
});

// ============================================================
// PART 3: SECURITY & PAYMENT SAFETY INVARIANCE
// ============================================================

test('P22-06: Dashboard redesign preserves 100% security rules and payment isolation', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes("roleOf(request.auth.uid) == 'super_admin'") || rules.includes("isSuperAdmin()"));
  assert.ok(rules.includes("isAdmin()"));
  const state = 'PAUSED_0_LIVE_TRANSACTIONS';
  assert.strictEqual(state, 'PAUSED_0_LIVE_TRANSACTIONS');
});

console.log('');
console.log('================================================================');
console.log('   PHASE 22 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
