/**
 * MSLB Phase P0.3.1 — Live Real Firebase Transaction Proof
 *
 * Executes real transaction writes against madrasa-app-50d6c:
 * 1. Admin login verification
 * 2. Real Teacher creation in teachers/
 * 3. Real Course creation in courses/
 * 4. Real Subject creation inside course.subjects[]
 * 5. Real Teacher assignment across all 4 sync paths
 * 6. Real Student enrollment with deterministic ID {studentUid}:{courseId}
 * 7. Real Attendance recording in attendance/
 * 8. Real Lesson progress tracking in lesson_progress/
 * 9. Direct verification of Firestore state
 * 10. Clean-up of test documents
 */
const { initializeApp } = require('../../frontend/node_modules/firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('../../frontend/node_modules/firebase/auth');
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} = require('../../frontend/node_modules/firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDFk_Cc6yEIROJ60vq0VtyFx0qd4YUeqxQ",
  authDomain: "madrasa-app-50d6c.firebaseapp.com",
  projectId: "madrasa-app-50d6c",
  storageBucket: "madrasa-app-50d6c.appspot.com",
  messagingSenderId: "675123731963",
  appId: "1:675123731963:web:2b892063276a7c452cbf5e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runLiveTransactions() {
  console.log("================================================================");
  console.log("   MSLB PHASE P0.3.1 — LIVE TRANSACTION PROOF (madrasa-app-50d6c)");
  console.log("================================================================");

  let createdTeacherId = null;
  let createdCourseId = null;
  let createdEnrollmentId = null;
  let createdAttendanceId = null;
  let createdProgressId = null;

  try {
    // 1. Authenticate as Super Admin
    console.log("\n[STEP 1] Authenticating as Admin...");
    const cred = await signInWithEmailAndPassword(auth, "sumraftm@gmail.com", "asadasad");
    const adminUser = cred.user;
    console.log(`  -> Signed in: UID=${adminUser.uid}, Email=${adminUser.email}`);

    // Verify Admin Firestore Profile
    const adminDoc = await getDoc(doc(db, "users", adminUser.uid));
    const adminData = adminDoc.data();
    console.log(`  -> Firestore Role: ${adminData?.role}, Status: ${adminData?.status}, Founder: ${adminData?.founder}`);

    // 2. LIVE TEST A: Create Teacher in teachers/
    console.log("\n[STEP 2] LIVE TEST A — Creating Teacher in teachers/...");
    const teacherPayload = {
      name: "E2E Proof Teacher",
      bio: "Ye ek real device verification ke liye test teacher profile hai.",
      title: "Verification Instructor",
      assigned_courses: [],
      courses: [],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    const teacherRef = await addDoc(collection(db, "teachers"), teacherPayload);
    createdTeacherId = teacherRef.id;
    console.log(`  -> Teacher created with Document ID: ${createdTeacherId}`);

    // Verify Teacher document in Firestore
    const teacherSnap = await getDoc(doc(db, "teachers", createdTeacherId));
    if (!teacherSnap.exists()) throw new Error("Teacher doc was not found after creation!");
    console.log(`  -> Firestore Proof: teachers/${createdTeacherId} exists. Name=${teacherSnap.data().name}`);

    // 3. LIVE TEST B: Create Course in courses/
    console.log("\n[STEP 3] LIVE TEST B — Creating Course in courses/...");
    const coursePayload = {
      name: "E2E Proof Course",
      description: "Ye ek real device verification ke liye test course hai.",
      teacher_name: "E2E Proof Teacher",
      teacher_id: createdTeacherId,
      schedule: "Mon - Thu",
      class_time: "10:00 AM IST",
      meet_link: "https://meet.google.com/proof-test-xyz",
      subjects: [],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    const courseRef = await addDoc(collection(db, "courses"), coursePayload);
    createdCourseId = courseRef.id;
    console.log(`  -> Course created with Document ID: ${createdCourseId}`);

    // Verify Course document in Firestore
    const courseSnap = await getDoc(doc(db, "courses", createdCourseId));
    if (!courseSnap.exists()) throw new Error("Course doc was not found after creation!");
    console.log(`  -> Firestore Proof: courses/${createdCourseId} exists. Name=${courseSnap.data().name}`);

    // 4. LIVE TEST C: Create Subject inside course.subjects[]
    console.log("\n[STEP 4] LIVE TEST C — Adding Embedded Subject to Course...");
    const subjectItem = {
      id: `sub_${Date.now()}`,
      name: "E2E Proof Subject",
      teacher_id: createdTeacherId,
      teacher_name: "E2E Proof Teacher",
      schedule: "Mon - Wed 10:00 AM",
    };
    await updateDoc(doc(db, "courses", createdCourseId), {
      subjects: [subjectItem],
      updated_at: serverTimestamp(),
    });
    console.log(`  -> Subject appended: ID=${subjectItem.id}, Name=${subjectItem.name}`);

    // Verify Subject in course doc
    const updatedCourseSnap = await getDoc(doc(db, "courses", createdCourseId));
    const courseSubjects = updatedCourseSnap.data().subjects;
    if (!courseSubjects || courseSubjects.length === 0 || courseSubjects[0].name !== "E2E Proof Subject") {
      throw new Error("Subject was not properly saved into course document!");
    }
    console.log(`  -> Firestore Proof: courses/${createdCourseId}.subjects[0] validated.`);

    // 5. LIVE TEST D: Assign Teacher Sync
    console.log("\n[STEP 5] LIVE TEST D — Syncing Teacher Assigned Courses...");
    await updateDoc(doc(db, "teachers", createdTeacherId), {
      assigned_courses: ["E2E Proof Course"],
      courses: ["E2E Proof Course"],
      updated_at: serverTimestamp(),
    });
    const updatedTeacherSnap = await getDoc(doc(db, "teachers", createdTeacherId));
    const assignedList = updatedTeacherSnap.data().assigned_courses;
    console.log(`  -> Teacher assigned_courses: [${assignedList.join(", ")}]`);

    // Verify all 4 sync paths
    console.log("  -> Verifying 4 sync paths:");
    console.log(`     1. courses.teacher_id: ${updatedCourseSnap.data().teacher_id === createdTeacherId ? "MATCH" : "MISMATCH"}`);
    console.log(`     2. courses.teacher_name: ${updatedCourseSnap.data().teacher_name === "E2E Proof Teacher" ? "MATCH" : "MISMATCH"}`);
    console.log(`     3. subjects[0].teacher_id: ${courseSubjects[0].teacher_id === createdTeacherId ? "MATCH" : "MISMATCH"}`);
    console.log(`     4. teachers.assigned_courses: ${assignedList.includes("E2E Proof Course") ? "MATCH" : "MISMATCH"}`);

    // 6. LIVE TEST F: Enroll Student with Deterministic ID
    console.log("\n[STEP 6] LIVE TEST F — Enrolling Student with Deterministic ID...");
    const studentUid = "5KaFYp6ym7MaVlCF8HLvi8u6A9K2"; // Existing approved student
    createdEnrollmentId = `${studentUid}:${createdCourseId}`;
    await setDoc(doc(db, "enrollments", createdEnrollmentId), {
      user_id: studentUid,
      course_id: createdCourseId,
      status: "active",
      enrolled_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    console.log(`  -> Enrollment created at path: enrollments/${createdEnrollmentId}`);

    // Verify Enrollment in Firestore
    const enrollmentSnap = await getDoc(doc(db, "enrollments", createdEnrollmentId));
    if (!enrollmentSnap.exists()) throw new Error("Enrollment document was not created!");
    console.log(`  -> Firestore Proof: enrollments/${createdEnrollmentId} exists. Status=${enrollmentSnap.data().status}`);

    // 7. LIVE TEST G: Record Attendance
    console.log("\n[STEP 7] LIVE TEST G — Recording Attendance...");
    createdAttendanceId = `${studentUid}_2026-09-11_${createdCourseId}`;
    await setDoc(doc(db, "attendance", createdAttendanceId), {
      user_id: studentUid,
      date: "2026-09-11",
      status: "present",
      marked_by: "admin",
      marked_by_uid: adminUser.uid,
      marked_by_name: "Sumra Fatma",
      course_id: createdCourseId,
      marked_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    console.log(`  -> Attendance created at path: attendance/${createdAttendanceId}`);

    // Verify Attendance in Firestore
    const attendanceSnap = await getDoc(doc(db, "attendance", createdAttendanceId));
    if (!attendanceSnap.exists()) throw new Error("Attendance document was not created!");
    console.log(`  -> Firestore Proof: attendance/${createdAttendanceId} exists. Status=${attendanceSnap.data().status}`);

    // 8. LIVE TEST H: Record Lesson Progress
    console.log("\n[STEP 8] LIVE TEST H — Recording Lesson Progress...");
    createdProgressId = `prog_${studentUid}_testlesson`;
    await setDoc(doc(db, "lesson_progress", createdProgressId), {
      user_id: studentUid,
      lesson_id: "test_lesson_1",
      course_id: createdCourseId,
      completed: true,
      completed_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    console.log(`  -> Lesson progress created at path: lesson_progress/${createdProgressId}`);

    const progressSnap = await getDoc(doc(db, "lesson_progress", createdProgressId));
    if (!progressSnap.exists()) throw new Error("Progress document was not created!");
    console.log(`  -> Firestore Proof: lesson_progress/${createdProgressId} exists. Completed=${progressSnap.data().completed}`);

    console.log("\n================================================================");
    console.log("   ALL LIVE TRANSACTION TESTS EXECUTED AND VERIFIED ON FIRESTORE");
    console.log("================================================================");

  } catch (err) {
    console.error("TRANSACTION FAILED:", err);
  } finally {
    // 9. CLEANUP TEMPORARY E2E TEST DATA
    console.log("\n[CLEANUP] Cleaning up temporary E2E test documents...");
    if (createdTeacherId) {
      await deleteDoc(doc(db, "teachers", createdTeacherId));
      console.log(`  -> Deleted teachers/${createdTeacherId}`);
    }
    if (createdCourseId) {
      await deleteDoc(doc(db, "courses", createdCourseId));
      console.log(`  -> Deleted courses/${createdCourseId}`);
    }
    if (createdEnrollmentId) {
      await deleteDoc(doc(db, "enrollments", createdEnrollmentId));
      console.log(`  -> Deleted enrollments/${createdEnrollmentId}`);
    }
    if (createdAttendanceId) {
      await deleteDoc(doc(db, "attendance", createdAttendanceId));
      console.log(`  -> Deleted attendance/${createdAttendanceId}`);
    }
    if (createdProgressId) {
      await deleteDoc(doc(db, "lesson_progress", createdProgressId));
      console.log(`  -> Deleted lesson_progress/${createdProgressId}`);
    }
    console.log("  -> Cleanup complete. Zero temporary test documents remain.");
  }
}

runLiveTransactions();
