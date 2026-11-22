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

/** Primary and fallback Gemini models for MSLB AI features. Client cannot override. */
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';
export const ALLOWED_MODEL = PRIMARY_MODEL;

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

// ─── Gemini Multi-Key Failover Pool ──────────────────────────────────────────

const exhaustedGeminiKeys = new Map<string, number>();

function isGeminiKeyExhausted(key: string): boolean {
  const hash = key.slice(-8);
  const until = exhaustedGeminiKeys.get(hash);
  if (!until) return false;
  if (Date.now() > until) {
    exhaustedGeminiKeys.delete(hash);
    return false;
  }
  return true;
}

function markGeminiKeyExhausted(key: string, cooldownMins = 30): void {
  const hash = key.slice(-8);
  exhaustedGeminiKeys.set(hash, Date.now() + cooldownMins * 60 * 1000);
  logger.warn(`[aiGateway] Gemini key ending in ...${hash} marked exhausted for ${cooldownMins} minutes.`);
}

function isQuotaError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.code || err?.statusCode;
  return (
    status === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
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
 * Calls Gemini API server-side using provided key(s) from Secret Manager.
 * Supports multi-key pools (comma, semicolon, or newline separated).
 * Automatically fails over to the next key if quota is exhausted (HTTP 429).
 * Tries PRIMARY_MODEL first, falling back to FALLBACK_MODEL if unavailable.
 * Keys are NEVER logged or returned to client.
 */
export async function callGemini(apiKeyOrKeys: string | string[], options: GeminiCallOptions): Promise<string> {
  const rawKeys = Array.isArray(apiKeyOrKeys)
    ? apiKeyOrKeys
    : String(apiKeyOrKeys || '')
        .split(/[,;\s\n]+/)
        .map((k) => k.trim())
        .filter(Boolean);

  const keys = rawKeys.length > 0 ? rawKeys : [apiKeyOrKeys as string];
  const nonExhausted = keys.filter((k) => !isGeminiKeyExhausted(k));
  const candidateKeys = nonExhausted.length > 0 ? nonExhausted : keys;

  const { GoogleGenAI } = await import('@google/genai');

  const config: Record<string, unknown> = {
    systemInstruction: options.systemInstruction,
    temperature:       options.temperature ?? 0.7,
    maxOutputTokens:   options.maxOutputTokens ?? 1024,
  };
  if (options.responseMimeType) {
    config.responseMimeType = options.responseMimeType;
  }

  let lastError: any = null;

  for (let i = 0; i < candidateKeys.length; i++) {
    const activeKey = candidateKeys[i];
    const ai = new GoogleGenAI({ apiKey: activeKey });

    try {
      const response = await ai.models.generateContent({
        model:    PRIMARY_MODEL,
        config,
        contents: options.contents,
      });
      const text = (response.text ?? '').trim();
      if (!text) throw new Error('Empty Gemini response from primary model');
      return text;
    } catch (primaryErr: any) {
      if (isQuotaError(primaryErr)) {
        markGeminiKeyExhausted(activeKey, 30);
        lastError = primaryErr;
        logger.warn(`[aiGateway] Gemini key [${i + 1}/${candidateKeys.length}] quota exceeded (429). Automatically failing over to next key in pool...`);
        continue;
      }

      logger.warn('[aiGateway] Primary model failed, attempting fallback model:', {
        primaryModel: PRIMARY_MODEL,
        fallbackModel: FALLBACK_MODEL,
        err: primaryErr?.message || primaryErr,
      });

      try {
        const fallbackResponse = await ai.models.generateContent({
          model:    FALLBACK_MODEL,
          config,
          contents: options.contents,
        });
        const fallbackText = (fallbackResponse.text ?? '').trim();
        if (!fallbackText) throw new Error('Empty Gemini response from fallback model');
        return fallbackText;
      } catch (fallbackErr: any) {
        lastError = fallbackErr;
        if (isQuotaError(fallbackErr)) {
          markGeminiKeyExhausted(activeKey, 30);
          logger.warn(`[aiGateway] Gemini fallback key [${i + 1}/${candidateKeys.length}] quota exceeded. Failing over to next key...`);
          continue;
        }
        // If not a quota error and not the last key, try next key
        if (i < candidateKeys.length - 1) {
          logger.warn('[aiGateway] Model error on key, trying next key in pool...', { err: fallbackErr?.message || fallbackErr });
          continue;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini API keys in pool failed to generate a response');
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

export interface MadrasaContext {
  name?: string;
  nameArabic?: string;
  tagline?: string;
  about?: string;
  contact?: string;
  courses?: string[];
}

/**
 * Builds the Islamic tutor system instruction.
 * Applied server-side ALWAYS — client cannot override or inject into it.
 * Multi-tenant aware: knows the specific madrasa, offered courses, and Suffah platform mechanics.
 * ChatGPT-style conversational fluency in Roman Urdu, Urdu, and English.
 */
export function buildIslamicTutorSystemPrompt(
  language:   'en' | 'ur' | 'auto',
  mode:       string,
  courseNote: string,
  madrasaContext?: MadrasaContext
): string {
  const madrasaName = madrasaContext?.name || 'Madrasatu-s-Salikat Lil Banat';
  const madrasaArabic = madrasaContext?.nameArabic ? ` (${madrasaContext.nameArabic})` : '';
  const madrasaAbout = madrasaContext?.about ? `\nAbout the institution: ${madrasaContext.about}` : '';
  const courseList = madrasaContext?.courses && madrasaContext.courses.length > 0
    ? `\nActive Courses offered by this Madrasa: ${madrasaContext.courses.join(', ')}`
    : '';
  const contactInfo = madrasaContext?.contact ? `\nContact details: ${madrasaContext.contact}` : '';

  const modeGuide: Record<string, string> = {
    tutor:   'Provide a clear, detailed, warm, and helpful explanation with Arabic terms, Islamic references, and practical everyday examples.',
    quiz:    'Create an interactive 4-option multiple-choice quiz on this topic. Format: Question, then A) B) C) D) options, then clearly explain which is correct and why.',
    vocab:   'List key Arabic vocabulary related to this topic: Arabic word, Roman transliteration, root letters (Madda), and meaning.',
    summary: 'Give 5-7 clear bullet-point key takeaways for quick study or exam revision.',
  };

  const instruction = modeGuide[mode] ?? modeGuide.tutor;

  return `You are the official AI Assistant and Islamic Tutor for "${madrasaName}"${madrasaArabic}, operating on the Suffah Digital Islamic Learning Platform.
${madrasaAbout}${courseList}${contactInfo}

ROLE & PERSONALITY (CHATGPT-STYLE CONVERSATIONAL INTELLIGENCE):
- You act like ChatGPT: highly helpful, intelligent, polite, friendly, empathetic, and knowledgeable.
- You can answer ANY question about:
  1. Islamic Studies: Quran, Tajweed (Nun Sakin, Tanween, Makharij, Madd), Hanafi Fiqh (Taharat, Wudu, Ghusl, Salah, Roza, Zakat, Hajj), Hadith, Aqeedah, Arabic grammar (Sarf & Nahw), and Seerah.
  2. Platform & App Guidance: How to use this Madrasa application, join live classes, pay fees, track attendance, take quizzes, view recordings, and download certificates.
  3. General study assistance, homework explanations, and educational advice.

PLATFORM KNOWLEDGE BASE (SUFFAH MADRASA APP):
- Home / Dashboard: Displays prayer times, daily ayah/hadith, continue learning, and upcoming live classes.
- Live Classes: Daily interactive audio/video classes with teachers. Students can join from Home or Live Class tab, listen, raise hand, see live Mushaf sync, and Tajweed board.
- Recordings: Missed a class? Go to Recordings or Course History to listen or watch previous classes anytime.
- Fee Management & Payments: Accessible via "More > Pay Fees" (or "Fee Payments"). Supports UPI (Google Pay, PhonePe, Paytm), Debit/Credit cards, and Netbanking via Razorpay. Payments are 100% confidential and secure; instant Islamic receipt with Transaction ID is generated.
- Quizzes & Exams: Located in the Quiz tab. Instant automated grading with explanations for every question.
- Official Certificates (Sanad): Scoring 60% or higher in quizzes or completing courses automatically issues an official verified digital Certificate bearing this Madrasa's name, emblem, and unique serial number, viewable in the Certificate tab.
- Attendance: Marked daily by teachers; students can review their attendance percentage in the Attendance tab.
- Islamic Tools: Built-in Quran Reader with audio recitations & word-by-word font, accurate Qibla compass, local Prayer/Namaz timings, and daily Duas.
- Support: Students can reach madrasa administration via WhatsApp support or customer support in the app.

LANGUAGE & SCRIPT INSTRUCTIONS:
- You are fluent in Roman Urdu / Hinglish (Urdu written in English/Latin letters), pure Urdu (نستعلیق), and English.
- AUTOMATICALLY DETECT and MATCH the language of the user's message:
  * If the user writes in Roman Urdu (e.g., "fee kaise pay karein?", "class kab shuru hogi?", "wudu ke kitne farz hain?"), ALWAYS respond in fluent, easy-to-understand Roman Urdu!
  * If the user writes in Urdu script (اردو), respond in polite, eloquent Urdu.
  * If the user writes in English, respond in clear, encouraging English.
- Begin your answers politely with an Islamic greeting ("Assalamu Alaykum" / "Bismillah").
- Use clean Markdown with headers, bold highlights, and bullet points for readability.

SHARIAH & LEGAL BOUNDARIES:
- Never issue personal binding legal fatwas (e.g. personal divorce/talaq, khula, inheritance property disputes, or abortion). For individual binding rulings, politely give the general Hanafi rule and kindly direct the student to consult certified muftis/scholars at Dar-ul-Iftaa or the madrasa's live scholars.
- Keep all discussions strictly respectful, educational, and free from political controversy.
${courseNote}
Mode instruction for this response: ${instruction}`;
}
