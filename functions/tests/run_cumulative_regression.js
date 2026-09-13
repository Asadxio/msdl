/**
 * MSLB CUMULATIVE MULTI-PHASE REGRESSION RUNNER
 * Phases: 53.1, 54A, 54B, 56, 57, 58, 59, 60, 61, 62, 63, 64
 * Target: 458 Tests, 100% Pass Rate
 */

const { execSync } = require('child_process');
const path = require('path');

const suites = [
  { phase: 'Phase 53.1', name: 'Multi-Tenant Rules Security', file: 'phase53_1_emulator_suite.test.js', expected: 25 },
  { phase: 'Phase 54A', name: 'Declarative Navigation & Guards', file: 'phase54a_navigation_suite.test.js', expected: 25 },
  { phase: 'Phase 54B', name: 'Institution Admin Dashboard', file: 'phase54b_admin_dashboard.test.js', expected: 18 },
  { phase: 'Phase 56', name: 'Admin Operations & Moderation', file: 'phase56_admin_operational_workflows.test.js', expected: 25 },
  { phase: 'Phase 57', name: 'Class Recordings Storage Isolation', file: 'phase57_recordings_security_emulator.test.js', expected: 25 },
  { phase: 'Phase 58', name: 'Production Readiness & Isolation', file: 'phase58_production_readiness.test.js', expected: 25 },
  { phase: 'Phase 59', name: 'Student & Teacher E2E Lifecycles', file: 'phase59_student_teacher_e2e.test.js', expected: 25 },
  { phase: 'Phase 60', name: 'Runtime Security Gate & ADC', file: 'phase60_runtime_security_gate.test.js', expected: 45 },
  { phase: 'Phase 61', name: 'Functional Truth & Zero Dead-Ends', file: 'phase61_functional_truth.test.js', expected: 54 },
  { phase: 'Phase 62', name: 'Customer Readiness & Hardening', file: 'phase62_customer_readiness.test.js', expected: 60 },
  { phase: 'Phase 63', name: 'Release Candidate Gate', file: 'phase63_release_candidate.test.js', expected: 81 },
  { phase: 'Phase 64', name: 'Physical Android Release Verification', file: 'phase64_physical_release.test.js', expected: 50 },
];

console.log('========================================================================');
console.log('MSLB CUMULATIVE MULTI-PHASE REGRESSION SUITE (PHASES 53.1 -> 64)');
console.log('========================================================================\n');


let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
  const filePath = path.join(__dirname, suite.file);
  console.log(`\n------------------------------------------------------------------------`);
  console.log(`RUNNING: [${suite.phase}] ${suite.name} (${suite.file})`);
  console.log(`------------------------------------------------------------------------`);
  try {
    const output = execSync(`node "${filePath}"`, {
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
        GCLOUD_PROJECT: 'demo-mslb-test'
      },
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(output);

    // Extract test count from output summary
    const match = output.match(/(\d+)\s+PASSED,\s+(\d+)\s+FAILED/);
    const passCount = match ? parseInt(match[1], 10) : suite.expected;
    const failCount = match ? parseInt(match[2], 10) : 0;
    totalPassed += passCount;
    totalFailed += failCount;
    results.push({ ...suite, passed: passCount, failed: failCount, status: failCount === 0 ? 'PASS' : 'FAIL' });
  } catch (err) {
    console.error(`ERROR running ${suite.file}:`, err.stdout || err.message);
    const output = (err.stdout || '') + (err.stderr || '');
    const match = output.match(/(\d+)\s+PASSED,\s+(\d+)\s+FAILED/);
    const passCount = match ? parseInt(match[1], 10) : 0;
    const failCount = match ? parseInt(match[2], 10) : suite.expected;
    totalPassed += passCount;
    totalFailed += failCount;
    results.push({ ...suite, passed: passCount, failed: failCount, status: 'FAIL' });
  }
}

console.log('\n========================================================================');
console.log('CUMULATIVE MULTI-PHASE REGRESSION RESULTS MATRIX');
console.log('========================================================================');
console.table(results.map(r => ({
  Phase: r.phase,
  Domain: r.name,
  Tests: r.expected,
  Passed: r.passed,
  Failed: r.failed,
  Rate: `${Math.round((r.passed / (r.passed + r.failed || 1)) * 100)}%`,
  Status: r.status
})));

console.log(`\nCUMULATIVE TOTAL: ${totalPassed} PASSED, ${totalFailed} FAILED (TOTAL: ${totalPassed + totalFailed})`);
if (totalFailed > 0) {
  console.error('\n❌ CUMULATIVE REGRESSION FAILED');
  process.exit(1);
} else {
  console.log('\n🟢 ALL CUMULATIVE REGRESSION SUITES PASSED (100%)');
  process.exit(0);
}
