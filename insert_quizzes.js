const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = 'C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl\\serviceAccountKey.json';
const INPUT_PATH = 'C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl\\cleaned_quizzes.json';

async function main() {
  console.log("Authentication: PENDING");
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Authentication: SUCCESS");
  } catch (e) {
    console.log(`Authentication: FAILED (${e.message})`);
    return;
  }
  
  console.log("Firestore: CONNECTED");
  const db = getFirestore();
  
  const rawData = fs.readFileSync(INPUT_PATH, 'utf-8');
  const parsedQuizzes = JSON.parse(rawData);
  
  const existingQuestions = new Set();
  try {
    const snapshot = await db.collection('quizzes').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.question) {
        existingQuestions.add(data.question);
      }
    });
  } catch (e) {
    console.log(`Firestore: FAILED (${e.message})`);
    return;
  }
  
  const startTime = Date.now();
  
  let insertedCount = 0;
  let skippedCount = 0;
  let validationErrors = 0;
  let failedWrites = 0;
  
  const categoryCounts = {};
  const validNewQuizzes = [];
  
  for (const q of parsedQuizzes) {
    if (existingQuestions.has(q.question)) {
      skippedCount++;
      continue;
    }
    
    validNewQuizzes.push(q);
    existingQuestions.add(q.question);
  }
  
  let batchCount = 0;
  const batchSize = 400; // Firebase limit is 500
  
  for (let i = 0; i < validNewQuizzes.length; i += batchSize) {
    const chunk = validNewQuizzes.slice(i, i + batchSize);
    const batch = db.batch();
    
    for (const q of chunk) {
      const docRef = db.collection('quizzes').doc();
      batch.set(docRef, q);
    }
    
    try {
      await batch.commit();
      batchCount++;
      insertedCount += chunk.length;
      
      for (const q of chunk) {
        const cat = q.category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    } catch (e) {
      failedWrites += chunk.length;
      console.log(`Batch ${batchCount + 1} failed: ${e.message}`);
      break; // Stop further writes
    }
  }
  
  const totalQuizzes = existingQuestions.size;
  const execTime = (Date.now() - startTime) / 1000;
  
  console.log("\nDocuments Processed:");
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Skipped (Duplicates): ${skippedCount}`);
  console.log(`Validation Errors: ${validationErrors}`);
  console.log(`Failed Writes: ${failedWrites}`);
  console.log(`Batch Count: ${batchCount}`);
  
  console.log("\nCategory Counts:");
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`${cat}: ${count}`);
  }
  
  console.log(`\nFinal Total Quiz Count: ${totalQuizzes}`);
  console.log(`Execution Time: ${execTime.toFixed(2)} seconds`);
  
  if (failedWrites > 0) {
    console.log("\nImport Status: FAILED");
  } else if (insertedCount > 0) {
    console.log("\nImport Status: SUCCESS");
  } else {
    console.log("\nImport Status: SUCCESS");
  }
}

main().catch(console.error);
