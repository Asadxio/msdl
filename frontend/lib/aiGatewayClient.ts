/**
 * MSLB AI Gateway Client
 *
 * Thin client wrappers around Firebase Callable Functions for all AI features.
 * REPLACES direct Gemini API calls from the client/APK.
 *
 * SECURITY:
 *   - No API key stored or referenced here.
 *   - All Gemini calls happen server-side via askAITutor / generateAIFlashcards / generateAIQuiz.
 *   - Firebase Auth is automatically attached by httpsCallable (uses current user token).
 *   - Errors from server are propagated with safe user-facing messages.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { TutorLanguage, TutorMode, ChatMessage } from '@/lib/aiAssistant';

// ─── Types (matching server callable contracts) ───────────────────────────────

export interface AskAITutorRequest {
  question:     string;
  history?:     { sender: 'user' | 'assistant'; text: string }[];
  language?:    TutorLanguage;
  mode?:        TutorMode;
  lessonTitle?: string;
  courseTitle?: string;
}

export interface AskAITutorResponse {
  text:     string;
  mode:     TutorMode;
  language: TutorLanguage;
}

export interface GenerateFlashcardsRequest {
  topic: string;
  count: number;
}

export interface GenerateFlashcardsResponse {
  cards: {
    id:              string;
    category:        string;
    categoryTitle:   string;
    topic:           string;
    frontText:       string;
    frontSubtitle:   string;
    backTranslation: string;
    backEnglish:     string;
    backRoman:       string;
    backExplanation: string;
    reference:       string;
  }[];
}

export interface GenerateQuizRequest {
  category:    string;
  count:       number;
  difficulty:  'easy' | 'medium' | 'hard';
  language:    'english' | 'urdu' | 'both';
  customTopic?: string;
}

export interface GenerateQuizResponse {
  questions: {
    id:             string;
    question:       string;
    options:        string[];
    correct_answer: string;
    category:       string;
    explanation:    string;
    difficulty?:    string;
    language?:      string;
  }[];
}

// ─── Error translator ─────────────────────────────────────────────────────────

/**
 * Map Firebase Functions error codes to user-safe messages.
 * Never exposes internal details.
 */
function translateAiError(err: unknown, feature: string): Error {
  const code = (err as any)?.code ?? '';
  const rawMsg = (err as any)?.message ?? '';

  if (code === 'functions/unauthenticated') {
    return new Error('Please log in to use AI features.');
  }
  if (code === 'functions/permission-denied') {
    return new Error('You do not have permission to use this AI feature.');
  }
  if (code === 'functions/resource-exhausted') {
    // Server sends a safe user-facing message
    return new Error(rawMsg || 'AI request limit reached. Please try again later.');
  }
  if (code === 'functions/invalid-argument') {
    return new Error(rawMsg || 'Invalid request. Please check your input.');
  }
  if (code === 'functions/internal') {
    return new Error('AI service temporarily unavailable. Please try again.');
  }
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    return new Error('AI service is busy. Please try again in a moment.');
  }

  console.warn(`[aiGatewayClient] ${feature} error`, { code, msg: rawMsg });
  return new Error('AI service error. Please try again.');
}

// ─── Callable Wrappers ────────────────────────────────────────────────────────

/**
 * Call the server-side askAITutor Firebase Function.
 * Replaces _callGeminiAiTutor() in aiAssistant.ts.
 */
export async function callAskAITutor(request: AskAITutorRequest): Promise<AskAITutorResponse> {
  try {
    const fn = httpsCallable<AskAITutorRequest, AskAITutorResponse>(functions, 'askAITutor');
    const result = await fn(request);
    return result.data;
  } catch (err) {
    throw translateAiError(err, 'askAITutor');
  }
}

/**
 * Call the server-side generateAIFlashcards Firebase Function.
 * Replaces _generateFlashcardsViaGemini() in aiFlashcardGenerator.ts.
 */
export async function callGenerateAIFlashcards(
  request: GenerateFlashcardsRequest
): Promise<GenerateFlashcardsResponse> {
  try {
    const fn = httpsCallable<GenerateFlashcardsRequest, GenerateFlashcardsResponse>(
      functions,
      'generateAIFlashcards'
    );
    const result = await fn(request);
    return result.data;
  } catch (err) {
    throw translateAiError(err, 'generateAIFlashcards');
  }
}

/**
 * Call the server-side generateAIQuiz Firebase Function.
 * Replaces _generateQuizViaGemini() in aiQuizGenerator.ts.
 */
export async function callGenerateAIQuiz(
  request: GenerateQuizRequest
): Promise<GenerateQuizResponse> {
  try {
    const fn = httpsCallable<GenerateQuizRequest, GenerateQuizResponse>(
      functions,
      'generateAIQuiz'
    );
    const result = await fn(request);
    return result.data;
  } catch (err) {
    throw translateAiError(err, 'generateAIQuiz');
  }
}
