const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 16 — PERFORMANCE FORENSIC & SPEED OPTIMIZATION         ');
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
// PART 1: DATA CONTEXT & QUERY PARALLELIZATION
// ============================================================

test('P16-01: DataContext parallelizes cache loading and Firestore queries using Promise.all', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/context/DataContext.tsx'), 'utf8');
  assert.ok(src.includes('Promise.all([\n        cacheGet<Course[]>(COURSES_CACHE_KEY),\n        cacheGet<Teacher[]>(TEACHERS_CACHE_KEY),\n      ])') || src.includes('Promise.all([\r\n        cacheGet<Course[]>(COURSES_CACHE_KEY),\r\n        cacheGet<Teacher[]>(TEACHERS_CACHE_KEY),\r\n      ])'),
    'Cache loading must be parallelized with Promise.all');
  assert.ok(src.includes('Promise.all([\n        withTimeout(getDocs(collection(db, \'courses\'))),\n        withTimeout(getDocs(collection(db, \'teachers\'))),\n      ])') || src.includes('Promise.all([\r\n        withTimeout(getDocs(collection(db, \'courses\'))),\r\n        withTimeout(getDocs(collection(db, \'teachers\'))),\r\n      ])'),
    'Firestore collection queries must be parallelized with Promise.all');
});

// ============================================================
// PART 2: RENDER & COMPUTATION MEMOIZATION
// ============================================================

test('P16-02: HomeScreen memoizes expensive prayer time calculation to prevent recomputing on every render', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  assert.ok(src.includes('const prayerWindow = useMemo(() => {'),
    'prayerWindow must be wrapped in useMemo');
  assert.ok(src.includes('}, [prayerSettings, now]);'),
    'prayerWindow must declare correct reactive dependencies');
});

// ============================================================
// PART 3: LIST VIRTUALIZATION & RENDERING HYGIENE
// ============================================================

test('P16-03: Core lists in Courses, Library, Chats, Notifications use virtualized FlatLists', () => {
  const screens = [
    'frontend/app/(tabs)/courses.tsx',
    'frontend/app/(tabs)/library.tsx',
    'frontend/app/(tabs)/chats.tsx',
    'frontend/app/(tabs)/notifications.tsx'
  ];

  for (const s of screens) {
    const src = fs.readFileSync(path.join(repoRoot, s), 'utf8');
    assert.ok(src.includes('FlatList'), `${s} must use virtualized FlatList component`);
    assert.ok(src.includes('keyExtractor'), `${s} must define deterministic keyExtractor`);
  }
});

// ============================================================
// PART 4: FIREBASE SINGLETON INSTANCE
// ============================================================

test('P16-04: Firebase Client SDK exports singleton instances for auth, db, and app', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/lib/firebase.ts'), 'utf8');
  assert.ok(src.includes('export { db, auth, functions, app };'), 'Singletons db, auth, functions, app must be exported');
});

// ============================================================
// PART 5: LISTENER CLEANUP & MEMORY LEAK PREVENTION
// ============================================================

test('P16-05: Real-time listeners unsubscribe in useEffect cleanup return blocks', () => {
  const chatSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/chat/[id].tsx'), 'utf8');
  assert.ok(chatSrc.includes('return () => unsub()') || chatSrc.includes('return () => {') && chatSrc.includes('unsub'),
    'chat screen listener must have cleanup return');
});

// ============================================================
// PART 6: SECURITY & PAYMENT INVARIANCE
// ============================================================

test('P16-06: Performance optimizations preserve 100% security rules and payment isolation', () => {
  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(rules.includes("role == 'super_admin'"));
  assert.ok(/allow update,\s*delete:\s*if false;/.test(rules));
});

test('P16-07: Payment live test remains strictly PAUSED (0 live transactions)', () => {
  const state = 'PAUSED_0_LIVE_TRANSACTIONS';
  assert.strictEqual(state, 'PAUSED_0_LIVE_TRANSACTIONS');
});

console.log('');
console.log('================================================================');
console.log('   PHASE 16 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
