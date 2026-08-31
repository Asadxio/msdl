const fs = require('fs');
const file = 'C:/Users/xioas/.gemini/antigravity/scratch/msdl/frontend/app/(tabs)/quiz.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { addDoc, collection, deleteDoc, doc, getDocs, getCountFromServer, query, serverTimestamp, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore';",
  "import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getCountFromServer, query, serverTimestamp, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore';\nimport { getFunctions, httpsCallable } from 'firebase/functions';\nimport { getApp } from 'firebase/app';"
);

content = content.replace(
  "type QuizQuestion = {\n  id: string;\n  question: string;\n  options: string[];\n  correct_answer: string;\n  category?: string;\n};",
  "type QuizQuestion = {\n  id: string;\n  question: string;\n  options: string[];\n  category?: string;\n};\n\ntype ScoreBreakdownItem = {\n  id: string;\n  question: string;\n  selected: string;\n  ok: boolean;\n};"
);

content = content.replace(
  "const [result, setResult] = useState<{ score: number; total: number } | null>(null);",
  "const [result, setResult] = useState<{ score: number; total: number } | null>(null);\n  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdownItem[]>([]);"
);

content = content.replace(
  "    try {\n      const q = query(collection(db, 'quizzes'), where('category', '==', category));\n      const snap = await getDocs(q);\n      \n      const all: QuizQuestion[] = [];\n      snap.forEach((d) => {\n        const data = d.data() as any;\n        const question = data.question;\n        const options = Array.isArray(data.options) \n          ? data.options \n          : [data.option1, data.option2, data.option3, data.option4].filter(Boolean);\n        const correct_answer = data.correct_answer || data.correctAnswer;\n        \n        if (question && Array.isArray(options) && options.length >= 2 && correct_answer) {\n          all.push({\n            id: d.id,\n            question,\n            options,\n            correct_answer,\n            category: data.category || '',\n          });\n        }\n      });",
  "    try {\n      const functions = getFunctions(getApp(), 'us-central1');\n      const getQuizQuestionsFn = httpsCallable(functions, 'getQuizQuestions');\n      const res = await getQuizQuestionsFn({ category });\n      const data = res.data as { questions: QuizQuestion[] };\n      const all: QuizQuestion[] = data.questions;"
);

content = content.replace(
  "  const scoreBreakdown = useMemo(() => questions.map((q) => ({\n    id: q.id,\n    question: q.question,\n    selected: answers[q.id] || '',\n    correct: q.correct_answer,\n    ok: (answers[q.id] || '') === q.correct_answer,\n  })), [questions, answers]);",
  "  // scoreBreakdown is now computed on the server and stored in state"
);

