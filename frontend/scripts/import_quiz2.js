const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountPath = '../../backend/serviceAccountKey.json';
const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(rawData);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const QUIZ_DATA = JSON.parse(fs.readFileSync('./quiz2_parsed.json', 'utf8'));

async function seed() {
    let total_inserted = 0;
    let total_skipped = 0;
    let validation_errors = [];
    
    try {
        const quizRef = db.collection('quizzes');
        const snapshot = await quizRef.get();
        const existingDocs = [];
        snapshot.forEach(doc => existingDocs.push(doc.data()));
        
        const existingQuestions = new Set(existingDocs.map(doc => doc.question.trim()));
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const item of QUIZ_DATA) {
            const question = item.question.trim();
            const fields = ['question', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'category'];
            let hasError = false;
            
            for (const field of fields) {
                if (!(field in item) || !String(item[field]).trim()) {
                    validation_errors.push(`Missing or empty field '${field}' in question: ${question}`);
                    hasError = true;
                }
            }
            
            const options = [item.option1.trim(), item.option2.trim(), item.option3.trim(), item.option4.trim()];
            if (!options.includes(item.correctAnswer.trim())) {
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
                
                if (batchCount === 500) {
                    await batch.commit();
                    batchCount = 0;
                }
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
