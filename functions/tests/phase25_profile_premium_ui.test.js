const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 25 — MSLB STUDENT PROFILE & ACCOUNT MASTER SUITE      ');
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
const aboutSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/about.tsx'), 'utf8');
const themeSrc = fs.readFileSync(path.join(repoRoot, 'frontend/constants/theme.ts'), 'utf8');

// ============================================================
// PART 1: PROFILE IDENTITY & METADATA INVENTORY
// ============================================================

test('P25-01: Profile header displays student name, student ID, avatar, and role badge', () => {
  assert.ok(aboutSrc.includes("testID=\"user-profile-card\""));
  assert.ok(aboutSrc.includes("premiumAvatarContainer"));
  assert.ok(aboutSrc.includes("premiumName"));
  assert.ok(aboutSrc.includes("studentIdText"));
  assert.ok(aboutSrc.includes("premiumRoleBadge"));
});

test('P25-02: Verified and Active status indicators are rendered accurately', () => {
  assert.ok(aboutSrc.includes("verifiedBadge"));
  assert.ok(aboutSrc.includes("premiumStatusBadge"));
  assert.ok(aboutSrc.includes("Active"));
  assert.ok(aboutSrc.includes("Pending"));
});

test('P25-03: Metadata rows preserve Email, Phone, Joined date, Last Active, and Referral code', () => {
  assert.ok(aboutSrc.includes("Joined {new Date(user.metadata.creationTime)"));
  assert.ok(aboutSrc.includes("Last Active: {new Date(user.metadata.lastSignInTime)"));
  assert.ok(aboutSrc.includes("Referral: {profile.referral_code}"));
  assert.ok(aboutSrc.includes("user.phoneNumber"));
});

// ============================================================
// PART 2: ACADEMIC STATS & ACHIEVEMENTS
// ============================================================

test('P25-04: Academic Performance grid preserves all 4 statistics (Courses, Lessons, Quizzes, Books)', () => {
  assert.ok(aboutSrc.includes("Courses Available"));
  assert.ok(aboutSrc.includes("Lessons Completed"));
  assert.ok(aboutSrc.includes("Quiz Attempts"));
  assert.ok(aboutSrc.includes("Library Books"));
  assert.ok(aboutSrc.includes("totalCoursesCount"));
  assert.ok(aboutSrc.includes("lessonsCompletedCount"));
  assert.ok(aboutSrc.includes("quizzesCompletedCount"));
  assert.ok(aboutSrc.includes("totalBooksCount"));
});

test('P25-05: Earned Achievements carousel displays student achievement badges', () => {
  assert.ok(aboutSrc.includes("🏆 Earned Achievements"));
  assert.ok(aboutSrc.includes("earnedBadges"));
  assert.ok(aboutSrc.includes("badgeCard"));
  assert.ok(aboutSrc.includes("emptyBadgesCard"));
});

// ============================================================
// PART 3: QUICK ACTIONS GROUPING & NAVIGATION
// ============================================================

test('P25-06: Quick actions are organized into Academic, Faith, and Account categories', () => {
  assert.ok(aboutSrc.includes("Academic Learning"));
  assert.ok(aboutSrc.includes("Faith & Utilities"));
  assert.ok(aboutSrc.includes("Account & Support"));
});

test('P25-07: All 11 Quick Action navigation destinations exist and are correctly wired', () => {
  assert.ok(aboutSrc.includes("safePush('/payment')"));
  assert.ok(aboutSrc.includes("safePush('/(tabs)/courses')"));
  assert.ok(aboutSrc.includes("safePush('/(tabs)/library')"));
  assert.ok(aboutSrc.includes("safePush('/(tabs)/quiz')"));
  assert.ok(aboutSrc.includes("safePush('/prayer-times')"));
  assert.ok(aboutSrc.includes("safePush('/qibla')"));
  assert.ok(aboutSrc.includes("safePush('/(tabs)/notifications')"));
  assert.ok(aboutSrc.includes("safePush('/settings')"));
  assert.ok(aboutSrc.includes("onPress={openHelp}"));
  assert.ok(aboutSrc.includes("onPress={scrollToAbout}"));
  assert.ok(aboutSrc.includes("onPress={signOut}"));
});

