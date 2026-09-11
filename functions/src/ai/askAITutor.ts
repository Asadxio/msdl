/**
 * MSLB askAITutor — Firebase Callable Function
 *
 * Secure server-side AI Islamic tutor replacing direct client-side Gemini calls.
 *
 * SECURITY INVARIANTS:
 *   - Firebase Auth required. Pending/rejected/deactivated users denied.
 *   - GEMINI_API_KEY never returned to client or logged.
 *   - Rate limited: 8 req/min, 150 req/day per UID.
 *   - Prompt injection protection applied to all user text.
 *   - Religious safety guardrails enforced server-side.
 *   - uid/role always read from server-side Firebase Auth + Firestore.
 *
 * CLIENT CONTRACT (preserved from lib/aiAssistant.ts):
 *   Request:  { question, history?, language?, mode?, lessonTitle?, courseTitle? }
 *   Response: { text, mode, language }
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GEMINI_API_KEY } from '../config/secrets';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { internalError, invalidArgumentError } from '../shared/errors';
import {
  enforceRateLimit,
  validateQuestion,
  validateTutorMode,
  validateLanguage,
  sanitizeLessonTitle,
  callGemini,
  logAiUsage,
  buildIslamicTutorSystemPrompt,
} from './aiGateway';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  sender: 'user' | 'assistant';
  text:   string;
}

interface AskAITutorRequest {
  question:     string;
  history?:     ChatMessage[];
  language?:    string;        // 'en' | 'ur'
  mode?:        string;        // 'tutor' | 'quiz' | 'vocab' | 'summary'
  lessonTitle?: string;
  courseTitle?: string;
}

interface AskAITutorResponse {
  text:     string;
  mode:     string;
  language: string;
}

const ALLOWED_LANGUAGES = ['en', 'ur'] as const;
const MAX_HISTORY = 10;

// ─── Callable ─────────────────────────────────────────────────────────────────

export const askAITutor = onCall(
  {
    region:  'us-central1',
    secrets: [GEMINI_API_KEY],
  },
  async (request: CallableRequest<AskAITutorRequest>): Promise<AskAITutorResponse> => {
    const t0 = Date.now();
    let uid = 'unknown';

    try {
      // 1. Auth + status check (pending/rejected users denied)
      const user = await requireAuthenticatedUser(request);
      uid = user.uid;
      logger.info(`[askAITutor] uid=${uid} role=${user.role}`);

      // 2. Rate limiting
      await enforceRateLimit(uid, 'tutor');

      // 3. Input validation + sanitization
      const raw = request.data ?? {};

      if (!raw.question) {
        throw invalidArgumentError('question is required.');
      }
      const question    = validateQuestion(raw.question);
      const language    = validateLanguage(raw.language ?? 'ur', ALLOWED_LANGUAGES) as 'en' | 'ur';
      const mode        = validateTutorMode(raw.mode ?? 'tutor');
      const lessonTitle = sanitizeLessonTitle(raw.lessonTitle);
      const courseTitle = sanitizeLessonTitle(raw.courseTitle);

      // 4. Validate + truncate history (client-provided — treat as untrusted)
      const rawHistory = Array.isArray(raw.history) ? raw.history : [];
      const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = rawHistory
        .filter((m): m is ChatMessage =>
          m !== null &&
          typeof m === 'object' &&
          (m.sender === 'user' || m.sender === 'assistant') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0
        )
        .slice(-MAX_HISTORY)
        .map((m) => ({
          role:  m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text.slice(0, 1000) }], // cap individual history messages
        }));

      // 5. Build system prompt (server-side, client cannot modify)
      const courseNote = lessonTitle
        ? (language === 'en'
            ? `\nActive Lesson: "${lessonTitle}"${courseTitle ? ` — Course: ${courseTitle}` : ''}`
            : `\nموجودہ سبق: "${lessonTitle}"${courseTitle ? ` — کورس: ${courseTitle}` : ''}`)
        : '';

      const systemInstruction = buildIslamicTutorSystemPrompt(language, mode, courseNote);

      // 6. Build contents array
      const contents = [...history, { role: 'user' as const, parts: [{ text: question }] }];

      // 7. Call Gemini server-side
      const apiKey = GEMINI_API_KEY.value();
      if (!apiKey) {
        throw internalError('AI service not configured. Contact admin.');
      }

      const text = await callGemini(apiKey, {
        systemInstruction,
        contents,
        temperature:     0.7,
        maxOutputTokens: 1024,
      });

      const latencyMs = Date.now() - t0;
      await logAiUsage({ uid, feature: 'tutor', success: true, latencyMs });

      return { text, mode, language };

    } catch (err: any) {
      const latencyMs = Date.now() - t0;

      // Do not log API key — err.message may contain it in edge cases, so strip
      const safeMsg = typeof err?.message === 'string'
        ? err.message.replace(/AIza[A-Za-z0-9_-]{35}/g, '[KEY_REDACTED]')
        : 'Unknown error';

      logger.error(`[askAITutor] uid=${uid} error=${safeMsg} latencyMs=${latencyMs}`);
      await logAiUsage({ uid, feature: 'tutor', success: false, latencyMs, errorCode: err?.code ?? 'unknown' });

      // Re-throw Firebase HttpsErrors directly (auth/rate-limit/validation)
      if (err?.httpErrorCode || err?.code) throw err;

      throw internalError('AI service temporarily unavailable. Please try again.');
    }
  }
);
