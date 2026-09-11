/**
 * MSLB generateAIFlashcards — Firebase Callable Function
 *
 * Secure server-side Islamic flashcard generation replacing client-side Gemini calls.
 *
 * SECURITY INVARIANTS:
 *   - Firebase Auth required.
 *   - GEMINI_API_KEY never returned to client or logged.
 *   - Rate limited: 3 req/min, 30 req/day per UID.
 *   - count capped at 10 server-side (client cannot override).
 *   - topic sanitized.
 *   - All roles (student/teacher/admin) may generate flashcards.
 *
 * CLIENT CONTRACT (preserved from lib/aiFlashcardGenerator.ts):
 *   Request:  { topic, count }
 *   Response: { cards: IslamicFlashcard[] }
 *
 * Note: id fields are generated server-side for integrity.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GEMINI_API_KEY } from '../config/secrets';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { internalError } from '../shared/errors';
import {
  enforceRateLimit,
  validateTopic,
  validateCount,
  callGemini,
  logAiUsage,
} from './aiGateway';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateFlashcardsRequest {
  topic: string;
  count: number;
}

interface IslamicFlashcard {
  id:               string;
  category:         string;
  categoryTitle:    string;
  topic:            string;
  frontText:        string;
  frontSubtitle:    string;
  backTranslation:  string;
  backEnglish:      string;
  backRoman:        string;
  backExplanation:  string;
  reference:        string;
}

interface GenerateFlashcardsResponse {
  cards: IslamicFlashcard[];
}

// ─── Callable ─────────────────────────────────────────────────────────────────

export const generateAIFlashcards = onCall(
  {
    region:  'us-central1',
    secrets: [GEMINI_API_KEY],
  },
  async (request: CallableRequest<GenerateFlashcardsRequest>): Promise<GenerateFlashcardsResponse> => {
    const t0 = Date.now();
    let uid = 'unknown';

    try {
      // 1. Auth check
      const user = await requireAuthenticatedUser(request);
      uid = user.uid;
      logger.info(`[generateAIFlashcards] uid=${uid} role=${user.role}`);

      // 2. Rate limiting
      await enforceRateLimit(uid, 'flashcards');

      // 3. Input validation
      const raw = request.data ?? {};
      const topic    = validateTopic(raw.topic);
      const cardCount = validateCount(raw.count, 1, 10); // Hard cap at 10

      // 4. Get API key from Secret Manager
      const apiKey = GEMINI_API_KEY.value();
      if (!apiKey) {
        throw internalError('AI service not configured. Contact admin.');
      }

      // 5. Build prompt (no client-controlled system instructions)
      const systemInstruction = `You are an Islamic education expert at Madrasatu-s-Salikat Lil Banat.
Create exactly ${cardCount} Islamic flashcards about: "${topic}".
All content must be authentic, scholarly, appropriate for Muslim women students.
Fiqh school: Hanafi where applicable.
IMPORTANT: Respond ONLY with a valid JSON array. No extra text, no markdown fences.
Each card must follow this exact JSON shape:
[
  {
    "category": "fiqh",
    "categoryTitle": "category title in Urdu",
    "topic": "specific sub-topic in Urdu/English",
    "frontText": "Arabic text or key term with diacritics",
    "frontSubtitle": "brief label/context in Urdu",
    "backTranslation": "Urdu translation",
    "backEnglish": "English explanation",
    "backRoman": "Roman Urdu transliteration",
    "backExplanation": "deeper Urdu explanation",
    "reference": "book/hadith reference"
  }
]
category must be one of: fiqh, tajweed, hadith, duas, aqeedah, arabic, seerah, tazkiyah.`;

      // 6. Call Gemini
      const rawText = await callGemini(apiKey, {
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: `Generate ${cardCount} flashcards about: ${topic}` }] }],
        temperature:      0.8,
        maxOutputTokens:  2048,
        responseMimeType: 'application/json',
      });

      // 7. Parse and validate response
      const jsonStr = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid card array from Gemini');
      }

      // 8. Add server-generated IDs (not client-provided)
      const cards: IslamicFlashcard[] = parsed.map((card: Record<string, unknown>, idx: number) => ({
        id:              `ai_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        category:        String(card.category ?? 'fiqh'),
        categoryTitle:   String(card.categoryTitle ?? ''),
        topic:           String(card.topic ?? ''),
        frontText:       String(card.frontText ?? ''),
        frontSubtitle:   String(card.frontSubtitle ?? ''),
        backTranslation: String(card.backTranslation ?? ''),
        backEnglish:     String(card.backEnglish ?? ''),
        backRoman:       String(card.backRoman ?? ''),
        backExplanation: String(card.backExplanation ?? ''),
        reference:       String(card.reference ?? ''),
      }));

      const latencyMs = Date.now() - t0;
      await logAiUsage({ uid, feature: 'flashcards', success: true, latencyMs });

      return { cards };

    } catch (err: any) {
      const latencyMs = Date.now() - t0;
      const safeMsg = typeof err?.message === 'string'
        ? err.message.replace(/AIza[A-Za-z0-9_-]{35}/g, '[KEY_REDACTED]')
        : 'Unknown error';

      logger.error(`[generateAIFlashcards] uid=${uid} error=${safeMsg}`);
      await logAiUsage({ uid, feature: 'flashcards', success: false, latencyMs, errorCode: err?.code ?? 'unknown' });

      if (err?.httpErrorCode || err?.code) throw err;
      throw internalError('Flashcard generation temporarily unavailable. Please try again.');
    }
  }
);