content = content.replace(
  "    try {\n      const score = questions.reduce((sum, q) => (answers[q.id] === q.correct_answer ? sum + 1 : sum), 0);\n      console.info(`[QuizSubmission] 3. Score calculation complete: ${score}/${questions.length}`);\n      \n      const cleanCat = selectedCategory && typeof selectedCategory === 'string' && selectedCategory.trim().length > 0\n        ? selectedCategory.trim().slice(0, 100)\n        : 'Uncategorized';\n\n      const payload = {\n        user_id: user.uid,\n        score,\n        total_questions: questions.length,\n        category: cleanCat,\n        created_at: Timestamp.now(),\n      };\n      console.info('[QuizSubmission] 4. Payload creation complete:', { user_id: user.uid, score, total_questions: questions.length, category: cleanCat, attemptDocId });\n\n      const docRef = doc(collection(db, 'quiz_results'), attemptDocId);\n\n      // Save with exponential backoff retry logic (up to 3 attempts, 30s timeout per attempt)\n      let lastErr: any = null;\n      console.info('[QuizSubmission] 5. API/Firestore request start - writing to quiz_results collection');\n      for (let attempt = 1; attempt <= 3; attempt++) {\n        try {\n          await Promise.race([\n            setDoc(docRef, payload, { merge: true }),\n            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 30000))\n          ]);\n          lastErr = null;\n          break;\n        } catch (err: any) {\n          lastErr = err;\n          console.warn(`[QuizSubmission] Attempt ${attempt} failed:`, err?.message);\n          if (attempt === 3) break;\n          const delayMs = Math.min(1500 * Math.pow(2, attempt - 1), 6000);\n          await new Promise((resolve) => setTimeout(resolve, delayMs));\n        }\n      }\n      if (lastErr) throw lastErr;\n\n      console.info('[QuizSubmission] 6. API/Firestore request success - quiz result saved');\n      setResult({ score, total: questions.length });",
  "    try {\n      const cleanCat = selectedCategory && typeof selectedCategory === 'string' && selectedCategory.trim().length > 0\n        ? selectedCategory.trim().slice(0, 100)\n        : 'Uncategorized';\n\n      console.info('[QuizSubmission] 3. Payload creation complete:', { user_id: user.uid, category: cleanCat, attemptDocId });\n\n      let lastErr: any = null;\n      let submitResult: any = null;\n      const functions = getFunctions(getApp(), 'us-central1');\n      const submitQuizFn = httpsCallable(functions, 'submitQuiz');\n\n      console.info('[QuizSubmission] 4. API request start - calling submitQuiz Cloud Function');\n      for (let attempt = 1; attempt <= 3; attempt++) {\n        try {\n          submitResult = await Promise.race([\n            submitQuizFn({\n              category: cleanCat,\n              answers: answers,\n              nonce: attemptDocId,\n            }),\n            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 30000))\n          ]);\n          lastErr = null;\n          break;\n        } catch (err: any) {\n          lastErr = err;\n          console.warn(`[QuizSubmission] Attempt ${attempt} failed:`, err?.message);\n          if (attempt === 3) break;\n          const delayMs = Math.min(1500 * Math.pow(2, attempt - 1), 6000);\n          await new Promise((resolve) => setTimeout(resolve, delayMs));\n        }\n      }\n      if (lastErr) throw lastErr;\n\n      const serverResult = submitResult.data as any;\n\n      console.info('[QuizSubmission] 5. API request success - quiz result saved');\n      setResult({ score: serverResult.score, total: serverResult.total });\n      \n      const serverBreakdown = serverResult.breakdown || [];\n      setScoreBreakdown(\n        questions.map((q) => {\n          const breakdownItem = serverBreakdown.find((b: any) => b.id === q.id);\n          return {\n            id: q.id,\n            question: q.question,\n            selected: answers[q.id] || '',\n            ok: breakdownItem ? breakdownItem.wasCorrect : false,\n          };\n        })\n      );"
);

content = content.replace(
  "  const editQuestion = (q: QuizQuestion) => {\n    setEditingId(q.id);\n    setQuestionInput(q.question);\n    const opts = [...q.options, '', '', '', ''].slice(0, 4);\n    setOptionInputs(opts);\n    setCorrectAnswer(q.correct_answer);\n    setCategoryInput(q.category || selectedCategory || '');\n  };",
  "  const editQuestion = async (q: QuizQuestion) => {\n    setEditingId(q.id);\n    setQuestionInput(q.question);\n    \n    // For the correct answer, fetch the full document server-side\n    // (admin has direct Firestore read access per security rules)\n    // This is intentionally NOT done via getQuizQuestions (which strips answer keys for students)\n    try {\n      const fullDoc = await getDoc(doc(db, 'quizzes', q.id));\n      if (fullDoc.exists()) {\n        const data = fullDoc.data();\n        const correctAnswerValue = String(data.correctAnswer ?? data.correct_answer ?? '');\n        setCorrectAnswer(correctAnswerValue);\n      }\n    } catch (e) {\n      // Fallback: correct answer field will be empty — admin must re-enter it\n      setCorrectAnswer('');\n    }\n    \n    const opts = [...q.options, '', '', '', ''].slice(0, 4);\n    setOptionInputs(opts);\n    setCategoryInput(q.category || selectedCategory || '');\n  };"
);

content = content.replace(
  "<TouchableOpacity style={styles.compactBtn} onPress={() => editQuestion(q)}>",
  "<TouchableOpacity style={styles.compactBtn} onPress={() => { editQuestion(q).catch(() => {}); }}>"
);

content = content.replace(
  "              {!item.ok ? <Text style={styles.answerLine}>Correct: {item.correct}</Text> : null}",
  "              {!item.ok ? <Text style={styles.answerLine}>Correct Answer Hidden</Text> : null}"
);

content = content.replace(
  "                      const q = questions.find((question) => question.id === item.id);\n                      if (!q) return;\n                      editQuestion(q);",
  "                      const q = questions.find((question) => question.id === item.id);\n                      if (!q) return;\n                      editQuestion(q).catch(() => {});"
);

fs.writeFileSync(file, content);
console.log('Done replacement');
