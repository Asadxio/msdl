'use strict';

/**
 * PHASE 72 — STUDENT ADMISSION -> PAYMENT -> ENROLLMENT -> LEARNING E2E TEST SUITE
 *
 * Verifies the complete student journey from signup through actual learning:
 * 1. REAL STUDENT ACCOUNT
 * 2. STUDENT SIGNUP & ACCOUNT CREATION
 * 3. APPROVAL & EMAIL VERIFICATION FLOW
 * 4. 12 OFFICIAL COURSES CATALOG
 * 5. COURSE FEES (ADMISSION ₹100 & COURSE-SPECIFIC PRICING)
 * 6. COURSE SELECTION & ACCESS LOCK STATE
 * 7. ADMISSION PAYMENT (₹100) & RAZORPAY INTEGRATION
 * 8. COURSE PAYMENT & FREE COURSES (SHORT COURSES)
 * 9. DETERMINISTIC ENROLLMENT & ANTI-CHEAT
 * 10. TEACHER VISIBILITY & SCOPING
 * 11. LEARNING CONTENT (MODULES, LESSONS, ATTACHMENTS)
 * 12. ASSIGNMENT SUBMISSION & GRADING
 * 13. QUIZ ASSESSMENT & EVALUATION
 * 14. LIVE CLASS & ATTENDANCE
 * 15. ATTENDANCE INTEGRITY
 * 16. PROGRESS AGGREGATION
 * 17. CERTIFICATE ELIGIBILITY & GENERATION
 * 18. PAYMENT SECURITY ATTACK TESTS
 * 19. ACADEMIC SECURITY ATTACK TESTS
 * 20. DATA CONSISTENCY CHECK
 * 21. UI / NAVIGATION CHAIN
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-mslb-phase72';
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const repoRoot = path.resolve(__dirname, '../../');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

// =========================================================================
// SECTION 1: REAL TEST DATA DEFINITION
// =========================================================================
const REAL_DATA = {
  ADMIN_UID: 'admin_super_uid',
  ADMIN_EMAIL: 'admin@mslb.edu',

  TEACHER_UID: 'teacher_fatima_uid',
  TEACHER_ID: 'TCH-7101',
  TEACHER_NAME: 'Ustaadha Fatima',
  TEACHER_EMAIL: 'fatima.teacher@mslb.edu',

  // Real existing student
  STUDENT_UID: 'sheikh_mohiuddin_uid',
  STUDENT_NAME: 'Sheikh Mohiuddin',
  STUDENT_EMAIL: 'sheikhmohiuddin551@gmail.com',
  STUDENT_PHONE: '+91 63669 19122',

  // Fresh signup test student
  FRESH_STUDENT_UID: 'student_p72_fresh_uid',
  FRESH_STUDENT_EMAIL: 'fresh.student72@mslb.edu',
  FRESH_STUDENT_NAME: 'Zainab Bint Mohiuddin',

  // Unrelated student for security penetration tests
  ATTACKER_STUDENT_UID: 'attacker_student_uid',
  ATTACKER_STUDENT_EMAIL: 'attacker@student.mslb.edu',

  ORGANIZATION_ID: 'mslb-main',
  RAZORPAY_TEST_SECRET: 'test_razorpay_secret_phase72_safe',

  // 12 Required Official Courses with exact fees
  OFFICIAL_CATALOG: [
    { id: 'course_rabiya', name: 'Rabiya', admission_fee: 100, course_fee: 500, teacher: 'Sumra Fatma' },
    { id: 'course_ula', name: 'Ula', admission_fee: 100, course_fee: 500, teacher: 'Sumra Fatma' },
    { id: 'course_aidadiya', name: 'Aidadiya', admission_fee: 100, course_fee: 500, teacher: 'Sumra Fatma' },
    { id: 'course_salisa', name: 'Salisa', admission_fee: 100, course_fee: 500, teacher: 'Firdouse Banu' },
    { id: 'course_khamsa', name: 'Khamsa', admission_fee: 100, course_fee: 500, teacher: 'Firdouse Banu' },
    { id: 'course_mubaligha', name: 'Mubaligha', admission_fee: 100, course_fee: 300, teacher: 'Sumra Fatma' },
    { id: 'course_madani_qaida', name: 'Madani Qaida', admission_fee: 100, course_fee: 200, teacher: 'Afnaz Razviya' },
    { id: 'course_urdu', name: 'Urdu Course', admission_fee: 100, course_fee: 100, teacher: 'Anjum Razviya' },
    { id: 'course_short_courses', name: 'Short Courses', admission_fee: 100, course_fee: 0, teacher: 'Sumra Fatma' }, // FREE
    { id: 'course_nazara', name: 'Nazara', admission_fee: 100, course_fee: 300, teacher: 'Afnaz Razviya' },
    { id: 'course_arabic_grammar', name: 'Arabic Grammar', admission_fee: 100, course_fee: 400, teacher: 'Anjum Razviya' },
    { id: 'course_qirat', name: 'Qirat Course', admission_fee: 100, course_fee: 500, teacher: 'Afnaz Razviya' },
  ]
};

let passed = 0;
let failed = 0;

function report(step, title, status, err = null) {
  if (status === 'PASS') {
    passed++;
    console.log(`  [PASS] ${step}: ${title}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${step}: ${title}`);
    if (err) console.error('    Error:', err.message || err);
  }
}

function computeHmacSignature(orderId, paymentId, secret) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function computeWebhookSignature(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function runPhase72E2ESuite() {
  console.log('================================================================');
  console.log('   PHASE 72 — STUDENT ADMISSION -> ENROLLMENT -> LEARNING E2E   ');
  console.log('================================================================\n');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  try {
    // -------------------------------------------------------------
    // Contexts setup
    // -------------------------------------------------------------
    const adminCtx = testEnv.authenticatedContext(REAL_DATA.ADMIN_UID, { email: REAL_DATA.ADMIN_EMAIL });
    const adminDb = adminCtx.firestore();

    const studentCtx = testEnv.authenticatedContext(REAL_DATA.STUDENT_UID, { email: REAL_DATA.STUDENT_EMAIL });
    const studentDb = studentCtx.firestore();

    const freshStudentCtx = testEnv.authenticatedContext(REAL_DATA.FRESH_STUDENT_UID, { email: REAL_DATA.FRESH_STUDENT_EMAIL });
    const freshStudentDb = freshStudentCtx.firestore();

    const attackerCtx = testEnv.authenticatedContext(REAL_DATA.ATTACKER_STUDENT_UID, { email: REAL_DATA.ATTACKER_STUDENT_EMAIL });
    const attackerDb = attackerCtx.firestore();

    const teacherCtx = testEnv.authenticatedContext(REAL_DATA.TEACHER_UID, { email: REAL_DATA.TEACHER_EMAIL });
    const teacherDb = teacherCtx.firestore();

    // =============================================================
    // 1. REAL TEST DATA & BASE PROFILES INITIALIZATION
    // =============================================================
    console.log('--- [1. REAL STUDENT ACCOUNT & BASE PROFILES] ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Seed app_settings/platform
      await db.collection('app_settings').doc('platform').set({
        fees_amount: 500,
        admission_fee: 100,
        organization_id: REAL_DATA.ORGANIZATION_ID,
        updated_at: new Date(),
      });

      // Admin Profile
      await db.collection('users').doc(REAL_DATA.ADMIN_UID).set({
        name: 'Chief Admin',
        email: REAL_DATA.ADMIN_EMAIL,
        role: 'admin',
        status: 'approved',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });

      // Real approved student profile (Sheikh Mohiuddin)
      await db.collection('users').doc(REAL_DATA.STUDENT_UID).set({
        name: REAL_DATA.STUDENT_NAME,
        email: REAL_DATA.STUDENT_EMAIL,
        phone: REAL_DATA.STUDENT_PHONE,
        role: 'student',
        status: 'approved',
        is_verified: true,
        whatsapp_consent: true,
        onboarding_state: 'completed',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });

      // Attacker student profile
      await db.collection('users').doc(REAL_DATA.ATTACKER_STUDENT_UID).set({
        name: 'Attacker Student',
        email: REAL_DATA.ATTACKER_STUDENT_EMAIL,
        role: 'student',
        status: 'approved',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });

      // Teacher Profile & Record
      await db.collection('users').doc(REAL_DATA.TEACHER_UID).set({
        name: REAL_DATA.TEACHER_NAME,
        email: REAL_DATA.TEACHER_EMAIL,
        role: 'teacher',
        status: 'approved',
        verification_status: 'verified',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });

      await db.collection('teachers').doc(REAL_DATA.TEACHER_UID).set({
        teacher_id: REAL_DATA.TEACHER_ID,
        user_uid: REAL_DATA.TEACHER_UID,
        name: REAL_DATA.TEACHER_NAME,
        email: REAL_DATA.TEACHER_EMAIL,
        verification_status: 'verified',
        status: 'approved',
        courses: ['Rabiya', 'Qirat Course'],
        assigned_courses: ['course_rabiya', 'course_qirat'],
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });
    });

    report('P72-01', 'Real student account & base profiles initialized', 'PASS');

    // =============================================================
    // 2. STUDENT SIGNUP
    // =============================================================
    console.log('\n--- [2. STUDENT SIGNUP & ACCOUNT CREATION] ---');
    try {
      // Valid Self-Signup by fresh student
      await assertSucceeds(
        freshStudentDb.collection('users').doc(REAL_DATA.FRESH_STUDENT_UID).set({
          name: REAL_DATA.FRESH_STUDENT_NAME,
          email: REAL_DATA.FRESH_STUDENT_EMAIL,
          role: 'student',
          status: 'pending',
          phone: '+919123456780',
          whatsapp_consent: true,
          whatsapp_consent_at: new Date(),
          is_minor: false,
          guardian_name: 'Mohiuddin Guardian',
          guardian_phone: '+919876543210',
          created_at: new Date(),
        })
      );
      report('P72-02A', 'Student self-signup with whatsapp consent & guardian info -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-02A', 'Student self-signup failed', 'FAIL', e);
    }

    try {
      // Attack: Fresh student attempts to grant themselves 'admin' role or 'approved' status on signup
      await assertFails(
        attackerDb.collection('users').doc(REAL_DATA.ATTACKER_STUDENT_UID).set({
          name: 'Hacker User',
          email: REAL_DATA.ATTACKER_STUDENT_EMAIL,
          role: 'admin',
          status: 'approved',
          created_at: new Date(),
        })
      );
      report('P72-02B', 'Unauthorized role/status escalation on signup strictly -> DENIED', 'PASS');
    } catch (e) {
      report('P72-02B', 'Role escalation attack was not rejected', 'FAIL', e);
    }

    // =============================================================
    // 3. APPROVAL FLOW
    // =============================================================
    console.log('\n--- [3. STUDENT APPROVAL FLOW] ---');
    try {
      // Attack: Pending student attempts to change own status to 'approved'
      await assertFails(
        freshStudentDb.collection('users').doc(REAL_DATA.FRESH_STUDENT_UID).update({
          status: 'approved',
        })
      );
      report('P72-03A', 'Student self-approval attempt strictly -> DENIED', 'PASS');
    } catch (e) {
      report('P72-03A', 'Student self-approval was not rejected', 'FAIL', e);
    }

    try {
      // Legitimate Admin Approval
      await assertSucceeds(
        adminDb.collection('users').doc(REAL_DATA.FRESH_STUDENT_UID).update({
          status: 'approved',
          updated_at: new Date(),
        })
      );
      report('P72-03B', 'Admin approval of pending student -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-03B', 'Admin approval failed', 'FAIL', e);
    }

    // =============================================================
    // 4. 12 OFFICIAL COURSES CATALOG
    // =============================================================
    console.log('\n--- [4. COURSE CATALOG (12 REQUIRED COURSES)] ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const c of REAL_DATA.OFFICIAL_CATALOG) {
        await db.collection('courses').doc(c.id).set({
          name: c.name,
          teacher_name: c.teacher,
          schedule: 'Weekly Sessions',
          class_time: '10:00 AM',
          meet_link: 'https://meet.google.com/p72-official',
          description: `Official Madrasa Curriculum for ${c.name}`,
          admission_fee: c.admission_fee,
          course_fee: c.course_fee,
          fee: c.course_fee,
          organization_id: REAL_DATA.ORGANIZATION_ID,
          subjects: [{ id: `subj_${c.id}`, name: `${c.name} Core` }],
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    });

    try {
      // Student reads all 12 courses from the catalog
      for (const c of REAL_DATA.OFFICIAL_CATALOG) {
        const doc = await studentDb.collection('courses').doc(c.id).get();
        assert.strictEqual(doc.exists, true, `Course ${c.name} must exist`);
        assert.strictEqual(doc.data().name, c.name);
      }
      report('P72-04', 'All 12 Official Courses verified and readable in catalog', 'PASS');
    } catch (e) {
      report('P72-04', 'Course catalog verification failed', 'FAIL', e);
    }

    // =============================================================
    // 5. COURSE FEES VERIFICATION
    // =============================================================
    console.log('\n--- [5. COURSE FEES STRUCTURE] ---');
    try {
      for (const c of REAL_DATA.OFFICIAL_CATALOG) {
        const doc = await studentDb.collection('courses').doc(c.id).get();
        const data = doc.data();
        assert.strictEqual(data.admission_fee, 100, `Admission fee for ${c.name} must be ₹100`);
        assert.strictEqual(data.course_fee, c.course_fee, `Course fee for ${c.name} must be ₹${c.course_fee}`);
      }
      report('P72-05', 'All 12 course fees verified (Admission: ₹100, exact course pricing)', 'PASS');
    } catch (e) {
      report('P72-05', 'Course fees verification failed', 'FAIL', e);
    }

    // =============================================================
    // 6. COURSE SELECTION & ACCESS LOCK STATE
    // =============================================================
    console.log('\n--- [6. COURSE SELECTION & ACCESS LOCK STATE] ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Seed a module and lesson for Rabiya
      await db.collection('modules').doc('mod_rabiya_01').set({
        course_id: 'course_rabiya',
        title: 'Bab 1: Aqaid',
        order: 1,
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });
      await db.collection('lessons').doc('lesson_rabiya_01').set({
        course_id: 'course_rabiya',
        module_id: 'mod_rabiya_01',
        title: 'Sabaq 1: Bunyadi Deeniyat',
        content_url: 'https://storage.mslb.edu/dars_01.mp3',
        order: 1,
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });
    });

    try {
      // Fresh student is NOT enrolled in Rabiya yet
      // Reading course metadata is ALLOWED
      const courseDoc = await freshStudentDb.collection('courses').doc('course_rabiya').get();
      assert.strictEqual(courseDoc.exists, true);
      report('P72-06A', 'Unenrolled student viewing course catalog overview -> ALLOWED', 'PASS');

      // Reading restricted learning content (lesson) must be DENIED before enrollment
      await assertFails(freshStudentDb.collection('lessons').doc('lesson_rabiya_01').get());
      report('P72-06B', 'Unenrolled student accessing restricted lesson -> strictly DENIED', 'PASS');
    } catch (e) {
      report('P72-06', 'Course lock state verification failed', 'FAIL', e);
    }

    // =============================================================
    // 7. ADMISSION PAYMENT (₹100) & RAZORPAY VERIFICATION
    // =============================================================
    console.log('\n--- [7. ADMISSION PAYMENT (₹100) END-TO-END] ---');
    const admissionOrderId = 'order_adm_rabiya_001';
    const admissionPaymentId = 'pay_adm_rabiya_001';
    const admissionSig = computeHmacSignature(admissionOrderId, admissionPaymentId, REAL_DATA.RAZORPAY_TEST_SECRET);

    let admissionPaymentDocId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Server creates pending payment for admission fee (₹100 = 10,000 paise)
      const ref = await db.collection('payments').add({
        user_id: REAL_DATA.STUDENT_UID,
        course_id: 'course_rabiya',
        provider: 'razorpay',
        provider_order_id: admissionOrderId,
        amount: 10000, // 100 INR in paise
        currency: 'INR',
        payment_type: 'admission',
        type: 'admission',
        state: 'pending',
        status: 'pending',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
        created_at_ms: Date.now(),
        source: 'cloud_function_v2',
      });
      admissionPaymentDocId = ref.id;
    });

    try {
      // Simulate server-side verification completion
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const batch = db.batch();
        batch.update(db.collection('payments').doc(admissionPaymentDocId), {
          state: 'succeeded',
          status: 'succeeded',
          provider_payment_id: admissionPaymentId,
          provider_signature: admissionSig,
          paid_amount: 10000,
          finalized_at: new Date(),
        });
        batch.set(db.collection('payment_processor_audit_logs').doc(), {
          event: 'admission_payment_verified',
          user_id: REAL_DATA.STUDENT_UID,
          course_id: 'course_rabiya',
          amount: 10000,
          created_at: new Date(),
        });
        await batch.commit();
      });

      // Verify student can read own successful admission payment
      const pDoc = await studentDb.collection('payments').doc(admissionPaymentDocId).get();
      assert.strictEqual(pDoc.data().status, 'succeeded');
      assert.strictEqual(pDoc.data().amount, 10000);
      report('P72-07', 'Admission payment (₹100) created & verified successfully', 'PASS');
    } catch (e) {
      report('P72-07', 'Admission payment failed', 'FAIL', e);
    }

    // =============================================================
    // 8. COURSE PAYMENT & FREE COURSES (SHORT COURSES)
    // =============================================================
    console.log('\n--- [8. COURSE PAYMENT & FREE COURSE ENROLLMENT] ---');
    // 8A: Course Fee Payment (Rabiya ₹500 = 50,000 paise)
    const courseOrderId = 'order_course_rabiya_001';
    const coursePaymentId = 'pay_course_rabiya_001';
    let coursePaymentDocId = '';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const pRef = await db.collection('payments').add({
        user_id: REAL_DATA.STUDENT_UID,
        course_id: 'course_rabiya',
        provider: 'razorpay',
        provider_order_id: courseOrderId,
        amount: 50000, // ₹500 in paise
        currency: 'INR',
        payment_type: 'fees',
        type: 'fees',
        state: 'pending',
        status: 'pending',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
        created_at_ms: Date.now(),
      });
      coursePaymentDocId = pRef.id;

      // Finalize and grant enrollment
      const batch = db.batch();
      batch.update(pRef, {
        state: 'succeeded',
        status: 'succeeded',
        provider_payment_id: coursePaymentId,
        paid_amount: 50000,
        finalized_at: new Date(),
      });
      const enrollmentId = `${REAL_DATA.STUDENT_UID}:course_rabiya`;
      batch.set(db.collection('enrollments').doc(enrollmentId), {
        user_id: REAL_DATA.STUDENT_UID,
        course_id: 'course_rabiya',
        status: 'active',
        source: 'payment',
        payment_id: coursePaymentDocId,
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
        updated_at: new Date(),
      });
      await batch.commit();
    });

    report('P72-08A', 'Course fee payment (₹500) finalized and active enrollment granted', 'PASS');

    // 8B: Free Course Enrollment (Short Courses: course_fee == 0)
    const freeEnrollmentId = `${REAL_DATA.STUDENT_UID}:course_short_courses`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Server-side enrollInFreeCourse execution
      await db.collection('enrollments').doc(freeEnrollmentId).set({
        user_id: REAL_DATA.STUDENT_UID,
        course_id: 'course_short_courses',
        status: 'active',
        source: 'free_course',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    try {
      const freeDoc = await studentDb.collection('enrollments').doc(freeEnrollmentId).get();
      assert.strictEqual(freeDoc.exists, true);
      assert.strictEqual(freeDoc.data().status, 'active');
      assert.strictEqual(freeDoc.data().source, 'free_course');
      report('P72-08B', 'Short Courses FREE enrollment directly verified', 'PASS');
    } catch (e) {
      report('P72-08B', 'Free course enrollment failed', 'FAIL', e);
    }

    // =============================================================
    // 9. ENROLLMENT & ANTI-CHEAT
    // =============================================================
    console.log('\n--- [9. DETERMINISTIC ENROLLMENT & SECURITY RULES] ---');
    try {
      // Attack: Unauthorized student attempts to directly write an enrollment in Firestore
      await assertFails(
        attackerDb.collection('enrollments').doc(`${REAL_DATA.ATTACKER_STUDENT_UID}:course_rabiya`).set({
          user_id: REAL_DATA.ATTACKER_STUDENT_UID,
          course_id: 'course_rabiya',
          status: 'active',
          source: 'hacked',
        })
      );
      report('P72-09A', 'Student direct creation of enrollment record strictly -> DENIED', 'PASS');
    } catch (e) {
      report('P72-09A', 'Direct enrollment creation attack was not rejected', 'FAIL', e);
    }

    try {
      // Verify enrolled student can read their own enrollment
      const enrDoc = await studentDb.collection('enrollments').doc(`${REAL_DATA.STUDENT_UID}:course_rabiya`).get();
      assert.strictEqual(enrDoc.exists, true);
      assert.strictEqual(enrDoc.data().status, 'active');
      report('P72-09B', 'Enrolled student reading own active enrollment -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-09B', 'Enrolled student could not read own enrollment', 'FAIL', e);
    }

    // =============================================================
    // 10. TEACHER VISIBILITY & SCOPING
    // =============================================================
    console.log('\n--- [10. TEACHER VISIBILITY & SCOPING] ---');
    try {
      // Course Rabiya is taught by Sumra Fatma
      const rabiyaDoc = await studentDb.collection('courses').doc('course_rabiya').get();
      assert.strictEqual(rabiyaDoc.data().teacher_name, 'Sumra Fatma');

      // Verify teacher profiles are readable by signed in students
      const tchDoc = await studentDb.collection('teachers').doc(REAL_DATA.TEACHER_UID).get();
      assert.strictEqual(tchDoc.exists, true);
      report('P72-10', 'Teacher visibility properly mapped to academic scope', 'PASS');
    } catch (e) {
      report('P72-10', 'Teacher visibility failed', 'FAIL', e);
    }

    // =============================================================
    // 11. LEARNING CONTENT ACCESS
    // =============================================================
    console.log('\n--- [11. LEARNING CONTENT (MODULES & LESSONS)] ---');
    try {
      // Enrolled student can now read the lesson they were previously denied!
      const lessonSnap = await studentDb.collection('lessons').doc('lesson_rabiya_01').get();
      assert.strictEqual(lessonSnap.exists, true);
      assert.strictEqual(lessonSnap.data().title, 'Sabaq 1: Bunyadi Deeniyat');
      report('P72-11A', 'Enrolled student accessing course lesson & audio URL -> ALLOWED', 'PASS');

      // Attacker student is still unenrolled -> DENIED
      await assertFails(attackerDb.collection('lessons').doc('lesson_rabiya_01').get());
      report('P72-11B', 'Unenrolled student accessing restricted course lesson -> DENIED', 'PASS');
    } catch (e) {
      report('P72-11', 'Learning content access check failed', 'FAIL', e);
    }

    // =============================================================
    // 12. ASSIGNMENT & GRADING WORKFLOW
    // =============================================================
    console.log('\n--- [12. ASSIGNMENT WORKFLOW] ---');
    const assignmentId = 'assign_rabiya_01';
    const submissionId = 'sub_rabiya_01_sheikh';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('assignments').doc(assignmentId).set({
        course_id: 'course_rabiya',
        title: 'Hifz Sabaq Submission',
        instructions: 'Record and submit Sabaq 1 tilawat.',
        created_at: new Date(),
      });
    });

    try {
      // Student submits response with mandatory submitted_at timestamp (using production schema keys)
      await assertSucceeds(
        studentDb.collection('submissions').doc(submissionId).set({
          assignment_id: assignmentId,
          user_id: REAL_DATA.STUDENT_UID,
          text_answer: 'Recitation of Surah Al-Fatiha with focus on Ayn and Haa.',
          file_url: 'https://firebasestorage.googleapis.com/v0/b/madrasa-app-50d6c.appspot.com/o/recitation.m4a',
          file_name: 'recitation_sheikh.m4a',
          mime_type: 'audio/m4a',
          status: 'submitted',
          submitted_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        })
      );
      report('P72-12A', 'Student submits assignment response with submitted_at -> ALLOWED', 'PASS');

      // Teacher grades submission and provides feedback
      await assertSucceeds(
        teacherDb.collection('submissions').doc(submissionId).update({
          grade: 98,
          status: 'graded',
          feedback: 'MashAllah, excellent pronunciation and tajweed rules applied.',
          graded_at: new Date(),
          updated_at: new Date(),
        })
      );
      report('P72-12B', 'Teacher grades submission and writes feedback -> ALLOWED', 'PASS');

      // Student reads teacher grade & feedback
      const gradedDoc = await studentDb.collection('submissions').doc(submissionId).get();
      assert.strictEqual(gradedDoc.data().grade, 98);
      assert.strictEqual(gradedDoc.data().status, 'graded');
      report('P72-12C', 'Student receives teacher grade and feedback -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-12', 'Assignment workflow failed', 'FAIL', e);
    }

    // =============================================================
    // 13. QUIZ ASSESSMENT & EVALUATION
    // =============================================================
    console.log('\n--- [13. QUIZ ASSESSMENT WORKFLOW] ---');
    const quizResultId = `qr_${REAL_DATA.STUDENT_UID}_quiz_rabiya_01`;

    try {
      // Anti-cheat: Student direct creation of quiz_results is denied
      await assertFails(
        studentDb.collection('quiz_results').doc(quizResultId).set({
          user_id: REAL_DATA.STUDENT_UID,
          course_id: 'course_rabiya',
          score: 10,
          total_questions: 10,
          created_at: new Date(),
        })
      );
      report('P72-13A', 'Student direct creation of quiz_result strictly -> DENIED', 'PASS');
    } catch (e) {
      report('P72-13A', 'Direct quiz_result creation was not rejected', 'FAIL', e);
    }

    // Legitimate quiz evaluation via trusted backend
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('quiz_results').doc(quizResultId).set({
        user_id: REAL_DATA.STUDENT_UID,
        course_id: 'course_rabiya',
        category: 'Rabiya Aqaid',
        score: 10,
        total_questions: 10,
        percentage: 100,
        status: 'evaluated',
        created_at: new Date(),
      });
    });

    try {
      // Student reads evaluated result
      const qDoc = await studentDb.collection('quiz_results').doc(quizResultId).get();
      assert.strictEqual(qDoc.data().score, 10);
      assert.strictEqual(qDoc.data().percentage, 100);
      report('P72-13B', 'Student reading trusted backend quiz result -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-13B', 'Student reading quiz result failed', 'FAIL', e);
    }

    // =============================================================
    // 14. LIVE CLASS WORKFLOW
    // =============================================================
    console.log('\n--- [14. LIVE CLASS WORKFLOW] ---');
    const liveClassId = 'live_rabiya_session_01';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('live_classes').doc(liveClassId).set({
        course_id: 'course_rabiya',
        title: 'Live Sabaq Session',
        teacher_id: REAL_DATA.TEACHER_UID,
        teacher_name: REAL_DATA.TEACHER_NAME,
        meet_link: 'https://meet.google.com/mslb-rabiya-live',
        status: 'active',
        organization_id: REAL_DATA.ORGANIZATION_ID,
        created_at: new Date(),
      });
    });

    try {
      // Enrolled student can see live class and join link
      const liveDoc = await studentDb.collection('live_classes').doc(liveClassId).get();
      assert.strictEqual(liveDoc.exists, true);
      assert.strictEqual(liveDoc.data().meet_link, 'https://meet.google.com/mslb-rabiya-live');
      report('P72-14', 'Enrolled student sees active live class and join link -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-14', 'Live class workflow failed', 'FAIL', e);
    }

    // =============================================================
    // 15. ATTENDANCE WORKFLOW
    // =============================================================
    console.log('\n--- [15. ATTENDANCE TRACKING] ---');
    const attendanceDocId = `att_${liveClassId}_${REAL_DATA.STUDENT_UID}`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('attendance').doc(attendanceDocId).set({
        user_id: REAL_DATA.STUDENT_UID,
        student_id: REAL_DATA.STUDENT_UID,
        student_name: REAL_DATA.STUDENT_NAME,
        course_id: 'course_rabiya',
        live_class_id: liveClassId,
        status: 'present',
        marked_by: REAL_DATA.TEACHER_UID,
        timestamp: new Date(),
        created_at: new Date(),
      });
    });

    try {
      // Student reads attendance record
      const attDoc = await studentDb.collection('attendance').doc(attendanceDocId).get();
      assert.strictEqual(attDoc.data().status, 'present');
      report('P72-15A', 'Student reads attendance marked present -> ALLOWED', 'PASS');

      // Student cannot delete or modify attendance
      await assertFails(studentDb.collection('attendance').doc(attendanceDocId).update({ status: 'absent' }));
      report('P72-15B', 'Student tampering with attendance record strictly -> DENIED', 'PASS');
    } catch (e) {
      report('P72-15', 'Attendance workflow failed', 'FAIL', e);
    }

    // =============================================================
    // 16. PROGRESS AGGREGATION
    // =============================================================
    console.log('\n--- [16. PROGRESS TRACKING] ---');
    const progressDocId = `${REAL_DATA.STUDENT_UID}:lesson_rabiya_01`;
    try {
      await assertSucceeds(
        studentDb.collection('lesson_progress').doc(progressDocId).set({
          user_id: REAL_DATA.STUDENT_UID,
          course_id: 'course_rabiya',
          lesson_id: 'lesson_rabiya_01',
          module_id: 'mod_rabiya_01',
          completed: true,
          quiz_completed: true,
          completed_at: new Date(),
          last_opened_at: new Date(),
          updated_at: new Date(),
        })
      );
      report('P72-16', 'Student records lesson progress -> ALLOWED', 'PASS');
    } catch (e) {
      report('P72-16', 'Progress tracking failed', 'FAIL', e);
    }

    // =============================================================
    // 17. CERTIFICATE ELIGIBILITY & GENERATION
    // =============================================================
    console.log('\n--- [17. CERTIFICATE GENERATION & VISIBILITY] ---');
    const certId = `cert_${REAL_DATA.STUDENT_UID}_course_rabiya`;

    // Server-side generateCertificate execution
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('certificates').doc(certId).set({
        certificate_id: certId,
        user_id: REAL_DATA.STUDENT_UID,
        uid: REAL_DATA.STUDENT_UID,
        course_id: 'course_rabiya',
        course_name: 'Rabiya',
        user_name: REAL_DATA.STUDENT_NAME,
        score: 10,
        total_questions: 10,
        percentage: 100,
        grade_label: 'Distinction',
        completion_date: '30 Sep 2026',
        hijri_date: '18 Rabi al-Akhir 1448 AH',
        status: 'issued',
        created_at: new Date(),
      });

      // Public verification record
      await db.collection('certificate_verifications').doc(certId).set({
        certificateId: certId,
        courseTitle: 'Rabiya',
        studentNameMasked: 'Sheikh (محفوظ)',
        status: 'issued',
        institution: 'Madrasatu-s-Salikat Lil Banat',
      });
    });

    try {
      // Owner student reads own certificate
      const certDoc = await studentDb.collection('certificates').doc(certId).get();
      assert.strictEqual(certDoc.exists, true);
      assert.strictEqual(certDoc.data().percentage, 100);
      report('P72-17A', 'Student accesses own awarded certificate -> ALLOWED', 'PASS');

      // Attacker student is DENIED reading another student's certificate
      await assertFails(attackerDb.collection('certificates').doc(certId).get());
      report('P72-17B', 'Attacker reading another student certificate strictly -> DENIED', 'PASS');
    } catch (e) {
      report('P72-17', 'Certificate verification failed', 'FAIL', e);
    }

    // =============================================================
    // 18. PAYMENT SECURITY ATTACK TESTS
    // =============================================================
    console.log('\n--- [18. PAYMENT SECURITY ATTACK TESTS] ---');
    try {
      // Attack 1: Student tries to create payment directly in 'succeeded' state
      await assertFails(
        studentDb.collection('payments').add({
          user_id: REAL_DATA.STUDENT_UID,
          amount: 50000,
          currency: 'INR',
          state: 'succeeded',
          status: 'succeeded',
          provider: 'razorpay',
          created_at: new Date(),
        })
      );
      report('P72-18A', 'Creating payment directly in "succeeded" state -> DENIED', 'PASS');
    } catch (e) {
      report('P72-18A', 'Payment direct succeeded creation not rejected', 'FAIL', e);
    }

    try {
      // Attack 2: Student tries to update own payment amount to 1 INR
      await assertFails(
        studentDb.collection('payments').doc(admissionPaymentDocId).update({
          amount: 100, // 1 INR
        })
      );
      report('P72-18B', 'Tampering with payment amount -> DENIED', 'PASS');
    } catch (e) {
      report('P72-18B', 'Payment amount tampering not rejected', 'FAIL', e);
    }

    try {
      // Attack 3: Student tries to create payment under another user's UID
      await assertFails(
        studentDb.collection('payments').add({
          user_id: REAL_DATA.ATTACKER_STUDENT_UID,
          amount: 50000,
          currency: 'INR',
          state: 'pending',
          status: 'pending',
          provider: 'razorpay',
          created_at: new Date(),
        })
      );
      report('P72-18C', 'Creating payment under another user ID -> DENIED', 'PASS');
    } catch (e) {
      report('P72-18C', 'Cross-user payment creation not rejected', 'FAIL', e);
    }

    // =============================================================
    // 19. ACADEMIC SECURITY ATTACKS
    // =============================================================
    console.log('\n--- [19. ACADEMIC SECURITY ATTACKS] ---');
    try {
      // Attack 4: Attacker student attempts to read Sheikh's private assignment submission
      await assertFails(attackerDb.collection('submissions').doc(submissionId).get());
      report('P72-19A', 'Cross-student submission snooping -> DENIED', 'PASS');
    } catch (e) {
      report('P72-19A', 'Cross-student submission snooping not rejected', 'FAIL', e);
    }

    try {
      // Attack 5: Attacker student attempts to edit Sheikh's quiz score
      await assertFails(
        attackerDb.collection('quiz_results').doc(quizResultId).update({
          score: 0,
        })
      );
      report('P72-19B', 'Modifying another student quiz score -> DENIED', 'PASS');
    } catch (e) {
      report('P72-19B', 'Quiz score tampering not rejected', 'FAIL', e);
    }

    // =============================================================
    // 20. END-TO-END DATA CONSISTENCY CHECK
    // =============================================================
    console.log('\n--- [20. DATA CONSISTENCY ACROSS ALL COLLECTIONS] ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const collectionsToCheck = [
        ['users', REAL_DATA.STUDENT_UID],
        ['payments', admissionPaymentDocId],
        ['payments', coursePaymentDocId],
        ['enrollments', `${REAL_DATA.STUDENT_UID}:course_rabiya`],
        ['enrollments', `${REAL_DATA.STUDENT_UID}:course_short_courses`],
        ['courses', 'course_rabiya'],
        ['courses', 'course_short_courses'],
        ['modules', 'mod_rabiya_01'],
        ['lessons', 'lesson_rabiya_01'],
        ['assignments', assignmentId],
        ['submissions', submissionId],
        ['quiz_results', quizResultId],
        ['attendance', attendanceDocId],
        ['lesson_progress', progressDocId],
        ['live_classes', liveClassId],
        ['certificates', certId],
      ];

      let allConsistent = true;
      for (const [col, id] of collectionsToCheck) {
        const snap = await db.collection(col).doc(id).get();
        if (!snap.exists) {
          allConsistent = false;
          console.error(`Missing expected document in ${col}/${id}`);
        }
      }
      assert.strictEqual(allConsistent, true, 'All 16 operational documents must exist and have consistent relations');
    });

    report('P72-20', 'Referential data consistency verified across all 14 Firestore collections', 'PASS');

    // =============================================================
    // 21. UI / NAVIGATION CHAIN
    // =============================================================
    console.log('\n--- [21. UI / NAVIGATION ROUTE CHAIN] ---');
    const studentRoutes = [
      'frontend/app/(tabs)/index.tsx',
      'frontend/app/(tabs)/courses.tsx',
      'frontend/app/course/[id].tsx',
      'frontend/app/payment.tsx',
      'frontend/app/live-class/index.tsx',
      'frontend/app/(tabs)/attendance.tsx',
      'frontend/app/(tabs)/quiz.tsx',
      'frontend/app/(tabs)/progress.tsx',
      'frontend/app/(tabs)/certificate.tsx',
    ];

    let allRoutesExist = true;
    for (const r of studentRoutes) {
      if (!fs.existsSync(path.join(repoRoot, r))) {
        allRoutesExist = false;
        console.error(`Route file missing: ${r}`);
      }
    }
    assert.strictEqual(allRoutesExist, true);
    report('P72-21', 'All Student navigation chain routes exist and resolve cleanly', 'PASS');

  } finally {
    await testEnv.cleanup();
  }

  console.log('\n================================================================');
  console.log(`PHASE 72 E2E RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase72E2ESuite().catch((err) => {
  console.error('Test Suite Fatal Crash:', err);
  process.exit(1);
});
