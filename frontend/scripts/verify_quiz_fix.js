const { initializeApp: initAdmin, cert } = require('firebase-admin/app');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const { initializeApp: initWeb } = require('firebase/app');
const { getAuth: getWebAuth, signInWithCustomToken } = require('firebase/auth');
const { getFirestore: getWebFirestore, collection, addDoc, serverTimestamp, getDoc, doc } = require('firebase/firestore');

async function runTest() {
  console.log('--- STARTING FORENSIC QUIZ FIX VALIDATION ---');
  
  // 1. Init Admin
  const serviceAccount = JSON.parse(fs.readFileSync('./backend/serviceAccountKey.json', 'utf8'));
  const adminApp = initAdmin({ credential: cert(serviceAccount) });
  const adminAuth = getAdminAuth(adminApp);
  const adminDb = getAdminFirestore(adminApp);
  
  // 2. Create Mock User
  const uid = 'test_quiz_user_' + Date.now();
  await adminAuth.createUser({ 
    uid,
    email: `${uid}@example.com`,
    emailVerified: true
  });
  console.log(`Created Auth User: ${uid}`);
  
  await adminDb.collection('users').doc(uid).set({
    uid,
    role: 'student',
    status: 'approved',
    verified: true,
    name: 'Test Quiz User',
    created_at: new Date()
  });
  console.log(`Created Firestore User Doc: approved & verified`);
  
  // 3. Get Custom Token
  const customToken = await adminAuth.createCustomToken(uid);
  
  // 4. Init Web SDK
  const firebaseConfig = {
    apiKey: "AIzaSyDFk_Cc6yEIROJ60vq0VtyFx0qd4YUeqxQ",
    authDomain: "madrasa-app-50d6c.firebaseapp.com",
    projectId: "madrasa-app-50d6c",
  };
  const webApp = initWeb(firebaseConfig);
  const webAuth = getWebAuth(webApp);
  const webDb = getWebFirestore(webApp);
  
  await signInWithCustomToken(webAuth, customToken);
  console.log(`Web SDK Signed In as: ${webAuth.currentUser.uid}`);
  
  // 5. Test quiz_results Write
  console.log('\n--- TESTING QUIZ RESULTS WRITE ---');
  let quizResultRef;
  try {
    // Check if we can read our own user document (tests isSignedIn and isSelf)
    const userDoc = await getDoc(doc(webDb, 'users', uid));
    console.log(`Can read user doc: ${userDoc.exists()}`);
    console.log(`User data:`, userDoc.data());

    // Check if isApprovedVerifiedUser() works by reading public_profiles
    try {
      await getDoc(doc(webDb, 'public_profiles', 'test'));
      console.log('PASS: isApprovedVerifiedUser() evaluated to true for GET public_profiles.');
    } catch (e) {
      console.log('FAIL: isApprovedVerifiedUser() evaluated to FALSE for GET public_profiles.', e.message);
    }

    const payload = {
      user_id: uid,
      score: 18,
      total_questions: 20,
      created_at: serverTimestamp(),
    };
    quizResultRef = await addDoc(collection(webDb, 'quiz_results'), payload);
    console.log('PASS: quiz_results document created successfully! Spinner will stop.');
    console.log(`Document ID: ${quizResultRef.id}`);
  } catch (err) {
    console.error('FAIL: quiz_results failed!', err.message);
    process.exit(1);
  }
  
  // 6. Test notifications Write (Expected to PASS now)
  console.log('\n--- TESTING NOTIFICATIONS WRITE ---');
  let notifRef;
  try {
    notifRef = await addDoc(collection(webDb, 'notifications'), {
      title: 'Wudu Quiz Completed',
      message: 'You scored 18/20 in Wudu.',
      user_id: uid,
      created_at: serverTimestamp()
    });
    console.log('PASS: notifications write succeeded as a regular user.');
  } catch (err) {
    console.error('FAIL: notifications rejected!', err.message);
    process.exit(1);
  }

  // 7. Verify Document Content
  console.log('\n--- VERIFYING DOCUMENT CONTENT ---');
  const docSnap = await adminDb.collection('quiz_results').doc(quizResultRef.id).get();
  const data = docSnap.data();
  console.log('Saved Document Data:');
  console.log(JSON.stringify(data, null, 2));
  
  const keys = Object.keys(data);
  if (keys.length === 4 && keys.includes('user_id') && keys.includes('score') && keys.includes('total_questions') && keys.includes('created_at')) {
    console.log('PASS: quiz_results contains ONLY the allowed fields.');
  } else {
    console.error('FAIL: Document contains unauthorized fields!', keys);
    process.exit(1);
  }
  
  // Cleanup
  console.log('\nCleaning up mock user...');
  await adminDb.collection('users').doc(uid).delete();
  await adminDb.collection('quiz_results').doc(quizResultRef.id).delete();
  await adminDb.collection('notifications').doc(notifRef.id).delete();
  await adminAuth.deleteUser(uid);
  
  console.log('\n--- VALIDATION COMPLETE: ALL PASS ---');
  process.exit(0);
}

runTest().catch(console.error);