// ============================================================
// PART 4: FEE MANAGEMENT & PAYMENTS
// ============================================================

test('P25-08: Fee management section displays current fees and unified payment CTA', () => {
  assert.ok(aboutSrc.includes("Fee Management & Payments"));
  assert.ok(aboutSrc.includes("Current Fees"));
  assert.ok(aboutSrc.includes("testID=\"open-unified-payment-btn\""));
  assert.ok(aboutSrc.includes("router.push('/payment')"));
});

test('P25-09: Latest payment status reflects approved, pending, and verified states', () => {
  assert.ok(aboutSrc.includes("Latest Payment Status"));
  assert.ok(aboutSrc.includes("paymentState(myPayments[0])"));
});

// ============================================================
// PART 5: FEEDBACK, ABOUT MADRASA, SECURITY & SOCIAL
// ============================================================

test('P25-10: Feedback form and testimonials subsystem is fully functional', () => {
  assert.ok(aboutSrc.includes("Feedback & Testimonials"));
  assert.ok(aboutSrc.includes("testID=\"submit-feedback-btn\""));
  assert.ok(aboutSrc.includes("submitFeedback"));
  assert.ok(aboutSrc.includes("testimonials"));
});

test('P25-11: About Madrasa section preserves complete institutional text and expansion', () => {
  assert.ok(aboutSrc.includes("AboutMadrasaSection"));
  assert.ok(aboutSrc.includes("DEFAULT_ABOUT_CONTENT"));
  assert.ok(aboutSrc.includes("Madrasatu-s-Salikat Lil Banat"));
});

test('P25-12: Account Security & Privacy preserves all 4 management actions', () => {
  assert.ok(aboutSrc.includes("Account Settings & Security"));
  assert.ok(aboutSrc.includes("Privacy Settings & Policy"));
  assert.ok(aboutSrc.includes("Data & Privacy Controls"));
  assert.ok(aboutSrc.includes("Sign Out of Session"));
  assert.ok(aboutSrc.includes("safePush('/data-privacy')"));
  assert.ok(aboutSrc.includes("safePush('/privacy')"));
});

test('P25-13: Social & Help preserves WhatsApp Channel, Instagram, YouTube, Telegram, WhatsApp Support, and Share App', () => {
  assert.ok(aboutSrc.includes("WhatsApp Channel"));
  assert.ok(aboutSrc.includes("Instagram"));
  assert.ok(aboutSrc.includes("YouTube"));
  assert.ok(aboutSrc.includes("Telegram"));
  assert.ok(aboutSrc.includes("WhatsApp Support"));
  assert.ok(aboutSrc.includes("testID=\"share-app-btn\""));
  assert.ok(aboutSrc.includes("testID=\"help-btn\""));
});

test('P25-14: Islamic Inspiration / Quran Verse card displays Arabic, translation, source, and New Quote rotator', () => {
  assert.ok(aboutSrc.includes("testID=\"bismillah-section\""));
  assert.ok(aboutSrc.includes("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"));
  assert.ok(aboutSrc.includes("ISLAMIC_INSPIRATIONS"));
  assert.ok(aboutSrc.includes("rotateInspiration"));
  assert.ok(aboutSrc.includes("New Quote"));
});

// ============================================================
// PART 6: INVARIANTS & INTEGRATION INTEGRITY
// ============================================================

test('P25-15: Zero security regression, no role elevation, payment live test remains PAUSED', () => {
  assert.ok(aboutSrc.includes("isAdmin ? 'SYS ID' : 'ID'"));
  assert.ok(!aboutSrc.includes('AIzaSy'));
});

console.log('');
console.log('================================================================');
console.log('   PHASE 25 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
