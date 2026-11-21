const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    projectId: 'madrasa-app-50d6c',
  });
}

const auth = getAuth();
const db = getFirestore();

async function run() {
  const email = 'playreview@suffah.edu';
  const password = 'SuffahReview@2026';
  let uid;

  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    await auth.updateUser(uid, {
      password,
      emailVerified: true,
      displayName: 'Google Reviewer',
    });
    console.log('User already existed. Updated password and verified email for:', uid);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email,
        password,
        displayName: 'Google Reviewer',
        emailVerified: true,
      });
      uid = user.uid;
      console.log('Created fresh review account:', uid);
    } else {
      throw err;
    }
  }

  await db.collection('users').doc(uid).set({
    uid,
    name: 'Google Reviewer',
    email,
    role: 'student',
    status: 'approved',
    email_verified: true,
    payment_status: 'received',
    organization_id: 'mslb-main',
    updated_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('SUCCESS: Review account configured in Firestore & Auth!');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
