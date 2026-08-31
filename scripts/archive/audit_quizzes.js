const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

try {
    initializeApp({
        credential: cert(serviceAccount)
    });
} catch (e) {
    if (!/already exists/.test(e.message)) {
        console.error('Firebase initialization error', e.stack);
    }
}

const db = getFirestore();

async function runAudit() {
    const snapshot = await db.collection('quizzes').get();
    
    let totalDocs = snapshot.size;
    let categories = {};
    let duplicates = [];
    let invalidDocs = [];
    let missingFieldsDocs = [];
    
    let questionSet = new Set();
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const id = doc.id;
        
        // Check missing fields
        const requiredFields = ['question', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'category'];
        let missing = [];
        for (let field of requiredFields) {
            if (!data[field] || typeof data[field] !== 'string' || data[field].trim() === '') {
                missing.push(field);
            }
        }
        if (missing.length > 0) {
            missingFieldsDocs.push(`${id} (Missing: ${missing.join(', ')})`);
        }
        
        // Category count
        let cat = data.category ? data.category.trim() : 'Unknown';
        if (!categories[cat]) categories[cat] = 0;
        categories[cat]++;
        
        // Duplicates check
        let qText = data.question ? data.question.trim().toLowerCase() : '';
        if (qText) {
            if (questionSet.has(qText)) {
                duplicates.push(`${id} (Question: "${data.question}")`);
            } else {
                questionSet.add(qText);
            }
        }
        
        // Invalid correctAnswer
        let opts = [data.option1, data.option2, data.option3, data.option4];
        let cAns = data.correctAnswer;
        if (cAns && !opts.includes(cAns)) {
            invalidDocs.push(`${id} (Correct Answer "${cAns}" not found in options)`);
        }
    });
    
    // Sort categories
    let sortedCats = Object.keys(categories).sort();
    
    console.log("========================================");
    console.log("QUIZ DATABASE REPORT");
    console.log("========================================");
    console.log("");
    console.log(`Total Quiz Documents: ${totalDocs}`);
    console.log("");
    console.log(`Total Categories: ${sortedCats.length}`);
    console.log("");
    console.log("Category Breakdown:");
    console.log("");
    sortedCats.forEach((c, index) => {
        console.log(`${index + 1}. ${c} — ${categories[c]}`);
    });
    console.log("");
    console.log("Duplicate Questions:");
    if (duplicates.length === 0) {
        console.log("None");
    } else {
        duplicates.forEach(d => console.log(d));
    }
    console.log("");
    console.log("Invalid Documents:");
    if (invalidDocs.length === 0) {
        console.log("None");
    } else {
        invalidDocs.forEach(d => console.log(d));
    }
    console.log("");
    console.log("Missing Required Fields:");
    if (missingFieldsDocs.length === 0) {
        console.log("None");
    } else {
        missingFieldsDocs.forEach(d => console.log(d));
    }
    console.log("");
    console.log("Final Database Status:");
    if (duplicates.length === 0 && invalidDocs.length === 0 && missingFieldsDocs.length === 0) {
        console.log("✅ Healthy");
    } else {
        console.log("❌ Issues Found");
    }
}

runAudit().catch(console.error).finally(() => process.exit(0));
