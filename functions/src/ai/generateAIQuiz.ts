/**
 * MSLB generateAIQuiz — Firebase Callable Function
 *
 * Secure server-side Islamic quiz generation replacing client-side Gemini calls.
 *
 * SECURITY INVARIANTS:
 *   - Firebase Auth required.
 *   - ONLY admin, super_admin, moderator, teacher, assistant_teacher may generate quizzes.
 *   - Students CANNOT invoke this — quiz generation is teacher/admin-only.
 *   - GEMINI_API_KEY never returned to client or logged.
 *   - Rate limited: 2 req/min, 20 req/day per UID.
 *   - count server-capped at 20.
 *
 * CLIENT CONTRACT (preserved from lib/aiQuizGenerator.ts):
 *   Request:  { category, count, difficulty, language, customTopic? }
 *   Response: { questions: GeneratedQuestion[] }
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GEMINI_API_KEY } from '../config/secrets';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { internalError, permissionDeniedError, invalidArgumentError } from '../shared/errors';
import {
  enforceRateLimit,
  validateTopic,
  validateCount,
  validateLanguage,
  callGemini,
  logAiUsage,
} from './aiGateway';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateQuizRequest {
  category:     string;
  count:        number;
  difficulty:   string;  // 'easy' | 'medium' | 'hard'
  language:     string;  // 'english' | 'urdu' | 'both'
  customTopic?: string;
}

interface GeneratedQuestion {
  id:             string;
  question:       string;
  options:        string[];
  correct_answer: string;
  category:       string;
  explanation:    string;
  difficulty?:    string;
  language?:      string;
}

interface GenerateQuizResponse {
  questions: GeneratedQuestion[];
}

const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const ALLOWED_LANGUAGES     = ['english', 'urdu', 'both'] as const;

/** Roles allowed to generate quizzes — students excluded */
const QUIZ_GEN_ALLOWED_ROLES = ['admin', 'super_admin', 'moderator', 'teacher', 'assistant_teacher'];

// ─── Callable ─────────────────────────────────────────────────────────────────

export const generateAIQuiz = onCall(
  {
    region:  'us-central1',
    secrets: [GEMINI_API_KEY],
  },
  async (request: CallableRequest<GenerateQuizRequest>): Promise<GenerateQuizResponse> => {
    const t0 = Date.now();
    let uid = 'unknown';

    try {
      // 1. Auth check
      const user = await requireAuthenticatedUser(request);
      uid = user.uid;
      logger.info(`[generateAIQuiz] uid=${uid} role=${user.role}`);

      // 2. Role authorization — quiz generation is teacher/admin only
      if (!QUIZ_GEN_ALLOWED_ROLES.includes(user.role)) {
        throw permissionDeniedError('Quiz generation requires teacher or admin role.');
      }

      // 3. Rate limiting
      await enforceRateLimit(uid, 'quiz');

      // 4. Input validation
      const raw = request.data ?? {};
      if (!raw.category) {
        throw invalidArgumentError('category is required.');
      }
      const category   = validateTopic(raw.category);
      const count      = validateCount(raw.count, 1, 20);
      const difficulty = validateLanguage(raw.difficulty ?? 'easy', ALLOWED_DIFFICULTIES);
      const language   = validateLanguage(raw.language ?? 'both', ALLOWED_LANGUAGES);

      // 5. Get API key
      const apiKey = GEMINI_API_KEY.value();
      if (!apiKey) {
        throw internalError('AI service not configured. Contact admin.');
      }

      // 6. Build prompt
      const langNote =
        language === 'english' ? 'English only. No Urdu.' :
        language === 'urdu'    ? 'Urdu only (اردو). No English.' :
                                 'Bilingual — each question and option in English / اردو format.';

      const systemInstruction = `You are an expert Islamic studies teacher at Madrasatu-s-Salikat Lil Banat, an online madrasa for Muslim women.
Generate exactly ${count} multiple-choice quiz questions about the Islamic topic: "${category}".
Rules:
- Difficulty: ${difficulty}
- Language: ${langNote}
- Fiqh school: Hanafi
- Each question must have exactly 4 options
- Only ONE correct answer per question
- All content must be authentic and scholarly
IMPORTANT: Respond ONLY with a valid JSON array. No extra text, no markdown fences.
Each item must follow this exact shape:
[
  {
    "question": "question text",
    "options": ["option A", "option B", "option C", "option D"],
    "correct_answer": "exact matching text from options array",
    "explanation": "scholarly Hanafi explanation"
  }
]`;

      // 7. Call Gemini
      const rawText = await callGemini(apiKey, {
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: `Generate ${count} quiz questions about: ${category}` }] }],
        temperature:      0.85,
        maxOutputTokens:  3000,
        responseMimeType: 'application/json',
      });

      // 8. Parse response
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid quiz array from Gemini');
      }

      // 9. Validate + normalize each question (never trust raw Gemini output shape)
      const questions: GeneratedQuestion[] = parsed.map((q: Record<string, unknown>, idx: number) => {
        const options = Array.isArray(q.options) ? q.options.map(String) : [];
        if (options.length !== 4) throw new Error(`Question ${idx + 1} does not have exactly 4 options`);

        const correctAnswer = String(q.correct_answer ?? '');
        if (!options.includes(correctAnswer)) {
          throw new Error(`Question ${idx + 1} correct_answer not in options array`);
        }

        return {
          id:             `ai_q_${Date.now()}_${idx + 1}`,
          question:       String(q.question ?? ''),
          options,
          correct_answer: correctAnswer,
          category,
          explanation:    String(q.explanation ?? ''),
          difficulty:     difficulty as string,
          language:       language as string,
        };
      });

      const latencyMs = Date.now() - t0;
      await logAiUsage({ uid, feature: 'quiz', success: true, latencyMs });

      return { questions };

    } catch (err: any) {
      const latencyMs = Date.now() - t0;
      const safeMsg = typeof err?.message === 'string'
        ? err.message.replace(/AIza[A-Za-z0-9_-]{35}/g, '[KEY_REDACTED]')
        : 'Unknown error';

      logger.error(`[generateAIQuiz] uid=${uid} error=${safeMsg}`);
      await logAiUsage({ uid, feature: 'quiz', success: false, latencyMs, errorCode: err?.code ?? 'unknown' });

      if (err?.httpErrorCode || err?.code) throw err;
      throw internalError('Quiz generation temporarily unavailable. Please try again.');
    }
  }
);
