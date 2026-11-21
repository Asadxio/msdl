const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..', '..');

console.log('================================================================');
console.log('   PHASE 85 — REAL-WORLD UX SIMPLIFICATION VERIFICATION SUITE   ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: TEACHER REAL-WORLD UX (GHALATI 1, 2, 3)
// ─────────────────────────────────────────────────────────────────────────────

test('G1-01: Sabaq Diary provides interactive Student Roster Picker without typing UIDs', () => {
  const file = fs.readFileSync(path.join(repoRoot, 'frontend/app/sabaq-diary.tsx'), 'utf8');
  assert.ok(file.includes('rosterStudents'), 'Must fetch students from roster for interactive selection');
  assert.ok(file.includes('pickerStudentChip'), 'Must provide interactive chips to pick students by name');
  assert.ok(!file.includes('Student account UID: a7B9xQ8...'), 'Must NOT ask teachers to manually type raw Firebase UIDs');
});

test('G2-01: Sabaq Diary dual-syncs attendance status with official attendance collection', () => {
  const file = fs.readFileSync(path.join(repoRoot, 'frontend/lib/sabaqDiary.ts'), 'utf8');
  assert.ok(file.includes("getAttendanceDocId"), 'Must generate canonical attendance doc ID');
  assert.ok(file.includes("collection(db, 'attendance')"), 'Must dual-sync to attendance collection');
  assert.ok(file.includes("setDoc(attRef"), 'Must write attendance status when recording Sabaq entry');
});

test('G3-01: Teacher Dashboard provides 1-Tap Quick Live Class launcher', () => {
  const file = fs.readFileSync(path.join(repoRoot, 'frontend/components/teacher/TeacherDashboard.tsx'), 'utf8');
  assert.ok(file.includes('handleQuickGoLive'), 'Must implement handleQuickGoLive function');
  assert.ok(file.includes('quickLiveLaunchCard'), 'Must render quickLiveLaunchCard banner');
  assert.ok(file.includes('⚡ Go Live Now • کلاس شروع کریں'), 'Must render prominent 1-tap Go Live CTA');
  assert.ok(file.includes('startLiveClass'), 'Must invoke startLiveClass directly');
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: STUDENT & PARENT REAL-WORLD UX (GHALATI 4, 6)
// ─────────────────────────────────────────────────────────────────────────────

test('G4-01: Student Home screen renders Today Sabaq & Live Class Hero card at the top', () => {
  const indexFile = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/index.tsx'), 'utf8');
  const heroCardFile = fs.readFileSync(path.join(repoRoot, 'frontend/components/dashboard/StudentTodayHeroCard.tsx'), 'utf8');

  assert.ok(indexFile.includes('StudentTodayHeroCard'), 'HomeScreen must import and render StudentTodayHeroCard');
  assert.ok(heroCardFile.includes('LIVE CLASS NOW • جاری کلاس'), 'Hero card must alert student when Live class is active');
  assert.ok(heroCardFile.includes('Today\'s Sabaq Diary'), 'Hero card must feature Sabaq, Sabqi, and Manzil');
  assert.ok(heroCardFile.includes('sabaq_records'), 'Hero card must query sabaq_records for student');
});

test('G6-01: Payment Screen provides 1-Tap Direct UPI Monthly Fee Checkout', () => {
  const file = fs.readFileSync(path.join(repoRoot, 'frontend/app/payment.tsx'), 'utf8');
  assert.ok(file.includes('quickFeePayCard'), 'Payment screen must feature 1-tap quick fee pay card');
  assert.ok(file.includes('launchSpecificUpiApp(\'phonepe\')'), 'Must support 1-tap PhonePe launch');
  assert.ok(file.includes('launchSpecificUpiApp(\'gpay\')'), 'Must support 1-tap Google Pay launch');
  assert.ok(file.includes('launchSpecificUpiApp(\'paytm\')'), 'Must support 1-tap Paytm launch');
  assert.ok(file.includes('instantPayNowBtn'), 'Must have instant 1-tap pay button');
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3: ADMIN & NAVIGATION REAL-WORLD UX (GHALATI 7, 8, 9)
// ─────────────────────────────────────────────────────────────────────────────

test('G7-01: Admin Users screen provides 1-Tap Bulk Approve All Pending button', () => {
  const file = fs.readFileSync(path.join(repoRoot, 'frontend/app/admin/users.tsx'), 'utf8');
  assert.ok(file.includes('handleApproveAllPending'), 'Must have handleApproveAllPending function');
  assert.ok(file.includes('pendingAlertBanner'), 'Must render pending alert banner when pending users exist');
  assert.ok(file.includes('quickCardApproveBadge'), 'Must have 1-tap quick approve button on user cards');
});

test('G8-01: Admin Add Book provides native phone PDF file picker and Cloud Storage upload', () => {
  const file = fs.readFileSync(path.join(repoRoot, 'frontend/app/admin/add-book.tsx'), 'utf8');
  const storageRules = fs.readFileSync(path.join(repoRoot, 'storage.rules'), 'utf8');

  assert.ok(file.includes('DocumentPicker.getDocumentAsync'), 'Must use expo-document-picker for native PDF selection');
  assert.ok(file.includes('uploadBytes'), 'Must upload PDF to Firebase Storage');
  assert.ok(file.includes('pdfPickerBtn'), 'Must render phone PDF picker button');
  assert.ok(storageRules.includes('match /organizations/{orgId}/library/{fileName}'), 'Storage rules must permit tenant library PDF uploads');
});

test('G9-01: Bottom Tabs Layout promotes Live Dars to bottom bar navigation', () => {
  const layoutFile = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/_layout.tsx'), 'utf8');
  const liveClassTabFile = path.join(repoRoot, 'frontend/app/(tabs)/live-class.tsx');

  assert.ok(fs.existsSync(liveClassTabFile), 'frontend/app/(tabs)/live-class.tsx must exist');
  assert.ok(layoutFile.includes('name="live-class"'), 'Bottom bar must include live-class tab');
  assert.ok(layoutFile.includes('title: \'Live Dars\''), 'Tab title must be Live Dars');
  assert.ok(layoutFile.includes('name="notifications" options={{ href: null }}'), 'Notifications must remain accessible without cluttering bottom bar');
});

console.log('\n================================================================');
console.log(`   PHASE 85 RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
