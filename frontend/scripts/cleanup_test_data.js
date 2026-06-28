const { initializeApp: initAdmin, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

async function cleanup() {
  const serviceAccount = JSON.parse(fs.readFileSync('./backend/serviceAccountKey.json', 'utf8'));
  const adminApp = initAdmin({ credential: cert(serviceAccount) });
  const auth = getAuth(adminApp);
  const db = getFirestore(adminApp);
  
  console.log('Searching for test users...');
  
  // List all users to find test users (max 1000 for simplicity)
  const listUsersResult = await auth.listUsers(1000);
  const testUsers = listUsersResult.users.filter(u => u.uid.startsWith('test_quiz_user_'));
  
  console.log(`Found ${testUsers.length} test users in Auth.`);
  
  let deletedAuth = 0;
  let deletedUserDocs = 0;
  
  for (const user of testUsers) {
    await auth.deleteUser(user.uid);
    deletedAuth++;
    
    const userDocRef = db.collection('users').doc(user.uid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      await userDocRef.delete();
      deletedUserDocs++;
    }
  }
  
  console.log(`Searching for test quiz_results...`);
  const quizResultsSnapshot = await db.collection('quiz_results').where('user_id', '>=', 'test_quiz_user_').where('user_id', '<=', 'test_quiz_user_\uf8ff').get();
  console.log(`Found ${quizResultsSnapshot.size} test quiz_results.`);
  
  let deletedQuizResults = 0;
  for (const doc of quizResultsSnapshot.docs) {
    await doc.ref.delete();
    deletedQuizResults++;
  }
  
  console.log(`Searching for test notifications...`);
  const notifSnapshot = await db.collection('notifications').where('user_id', '>=', 'test_quiz_user_').where('user_id', '<=', 'test_quiz_user_\uf8ff').get();
  console.log(`Found ${notifSnapshot.size} test notifications.`);
  
  let deletedNotif = 0;
  for (const doc of notifSnapshot.docs) {
    await doc.ref.delete();
    deletedNotif++;
  }

  console.log('Cleanup complete.');
  console.log({ deletedAuth, deletedUserDocs, deletedQuizResults, deletedNotif });
  process.exit(0);
}

cleanup().catch(console.error);
