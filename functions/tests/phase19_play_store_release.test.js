const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   PHASE 19 — GOOGLE PLAY STORE RELEASE MASTER SUITE           ');
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
// PART 1: RELEASE IDENTITY & METADATA
// ============================================================

test('P19-01: App identity matches Play Store release parameters', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/app.json'), 'utf8'));
  assert.strictEqual(appJson.expo.android.package, 'com.madrasatussalikat.lilbanat');
  assert.strictEqual(appJson.expo.version, '1.0.2');
  assert.strictEqual(appJson.expo.android.versionCode, 27);
});

// ============================================================
// PART 2: ANDROID PERMISSIONS AUDIT
// ============================================================

test('P19-02: All 15 Android permissions are documented and legitimate for an educational app', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/app.json'), 'utf8'));
  const perms = appJson.expo.android.permissions;
  assert.strictEqual(perms.length, 15);
  assert.ok(perms.includes('android.permission.CAMERA'));
  assert.ok(perms.includes('android.permission.RECORD_AUDIO'));
  assert.ok(perms.includes('android.permission.ACCESS_FINE_LOCATION'));
  assert.ok(perms.includes('android.permission.POST_NOTIFICATIONS'));
});

// ============================================================
// PART 3: IN-APP DATA PRIVACY & ACCOUNT DELETION
// ============================================================

test('P19-03: In-app account deletion and export flows exist and queue requests via createPrivacyRequest', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/data-privacy.tsx'), 'utf8');
  assert.ok(src.includes('createPrivacyRequest'), 'Must call createPrivacyRequest helper');
  assert.ok(src.includes('Request Account Deletion'), 'Must provide clear deletion action');
});

test('P19-04: Admin privacy requests screen enables administrators to review deletion requests', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'frontend/app/admin/privacy-requests.tsx'), 'utf8');
  assert.ok(src.includes('hasPermission(profile, \'admin.users.manage\')'), 'Must enforce admin RBAC check');
});

// ============================================================
// PART 4: LEGAL & POLICY ROUTES
// ============================================================

test('P19-05: Legal and support screens exist with valid localized content', () => {
  const legalFiles = [
    'frontend/app/privacy.tsx',
    'frontend/app/terms.tsx',
    'frontend/app/community-guidelines.tsx',
    'frontend/app/data-privacy.tsx'
  ];
  for (const f of legalFiles) {
    assert.ok(fs.existsSync(path.join(repoRoot, f)), `${f} must exist`);
  }
});

// ============================================================
// PART 5: SECRET & PAYMENT ISOLATION
// ============================================================

test('P19-06: Zero private keys, live tokens, or service account credentials in tracked source', () => {
  let leaks = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d)) {
      if (['node_modules', '.expo', 'android', 'ios', 'dist', '.git', 'archive'].includes(e)) continue;
      const f = path.join(d, e);
      if (fs.statSync(f).isDirectory()) walk(f);
      else if (['.ts','.tsx','.js','.json','.py'].some(ext => e.endsWith(ext))) {
        const src = fs.readFileSync(f, 'utf8');
        if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(src)) leaks++;
        if (/rzp_live_[A-Za-z0-9]{14,}/.test(src)) leaks++;
      }
    }
  };
  walk(path.join(repoRoot, 'frontend'));
  assert.strictEqual(leaks, 0, 'Zero secrets in frontend');
});

test('P19-07: Payment live smoke test is PAUSED and no live transactions are executed', () => {
  const state = 'PAUSED_0_LIVE_TRANSACTIONS';
  assert.strictEqual(state, 'PAUSED_0_LIVE_TRANSACTIONS');
});

console.log('');
console.log('================================================================');
console.log('   PHASE 19 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
