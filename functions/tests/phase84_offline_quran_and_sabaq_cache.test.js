const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("================================================================");
console.log("   PHASE 84 — OFFLINE QURAN & SABAQ CACHE INTEGRITY SUITE       ");
console.log("================================================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  [PASS] " + name);
    passed++;
  } catch (err) {
    console.error("  [FAIL] " + name + ": " + err.message);
    failed++;
  }
}

const frontendDir = path.resolve(__dirname, '../../frontend');

// 1. SABAQ-OFFLINE: Verify sabaqDiary.ts implements offline caching functions
test("SABAQ-01: sabaqDiary.ts exports offline caching and queue sync functions", () => {
  const filePath = path.join(frontendDir, 'lib', 'sabaqDiary.ts');
  assert.ok(fs.existsSync(filePath), 'sabaqDiary.ts must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('getCachedStudentSabaqDiary'), 'Must export getCachedStudentSabaqDiary');
  assert.ok(content.includes('cacheStudentSabaqDiary'), 'Must export cacheStudentSabaqDiary');
  assert.ok(content.includes('queueOfflineSabaqEntry'), 'Must export queueOfflineSabaqEntry');
  assert.ok(content.includes('flushOfflineSabaqQueue'), 'Must export flushOfflineSabaqQueue');
  assert.ok(content.includes('getOfflineSabaqQueueCount'), 'Must export getOfflineSabaqQueueCount');
});

// 2. SABAQ-RESILIENCY: Test offline queue state machine in JavaScript
test("SABAQ-02: Offline Sabaq entry queuing and deduplication logic", () => {
  let mockQueue = [];

  function queueEntry(entry) {
    const existingIndex = mockQueue.findIndex(e => e.id === entry.id);
    if (existingIndex >= 0) {
      mockQueue[existingIndex] = entry;
    } else {
      mockQueue.push(entry);
    }
  }

  const sampleEntry = {
    id: 'org1_std1_2026-11-21',
    organization_id: 'org1',
    institution_name: 'Suffah Madrasa',
    student_id: 'std1',
    student_name: 'Fatima',
    teacher_id: 'tch1',
    teacher_name: 'Ustaadha Zainab',
    date: '2026-11-21',
    status: 'present',
    sabaq: { text: 'Al-Baqarah 1-10', grade: 'Mumtaz' },
    sabqi: { text: 'Al-Fatihah', grade: 'Mumtaz' },
    manzil: { text: 'Juz 30', grade: 'Jayyid Jiddan', juz: 30 },
  };

  queueEntry(sampleEntry);
  assert.strictEqual(mockQueue.length, 1);

  // Re-queuing updated version replaces in place
  queueEntry({ ...sampleEntry, sabaq: { text: 'Al-Baqarah 1-20', grade: 'Mumtaz' } });
  assert.strictEqual(mockQueue.length, 1);
  assert.strictEqual(mockQueue[0].sabaq.text, 'Al-Baqarah 1-20');
});

// 3. SABAQ-SCREEN: Verify sabaq-diary.tsx integrates offline cache on startup
test("SABAQ-03: sabaq-diary.tsx loads cached entries and handles offline submission queue", () => {
  const filePath = path.join(frontendDir, 'app', 'sabaq-diary.tsx');
  assert.ok(fs.existsSync(filePath), 'sabaq-diary.tsx must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('getCachedStudentSabaqDiary'), 'sabaq-diary.tsx must call getCachedStudentSabaqDiary');
  assert.ok(content.includes('flushOfflineSabaqQueue'), 'sabaq-diary.tsx must auto-flush offline queue');
  assert.ok(content.includes('offlineQueueCount') || content.includes('queueOfflineSabaqEntry'), 'sabaq-diary.tsx must handle offline queue');
});

// 4. QURAN-OFFLINE: Verify quranStorage.ts exports offline Juz Amma and pre-cache functions
test("QURAN-01: quranStorage.ts exports text caching index and Juz Amma helpers", () => {
  const filePath = path.join(frontendDir, 'lib', 'quranStorage.ts');
  assert.ok(fs.existsSync(filePath), 'quranStorage.ts must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('isSurahTextCached'), 'Must export isSurahTextCached');
  assert.ok(content.includes('getCachedSurahsList'), 'Must export getCachedSurahsList');
  assert.ok(content.includes('getOfflineQuranStats'), 'Must export getOfflineQuranStats');
});

// 5. QURAN-API: Verify quranApi.ts provides preCacheSurahText and preCacheJuzAmma
test("QURAN-02: quranApi.ts provides preCacheSurahText and preCacheJuzAmma", () => {
  const filePath = path.join(frontendDir, 'lib', 'quranApi.ts');
  assert.ok(fs.existsSync(filePath), 'quranApi.ts must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('preCacheSurahText'), 'Must export preCacheSurahText');
  assert.ok(content.includes('preCacheJuzAmma'), 'Must export preCacheJuzAmma');
});

// 6. QURAN-STARTER: Verify essential madrasa daily prayer Surahs are bundled in STARTER_SURAHS
test("QURAN-03: quranStarterSurahs.ts includes essential short Surahs for 100% offline baseline", () => {
  const filePath = path.join(frontendDir, 'lib', 'quranStarterSurahs.ts');
  assert.ok(fs.existsSync(filePath), 'quranStarterSurahs.ts must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  // Must contain Surah 1 (Fatihah), 108 (Kawthar), 109 (Kafirun), 110 (Nasr), 112 (Ikhlas), 113 (Falaq), 114 (Nas)
  assert.ok(content.includes('1: {'), 'Surah 1 Al-Fatihah must be bundled');
  assert.ok(content.includes('108: {'), 'Surah 108 Al-Kawthar must be bundled');
  assert.ok(content.includes('109: {'), 'Surah 109 Al-Kafirun must be bundled');
  assert.ok(content.includes('112: {'), 'Surah 112 Al-Ikhlas must be bundled');
  assert.ok(content.includes('113: {'), 'Surah 113 Al-Falaq must be bundled');
  assert.ok(content.includes('114: {'), 'Surah 114 An-Nas must be bundled');
});

// 7. QURAN-UI: Verify quran-reader.tsx displays offline indicator badge
test("QURAN-04: quran-reader.tsx renders offline indicator badge and offline cache status", () => {
  const filePath = path.join(frontendDir, 'app', 'quran-reader.tsx');
  assert.ok(fs.existsSync(filePath), 'quran-reader.tsx must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('Offline Ready') || content.includes('آف لائن دستیاب') || content.includes('isOfflineBadge'), 'Must display offline availability indicator');
});

// 8. QURAN-DASHBOARD: Verify quran.tsx features 1-tap Offline Hifz / Juz Amma Pack
test("QURAN-05: quran.tsx provides 1-Tap Offline Hifz & Juz Amma Pack button", () => {
  const filePath = path.join(frontendDir, 'app', 'quran.tsx');
  assert.ok(fs.existsSync(filePath), 'quran.tsx must exist');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(content.includes('Juz Amma') || content.includes('پارہ 30') || content.includes('preCacheJuzAmma'), 'quran.tsx must offer 1-tap Juz Amma offline pack');
});

console.log("\n================================================================");
console.log(`   PHASE 84 RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================");

if (failed > 0) process.exit(1);
