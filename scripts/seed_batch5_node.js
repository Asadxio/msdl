const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccountPath = '../backend/serviceAccountKey.json';
const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(rawData);

try {
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (e) {
  if (e.code !== 'app/duplicate-app') throw e;
}

const db = getFirestore();

const QUIZ_DATA = [
  // Hijab
  { question: "Hijab ka hukm kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Farz", category: "Hijab" },
  { question: "Hijab kis ke hukm se hai?", option1: "Allah Ta'ala", option2: "Logon ka riwaj", option3: "Culture", option4: "Hukumat", correctAnswer: "Allah Ta'ala", category: "Hijab" },
  { question: "Hijab ka bunyadi maqsad kya hai?", option1: "Haya aur Iffat ki hifazat", option2: "Fashion", option3: "Shohrat", option4: "Zeenat dikhana", correctAnswer: "Haya aur Iffat ki hifazat", category: "Hijab" },
  { question: "Hijab kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tajweed", correctAnswer: "Fiqh", category: "Hijab" },
  { question: "Hijab kis bab mein padhaya jata hai?", option1: "Aurat ke Ahkam", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-ul-Buyu", correctAnswer: "Aurat ke Ahkam", category: "Hijab" },
  { question: "Hijab ikhtiyar karna kis sifat ki nishani hai?", option1: "Haya", option2: "Takabbur", option3: "Hasad", option4: "Ghussa", correctAnswer: "Haya", category: "Hijab" },
  { question: "Hijab ka ta'alluq kis se hai?", option1: "Allah ki ita'at", option2: "Sirf Riwaj", option3: "Sirf Fashion", option4: "Sirf Mausam", correctAnswer: "Allah ki ita'at", category: "Hijab" },
  { question: "Hijab ka ehtimam karna kaisa hai?", option1: "Zaroori", option2: "Ikhtiyari", option3: "Makruh", option4: "Na-Jaiz", correctAnswer: "Zaroori", category: "Hijab" },
  { question: "Hijab ka asal maqsad kya hai?", option1: "Allah Ta'ala ke hukm par amal", option2: "Logon ko khush karna", option3: "Fashion karna", option4: "Mashhoor hona", correctAnswer: "Allah Ta'ala ke hukm par amal", category: "Hijab" },
  { question: "Hijab ke masail seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Hijab" },

  // Mahram aur Ghair Mahram
  { question: "Mahram kise kehte hain?", option1: "Jinse hamesha ke liye nikah haram ho", option2: "Har Musalman", option3: "Sirf Rishtedar", option4: "Sirf Padosi", correctAnswer: "Jinse hamesha ke liye nikah haram ho", category: "Mahram aur Ghair Mahram" },
  { question: "Ghair Mahram kise kehte hain?", option1: "Jinse nikah jaiz ho", option2: "Jinse nikah hamesha haram ho", option3: "Sirf Walid", option4: "Sirf Bhai", correctAnswer: "Jinse nikah jaiz ho", category: "Mahram aur Ghair Mahram" },
  { question: "Walid (Father) aurat ke liye kya hain?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Bhai aurat ke liye kya hai?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Chacha aurat ke liye kya hain?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Mamu aurat ke liye kya hain?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Shohar aurat ke liye kya hai?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Devar (Shohar ka bhai) aurat ke liye kya hai?", option1: "Mahram", option2: "Ghair Mahram", option3: "Sirf Rishtedar", option4: "Walid ki tarah", correctAnswer: "Ghair Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Jeth (Shohar ka bada bhai) aurat ke liye kya hai?", option1: "Mahram", option2: "Ghair Mahram", option3: "Walid ki tarah", option4: "Koi nahi", correctAnswer: "Ghair Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Phupha aurat ke liye kya hain?", option1: "Mahram", option2: "Ghair Mahram", option3: "Shohar", option4: "Bhai", correctAnswer: "Ghair Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Khalu aurat ke liye kya hain?", option1: "Mahram", option2: "Ghair Mahram", option3: "Walid", option4: "Bhai", correctAnswer: "Ghair Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Bhanja aurat ke liye kya hai?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Bhatija aurat ke liye kya hai?", option1: "Mahram", option2: "Ghair Mahram", option3: "Ajnabi", option4: "Koi nahi", correctAnswer: "Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Mahram aur Ghair Mahram ke ahkam kis ilm mein padhaye jate hain?", option1: "Fiqh", option2: "Nahw", option3: "Sarf", option4: "Balaghat", correctAnswer: "Fiqh", category: "Mahram aur Ghair Mahram" },
  { question: "Mahram aur Ghair Mahram ke masail kis bab ka hissa hain?", option1: "Aurat ke Ahkam", option2: "Kitab-us-Salah", option3: "Kitab-us-Saum", option4: "Kitab-ul-Buyu", correctAnswer: "Aurat ke Ahkam", category: "Mahram aur Ghair Mahram" },
  { question: "Hijab ka hukm kin ke saamne hota hai?", option1: "Ghair Mahram", option2: "Mahram", option3: "Shohar", option4: "Walid", correctAnswer: "Ghair Mahram", category: "Mahram aur Ghair Mahram" },
  { question: "Mahram rishton ki pehchan seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Mahram aur Ghair Mahram" },
  { question: "Ghair Mahram ke ahkam jaanne ka maqsad kya hai?", option1: "Shari'at ke mutabiq zindagi guzarna", option2: "Sirf Imtihan dena", option3: "Sirf Riwaj nibhana", option4: "Koi maqsad nahi", correctAnswer: "Shari'at ke mutabiq zindagi guzarna", category: "Mahram aur Ghair Mahram" },
  { question: "Mahram aur Ghair Mahram ka ilm kis ke liye zaroori hai?", option1: "Har Baligh Musalman", option2: "Sirf Ulema", option3: "Sirf Mardon", option4: "Sirf Teachers", correctAnswer: "Har Baligh Musalman", category: "Mahram aur Ghair Mahram" },
  { question: "Mahram aur Ghair Mahram ke ahkam par amal karna kaisa hai?", option1: "Zaroori", option2: "Mustahab", option3: "Makruh", option4: "Ikhtiyari", correctAnswer: "Zaroori", category: "Mahram aur Ghair Mahram" },

  // Libas ke Ahkam
  { question: "Muslim aurat ke libas ka bunyadi maqsad kya hai?", option1: "Satr-e-Aurat ko chhupana", option2: "Fashion dikhana", option3: "Logon ko mutasir karna", option4: "Shohrat hasil karna", correctAnswer: "Satr-e-Aurat ko chhupana", category: "Libas ke Ahkam" },
  { question: "Namaz ke liye kapde kaise hone chahiye?", option1: "Paak aur Satr ko chhupane wale", option2: "Sirf naye", option3: "Sirf safed", option4: "Sirf mehange", correctAnswer: "Paak aur Satr ko chhupane wale", category: "Libas ke Ahkam" },
  { question: "Patle kapde jinse badan nazar aaye, unka kya hukm hai?", option1: "Jaiz nahi", option2: "Mustahab", option3: "Sunnat", option4: "Jaiz", correctAnswer: "Jaiz nahi", category: "Libas ke Ahkam" },
  { question: "Tang (tight) libas jo badan ki banawat zahir kare, uska kya hukm hai?", option1: "Shari'at ke khilaf hai", option2: "Mustahab hai", option3: "Sunnat hai", option4: "Afzal hai", correctAnswer: "Shari'at ke khilaf hai", category: "Libas ke Ahkam" },
  { question: "Kapde pehenne ka asal maqsad kya hai?", option1: "Satr aur Haya ki hifazat", option2: "Fashion", option3: "Shohrat", option4: "Riwaj", correctAnswer: "Satr aur Haya ki hifazat", category: "Libas ke Ahkam" },
  { question: "Najis kapdon mein Namaz padhna kaisa hai?", option1: "Jaiz nahi", option2: "Jaiz hai", option3: "Mustahab hai", option4: "Sunnat hai", correctAnswer: "Jaiz nahi", category: "Libas ke Ahkam" },
  { question: "Kapde pehenne mein kis sifat ka khayal rakhna chahiye?", option1: "Haya", option2: "Takabbur", option3: "Hasad", option4: "Ghussa", correctAnswer: "Haya", category: "Libas ke Ahkam" },
  { question: "Libas ke Ahkam kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tajweed", correctAnswer: "Fiqh", category: "Libas ke Ahkam" },
  { question: "Libas ke Ahkam kis bab mein padhaye jate hain?", option1: "Aurat ke Ahkam", option2: "Kitab-us-Salah", option3: "Kitab-us-Saum", option4: "Kitab-ul-Buyu", correctAnswer: "Aurat ke Ahkam", category: "Libas ke Ahkam" },
  { question: "Muslim aurat ke libas mein Haya ka kya maqam hai?", option1: "Bunyadi Ahmiyat", option2: "Koi Ahmiyat nahi", option3: "Sirf Eid ke din", option4: "Sirf Masjid mein", correctAnswer: "Bunyadi Ahmiyat", category: "Libas ke Ahkam" },
  { question: "Kapde pehenne mein israaf karna kaisa hai?", option1: "Pasandeedah nahi", option2: "Mustahab", option3: "Farz", option4: "Sunnat", correctAnswer: "Pasandeedah nahi", category: "Libas ke Ahkam" },
  { question: "Takabbur ke liye libas pehenna kaisa hai?", option1: "Na-Jaiz", option2: "Jaiz", option3: "Mustahab", option4: "Sunnat", correctAnswer: "Na-Jaiz", category: "Libas ke Ahkam" },
  { question: "Saaf aur paak libas pehenna kaisa hai?", option1: "Pasandeedah", option2: "Makruh", option3: "Na-Jaiz", option4: "Ghalat", correctAnswer: "Pasandeedah", category: "Libas ke Ahkam" },
  { question: "Libas ka intikhab kis usool ke mutabiq hona chahiye?", option1: "Shari'at ke mutabiq", option2: "Fashion ke mutabiq", option3: "Film ke mutabiq", option4: "Logon ke mutabiq", correctAnswer: "Shari'at ke mutabiq", category: "Libas ke Ahkam" },
  { question: "Kapdon mein Haya ikhtiyar karna kis cheez ki nishani hai?", option1: "Iman ki", option2: "Takabbur ki", option3: "Hasad ki", option4: "Ghaflat ki", correctAnswer: "Iman ki", category: "Libas ke Ahkam" },
  { question: "Muslim aurat ko libas kis niyyat se pehenna chahiye?", option1: "Allah Ta'ala ki ita'at ke liye", option2: "Logon ko dikhane ke liye", option3: "Shohrat ke liye", option4: "Muqabale ke liye", correctAnswer: "Allah Ta'ala ki ita'at ke liye", category: "Libas ke Ahkam" },
  { question: "Libas ke Ahkam seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Sirf Ulema ke liye", option4: "Makruh", correctAnswer: "Aham", category: "Libas ke Ahkam" },
  { question: "Kapde pehenne se pehle kis baat ka khayal rakhna chahiye?", option1: "Paakizgi aur Satr", option2: "Sirf Rang", option3: "Sirf Brand", option4: "Sirf Qeemat", correctAnswer: "Paakizgi aur Satr", category: "Libas ke Ahkam" },
  { question: "Libas ke Ahkam par amal karna kaisa hai?", option1: "Zaroori", option2: "Ikhtiyari", option3: "Makruh", option4: "Sirf Eid par", correctAnswer: "Zaroori", category: "Libas ke Ahkam" },
  { question: "Islami libas ka asal maqsad kya hai?", option1: "Haya, Satr aur Allah ki ita'at", option2: "Fashion aur Shohrat", option3: "Muqabala karna", option4: "Logon ko mutasir karna", correctAnswer: "Haya, Satr aur Allah ki ita'at", category: "Libas ke Ahkam" }
];

async function seed() {
  console.log(`Starting to seed ${QUIZ_DATA.length} quiz questions...`);
  
  const quizzesRef = db.collection('quizzes');
  let inserted = 0;
  let skipped = 0;
  const categories = {};
  
  const snapshot = await quizzesRef.get();
  const existingQuestions = new Set();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.question) {
      existingQuestions.add(data.question.trim());
    }
  });

  const batches = [];
  let currentBatch = db.batch();
  let operationCount = 0;

  for (const item of QUIZ_DATA) {
    if (existingQuestions.has(item.question.trim())) {
      skipped++;
      continue;
    }
    
    // Ensure correctAnswer strictly matches one option
    const opts = [item.option1, item.option2, item.option3, item.option4];
    if (!opts.includes(item.correctAnswer)) {
      console.error(`Invalid correct answer for question: "${item.question}"`);
      console.error(`Options: ${opts.join(', ')} | Correct Answer: ${item.correctAnswer}`);
      process.exit(1);
    }
    
    const docRef = quizzesRef.doc();
    currentBatch.set(docRef, item);
    inserted++;
    
    if (!categories[item.category]) categories[item.category] = 0;
    categories[item.category]++;

    operationCount++;
    if (operationCount === 400) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`Committed batch ${i + 1} / ${batches.length}`);
  }
  
  const finalSnap = await quizzesRef.get();
  
  console.log('--- SEEDING COMPLETE ---');
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (Duplicates): ${skipped}`);
  console.log('Category Counts Inserted:', categories);
  console.log(`Final Total Count in DB: ${finalSnap.size}`);
}

seed().catch(err => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
