const fs = require('fs'); 
const text = fs.readFileSync('all_user_input.txt', 'utf-8'); 
const blockRegex = /Question\s+([\s\S]*?)\s+Option 1\s+([\s\S]*?)\s+Option 2\s+([\s\S]*?)\s+Option 3\s+([\s\S]*?)\s+Option 4\s+([\s\S]*?)\s+Correct Answer\s+([\s\S]*?)\s+Category\s+([^\r\n]+)/g; 
let match; 
let count = 0; 
while ((match = blockRegex.exec(text)) !== null && count < 5) { 
  let q = match[1].trim().replace(/^\d+\s+Question\s+/, '').trim(); 
  console.log(`\n--- Question ${count+1} ---\nQuestion:\n${q}\nOption 1:\n${match[2].trim()}\nOption 2:\n${match[3].trim()}\nOption 3:\n${match[4].trim()}\nOption 4:\n${match[5].trim()}\nCorrect Answer:\n${match[6].trim()}\nCategory:\n${match[7].trim()}`); 
  count++; 
}
