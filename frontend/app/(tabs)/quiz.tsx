/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { QUIZ_SESSION_TTL_MS, clearQuizSession, loadQuizSession, saveQuizSession } from '@/lib/lmsHardening';
import { FeedbackBanner, SkeletonCard } from '@/components/ui';
import { UIButton } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { trackSecurity } from '@/lib/securityMonitor';

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  category?: string;
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setAnswers({});
    setIndex(0);
    try {
      const snap = await getDocs(collection(db, 'quizzes'));
      const all: QuizQuestion[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data.question || !Array.isArray(data.options) || data.options.length < 2 || !data.correct_answer) return;
        all.push({
          id: d.id,
          question: data.question,
          options: data.options,
          correct_answer: data.correct_answer,
          category: data.category || '',
        });
      });
      if (all.length === 0) {
        setQuestions([]);
        setError('No quiz questions available yet. Admin can add questions.');
      } else {
        const shuffled = shuffle(all);
        setQuestions(shuffled);
        if (user?.uid) {
          const quizKey = String(shuffled.map((q) => q.id).join('-')).slice(0, 180);
          const prior = await loadQuizSession(user.uid, quizKey).catch(() => null);
          if (prior) {
            setAnswers(prior.answers || {});
            const idx = Math.max(0, shuffled.findIndex((q) => !prior.answers?.[q.id]));
            setIndex(idx === -1 ? 0 : idx);
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load quiz.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadQuiz().catch(() => {});
  }, [loadQuiz]);

  useFocusEffect(useCallback(() => {
    loadQuiz().catch(() => {});
  }, [loadQuiz]));

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const picked = current ? answers[current.id] : '';

  const scoreBreakdown = useMemo(() => questions.map((q) => ({
    id: q.id,
    question: q.question,
    selected: answers[q.id] || '',
    correct: q.correct_answer,
    ok: (answers[q.id] || '') === q.correct_answer,
  })), [questions, answers]);

  const submitQuiz = async () => {
    if (!user?.uid) return;
    if (sessionExpired) {
      setError('Quiz session expired. Please restart attempt.');
      trackSecurity('quiz_session_expired_submit', { uid: user.uid });
      return;
    }
    if (questions.some((q) => !answers[q.id])) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const score = questions.reduce((sum, q) => (answers[q.id] === q.correct_answer ? sum + 1 : sum), 0);
      await addDoc(collection(db, 'quiz_results'), {
        user_id: user.uid,
        score,
        total_questions: questions.length,
        created_at: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        title: 'Quiz Submitted',
        message: `You scored ${score}/${questions.length} in Quiz.`,
        user_id: user.uid,
        created_at: serverTimestamp(),
      });
      setResult({ score, total: questions.length });
      const quizKey = String(questions.map((q) => q.id).join('-')).slice(0, 180);
      await clearQuizSession(user.uid, quizKey).catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveQuestion = async () => {
    if (!isAdmin) return;
    const normalized = optionInputs.map((o) => o.trim()).filter(Boolean);
    if (!questionInput.trim() || normalized.length < 2 || !correctAnswer.trim()) {
      setError('Question, at least 2 options, and correct answer are required.');
      return;
    }
    if (!normalized.includes(correctAnswer.trim())) {
      setError('Correct answer must exactly match one of the answer options.');
      return;
    }
    setSavingQuestion(true);
    try {
      const payload = {
        question: questionInput.trim(),
        options: optionInputs.map((o) => o.trim()).filter(Boolean),
        correct_answer: correctAnswer.trim(),
        category: category.trim(),
        updated_at: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'quizzes', editingId), payload);
      } else {
        await addDoc(collection(db, 'quizzes'), { ...payload, created_at: serverTimestamp() });
      }
      setEditingId('');
      setQuestionInput('');
      setOptionInputs(['', '', '', '']);
      setCorrectAnswer('');
      setCategory('');
      await loadQuiz();
    } catch (e: any) {
      setError(e?.message || 'Failed to save question.');
    } finally {
      setSavingQuestion(false);
    }
  };

  const editQuestion = (q: QuizQuestion) => {
    setEditingId(q.id);
    setQuestionInput(q.question);
    const opts = [...q.options, '', '', '', ''].slice(0, 4);
    setOptionInputs(opts);
    setCorrectAnswer(q.correct_answer);
    setCategory(q.category || '');
  };

  const removeQuestion = async (id: string) => {
    if (!isAdmin || !id) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      await loadQuiz();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete question.');
    }
  };


  useEffect(() => {
    if (!user?.uid || questions.length === 0 || result) return;
    const quizKey = String(questions.map((q) => q.id).join('-')).slice(0, 180);
    saveQuizSession(user.uid, {
      quiz_key: quizKey,
      started_at_ms: Date.now(),
      expires_at_ms: Date.now() + QUIZ_SESSION_TTL_MS,
      answers,
      question_order: questions.map((q) => q.id),
      submitted: false,
    }).catch(() => {});
  }, [answers, questions, user?.uid, result]);

  useEffect(() => {
    if (loading || result || questions.length === 0) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > QUIZ_SESSION_TTL_MS) {
        setSessionExpired(true);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, result, questions.length]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>Quiz</Text>
            <Text style={styles.subtitle}>Attempt with available questions</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadQuiz} disabled={loading} accessibilityRole="button" accessibilityLabel="Refresh quiz">
            {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.refreshText}>Refresh</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {isAdmin ? (
        <SectionCard style={styles.adminCard}>
          <Text style={styles.adminTitle}>{editingId ? 'Edit Quiz Question' : 'Add Quiz Question'}</Text>
          <Text style={styles.inputLabel}>Question</Text>
          <TextInput style={styles.input} value={questionInput} onChangeText={setQuestionInput} placeholder="Enter the quiz question" placeholderTextColor={COLORS.textMuted} />
          <Text style={styles.inputLabel}>Answer Options</Text>
          {optionInputs.map((option, i) => (
            <TextInput
              key={String(i)}
              style={styles.input}
              value={option}
              onChangeText={(text) => setOptionInputs((prev) => prev.map((item, idx) => (idx === i ? text : item)))}
              placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ' (optional)'}`}
              placeholderTextColor={COLORS.textMuted}
            />
          ))}
          <Text style={styles.inputLabel}>Correct Answer</Text>
          <TextInput style={styles.input} value={correctAnswer} onChangeText={setCorrectAnswer} placeholder="Type the correct answer exactly as one option" placeholderTextColor={COLORS.textMuted} />
          <Text style={styles.inputLabel}>Category</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Category (optional)" placeholderTextColor={COLORS.textMuted} />
          <UIButton label={editingId ? 'Update Question' : 'Add Question'} onPress={saveQuestion} loading={savingQuestion} accessibilityLabel="Save quiz question" />
          {editingId ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setEditingId(''); setQuestionInput(''); setOptionInputs(['', '', '', '']); setCorrectAnswer(''); setCategory(''); }}>
              <Text style={styles.secondaryBtnText}>Cancel Edit</Text>
            </TouchableOpacity>
          ) : null}
        </SectionCard>
      ) : null}

      {isAdmin && questions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminQuestionList}>
          {questions.map((q) => (
            <View key={q.id} style={styles.adminQuestionChip}>
              <Text style={styles.adminQuestionText} numberOfLines={2}>{q.question}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.compactBtn} onPress={() => editQuestion(q)}>
                  <Text style={styles.compactBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.compactBtn, styles.compactDeleteBtn]} onPress={() => removeQuestion(q.id)}>
                  <Text style={[styles.compactBtnText, { color: COLORS.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {error ? (<View style={styles.feedbackWrap}><FeedbackBanner type="error" message={error} /></View>) : null}

      {loading ? (
        <View style={styles.center}>
          <SkeletonCard lines={3} />
          <View style={{ height: 12 }} />
          <SkeletonCard lines={2} />
        </View>
      ) : error && questions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={loadQuiz}><Text style={styles.btnText}>Retry</Text></TouchableOpacity>
        </View>
      ) : result ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Your Score</Text>
            <Text style={styles.resultScore}>{result.score}/{result.total}</Text>
          </View>
          {scoreBreakdown.map((item, i) => (
            <View key={item.id} style={styles.answerCard}>
              <Text style={styles.answerQ}>{i + 1}. {item.question}</Text>
              <Text style={[styles.answerLine, !item.ok && { color: COLORS.error }]}>Your answer: {item.selected || 'Not answered'}</Text>
              {!item.ok ? <Text style={styles.answerLine}>Correct: {item.correct}</Text> : null}
              {isAdmin ? (
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => {
                      const q = questions.find((question) => question.id === item.id);
                      if (!q) return;
                      editQuestion(q);
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => removeQuestion(item.id)}>
                    <Text style={styles.secondaryBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}
          <TouchableOpacity style={styles.btn} onPress={loadQuiz}><Text style={styles.btnText}>Try New Random Quiz</Text></TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.body}>
          <Text style={styles.progress}>Question {index + 1} / {questions.length}</Text>
          <View style={styles.questionCard}>
            <Text style={styles.question}>{current?.question}</Text>
            {current?.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionBtn, picked === opt && styles.optionBtnActive]}
                onPress={() => setAnswers((p) => ({ ...p, [current.id]: opt }))}
              >
                <Text style={[styles.optionText, picked === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.secondaryBtn, index === 0 && { opacity: 0.4 }]}
              onPress={() => setIndex((v) => Math.max(v - 1, 0))}
              disabled={index === 0}
            >
              <Text style={styles.secondaryBtnText}>Previous</Text>
            </TouchableOpacity>
            {!isLast ? (
              <TouchableOpacity style={styles.btn} onPress={() => setIndex((v) => Math.min(v + 1, questions.length - 1))}>
                <Text style={styles.btnText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.7 }]} onPress={submitQuiz} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Submit Quiz</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  refreshBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surfaceAlt },
  refreshText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted },
  body: { padding: SPACING.md, gap: 10 },
  adminCard: { margin: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 8, ...SHADOWS.card },
  adminTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  inputLabel: { color: COLORS.textMain, fontSize: 12, fontWeight: '700', marginTop: 4 },
  adminQuestionList: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: 8 },
  adminQuestionChip: { width: 220, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, gap: 8 },
  adminQuestionText: { color: COLORS.textMain, fontWeight: '700', fontSize: 12 },
  compactBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center', paddingVertical: 7, backgroundColor: COLORS.surfaceAlt },
  compactDeleteBtn: { borderColor: '#F2B8B5', backgroundColor: '#FDECEC' },
  compactBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 9, color: COLORS.textMain, backgroundColor: COLORS.surfaceAlt, textAlign: 'left' },
  progress: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  questionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card, gap: 10 },
  question: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  optionBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: COLORS.surfaceAlt },
  optionBtnActive: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },
  optionText: { color: COLORS.textMain, fontSize: 14 },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: COLORS.surface },
  secondaryBtnText: { color: COLORS.textMain, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 10 },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  errorText: { color: COLORS.error, fontSize: 12, textAlign: 'center' },
  resultCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, alignItems: 'center', ...SHADOWS.card },
  resultTitle: { color: COLORS.textMuted, fontWeight: '600' },
  resultScore: { fontSize: 28, color: COLORS.primary, fontWeight: '800' },
  answerCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm, gap: 4 },
  answerQ: { color: COLORS.textMain, fontWeight: '700' },
  answerLine: { color: COLORS.textMuted, fontSize: 12 },
  scrollContent: { padding: SPACING.md, gap: 10, paddingBottom: 24 },
});
