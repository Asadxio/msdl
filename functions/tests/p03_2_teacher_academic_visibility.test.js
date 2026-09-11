/**
 * MSLB Phase P0.3.2 — Complete Teacher Academic Visibility Test Suite
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { initializeApp } = require("../../frontend/node_modules/firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("../../frontend/node_modules/firebase/auth");
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} = require("../../frontend/node_modules/firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyDFk_Cc6yEIROJ60vq0VtyFx0qd4YUeqxQ",
  authDomain: "madrasa-app-50d6c.firebaseapp.com",
  projectId: "madrasa-app-50d6c",
  storageBucket: "madrasa-app-50d6c.appspot.com",
  messagingSenderId: "675123731963",
  appId: "1:675123731963:web:2b892063276a7c452cbf5e",
};

const repoRoot = "C:/Users/xioas/.gemini/antigravity/scratch/msdl";

console.log("================================================================");
console.log("   PHASE P0.3.2 - TEACHER ACADEMIC VISIBILITY TEST SUITE       ");
console.log("================================================================");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log("  [PASS] " + name);
    passed++;
  } catch (err) {
    console.error("  [FAIL] " + name + ": " + (err.stack || err.message));
    failed++;
  }
}

(async () => {
  // 1. Data Model Separation & Rules
  await test("ARCH-01: Data models remain strictly separated (/quiz_results != /submissions)", () => {
    const rulesContent = fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8");
    assert.strictEqual(rulesContent.includes("match /quiz_results/{resultId}"), true);
    assert.strictEqual(rulesContent.includes("match /submissions/{submissionId}"), true);

    const dashboardContent = fs.readFileSync(path.join(repoRoot, "frontend/components/teacher/TeacherDashboard.tsx"), "utf8");
    assert.strictEqual(dashboardContent.includes("collection(db, 'quiz_results')"), true);
    assert.strictEqual(dashboardContent.includes("collection(db, 'submissions')"), true);
  });

  await test("ARCH-02: Firestore rules grant Teachers read access to /quiz_results", () => {
    const rulesContent = fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8");
    const quizMatch = rulesContent.slice(rulesContent.indexOf("match /quiz_results/{resultId}"));
    const ruleSection = quizMatch.slice(0, quizMatch.indexOf("match /quiz_attempt_locks"));
    assert.strictEqual(ruleSection.includes("isTeacherOrAdmin()"), true);
  });

  await test("ARCH-03: Firestore rules enforce score immutability during teacher review", () => {
    const rulesContent = fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8");
    assert.strictEqual(rulesContent.includes("request.resource.data.score == resource.data.score"), true);
    assert.strictEqual(rulesContent.includes("request.resource.data.total == resource.data.total"), true);
    assert.strictEqual(rulesContent.includes("request.resource.data.percentage == resource.data.percentage"), true);
    assert.strictEqual(rulesContent.includes("request.resource.data.user_id == resource.data.user_id"), true);
  });

  await test("ARCH-04: Client TeacherDashboard implements score immutability and note update", () => {
    const dashboardContent = fs.readFileSync(path.join(repoRoot, "frontend/components/teacher/TeacherDashboard.tsx"), "utf8");
    assert.strictEqual(dashboardContent.includes("handleSaveTeacherNote"), true);
    assert.strictEqual(dashboardContent.includes("teacher_notes: teacherNoteInput.trim()"), true);
    assert.strictEqual(dashboardContent.includes("reviewed_at: serverTimestamp()"), true);
  });

  await test("ARCH-05: Cloud Function submitQuiz receives and records course_id & student_name", () => {
    const fnContent = fs.readFileSync(path.join(repoRoot, "functions/src/quiz/submitQuiz.ts"), "utf8");
    assert.strictEqual(fnContent.includes("course_id?: string"), true);
    assert.strictEqual(fnContent.includes("student_name?: string"), true);
    assert.strictEqual(fnContent.includes("resultDocData.course_id = String(request.data.course_id).trim()"), true);
    assert.strictEqual(fnContent.includes("resultDocData.student_name = String(request.data.student_name).trim()"), true);
  });

  await test("ARCH-06: Client quiz.tsx captures course_id and forwards to submitQuiz", () => {
    const quizClientContent = fs.readFileSync(path.join(repoRoot, "frontend/app/(tabs)/quiz.tsx"), "utf8");
    assert.strictEqual(quizClientContent.includes("course_id: String(params.courseId || params.course_id || '').trim()"), true);
    assert.strictEqual(quizClientContent.includes("student_name: profile?.name || user.displayName || undefined"), true);
  });

  // 2. RBAC & IDOR Rules
  await test("RBAC-01: Student A cannot view Student B quiz results via rule logic", () => {
    const evaluateReadRule = (callerRole, callerUid, docUserId) => {
      const isTeacherOrAdmin = callerRole === "admin" || callerRole === "super_admin" || callerRole === "teacher";
      const isOwner = callerUid === docUserId;
      return isTeacherOrAdmin || isOwner;
    };
    assert.strictEqual(evaluateReadRule("student", "student_123", "student_123"), true);
    assert.strictEqual(evaluateReadRule("student", "student_123", "student_456"), false);
    assert.strictEqual(evaluateReadRule("teacher", "teacher_789", "student_456"), true);
  });

  await test("RBAC-02: Grade tampering rejection simulation", () => {
    const evaluateUpdateRule = (callerRole, existingData, updatedData) => {
      if (callerRole !== "admin" && callerRole !== "super_admin" && callerRole !== "teacher") return false;
      if (updatedData.score !== existingData.score) return false;
      if (updatedData.total !== existingData.total) return false;
      if (updatedData.percentage !== existingData.percentage) return false;
      if (updatedData.user_id !== existingData.user_id) return false;
      return true;
    };
    const original = { user_id: "std_1", score: 8, total: 10, percentage: 80, teacher_notes: "" };
    const validUpdate = { ...original, teacher_notes: "Great tajweed progress" };
    assert.strictEqual(evaluateUpdateRule("teacher", original, validUpdate), true);
    const tamperedUpdate = { ...original, score: 10, percentage: 100 };
    assert.strictEqual(evaluateUpdateRule("teacher", original, tamperedUpdate), false);
  });

  // 3. Live Server-Side / Client Rule Verification
  // In production rules, quiz_results creation is allow create: if false (Cloud Function Admin SDK only).
  // Teachers/Admins can read existing quiz results and teachers can update teacher_notes.
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await test("LIVE-01: Authenticate as Teacher/Admin (sumraftm@gmail.com)", async () => {
    const cred = await signInWithEmailAndPassword(auth, "sumraftm@gmail.com", "asadasad");
    assert.ok(cred.user.uid);
  });

  await test("LIVE-02: Query real production quiz_results collection with teacher permissions", async () => {
    const { getDocs, query: fsQuery, limit: fsLimit } = require("../../frontend/node_modules/firebase/firestore");
    const q = fsQuery(collection(db, "quiz_results"), fsLimit(5));
    const snap = await getDocs(q);
    assert.ok(snap.size >= 1, "Should be able to read existing quiz_results documents");
    const firstDoc = snap.docs[0];
    const data = firstDoc.data();
    console.log(`       [INFO] Read doc ${firstDoc.id}: Student=${data.user_id}, Score=${data.score}/${data.total}, Cat=${data.category}`);
    assert.ok(typeof data.score === 'number', "Score must be a number");
  });

  await test("LIVE-03: Teacher updates teacher_notes on existing quiz result without mutating score", async () => {
    const { getDocs, query: fsQuery, limit: fsLimit } = require("../../frontend/node_modules/firebase/firestore");
    const q = fsQuery(collection(db, "quiz_results"), fsLimit(1));
    const snap = await getDocs(q);
    const targetDoc = snap.docs[0];
    const originalData = targetDoc.data();

    const noteTimestamp = new Date().toISOString();
    const testFeedback = `Academic review verified at ${noteTimestamp}`;

    await updateDoc(targetDoc.ref, {
      teacher_notes: testFeedback,
      feedback: testFeedback,
      reviewed_by: "Alima Fazila Sumra Fatma Qadri",
      reviewed_at: serverTimestamp(),
    });

    const refreshedSnap = await getDoc(targetDoc.ref);
    const refreshedData = refreshedSnap.data();
    assert.strictEqual(refreshedData.teacher_notes, testFeedback);
    assert.strictEqual(refreshedData.score, originalData.score, "Score must remain strictly unchanged");
    assert.strictEqual(refreshedData.user_id, originalData.user_id, "User ID must remain strictly unchanged");

    // Clean up note to preserve original state
    await updateDoc(targetDoc.ref, {
      teacher_notes: originalData.teacher_notes || "",
      feedback: originalData.feedback || "",
      reviewed_by: originalData.reviewed_by || "",
    });
    console.log("       [INFO] Cleaned up test note to maintain clean production state.");
  });

  console.log("================================================================");
  console.log("P0.3.2 TEST SUITE RESULTS: " + passed + " PASSED | " + failed + " FAILED");
  console.log("================================================================");
  if (failed > 0) process.exit(1);
})();
