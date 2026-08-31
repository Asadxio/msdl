/**
 * MSLB Get Quiz Questions — Cloud Function
 *
 * Reads quiz documents from Firestore server-side and returns ONLY
 * the question text and answer options — NEVER the correct answer.
 *
 * The correct answer is stripped server-side before any data reaches
 * the Android client.
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { db } from "../config/admin";
import { requireAuthenticatedUser } from "../auth/verifyAuth";
import { invalidArgumentError, internalError } from "../shared/errors";

// Safe question type — does NOT include correctAnswer or correct_answer
export interface SafeQuizQuestion {
  id: string;
  question: string;
  options: string[];
  category: string;
}

interface GetQuizQuestionsRequest {
  category?: string;
}

export const getQuizQuestions = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<GetQuizQuestionsRequest>): Promise<{ questions: SafeQuizQuestion[] }> => {
    // 1. Require authentication
    const user = await requireAuthenticatedUser(request);
    logger.info(`[getQuizQuestions] uid=${user.uid} category=${request.data?.category ?? 'all'}`);

    const category = request.data?.category;

    // 2. Validate category if provided
    if (category !== undefined && (typeof category !== 'string' || category.length > 100)) {
      throw invalidArgumentError('Invalid category.');
    }

    // 3. Build Firestore query
    try {
      let query: FirebaseFirestore.Query = db.collection('quizzes');
      if (category && category.trim().length > 0) {
        query = query.where('category', '==', category.trim());
      }
      // Limit to prevent abuse
      query = query.limit(60);

      const snapshot = await query.get();

      // 4. Strip answer keys — ONLY return safe fields using allowlist
      const questions: SafeQuizQuestion[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        
        let options: string[] = [];
        if (Array.isArray(data.options)) {
          options = data.options;
        } else {
          options = [data.option1, data.option2, data.option3, data.option4].filter(Boolean) as string[];
        }

        // CRITICAL: Explicit allowlist — correctAnswer and correct_answer are intentionally excluded
        return {
          id: doc.id,
          question: String(data.question ?? ''),
          options: options.map(String),
          category: String(data.category ?? ''),
        };
      }).filter((q) => q.question.length > 0 && q.options.length >= 2);

      logger.info(`[getQuizQuestions] Returning ${questions.length} questions (answer keys stripped)`);
      return { questions };
    } catch (err) {
      logger.error('[getQuizQuestions] Firestore read failed', err);
      throw internalError('Failed to load quiz questions.');
    }
  }
);
