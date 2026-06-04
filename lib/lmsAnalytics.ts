import { trackEvent } from '@/lib/analytics';

export function trackQuizSubmit(quizId: string, score: number, totalQuestions: number) {
  trackEvent('lms_quiz_submit', { quiz_id: quizId, score, total_questions: totalQuestions }, `quiz:${quizId}:${score}:${totalQuestions}`);
}

export function trackCourseProgress(courseId: string, progressPct: number) {
  trackEvent('custom', { metric: 'course_progress', course_id: courseId, progress_pct: progressPct }, `course:${courseId}:${Math.floor(progressPct)}`);
}
