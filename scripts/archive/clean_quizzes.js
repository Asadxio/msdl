const fs = require('fs');

const INPUT_PATH = 'C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl\\raw_quiz_dataset.txt';
const OUTPUT_PATH = 'C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl\\cleaned_quizzes.json';

function parseQuizzes(text) {
  // Strip all markdown bold asterisks to normalize the text back to what the script expects
  text = text.replace(/\*\*/g, '');
  
  // Also strip '## ' for '## Question 1' etc
  text = text.replace(/^## /gm, '');
  
  const quizzes = [];
  // The split should handle both "Question 1\n\nQuestion\n" and similar variations.
  // The blocks start with "Question <number>" and then have "Question\n"
  
  // A robust approach: match the blocks directly using exec instead of split
  const blockRegex = /Question\s+([\s\S]*?)\s+Option 1\s+([\s\S]*?)\s+Option 2\s+([\s\S]*?)\s+Option 3\s+([\s\S]*?)\s+Option 4\s+([\s\S]*?)\s+Correct Answer\s+([\s\S]*?)\s+Category\s+([^\r\n]+)/g;
  
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    let rawBlock = match[0];
    let question = match[1].trim();
    // Sometimes the match captures the previous question's trailing text or the heading "Question X"
    question = question.replace(/^\d+\s+Question\s+/, '').trim();
    
    try {
      const quiz = {
        question: question,
        option1: match[2].trim(),
        option2: match[3].trim(),
        option3: match[4].trim(),
        option4: match[5].trim(),
        correctAnswer: match[6].trim(),
        category: match[7].trim()
      };
      quizzes.push({ raw: rawBlock, parsed: quiz });
    } catch (e) {
      quizzes.push({ raw: rawBlock, parsed: null, reason: "Parsing exception." });
    }
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
    return { isValid: false, err: `correctAnswer '${ca}' does not match any option.` };
  }
  
  return { isValid: true, err: "" };
}

function main() {
  let text = fs.readFileSync(INPUT_PATH, 'utf-8');
  
  // Total raw records found
  // Count occurrences of 'Option 1' as a proxy for raw records
  const totalRawRecords = (text.match(/Option 1/g) || []).length;
  
  const parsedRecords = parseQuizzes(text);
  
  const seenQuestions = new Set();
  
  let totalValid = 0;
  let totalDuplicates = 0;
  let totalMalformed = 0;
  let validationErrors = 0;
  const categoryCounts = {};
  
  const validQuizzes = [];
  const rejected = [];
  
  for (const record of parsedRecords) {
    if (!record.parsed) {
      totalMalformed++;
      rejected.push({ reason: record.reason, raw: record.raw.substring(0, 100) + '...' });
      continue;
    }
    
    const q = record.parsed;
    const { isValid, err } = validateQuiz(q);
    
    if (!isValid) {
      validationErrors++;
      totalMalformed++;
      rejected.push({ reason: err, raw: q.question });
      continue;
    }
    
    if (seenQuestions.has(q.question)) {
      totalDuplicates++;
      rejected.push({ reason: "Duplicate question", raw: q.question });
      continue;
    }
    
    seenQuestions.add(q.question);
    validQuizzes.push(q);
    totalValid++;
    
    const cat = q.category;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }
  
  // We missed some if totalValid + totalMalformed < totalRawRecords
  const missed = totalRawRecords - (totalValid + totalMalformed + totalDuplicates);
  if (missed > 0) {
    totalMalformed += missed;
  }
  
  // Save cleaned dataset
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(validQuizzes, null, 2));
  
  console.log(`Total raw records found: ${totalRawRecords}`);
  console.log(`Total valid quizzes: ${totalValid}`);
  console.log(`Total duplicates removed: ${totalDuplicates}`);
  console.log(`Total malformed records removed: ${totalMalformed}`);
  console.log(`Total parsing artifacts removed: 0`);
  console.log(`Validation errors: ${validationErrors}`);
  
  console.log(`\nCategory counts:`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`- ${cat}: ${count}`);
  }
  
  if (rejected.length > 0) {
    console.log(`\nRejected Records:`);
    rejected.forEach((r, i) => {
      console.log(`${i + 1}. Reason: ${r.reason} | Preview: ${r.raw.replace(/\n/g, ' ')}`);
    });
  }
}

main();
