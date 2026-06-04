import { requestAI } from '@/lib/ai/requestManager';

export async function generateLessonSummary(title: string, content: string) {
  return requestAI('lms_summary', { title, content }, { summary: 'Summary unavailable right now. Please try again later.' });
}

export async function generateQuizExplanation(question: string, answer: string) {
  return requestAI('quiz_explain', { question, answer }, { explanation: 'Explanation unavailable right now.' });
}
