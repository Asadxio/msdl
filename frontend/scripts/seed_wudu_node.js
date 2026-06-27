const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountPath = '../backend/serviceAccountKey.json';
const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(rawData);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const QUIZ_DATA = [
  {
    "question": "Wudu mein kitne farz hain?",
    "option1": "2",
    "option2": "3",
    "option3": "4",
    "option4": "5",
    "correctAnswer": "4",
    "category": "Wudu"
  },
  {
    "question": "Wudu ka pehla farz kya hai?",
    "option1": "Chehra dhona",
    "option2": "Haath dhona",
    "option3": "Sar ka Masah",
    "option4": "Pair dhona",
    "correctAnswer": "Chehra dhona",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein haath kis jagah tak dhona farz hai?",
    "option1": "Kalai tak",
    "option2": "Kohniyon samet",
    "option3": "Kandhe tak",
    "option4": "Ungliyon tak",
    "correctAnswer": "Kohniyon samet",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein sar ke kitne hisse ka masah farz hai?",
    "option1": "Pura Sar",
    "option2": "Aadha Sar",
    "option3": "Chauthai Sar",
    "option4": "Sirf Peshani",
    "correctAnswer": "Chauthai Sar",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein pair kis jagah tak dhona farz hai?",
    "option1": "Takhnon samet",
    "option2": "Pindli tak",
    "option3": "Ghutnon tak",
    "option4": "Sirf Pair ka Upar Hissa",
    "correctAnswer": "Takhnon samet",
    "category": "Wudu"
  },
  {
    "question": "Wudu se pehle Bismillah padhna kya hai?",
    "option1": "Farz",
    "option2": "Wajib",
    "option3": "Sunnat",
    "option4": "Makruh",
    "correctAnswer": "Sunnat",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein Miswak karna kya hai?",
    "option1": "Farz",
    "option2": "Sunnat",
    "option3": "Makruh",
    "option4": "Wajib",
    "correctAnswer": "Sunnat",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein kulli karna kya hai?",
    "option1": "Farz",
    "option2": "Sunnat",
    "option3": "Makruh",
    "option4": "Mustahab",
    "correctAnswer": "Sunnat",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein naak mein paani chadhana kya hai?",
    "option1": "Farz",
    "option2": "Sunnat",
    "option3": "Makruh",
    "option4": "Mustahab",
    "correctAnswer": "Sunnat",
    "category": "Wudu"
  },
  {
    "question": "Har farz aza ko kam se kam kitni baar dhona farz hai?",
    "option1": "1 Baar",
    "option2": "2 Baar",
    "option3": "3 Baar",
    "option4": "4 Baar",
    "correctAnswer": "1 Baar",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein tartib se aza dhona kya hai?",
    "option1": "Farz",
    "option2": "Sunnat",
    "option3": "Makruh",
    "option4": "Wajib",
    "correctAnswer": "Sunnat",
    "category": "Wudu"
  },
  {
    "question": "Wudu ke baad do rakat namaz padhna kya hai?",
    "option1": "Farz",
    "option2": "Wajib",
    "option3": "Mustahab",
    "option4": "Makruh",
    "correctAnswer": "Mustahab",
    "category": "Wudu"
  },
  {
    "question": "Ek Wudu se jab tak Wudu na toote kitni namazein padh sakte hain?",
    "option1": "1",
    "option2": "2",
    "option3": "5",
    "option4": "Jitni Chahein",
    "correctAnswer": "Jitni Chahein",
    "category": "Wudu"
  },
  {
    "question": "Wudu kis ibadat ke liye shart hai?",
    "option1": "Roza",
    "option2": "Namaz",
    "option3": "Zakat",
    "option4": "Hajj",
    "correctAnswer": "Namaz",
    "category": "Wudu"
  },
  {
    "question": "Behosh ho jana Wudu ko kya karta hai?",
    "option1": "Nahi Todta",
    "option2": "Tod Deta Hai",
    "option3": "Makruh Banata Hai",
    "option4": "Mustahab Banata Hai",
    "correctAnswer": "Tod Deta Hai",
    "category": "Wudu"
  },
  {
    "question": "Peshaab ya Pakhana karne se kya toot jata hai?",
    "option1": "Roza",
    "option2": "Ghusl",
    "option3": "Wudu",
    "option4": "Tayammum",
    "correctAnswer": "Wudu",
    "category": "Wudu"
  },
  {
    "question": "Khoon behkar apni jagah se nikal aaye to kya Wudu toot jata hai?",
    "option1": "Haan",
    "option2": "Nahi",
    "option3": "Sirf Namaz tootegi",
    "option4": "Sirf Ghusl farz hoga",
    "correctAnswer": "Haan",
    "category": "Wudu"
  },
  {
    "question": "Wudu mein gardan ka masah karna kya hai?",
    "option1": "Farz",
    "option2": "Sunnat",
    "option3": "Mustahab",
    "option4": "Wajib",
    "correctAnswer": "Mustahab",
    "category": "Wudu"
  },
  {
    "question": "Quran-e-Kareem ko baghair Wudu chhoona kaisa hai?",
    "option1": "Jaiz",
    "option2": "Na-Jaiz",
    "option3": "Mustahab",
    "option4": "Sunnat",
    "correctAnswer": "Na-Jaiz",
    "category": "Wudu"
  },
  {
    "question": "Wudu ka zikr Quran-e-Kareem ki kis Surah mein hai?",
    "option1": "Surah Al-Baqarah",
    "option2": "Surah Al-Ma'idah",
    "option3": "Surah Yaseen",
    "option4": "Surah Ar-Rahman",
    "correctAnswer": "Surah Al-Ma'idah",
    "category": "Wudu"
  }
];

async function seed() {
    let total_inserted = 0;
    let total_skipped = 0;
    let validation_errors = [];
    
    try {
        const quizRef = db.collection('quizzes');
        const snapshot = await quizRef.get();
        const existingDocs = [];
        snapshot.forEach(doc => existingDocs.push(doc.data()));
        
        const existingQuestions = new Set(existingDocs.map(doc => doc.question));
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const item of QUIZ_DATA) {
            const question = item.question;
            const fields = ['question', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'category'];
            let hasError = false;
            
            for (const field of fields) {
                if (!(field in item) || !String(item[field]).trim()) {
                    validation_errors.push(`Missing or empty field '${field}' in question: ${question}`);
                    hasError = true;
                }
            }
            
            const options = [item.option1, item.option2, item.option3, item.option4];
            if (!options.includes(item.correctAnswer)) {
                validation_errors.push(`Correct answer '${item.correctAnswer}' does not match any option for question: ${question}`);
                hasError = true;
            }
            
            if (hasError) continue;
            
            if (existingQuestions.has(question)) {
                total_skipped++;
            } else {
                const newDocRef = quizRef.doc();
                batch.set(newDocRef, item);
                existingQuestions.add(question);
                total_inserted++;
                batchCount++;
            }
        }
        
        if (batchCount > 0) {
            await batch.commit();
        }
        
        // Final verification
        const finalSnapshot = await quizRef.get();
        const categories = {};
        finalSnapshot.forEach(doc => {
            const cat = doc.data().category || 'Unknown';
            categories[cat] = (categories[cat] || 0) + 1;
        });
        
        console.log(JSON.stringify({
            total_inserted,
            total_skipped,
            validation_errors,
            final_count: finalSnapshot.size,
            categories
        }, null, 2));
        
    } catch (error) {
        console.error("FAILED", error);
    }
}

seed();
