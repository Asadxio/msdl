import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/admin";
import { requireAuthenticatedUser } from "../auth/verifyAuth";
import { invalidArgumentError } from "../shared/errors";
import { collections } from "../shared/firestore";

interface SubmitQuizRequest {
  category: string;
  answers: Record<string, string>; // { [questionDocId]: selectedOptionValue }
  nonce: string;                   // dedup / attempt ID from client
  startedAtMs?: number;            // for timing analysis (not trusted for security)
}

interface SubmitQuizResponse {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  resultId: string;
  duplicate?: boolean;
  breakdown?: { id: string; wasCorrect: boolean }[];
}

export const submitQuiz = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<SubmitQuizRequest>): Promise<SubmitQuizResponse> => {
    const user = await requireAuthenticatedUser(request);
    const { category, answers, nonce, startedAtMs } = request.data ?? {};

    // Validate
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      throw invalidArgumentError('category is required.');
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw invalidArgumentError('answers must be an object.');
    }
    if (Object.keys(answers).length > 60) {
      throw invalidArgumentError('Too many answers.');
    }
    if (!nonce || typeof nonce !== 'string' || nonce.length > 200) {
      throw invalidArgumentError('nonce is required.');
    }

    // Deduplication check
    const dedupeKey = `quiz:${user.uid}:${category}:${nonce}`;
    const dedupeRef = collections.operationDedupe().doc(dedupeKey);
    const existing = await dedupeRef.get();
    if (existing.exists) {
      const existingData = existing.data()!;
      return {
        score: existingData.score ?? 0,
        total: existingData.total ?? 0,
        percentage: existingData.percentage ?? 0,
        passed: existingData.passed ?? false,
        resultId: existingData.resultId ?? '',
        duplicate: true,
        breakdown: existingData.breakdown ?? [],
      };
    }

    // Load quiz questions WITH correct answers server-side (Admin SDK reads all fields)
    const snapshot = await db.collection('quizzes')
      .where('category', '==', category.trim())
      .get();

    if (snapshot.empty) {
      throw invalidArgumentError(`No quiz found for category: ${category}`);
    }

    // Build answer key map: { docId -> correctAnswer }
    const answerKeyMap: Record<string, string> = {};
    snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      // Support both field names used in production data
      const correctAnswer = String(data.correctAnswer ?? data.correct_answer ?? '');
      answerKeyMap[doc.id] = correctAnswer;
    });

    const total = snapshot.docs.length;

    // Timing check (from quizSecurity.py logic)
    if (startedAtMs && typeof startedAtMs === 'number') {
      const elapsedMs = Date.now() - startedAtMs;
      const minExpectedMs = total * 3000; // 3 seconds minimum per question
      if (elapsedMs < minExpectedMs) {
        logger.warn(`[submitQuiz] Suspicious timing uid=${user.uid} elapsed=${elapsedMs}ms expected>=${minExpectedMs}ms`);
        // Log but do not reject — legitimate fast users should not be penalized
        await collections.securityEvents().add({
          event: 'quiz_suspicious_timing',
          uid: user.uid,
          category,
          elapsedMs,
          minExpectedMs,
          createdAtMs: Date.now(),
        }).catch(() => {}); // Non-fatal
      }
    }

    // Server-side grading — compare submitted answers to server answer key
    let score = 0;
    const breakdown: { id: string, wasCorrect: boolean }[] = [];
    
    for (const [docId, submittedAnswer] of Object.entries(answers)) {
      const correctAnswer = answerKeyMap[docId];
      const wasCorrect = (correctAnswer && submittedAnswer === correctAnswer) || false;
      if (wasCorrect) {
        score++;
      }
      breakdown.push({
        id: docId,
        wasCorrect,
      });
    }

    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passThreshold = 50; // Default — can be made configurable per quiz
    const passed = percentage >= passThreshold;

    // Write result via Admin SDK
    const resultRef = collections.quizResults().add({
      uid: user.uid,
      user_id: user.uid, // backward compat with existing quiz_results schema
      category: category.trim(),
      score,
      total_questions: total,
      total,
      percentage,
      passed,
      nonce,
      submittedAtMs: Date.now(),
      submittedAt: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(), // backward compat
    });

    // Write dedupe BEFORE awaiting result (prevent race condition)
    await dedupeRef.set({
      uid: user.uid,
      category,
      nonce,
      score,
      total,
      percentage,
      passed,
      createdAtMs: Date.now(),
      breakdown,
    });

    const resultDoc = await resultRef;
    const resultId = resultDoc.id;

    logger.info(`[submitQuiz] Result written resultId=${resultId} uid=${user.uid} score=${score}/${total}`);

    // NEVER return correctAnswer or answerKeyMap
    return { score, total, percentage, passed, resultId, breakdown };
  }
);
