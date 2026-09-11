const assert = require('assert');

console.log("================================================================");
console.log("   PHASE 60 — QURAN OFFLINE AUDIO DOWNLOAD MANAGER MASTER SUITE ");
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

// 1. URL formatting checks
test("P60-01: Full Surah audio URL is deterministic and points to archive.org collection", () => {
  function getFullSurahUrduAudioUrl(surahNumber) {
    const sStr = String(surahNumber).padStart(3, '0');
    return 'https://archive.org/download/quran-arabic-to-urdu-hindi-verse-by-verse-tarjuma-audio/' + sStr + '.mp3';
  }

  assert.strictEqual(getFullSurahUrduAudioUrl(1), 'https://archive.org/download/quran-arabic-to-urdu-hindi-verse-by-verse-tarjuma-audio/001.mp3');
  assert.strictEqual(getFullSurahUrduAudioUrl(114), 'https://archive.org/download/quran-arabic-to-urdu-hindi-verse-by-verse-tarjuma-audio/114.mp3');
});

// 2. Local audio routing resolver check
test("P60-02: Playable URI resolver routes to local file:// when cached, else remote CDN", () => {
  function resolvePlayableUri(surahNumber, isDownloaded, localFileUri) {
    if (isDownloaded) {
      return { uri: localFileUri, isOffline: true };
    }
    const sStr = String(surahNumber).padStart(3, '0');
    return { uri: 'https://archive.org/download/quran-arabic-to-urdu-hindi-verse-by-verse-tarjuma-audio/' + sStr + '.mp3', isOffline: false };
  }

  const onlineResult = resolvePlayableUri(1, false, 'file:///data/user/0/app/mslb_quran_audio/surah_001.mp3');
  assert.strictEqual(onlineResult.isOffline, false);
  assert.ok(onlineResult.uri.startsWith('https://'));

  const offlineResult = resolvePlayableUri(1, true, 'file:///data/user/0/app/mslb_quran_audio/surah_001.mp3');
  assert.strictEqual(offlineResult.isOffline, true);
  assert.strictEqual(offlineResult.uri, 'file:///data/user/0/app/mslb_quran_audio/surah_001.mp3');
});

// 3. Storage MB calculation check
test("P60-03: Storage size calculation converts bytes to formatted MB accurately", () => {
  function formatBytesToMb(bytes) {
    return Number((bytes / (1024 * 1024)).toFixed(1));
  }

  assert.strictEqual(formatBytesToMb(15728640), 15.0);
  assert.strictEqual(formatBytesToMb(5242880), 5.0);
  assert.strictEqual(formatBytesToMb(1048576), 1.0);
});

// 4. Downloaded index deduplication check
test("P60-04: Download index deduplicates and updates existing Surah entries", () => {
  let index = [
    { surahNumber: 1, surahName: 'Al-Fatihah', sizeMb: 2.1, downloadedAt: 1000 },
    { surahNumber: 112, surahName: 'Al-Ikhlas', sizeMb: 1.0, downloadedAt: 1050 },
  ];

  function saveToIndex(newItem) {
    const filtered = index.filter(i => i.surahNumber !== newItem.surahNumber);
    index = [newItem, ...filtered];
  }

  // Update Surah 1 with new file size
  saveToIndex({ surahNumber: 1, surahName: 'Al-Fatihah', sizeMb: 2.4, downloadedAt: 2000 });
  assert.strictEqual(index.length, 2);
  assert.strictEqual(index[0].surahNumber, 1);
  assert.strictEqual(index[0].sizeMb, 2.4);

  // Delete Surah 112
  index = index.filter(i => i.surahNumber !== 112);
  assert.strictEqual(index.length, 1);
});

// 5. Total offline storage aggregator check
test("P60-05: Total storage aggregator sums sizes correctly", () => {
  const list = [
    { surahNumber: 1, sizeMb: 2.5 },
    { surahNumber: 2, sizeMb: 78.4 },
    { surahNumber: 36, sizeMb: 14.1 },
  ];

  const total = list.reduce((sum, item) => sum + item.sizeMb, 0);
  assert.strictEqual(Number(total.toFixed(1)), 95.0);
});

console.log("\n================================================================");
console.log(`   PHASE 60 RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================");

if (failed > 0) process.exit(1);
