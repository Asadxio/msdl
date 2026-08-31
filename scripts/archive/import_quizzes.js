
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = 'C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl\\serviceAccountKey.json';
const INPUT_PATH = 'C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl\\all_user_input.txt';

function parseQuizzes(text) {
  const quizzes = [];
  
  // A regex to match an entire quiz question block
  // We use [\s\S] to match across newlines.
  // The block looks like:
  // Question
  // <question_text>
  // Option 1
  // <opt1>
  // Option 2
  // <opt2>
  // Option 3
  // <opt3>
  // Option 4
  // <opt4>
  // Correct Answer
  // <ans>
  // Category
  // <cat>
  
  const blockRegex = /Question\s+([\s\S]*?)\s+Option 1\s+([\s\S]*?)\s+Option 2\s+([\s\S]*?)\s+Option 3\s+([\s\S]*?)\s+Option 4\s+([\s\S]*?)\s+Correct Answer\s+([\s\S]*?)\s+Category\s+([^\r\n]+)/g;
  
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    let question = match[1].trim();
    // Sometimes 'Question' matched the "Question 1\n\nQuestion\n..." part, so we need to clean up question text.
    // If question text starts with something like "1\n\nQuestion\n", strip it.
    question = question.replace(/^\d+\s+Question\s+/, '').trim();
    
    const quiz = {
      question: question,
      option1: match[2].trim(),
      option2: match[3].trim(),
      option3: match[4].trim(),
      option4: match[5].trim(),
      correctAnswer: match[6].trim(),
      category: match[7].trim()
    };
    quizzes.push(quiz);
  }
  return quizzes;
}

function validateQuiz(quiz) {
  const required = ["question", "option1", "option2", "option3", "option4", "correctAnswer", "category"];
  for (const r of required) {
    if (!quiz[r] || typeof quiz[r] !== 'string' || quiz[r].trim() === "") {
      return { isValid: false, err: `Missing or empty field: ${r}` };
    }
  }
  
  const ca = quiz.correctAnswer;
  const options = [quiz.option1, quiz.option2, quiz.option3, quiz.option4];
  if (!options.includes(ca)) {
    return { isValid: false, err: `correctAnswer '${ca}' does not match any option` };
  }
  
  return { isValid: true, err: "" };
}

async function main() {
  console.log("Authentication: PENDING");
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    const { initializeApp, cert } = require('firebase-admin/app');
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
  
  const text = fs.readFileSync(INPUT_PATH, 'utf-8');
  const parsedQuizzes = parseQuizzes(text);
  
  // Debug output
  console.log(`Parsed Quizzes Count: ${parsedQuizzes.length}`);
  
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
    const { isValid, err } = validateQuiz(q);
    if (!isValid) {
      // console.log("Validation Error:", err, q);
      validationErrors++;
      continue;
    }
    
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
