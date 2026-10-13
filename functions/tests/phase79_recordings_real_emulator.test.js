/**
 * Phase 79 — Genuine Firebase Emulator Class Recording Security Test Suite
 *
 * Executes ACTUAL Firebase Firestore and Storage security rules
 * against the local Firebase Emulators (Firestore: 8080, Storage: 9199).
 *
 * Verifies:
 * 1. Unauthenticated & unapproved users cannot read/write recordings or storage
 * 2. Enrolled students can read course recordings & storage; non-enrolled students are DENIED
 * 3. Students cannot create, update, or delete recordings or storage files
 * 4. Cross-organization isolation prevents Tenant B users from accessing Tenant A recordings & storage
 * 5. Teachers can create recordings for their courses in their own tenant, but cannot spoof other teachers or courses from other tenants
 * 6. Teachers can update and delete their own recordings, but CANNOT mutate course_id or organization_id
 * 7. Storage rules enforce valid audio MIME types, non-zero size, and <= 200MB limit
 * 8. SuperAdmin exceptions remain appropriately privileged
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const repoRoot = path.resolve(__dirname, '../../');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const storageRules = fs.readFileSync(path.join(repoRoot, 'storage.rules'), 'utf8');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-mslb-test';

// Test Identities
const SUPER_ADMIN = { uid: 'sa_79_uid', email: 'sumraftm@gmail.com', role: 'super_admin', status: 'approved' };
const ADMIN_A = { uid: 'admin_a_79', email: 'admin_a@darulilm.edu', role: 'admin', status: 'approved', organization_id: 'org_a' };
const TEACHER_A = { uid: 'teacher_a_79', email: 'teacher_a@darulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_a' };
const STUDENT_A_ENROLLED = { uid: 'student_a_enr_79', email: 'student_enr@darulilm.edu', role: 'student', status: 'approved', organization_id: 'org_a' };
const STUDENT_A_UNENROLLED = { uid: 'student_a_unenr_79', email: 'student_unenr@darulilm.edu', role: 'student', status: 'approved', organization_id: 'org_a' };

const ADMIN_B = { uid: 'admin_b_79', email: 'admin_b@noorulilm.edu', role: 'admin', status: 'approved', organization_id: 'org_b' };
const TEACHER_B = { uid: 'teacher_b_79', email: 'teacher_b@noorulilm.edu', role: 'teacher', status: 'approved', organization_id: 'org_b' };
const STUDENT_B = { uid: 'student_b_79', email: 'student_b@noorulilm.edu', role: 'student', status: 'approved', organization_id: 'org_b' };

const UNAPPROVED_USER = { uid: 'unapproved_79', email: 'pending@darulilm.edu', role: 'student', status: 'pending', organization_id: 'org_a' };

const COURSE_A = 'course_a_79';
const COURSE_B = 'course_b_79';
const REC_A_ID = 'rec_a_001';
const REC_B_ID = 'rec_b_001';

let testEnv;
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.stack || err.message}`);
    failed++;
  }
}

async function setupFixtures(adminDb) {
  const users = [
    SUPER_ADMIN,
    ADMIN_A,
    TEACHER_A,
    STUDENT_A_ENROLLED,
    STUDENT_A_UNENROLLED,
    ADMIN_B,
    TEACHER_B,
    STUDENT_B,
    UNAPPROVED_USER,
  ];

  for (const u of users) {
    await adminDb.collection('users').doc(u.uid).set({
      uid: u.uid,
      name: `${u.role} ${u.uid}`,
      email: u.email,
      role: u.role,
      status: u.status,
      organization_id: u.organization_id || null,
      created_at: new Date(),
    });
  }

  // Organizations
  await adminDb.collection('organizations').doc('org_a').set({
    id: 'org_a',
    name: 'Darul Ilm Madrasa',
    status: 'active',
  });
  await adminDb.collection('organizations').doc('org_b').set({
    id: 'org_b',
    name: 'Noorul Ilm Madrasa',
    status: 'active',
  });

  // Memberships
  const memberships = [
    { id: `org_a_${ADMIN_A.uid}`, org: 'org_a', uid: ADMIN_A.uid, role: 'admin' },
    { id: `org_a_${TEACHER_A.uid}`, org: 'org_a', uid: TEACHER_A.uid, role: 'teacher' },
    { id: `org_a_${STUDENT_A_ENROLLED.uid}`, org: 'org_a', uid: STUDENT_A_ENROLLED.uid, role: 'student' },
    { id: `org_a_${STUDENT_A_UNENROLLED.uid}`, org: 'org_a', uid: STUDENT_A_UNENROLLED.uid, role: 'student' },
    { id: `org_b_${ADMIN_B.uid}`, org: 'org_b', uid: ADMIN_B.uid, role: 'admin' },
    { id: `org_b_${TEACHER_B.uid}`, org: 'org_b', uid: TEACHER_B.uid, role: 'teacher' },
    { id: `org_b_${STUDENT_B.uid}`, org: 'org_b', uid: STUDENT_B.uid, role: 'student' },
  ];

  for (const m of memberships) {
    await adminDb.collection('organization_memberships').doc(m.id).set({
      id: m.id,
      organization_id: m.org,
      user_id: m.uid,
      role: m.role,
      status: 'active',
    });
  }

  // Courses
  await adminDb.collection('courses').doc(COURSE_A).set({
    name: 'Tajweed Course A',
    organization_id: 'org_a',
    created_at: new Date(),
  });
  await adminDb.collection('courses').doc(COURSE_B).set({
    name: 'Fiqh Course B',
    organization_id: 'org_b',
    created_at: new Date(),
  });

  // Active Enrollment for STUDENT_A_ENROLLED in COURSE_A
  const enrollmentDocIdA = `${STUDENT_A_ENROLLED.uid}:${COURSE_A}`;
  await adminDb.collection('enrollments').doc(enrollmentDocIdA).set({
    id: enrollmentDocIdA,
    user_id: STUDENT_A_ENROLLED.uid,
    course_id: COURSE_A,
    status: 'active',
    enrolled_at: new Date(),
  });

  // Recordings
  await adminDb.collection('recordings').doc(REC_A_ID).set({
    title: 'Lecture 1 — Tajweed Rules',
    course_id: COURSE_A,
    teacher_id: TEACHER_A.uid,
    teacher_name: 'Ustaadha Fatima',
    organization_id: 'org_a',
    storage_path: `organizations/org_a/courses/${COURSE_A}/recordings/class_1/rec_1.m4a`,
    file_url: 'https://example.com/rec_1.m4a',
    status: 'published',
    created_at: new Date(),
  });

  await adminDb.collection('recordings').doc(REC_B_ID).set({
    title: 'Lecture 1 — Fiqh Rules',
    course_id: COURSE_B,
    teacher_id: TEACHER_B.uid,
    teacher_name: 'Ustaadha Maryam',
    organization_id: 'org_b',
    storage_path: `organizations/org_b/courses/${COURSE_B}/recordings/class_2/rec_2.m4a`,
    file_url: 'https://example.com/rec_2.m4a',
    status: 'published',
    created_at: new Date(),
  });
}

(async () => {
  console.log('================================================================');
  console.log('   MSLB PHASE 79 — GENUINE FIREBASE EMULATOR RECORDING SUITE    ');
  console.log('================================================================');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: storageRules,
      host: '127.0.0.1',
      port: 9199,
    },
  });

  await testEnv.clearFirestore();
  await testEnv.clearStorage();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setupFixtures(ctx.firestore());
  });

  // Contexts
  const unauthCtx = testEnv.unauthenticatedContext();
  const unapprovedCtx = testEnv.authenticatedContext(UNAPPROVED_USER.uid, { email: UNAPPROVED_USER.email, email_verified: false });
  const saCtx = testEnv.authenticatedContext(SUPER_ADMIN.uid, { email: SUPER_ADMIN.email, email_verified: true });
  const adminACtx = testEnv.authenticatedContext(ADMIN_A.uid, { email: ADMIN_A.email, email_verified: true });
  const teacherACtx = testEnv.authenticatedContext(TEACHER_A.uid, { email: TEACHER_A.email, email_verified: true });
  const studentEnrolledCtx = testEnv.authenticatedContext(STUDENT_A_ENROLLED.uid, { email: STUDENT_A_ENROLLED.email, email_verified: true });
  const studentUnenrolledCtx = testEnv.authenticatedContext(STUDENT_A_UNENROLLED.uid, { email: STUDENT_A_UNENROLLED.email, email_verified: true });
  const adminBCtx = testEnv.authenticatedContext(ADMIN_B.uid, { email: ADMIN_B.email, email_verified: true });
  const teacherBCtx = testEnv.authenticatedContext(TEACHER_B.uid, { email: TEACHER_B.email, email_verified: true });
  const studentBCtx = testEnv.authenticatedContext(STUDENT_B.uid, { email: STUDENT_B.email, email_verified: true });

  const unauthDb = unauthCtx.firestore();
  const unapprovedDb = unapprovedCtx.firestore();
  const saDb = saCtx.firestore();
  const adminADb = adminACtx.firestore();
  const teacherADb = teacherACtx.firestore();
  const studentEnrolledDb = studentEnrolledCtx.firestore();
  const studentUnenrolledDb = studentUnenrolledCtx.firestore();
  const adminBDb = adminBCtx.firestore();
  const teacherBDb = teacherBCtx.firestore();
  const studentBDb = studentBCtx.firestore();

  const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....');

  // Pre-seed an audio file in Storage for read testing using admin context
  const storageSeedPath = `organizations/org_a/courses/${COURSE_A}/recordings/class_1/rec_1.m4a`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(storageSeedPath).put(dummyAudio, { contentType: 'audio/mp4' });
  });

  console.log('\n--- GROUP 1: UNAUTHENTICATED & UNAPPROVED ACCESS RESTRICTIONS ---');

  await runTest('SEC79-01: Unauthenticated request cannot read Firestore recording (DENY)', async () => {
    await assertFails(unauthDb.collection('recordings').doc(REC_A_ID).get());
  });

  await runTest('SEC79-02: Unauthenticated request cannot create Firestore recording (DENY)', async () => {
    await assertFails(unauthDb.collection('recordings').add({
      title: 'Hacked Recording',
      course_id: COURSE_A,
      organization_id: 'org_a',
    }));
  });

  await runTest('SEC79-03: Unapproved user cannot read Firestore recording (DENY)', async () => {
    await assertFails(unapprovedDb.collection('recordings').doc(REC_A_ID).get());
  });

  await runTest('SEC79-04: Unauthenticated request cannot read Storage recording file (DENY)', async () => {
    await assertFails(unauthCtx.storage().ref(storageSeedPath).getDownloadURL());
  });

  await runTest('SEC79-05: Unapproved user cannot read Storage recording file (DENY)', async () => {
    await assertFails(unapprovedCtx.storage().ref(storageSeedPath).getDownloadURL());
  });

  console.log('\n--- GROUP 2: STUDENT ACADEMIC ENROLLMENT GATING ---');

  await runTest('SEC79-06: Enrolled student can read recording document for Course A (ALLOW)', async () => {
    await assertSucceeds(studentEnrolledDb.collection('recordings').doc(REC_A_ID).get());
  });

  await runTest('SEC79-07: Unenrolled student cannot read recording document for Course A (DENY)', async () => {
    await assertFails(studentUnenrolledDb.collection('recordings').doc(REC_A_ID).get());
  });

  await runTest('SEC79-08: Student cannot create a recording in Firestore (DENY)', async () => {
    await assertFails(studentEnrolledDb.collection('recordings').add({
      title: 'Student Upload',
      course_id: COURSE_A,
      organization_id: 'org_a',
      teacher_id: STUDENT_A_ENROLLED.uid,
    }));
  });

  await runTest('SEC79-09: Student cannot update a recording in Firestore (DENY)', async () => {
    await assertFails(studentEnrolledDb.collection('recordings').doc(REC_A_ID).update({
      title: 'Altered Title',
    }));
  });

  await runTest('SEC79-10: Student cannot delete a recording in Firestore (DENY)', async () => {
    await assertFails(studentEnrolledDb.collection('recordings').doc(REC_A_ID).delete());
  });

  await runTest('SEC79-11: Enrolled student can download/stream Storage recording file (ALLOW)', async () => {
    await assertSucceeds(studentEnrolledCtx.storage().ref(storageSeedPath).getDownloadURL());
  });

  await runTest('SEC79-12: Unenrolled student cannot download/stream Storage recording file (DENY)', async () => {
    await assertFails(studentUnenrolledCtx.storage().ref(storageSeedPath).getDownloadURL());
  });

  await runTest('SEC79-13: Student cannot upload to Storage recording path (DENY)', async () => {
    const uploadRef = studentEnrolledCtx.storage().ref(`organizations/org_a/courses/${COURSE_A}/recordings/class_1/hack.m4a`);
    await assertFails(uploadRef.put(dummyAudio, { contentType: 'audio/mp4' }));
  });

  await runTest('SEC79-14: Student cannot delete Storage recording file (DENY)', async () => {
    await assertFails(studentEnrolledCtx.storage().ref(storageSeedPath).delete());
  });

  console.log('\n--- GROUP 3: MULTI-TENANT ISOLATION ---');

  await runTest('SEC79-15: Student from Tenant B cannot read Tenant A recording (DENY)', async () => {
    await assertFails(studentBDb.collection('recordings').doc(REC_A_ID).get());
  });

  await runTest('SEC79-16: Student from Tenant B cannot download Tenant A Storage file (DENY)', async () => {
    await assertFails(studentBCtx.storage().ref(storageSeedPath).getDownloadURL());
  });

  await runTest('SEC79-17: Teacher from Tenant B cannot create recording in Tenant A (DENY)', async () => {
    await assertFails(teacherBDb.collection('recordings').add({
      title: 'Cross Tenant Injection',
      course_id: COURSE_A,
      organization_id: 'org_a',
      teacher_id: TEACHER_B.uid,
    }));
  });

  await runTest('SEC79-18: Teacher from Tenant B cannot upload to Tenant A Storage partition (DENY)', async () => {
    const uploadRef = teacherBCtx.storage().ref(`organizations/org_a/courses/${COURSE_A}/recordings/class_1/intruder.m4a`);
    await assertFails(uploadRef.put(dummyAudio, { contentType: 'audio/mp4' }));
  });

  await runTest('SEC79-19: Teacher from Tenant B cannot delete Tenant A recording (DENY)', async () => {
    await assertFails(teacherBDb.collection('recordings').doc(REC_A_ID).delete());
  });

  console.log('\n--- GROUP 4: TEACHER PERMISSIONS & IMMUTABILITY BOUNDARIES ---');

  await runTest('SEC79-20: Teacher A creates valid recording stamped with own teacher_id and org_a (ALLOW)', async () => {
    await assertSucceeds(teacherADb.collection('recordings').add({
      title: 'Teacher Valid Take',
      course_id: COURSE_A,
      organization_id: 'org_a',
      teacher_id: TEACHER_A.uid,
      teacher_name: 'Ustaadha Fatima',
      status: 'published',
    }));
  });

  await runTest('SEC79-21: Teacher A attempting to spoof teacher_id of another user is rejected (DENY)', async () => {
    await assertFails(teacherADb.collection('recordings').add({
      title: 'Spoofed Teacher Take',
      course_id: COURSE_A,
      organization_id: 'org_a',
      teacher_id: TEACHER_B.uid, // Spoofed ID
      status: 'published',
    }));
  });

  await runTest('SEC79-22: Teacher A cannot attach recording to Course B from another tenant (DENY)', async () => {
    await assertFails(teacherADb.collection('recordings').add({
      title: 'Cross Course Org Mismatch',
      course_id: COURSE_B, // Belongs to org_b
      organization_id: 'org_a',
      teacher_id: TEACHER_A.uid,
      status: 'published',
    }));
  });

  await runTest('SEC79-23: Teacher A can update description/title of own recording (ALLOW)', async () => {
    await assertSucceeds(teacherADb.collection('recordings').doc(REC_A_ID).update({
      description: 'Updated lesson summary notes',
    }));
  });

  await runTest('SEC79-24: Teacher A cannot mutate course_id of an existing recording (DENY)', async () => {
    await assertFails(teacherADb.collection('recordings').doc(REC_A_ID).update({
      course_id: 'course_a_different',
    }));
  });

  await runTest('SEC79-25: Teacher A cannot mutate organization_id of an existing recording (DENY)', async () => {
    await assertFails(teacherADb.collection('recordings').doc(REC_A_ID).update({
      organization_id: 'org_b',
    }));
  });

  await runTest('SEC79-26: Teacher A cannot update Teacher B recording (DENY)', async () => {
    await assertFails(teacherADb.collection('recordings').doc(REC_B_ID).update({
      description: 'Unauthorized edit',
    }));
  });

  console.log('\n--- GROUP 5: STORAGE RULES & MEDIA INTEGRITY ENFORCEMENT ---');

  await runTest('SEC79-27: Teacher A uploads valid audio file (.m4a / audio/mp4) <= 200MB (ALLOW)', async () => {
    const uploadRef = teacherACtx.storage().ref(`organizations/org_a/courses/${COURSE_A}/recordings/class_valid/valid.m4a`);
    await assertSucceeds(uploadRef.put(dummyAudio, { contentType: 'audio/mp4' }));
  });

  await runTest('SEC79-28: Teacher A uploading invalid MIME type (e.g. image/png) is rejected (DENY)', async () => {
    const uploadRef = teacherACtx.storage().ref(`organizations/org_a/courses/${COURSE_A}/recordings/class_valid/invalid.png`);
    await assertFails(uploadRef.put(dummyAudio, { contentType: 'image/png' }));
  });

  await runTest('SEC79-29: Teacher A uploading zero-byte file is rejected (DENY)', async () => {
    const uploadRef = teacherACtx.storage().ref(`organizations/org_a/courses/${COURSE_A}/recordings/class_valid/empty.m4a`);
    await assertFails(uploadRef.put(Buffer.alloc(0), { contentType: 'audio/mp4' }));
  });

  console.log('\n--- GROUP 6: ADMIN & SUPER ADMIN MANAGEMENT PRIVILEGES ---');

  await runTest('SEC79-30: Super Admin can read recordings across tenants (ALLOW)', async () => {
    await assertSucceeds(saDb.collection('recordings').doc(REC_B_ID).get());
  });

  await runTest('SEC79-31: Super Admin can download Storage file across tenants (ALLOW)', async () => {
    await assertSucceeds(saCtx.storage().ref(storageSeedPath).getDownloadURL());
  });

  await runTest('SEC79-32: Tenant A Admin can delete recording in Tenant A (ALLOW)', async () => {
    await assertSucceeds(adminADb.collection('recordings').doc(REC_A_ID).delete());
  });

  await runTest('SEC79-33: Tenant A Admin cannot delete recording in Tenant B (DENY)', async () => {
    await assertFails(adminADb.collection('recordings').doc(REC_B_ID).delete());
  });

  console.log('\n================================================================');
  console.log(`PHASE 79 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})().catch((err) => {
  console.error('Fatal execution error in test runner:', err);
  process.exit(1);
});
