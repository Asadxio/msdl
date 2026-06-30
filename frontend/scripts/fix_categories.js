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

async function fixCategories() {
    try {
        const quizRef = db.collection('quizzes');
        const snapshot = await quizRef.get();
        const batch = db.batch();
        let batchCount = 0;
        let fixedCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.category && data.category.includes('\n')) {
                let cleanCategory = data.category.split('\n')[0].replace(/#|Category:/g, '').trim();
                batch.update(doc.ref, { category: cleanCategory });
                fixedCount++;
                batchCount++;
            }
            if (batchCount === 500) {
                batch.commit();
                batchCount = 0;
            }
        });
        
        if (batchCount > 0) {
            await batch.commit();
        }
        
        console.log(`Fixed ${fixedCount} categories.`);
        
    } catch (error) {
        console.error("FAILED", error);
    }
}

fixCategories();
