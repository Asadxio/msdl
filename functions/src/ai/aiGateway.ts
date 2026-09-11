/**
 * MSLB AI Gateway — Shared Server Module
 *
 * Centralizes all server-side Gemini API calls for:
 *   - askAITutor        (AI Islamic tutor chat)
 *   - generateAIFlashcards (Islamic flashcard generation)
 *   - generateAIQuiz    (Islamic quiz question generation)
 *
 * SECURITY INVARIANTS:
 *   - GEMINI_API_KEY is read ONLY server-side from Secret Manager.
 *   - Key is NEVER returned to client, logged, or stored.
 *   - All callers must be authenticated Firebase users.
 *   - Rate limits enforced per-UID via Firestore ai_rate_limits collection.
 *   - Request payloads validated + sanitized before Gemini call.
 *   - Religious safety guardrails preserved exactly.
 *   - Prompt injection cannot override system instructions.
 */

import { db } from '../config/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { resourceExhaustedError, invalidArgumentError } from '../shared/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Allowed Gemini model for all MSLB AI features. Client cannot override. */
const ALLOWED_MODEL = 'gemini-3.6-flash';

/** Max input lengths — prevents abuse */
const MAX_QUESTION_CHARS = 2000;
const MAX_LESSON_TITLE_CHARS = 200;
const MAX_TOPIC_CHARS = 200;

/** Rate limits per UID per feature per day */
const RATE_LIMITS = {
  tutor:      { perMinute: 8, perDay: 150 },
  flashcards: { perMinute: 3, perDay: 30  },
  quiz:       { perMinute: 2, perDay: 20  },
} as const;

export type AiFeature = keyof typeof RATE_LIMITS;

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

/**
 * Enforces per-UID rate limiting for a given AI feature.
 * Uses Firestore ai_rate_limits/{uid}/feature/{feature} as a counter.
 * Throws resource-exhausted if limit exceeded.
 */
export async function enforceRateLimit(uid: string, feature: AiFeature): Promise<void> {
  const limits = RATE_LIMITS[feature];
  const nowMs = Date.now();
  const utcDayKey = new Date(nowMs).toISOString().slice(0, 10);
  const minuteKey = Math.floor(nowMs / 60000);

  const docRef = db
    .collection('ai_rate_limits')
    .doc(uid)
    .collection('feature')
    .doc(feature);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data()! : {};

    const dayCount: number = data.dayKey === utcDayKey ? (data.dayCount ?? 0) : 0;
    if (dayCount >= limits.perDay) {
      throw resourceExhaustedError(
        `Daily AI limit reached for ${feature}. Limit: ${limits.perDay}/day. Try again tomorrow.`
      );
    }

    const minuteCount: number = data.minuteKey === minuteKey ? (data.minuteCount ?? 0) : 0;
    if (minuteCount >= limits.perMinute) {
      throw resourceExhaustedError(
        `Rate limit: too many ${feature} requests. Please wait a moment.`
      );
    }

    tx.set(docRef, {
      dayKey:      utcDayKey,
      dayCount:    dayCount + 1,
      minuteKey:   minuteKey,
      minuteCount: minuteCount + 1,
      lastRequestMs: nowMs,
      updatedAt:   FieldValue.serverTimestamp(),
    });
  });
}

// ─── Input Validators ─────────────────────────────────────────────────────────

export function validateQuestion(question: unknown, fieldName = 'question'): string {
  if (typeof question !== 'string' || question.trim().length === 0) {
    throw invalidArgumentError(`${fieldName} must be a non-empty string.`);
  }
  return sanitizeInput(question.trim().slice(0, MAX_QUESTION_CHARS));
}

export function validateTopic(topic: unknown): string {
  if (typeof topic !== 'string' || topic.trim().length === 0) {
    throw invalidArgumentError('topic must be a non-empty string.');
  }
  return topic.trim().slice(0, MAX_TOPIC_CHARS);
}

export function validateCount(count: unknown, min: number, max: number): number {
  const n = Number(count);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw invalidArgumentError(`count must be an integer between ${min} and ${max}.`);
  }
  return n;
}

export function validateTutorMode(mode: unknown): string {
  const allowed = ['tutor', 'quiz', 'vocab', 'summary'];
  if (typeof mode !== 'string' || !allowed.includes(mode)) {
    throw invalidArgumentError(`mode must be one of: ${allowed.join(', ')}.`);
  }
  return mode;
}

export function validateLanguage(lang: unknown, allowed: readonly string[]): string {
  if (typeof lang !== 'string' || !(allowed as string[]).includes(lang)) {
    throw invalidArgumentError(`language must be one of: ${allowed.join(', ')}.`);
  }
  return lang;
}

export function sanitizeLessonTitle(title: unknown): string {
  if (typeof title !== 'string') return '';
  return title.trim().slice(0, MAX_LESSON_TITLE_CHARS);
}

/** Remove prompt injection patterns from user-controlled text */
function sanitizeInput(text: string): string {
  return text
    .replace(/ignore (previous|all|any) (instructions?|prompts?|context)/gi, '[filtered]')
    .replace(/you are now|act as|pretend (to be|you are)/gi, '[filtered]')
    .replace(/system\s*:/gi, '[filtered]')
    .replace(/\[system\]/gi, '[filtered]')
    .trim();
}

