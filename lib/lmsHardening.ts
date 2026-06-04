import AsyncStorage from '@react-native-async-storage/async-storage';

export type QuizSessionState = {
  quiz_key: string;
  started_at_ms: number;
  expires_at_ms: number;
  answers: Record<string, string>;
  question_order: string[];
  submitted: boolean;
};

export const QUIZ_SESSION_TTL_MS = 25 * 60 * 1000;

function keyForQuiz(uid: string, quizKey: string) {
  return `quiz_session_${uid}_${quizKey}`;
}

export async function saveQuizSession(uid: string, state: QuizSessionState): Promise<void> {
  await AsyncStorage.setItem(keyForQuiz(uid, state.quiz_key), JSON.stringify(state));
}

export async function loadQuizSession(uid: string, quizKey: string): Promise<QuizSessionState | null> {
  const raw = await AsyncStorage.getItem(keyForQuiz(uid, quizKey));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as QuizSessionState;
  if (!parsed || Date.now() > Number(parsed.expires_at_ms || 0) || parsed.submitted) {
    await AsyncStorage.removeItem(keyForQuiz(uid, quizKey));
    return null;
  }
  return parsed;
}

export async function clearQuizSession(uid: string, quizKey: string): Promise<void> {
  await AsyncStorage.removeItem(keyForQuiz(uid, quizKey));
}

export type AssignmentDraft = {
  assignment_id: string;
  text: string;
  external_file_url: string;
  updated_at_ms: number;
};

function keyForAssignmentDraft(uid: string, assignmentId: string) {
  return `assignment_draft_${uid}_${assignmentId}`;
}

export async function saveAssignmentDraft(uid: string, draft: AssignmentDraft): Promise<void> {
  await AsyncStorage.setItem(keyForAssignmentDraft(uid, draft.assignment_id), JSON.stringify(draft));
}

export async function loadAssignmentDraft(uid: string, assignmentId: string): Promise<AssignmentDraft | null> {
  const raw = await AsyncStorage.getItem(keyForAssignmentDraft(uid, assignmentId));
  if (!raw) return null;
  return JSON.parse(raw) as AssignmentDraft;
}

export async function clearAssignmentDraft(uid: string, assignmentId: string): Promise<void> {
  await AsyncStorage.removeItem(keyForAssignmentDraft(uid, assignmentId));
}
