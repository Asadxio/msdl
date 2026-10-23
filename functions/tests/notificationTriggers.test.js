const assert = require('assert');

// Verify exports from compiled functions bundle
const indexExports = require('../lib/index');
const triggerExports = require('../lib/notifications/notificationTriggers');

async function runTests() {
  console.log('--- Running Automated Notification Triggers Verification ---');

  // Test 1: User Approval trigger is exported
  assert.ok(indexExports.onUserApprovalTrigger, 'onUserApprovalTrigger should be exported in index');
  assert.ok(triggerExports.onUserApprovalTrigger, 'onUserApprovalTrigger should be exported in notificationTriggers');
  console.log('PASS: onUserApprovalTrigger export verified');

  // Test 2: Assignment Submission & Review trigger is exported
  assert.ok(indexExports.onSubmissionWrittenTrigger, 'onSubmissionWrittenTrigger should be exported in index');
  assert.ok(triggerExports.onSubmissionWrittenTrigger, 'onSubmissionWrittenTrigger should be exported in notificationTriggers');
  console.log('PASS: onSubmissionWrittenTrigger export verified');

  // Test 3: Live Class Started trigger is exported
  assert.ok(indexExports.onLiveClassWrittenTrigger, 'onLiveClassWrittenTrigger should be exported in index');
  assert.ok(triggerExports.onLiveClassWrittenTrigger, 'onLiveClassWrittenTrigger should be exported in notificationTriggers');
  console.log('PASS: onLiveClassWrittenTrigger export verified');

  // Test 4: New Lesson Written / Uploaded trigger is exported
  assert.ok(indexExports.onLessonWrittenTrigger, 'onLessonWrittenTrigger should be exported in index');
  assert.ok(triggerExports.onLessonWrittenTrigger, 'onLessonWrittenTrigger should be exported in notificationTriggers');
  console.log('PASS: onLessonWrittenTrigger export verified');

  // Test 5: New Assignment Created trigger is exported
  assert.ok(indexExports.onAssignmentCreatedTrigger, 'onAssignmentCreatedTrigger should be exported in index');
  assert.ok(triggerExports.onAssignmentCreatedTrigger, 'onAssignmentCreatedTrigger should be exported in notificationTriggers');
  console.log('PASS: onAssignmentCreatedTrigger export verified');

  // Test 6: Certificate Issued trigger is exported
  assert.ok(indexExports.onCertificateIssuedTrigger, 'onCertificateIssuedTrigger should be exported in index');
  assert.ok(triggerExports.onCertificateIssuedTrigger, 'onCertificateIssuedTrigger should be exported in notificationTriggers');
  console.log('PASS: onCertificateIssuedTrigger export verified');

  console.log('\nALL 6 Automated Notification Triggers verified and exported successfully!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