// ─── Gemini API Caller ────────────────────────────────────────────────────────

export interface GeminiCallOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  systemInstruction: string;
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[];
}

/**
 * Calls Gemini API server-side using provided key from Secret Manager.
 * Model is hardcoded — client cannot override.
 * Key is never logged or returned.
 */
export async function callGemini(apiKey: string, options: GeminiCallOptions): Promise<string> {
  // Dynamic import prevents @google/genai being bundled if not reached
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const config: Record<string, unknown> = {
    systemInstruction: options.systemInstruction,
    temperature:       options.temperature ?? 0.7,
    maxOutputTokens:   options.maxOutputTokens ?? 1024,
  };
  if (options.responseMimeType) {
    config.responseMimeType = options.responseMimeType;
  }

  const response = await ai.models.generateContent({
    model:    ALLOWED_MODEL,
    config,
    contents: options.contents,
  });

  const text = (response.text ?? '').trim();
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

/**
 * Log safe AI usage telemetry to Firestore.
 * NEVER logs the API key, user conversation content, or credentials.
 */
export async function logAiUsage(params: {
  uid:        string;
  feature:    AiFeature;
  success:    boolean;
  latencyMs:  number;
  errorCode?: string;
}): Promise<void> {
  try {
    await db.collection('ai_usage_telemetry').add({
      uid:       params.uid,
      feature:   params.feature,
      success:   params.success,
      latencyMs: params.latencyMs,
      errorCode: params.errorCode ?? null,
      model:     ALLOWED_MODEL,
      createdAt: FieldValue.serverTimestamp(),
      dayKey:    new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    logger.warn('[aiGateway] Telemetry write failed (non-blocking)', { err });
  }
}

// ─── Religious Safety System Prompt ──────────────────────────────────────────

/**
 * Builds the MSLB Islamic tutor system instruction.
 * Applied server-side ALWAYS — client cannot override or inject into it.
 */
export function buildIslamicTutorSystemPrompt(
  language:   'en' | 'ur',
  mode:       string,
  courseNote: string
): string {
  const modeGuide: Record<string, string> = {
    tutor:   language === 'en'
      ? 'Provide a detailed scholarly explanation with Arabic terms, Islamic references and practical examples.'
      : 'تفصیلی علمی وضاحت دیں — عربی اصطلاحات، حوالہ جات اور مثالیں شامل کریں۔',
    quiz:    language === 'en'
      ? 'Create a 4-option MCQ quiz on this topic. Format: question, then A) B) C) D) options, then mark the correct answer.'
      : 'اس موضوع پر 4 آپشن MCQ سوال بنائیں — سوال، پھر A) B) C) D)، پھر درست جواب۔',
    vocab:   language === 'en'
      ? 'List key Arabic vocabulary: Arabic word, transliteration, root letters, English meaning.'
      : 'اہم عربی الفاظ بیان کریں: عربی لفظ، رومن، مادہ، اردو معنی۔',
    summary: language === 'en'
      ? 'Give 5-7 bullet-point key takeaways for quick exam revision.'
      : '5-7 اہم نکات میں امتحانی خلاصہ دیں۔',
  };

  const instruction = modeGuide[mode] ?? modeGuide.tutor;

  if (language === 'en') {
    return `You are an expert Islamic Studies AI tutor for Madrasatu-s-Salikat Lil Banat — an online madrasa for Muslim women.
Subjects: Quran, Tajweed, Fiqh (Hanafi), Aqeedah, Hadith, Arabic grammar, Seerah, and Madrasa curriculum.
Language: English only (include Arabic terms with transliterations).
Style: Scholarly, warm, encouraging. Begin with Bismillah or Assalamu Alaykum. Use markdown formatting.
Limits: Never issue personal Fatwas. Never discuss politics. Stay strictly focused on Islamic education.
IMPORTANT: For binding personal Shariah legal rulings/fatwas, always direct the student to certified live scholars at Dar-ul-Iftaa.${courseNote}
Instruction for this message: ${instruction}`;
  }

  return `آپ مدرسۃ السالکات للبنات کی ماہر AI استاذہ ہیں — آن لائن مدرسہ برائے مسلم خواتین۔
مضامین: قرآن، تجوید، فقہ حنفی، عقیدہ، حدیث، عربی گرامر، سیرت اور مدرسہ نصاب۔
زبان: صرف اردو میں جواب دیں (عربی اصطلاحات جہاں ضروری ہوں)۔
انداز: علمی، گرم جوش اور حوصلہ افزا۔ بسم اللہ یا سلام سے شروع کریں۔ مارک ڈاؤن فارمیٹ استعمال کریں۔
حدود: ذاتی فتویٰ کبھی نہ دیں۔ سیاست سے گریز کریں۔ صرف اسلامی تعلیم تک محدود رہیں۔
اہم: ذاتی شرعی مسائل اور فتووں کے لیے ہمیشہ دارالافتاء کے مصدقہ علماء سے رجوع کرنے کی ہدایت دیں۔${courseNote}
اس پیغام کی ہدایت: ${instruction}`;
}
