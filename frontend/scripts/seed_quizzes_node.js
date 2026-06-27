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
    // GHUSL
    {
        "question": "Ghusl mein kitne farz hain?",
        "option1": "2",
        "option2": "3",
        "option3": "4",
        "option4": "5",
        "correctAnswer": "3",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ka pehla farz kya hai?",
        "option1": "Kulli karna",
        "option2": "Naak mein paani chadhana",
        "option3": "Pura badan dhona",
        "option4": "Haath dhona",
        "correctAnswer": "Kulli karna",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ka doosra farz kya hai?",
        "option1": "Pura badan dhona",
        "option2": "Naak mein paani chadhana",
        "option3": "Sar ka Masah",
        "option4": "Chehra dhona",
        "correctAnswer": "Naak mein paani chadhana",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ka teesra farz kya hai?",
        "option1": "Chehra dhona",
        "option2": "Pura badan dhona",
        "option3": "Pair dhona",
        "option4": "Haath dhona",
        "correctAnswer": "Pura badan dhona",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl mein munh ke kis hissa tak paani pahunchana farz hai?",
        "option1": "Sirf Honth tak",
        "option2": "Pura Munh",
        "option3": "Sirf Daant",
        "option4": "Sirf Zubaan",
        "correctAnswer": "Pura Munh",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl mein naak ke kis hissa tak paani pahunchana farz hai?",
        "option1": "Sirf Naak ke Bahar",
        "option2": "Naram Haddi tak",
        "option3": "Sirf Naak ki Nok",
        "option4": "Aadhi Naak",
        "correctAnswer": "Naram Haddi tak",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl mein poore badan par kitni baar paani bahana farz hai?",
        "option1": "1 Baar",
        "option2": "2 Baar",
        "option3": "3 Baar",
        "option4": "4 Baar",
        "correctAnswer": "1 Baar",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl se pehle Bismillah padhna kya hai?",
        "option1": "Farz",
        "option2": "Sunnat",
        "option3": "Wajib",
        "option4": "Makruh",
        "correctAnswer": "Sunnat",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl se pehle Wudu karna kya hai?",
        "option1": "Farz",
        "option2": "Sunnat",
        "option3": "Makruh",
        "option4": "Wajib",
        "correctAnswer": "Sunnat",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl mein pehle kis taraf paani bahana Sunnat hai?",
        "option1": "Baayi Taraf",
        "option2": "Daayi Taraf",
        "option3": "Sirf Sar par",
        "option4": "Pairon par",
        "correctAnswer": "Daayi Taraf",
        "category": "Ghusl"
    },
    {
        "question": "Janabat ki halat mein Namaz padhna kaisa hai?",
        "option1": "Jaiz",
        "option2": "Na-Jaiz",
        "option3": "Mustahab",
        "option4": "Makruh",
        "correctAnswer": "Na-Jaiz",
        "category": "Ghusl"
    },
    {
        "question": "Janabat ki halat mein Quran-e-Kareem padhna kaisa hai?",
        "option1": "Jaiz",
        "option2": "Na-Jaiz",
        "option3": "Mustahab",
        "option4": "Sunnat",
        "correctAnswer": "Na-Jaiz",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ke farz ada na hon to Ghusl ka kya hukm hai?",
        "option1": "Ho jayega",
        "option2": "Nahi hoga",
        "option3": "Sirf Wudu hoga",
        "option4": "Namaz ho jayegi",
        "correctAnswer": "Nahi hoga",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ke baad agar Wudu na toote to Namaz ke liye alag Wudu ki zarurat hai?",
        "option1": "Haan",
        "option2": "Nahi",
        "option3": "Sirf Jummah mein",
        "option4": "Sirf Eid mein",
        "correctAnswer": "Nahi",
        "category": "Ghusl"
    },
    {
        "question": "Jis hissa par paani na pahunche us hissa ka kya hukm hai?",
        "option1": "Maaf hai",
        "option2": "Ghusl mukammal nahi hoga",
        "option3": "Sirf Wudu karna hoga",
        "option4": "Koi Hukm nahi",
        "correctAnswer": "Ghusl mukammal nahi hoga",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ke dauran anguthi tang ho to kya karna chahiye?",
        "option1": "Utarna ya hila kar paani pahunchana",
        "option2": "Waise hi chhod dena",
        "option3": "Kapde se ponchna",
        "option4": "Sirf Masah karna",
        "correctAnswer": "Utarna ya hila kar paani pahunchana",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl ke baad sabse pehli kaunsi ibadat ada ki ja sakti hai?",
        "option1": "Namaz",
        "option2": "Zakat",
        "option3": "Qurbani",
        "option4": "Azaan",
        "correctAnswer": "Namaz",
        "category": "Ghusl"
    },
    {
        "question": "Ghusl kis cheez ko door karta hai?",
        "option1": "Hadas-e-Akbar",
        "option2": "Hadas-e-Asghar",
        "option3": "Sirf Najasat",
        "option4": "Kuch nahi",
        "correctAnswer": "Hadas-e-Akbar",
        "category": "Ghusl"
    },
    {
        "question": "Aurat ko Haiz ke baad kya karna farz hai?",
        "option1": "Sirf Wudu",
        "option2": "Ghusl",
        "option3": "Tayammum",
        "option4": "Kuch nahi",
        "correctAnswer": "Ghusl",
        "category": "Ghusl"
    },
    {
        "question": "Nifas khatam hone ke baad kya farz hota hai?",
        "option1": "Sirf Wudu",
        "option2": "Ghusl",
        "option3": "Roza",
        "option4": "Sadqah",
        "correctAnswer": "Ghusl",
        "category": "Ghusl"
    },
    
    // TAYAMMUM
    {
        "question": "Tayammum kab jaiz hota hai?",
        "option1": "Jab paani maujood ho",
        "option2": "Jab paani istemal na kar sakte hon ya na mile",
        "option3": "Har waqt",
        "option4": "Sirf Ramzan mein",
        "correctAnswer": "Jab paani istemal na kar sakte hon ya na mile",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ke kitne farz hain?",
        "option1": "2",
        "option2": "3",
        "option3": "4",
        "option4": "5",
        "correctAnswer": "2",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ka pehla farz kya hai?",
        "option1": "Chehre ka Masah",
        "option2": "Haath dhona",
        "option3": "Pair dhona",
        "option4": "Kulli karna",
        "correctAnswer": "Chehre ka Masah",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ka doosra farz kya hai?",
        "option1": "Sar ka Masah",
        "option2": "Dono haathon ka kohniyon samet Masah",
        "option3": "Pair dhona",
        "option4": "Naak saaf karna",
        "correctAnswer": "Dono haathon ka kohniyon samet Masah",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum kis cheez se kiya jata hai?",
        "option1": "Paani",
        "option2": "Paak mitti ya us jaisi zameeni cheez",
        "option3": "Doodh",
        "option4": "Tel",
        "correctAnswer": "Paak mitti ya us jaisi zameeni cheez",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum mein kitni baar zameen par haath mara jata hai?",
        "option1": "1 Baar",
        "option2": "2 Baar",
        "option3": "3 Baar",
        "option4": "4 Baar",
        "correctAnswer": "2 Baar",
        "category": "Tayammum"
    },
    {
        "question": "Pehli baar haath marne ke baad kis ka Masah kiya jata hai?",
        "option1": "Sar",
        "option2": "Chehra",
        "option3": "Pair",
        "option4": "Gardan",
        "correctAnswer": "Chehra",
        "category": "Tayammum"
    },
    {
        "question": "Doosri baar haath marne ke baad kis ka Masah kiya jata hai?",
        "option1": "Pair",
        "option2": "Haath kohniyon samet",
        "option3": "Sar",
        "option4": "Seena",
        "correctAnswer": "Haath kohniyon samet",
        "category": "Tayammum"
    },
    {
        "question": "Paani mil jane par Tayammum ka kya hukm hai?",
        "option1": "Qaim rahega",
        "option2": "Toot jayega",
        "option3": "Mustahab ho jayega",
        "option4": "Makruh ho jayega",
        "correctAnswer": "Toot jayega",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum kis ka badal hai?",
        "option1": "Namaz",
        "option2": "Wudu aur Ghusl",
        "option3": "Roza",
        "option4": "Zakat",
        "correctAnswer": "Wudu aur Ghusl",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ke liye niyyat karna kya hai?",
        "option1": "Farz",
        "option2": "Sunnat",
        "option3": "Mustahab",
        "option4": "Makruh",
        "correctAnswer": "Farz",
        "category": "Tayammum"
    },
    {
        "question": "Geeli mitti se Tayammum karna kaisa hai?",
        "option1": "Jaiz hai agar us par mitti ka gubaar ho",
        "option2": "Hamesha na-jaiz",
        "option3": "Sirf Ramzan mein jaiz",
        "option4": "Sirf Safar mein jaiz",
        "correctAnswer": "Jaiz hai agar us par mitti ka gubaar ho",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ke baad Wudu tootne wali cheez ho jaye to kya hoga?",
        "option1": "Tayammum toot jayega",
        "option2": "Kuch nahi hoga",
        "option3": "Sirf Namaz tootegi",
        "option4": "Sirf Roza tootega",
        "correctAnswer": "Tayammum toot jayega",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ke baad Farz Namaz padhna kaisa hai?",
        "option1": "Jaiz",
        "option2": "Na-Jaiz",
        "option3": "Makruh",
        "option4": "Mustahab",
        "correctAnswer": "Jaiz",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum mein chehre ka kitna hissa masah kiya jata hai?",
        "option1": "Sirf Peshani",
        "option2": "Jitna Wudu mein dhona farz hai",
        "option3": "Sirf Gaal",
        "option4": "Sirf Naak",
        "correctAnswer": "Jitna Wudu mein dhona farz hai",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum mein haathon ka masah kahan tak kiya jata hai?",
        "option1": "Kalai tak",
        "option2": "Kohniyon samet",
        "option3": "Kandhon tak",
        "option4": "Ungliyon tak",
        "correctAnswer": "Kohniyon samet",
        "category": "Tayammum"
    },
    {
        "question": "Paani ke nuksan ka yaqeen ho to kya Tayammum kiya ja sakta hai?",
        "option1": "Haan",
        "option2": "Nahi",
        "option3": "Sirf Safar mein",
        "option4": "Sirf Bimari mein",
        "correctAnswer": "Haan",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ke liye paak mitti ka hona kaisa hai?",
        "option1": "Farz",
        "option2": "Shart",
        "option3": "Makruh",
        "option4": "Mustahab",
        "correctAnswer": "Shart",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum karne ke baad paani mil jaye to agali Namaz ke liye kya karna hoga?",
        "option1": "Phir Tayammum",
        "option2": "Wudu ya zarurat ho to Ghusl",
        "option3": "Kuch nahi",
        "option4": "Sirf Dua",
        "correctAnswer": "Wudu ya zarurat ho to Ghusl",
        "category": "Tayammum"
    },
    {
        "question": "Tayammum ka zikr Quran-e-Kareem ki kis Surah mein hai?",
        "option1": "Surah Al-Ma'idah",
        "option2": "Surah Yaseen",
        "option3": "Surah Al-Kahf",
        "option4": "Surah Al-Mulk",
        "correctAnswer": "Surah Al-Ma'idah",
        "category": "Tayammum"
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
