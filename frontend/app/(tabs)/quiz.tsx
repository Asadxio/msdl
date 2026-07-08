/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, deleteDoc, doc, getDocs, getCountFromServer, query, serverTimestamp, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { QUIZ_SESSION_TTL_MS, clearQuizSession, loadQuizSession, saveQuizSession } from '@/lib/lmsHardening';
import { FeedbackBanner, SkeletonCard } from '@/components/ui';
import { UIButton } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { trackSecurity } from '@/lib/securityMonitor';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { QUIZ_CATEGORIES } from '@/constants/quizCategories';

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
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  
  // App State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Quiz State
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const submissionLockRef = useRef(false);
  const currentAttemptIdRef = useRef<string | null>(null);

  // Admin State
  const [editingId, setEditingId] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Load category counts on mount
  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      setLoadingCounts(true);
      const counts: Record<string, number> = {};
      
      const batchSize = 10;
      for (let i = 0; i < QUIZ_CATEGORIES.length; i += batchSize) {
        const chunk = QUIZ_CATEGORIES.slice(i, i + batchSize);
        await Promise.all(chunk.map(async (cat) => {
          try {
            const q = query(collection(db, 'quizzes'), where('category', '==', cat));
            const snap = await getCountFromServer(q);
            counts[cat] = snap.data().count;
          } catch (e) {
            console.log(`Failed to fetch count for ${cat}`);
            counts[cat] = 0;
          }
        }));
      }
      if (mounted) {
        setCategoryCounts(counts);
        setLoadingCounts(false);
      }
    };
    fetchCounts();
    return () => { mounted = false; };
  }, []);

  const loadQuiz = useCallback(async (category: string) => {
    setLoading(true);
    setError('');
    setResult(null);
    setAnswers({});
    setIndex(0);
    setSessionExpired(false);
    
    try {
      const q = query(collection(db, 'quizzes'), where('category', '==', category));
      const snap = await getDocs(q);
      
      const all: QuizQuestion[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const question = data.question;
        const options = Array.isArray(data.options) 
          ? data.options 
          : [data.option1, data.option2, data.option3, data.option4].filter(Boolean);
        const correct_answer = data.correct_answer || data.correctAnswer;
        
        if (question && Array.isArray(options) && options.length >= 2 && correct_answer) {
          all.push({
            id: d.id,
            question,
            options,
            correct_answer,
            category: data.category || '',
          });
        }
      });
      
      if (all.length === 0) {
        setQuestions([]);
        setError(`No quiz questions available for ${category}.`);
      } else {
        const shuffled = shuffle(all);
        setQuestions(shuffled);
        
        if (user?.uid) {
          const quizKey = String(shuffled.map((q) => q.id).join('-')).slice(0, 180);
          const prior = await loadQuizSession(user.uid, quizKey).catch(() => null);
          if (prior && !prior.submitted) {
            setAnswers(prior.answers || {});
            const idx = Math.max(0, shuffled.findIndex((q) => !prior.answers?.[q.id]));
            setIndex(idx === -1 ? 0 : idx);
          }
        }
      }
    } catch (e: any) {
      logFirestoreFailure({ collection: 'quizzes', operation: 'get', query: `get quizzes where category=${category}`, role: profile?.role, status: profile?.status }, e);
      setError(e?.message || 'Failed to load quiz.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, profile]);

  const selectCategory = (cat: string) => {
    submissionLockRef.current = false;
    currentAttemptIdRef.current = null;
    setSelectedCategory(cat);
    loadQuiz(cat);
  };

  const quitQuiz = () => {
    submissionLockRef.current = false;
    currentAttemptIdRef.current = null;
    setSelectedCategory(null);
    setQuestions([]);
    setResult(null);
    setError('');
    setAnswers({});
  };

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
    console.info('[QuizSubmission] 1. Button pressed - starting submitQuiz pipeline');
    if (!user?.uid || submitting || submissionLockRef.current || Boolean(result)) {
      console.info('[QuizSubmission] Early return: busy or already submitted');
      return;
    }
    if (sessionExpired) {
      console.warn('[QuizSubmission] Validation failure: Quiz session expired');
      setError('Quiz session expired. Please restart attempt.');
      trackSecurity('quiz_session_expired_submit', { uid: user.uid });
      return;
    }
    if (questions.some((q) => !answers[q.id])) {
      console.warn('[QuizSubmission] Validation failure: Unanswered questions');
      setError('Please answer all questions before submitting.');
      return;
    }
    console.info('[QuizSubmission] 2. Validation passed - all questions answered');
    setError('');
    setSubmitting(true);
    submissionLockRef.current = true;

    // Generate deterministic attempt ID once for this attempt so retries never duplicate
    if (!currentAttemptIdRef.current) {
      const randSuffix = Math.random().toString(36).substring(2, 10);
      currentAttemptIdRef.current = `${user.uid}_${Date.now()}_${randSuffix}`;
    }
    const attemptDocId = currentAttemptIdRef.current;

    try {
      const score = questions.reduce((sum, q) => (answers[q.id] === q.correct_answer ? sum + 1 : sum), 0);
      console.info(`[QuizSubmission] 3. Score calculation complete: ${score}/${questions.length}`);
      
      const cleanCat = selectedCategory && typeof selectedCategory === 'string' && selectedCategory.trim().length > 0
        ? selectedCategory.trim().slice(0, 100)
        : 'Uncategorized';

      const payload = {
        user_id: user.uid,
        score,
        total_questions: questions.length,
        category: cleanCat,
        created_at: Timestamp.now(),
      };
      console.info('[QuizSubmission] 4. Payload creation complete:', { user_id: user.uid, score, total_questions: questions.length, category: cleanCat, attemptDocId });

      const docRef = doc(collection(db, 'quiz_results'), attemptDocId);

      // Save with exponential backoff retry logic (up to 3 attempts, 30s timeout per attempt)
      let lastErr: any = null;
      console.info('[QuizSubmission] 5. API/Firestore request start - writing to quiz_results collection');
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await Promise.race([
            setDoc(docRef, payload, { merge: true }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 30000))
          ]);
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[QuizSubmission] Attempt ${attempt} failed:`, err?.message);
          if (attempt === 3) break;
          const delayMs = Math.min(1500 * Math.pow(2, attempt - 1), 6000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      if (lastErr) throw lastErr;

      console.info('[QuizSubmission] 6. API/Firestore request success - quiz result saved');
      setResult({ score, total: questions.length });

      // Secondary cleanups (session clear) should never discard or fail the saved result
      const quizKey = String(questions.map((q) => q.id).join('-')).slice(0, 180);
      await clearQuizSession(user.uid, quizKey).catch(() => {});
    } catch (e: any) {
      console.error('[QuizSubmission] 7. API/Firestore request failure:', e);
      logFirestoreFailure({ collection: 'quiz_results', operation: 'set', query: 'save quiz result with backoff retry', role: profile?.role, status: profile?.status }, e);
      const code = String(e?.code || '');
      const msg = String(e?.message || '');
      
      let displayMsg = 'An unknown error occurred while saving quiz results. Please try again.';
      let isNetworkError = false;

      if (msg === 'TIMEOUT_ERROR' || msg.toLowerCase().includes('timeout')) {
        displayMsg = 'Request timed out while saving quiz results. Please try again.';
        isNetworkError = true;
        console.warn('[QuizSubmission] Timeout Error:', msg);
      } else if (code.includes('permission-denied') || msg.toLowerCase().includes('permission')) {
        displayMsg = 'Permission denied. You do not have permission to submit quiz results.';
        console.warn('[QuizSubmission] Permission Denied Error:', code, msg);
      } else if (code.includes('unavailable') || code.includes('network') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('offline') || msg.toLowerCase().includes('connection') || msg.toLowerCase().includes('failed to fetch')) {
        displayMsg = 'Network unavailable. Please check your internet connection.';
        isNetworkError = true;
        console.warn('[QuizSubmission] Network Unavailable Error:', code, msg);
      } else {
        displayMsg = msg || displayMsg;
        console.warn('[QuizSubmission] API/Firestore Error:', code, msg);
      }

      setError(displayMsg);

      if (isNetworkError) {
        // Unlock only for retry of the same deterministic attemptDocId
        submissionLockRef.current = false;
        Alert.alert(
          'Submission Failed',
          displayMsg,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => { void submitQuiz(); } }
          ]
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const saveQuestion = async () => {
    if (!isAdmin) return;
    const normalized = optionInputs.map((o) => o.trim()).filter(Boolean);
    const trimmedCategory = categoryInput.trim();

    // Validate required fields
    if (!questionInput.trim() || normalized.length < 2 || !correctAnswer.trim() || !trimmedCategory) {
      setError('Question, at least 2 options, correct answer, and category are required.');
      return;
    }

    // Ensure correct answer matches one of the options
    if (!normalized.includes(correctAnswer.trim())) {
      setError('Correct answer must exactly match one of the answer options.');
      return;
    }

    // Enforce max length 100 characters for category
    const cleanCategory = trimmedCategory.slice(0, 100);
    if (cleanCategory.length === 0) {
      setError('Category cannot be empty after trimming.');
      return;
    }

    const payload = {
      question: questionInput.trim(),
      options: normalized,
      correct_answer: correctAnswer.trim(),
      category: cleanCategory,
      created_at: serverTimestamp(),
    };

    setSavingQuestion(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'quizzes', editingId), payload);
      } else {
        await addDoc(collection(db, 'quizzes'), payload);
      }
      // Reset form state
      setEditingId('');
      setQuestionInput('');
      setOptionInputs(['', '', '', '']);
      setCorrectAnswer('');
      setCategoryInput('');
      // Refresh current category view
      if (selectedCategory) {
        await loadQuiz(selectedCategory);
      }
    } catch (e: any) {
      logFirestoreFailure({ collection: 'quizzes', operation: editingId ? 'update' : 'add', path: editingId ? `quizzes/${editingId}` : 'quizzes', query: editingId ? 'update quiz question' : 'create quiz question', role: profile?.role, status: profile?.status }, e);
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
    setCategoryInput(q.category || selectedCategory || '');
  };

  const removeQuestion = async (id: string) => {
    if (!isAdmin || !id) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      if (selectedCategory) await loadQuiz(selectedCategory);
    } catch (e: any) {
      logFirestoreFailure({ collection: 'quizzes', operation: 'delete', path: `quizzes/${id}`, query: 'delete quiz question', role: profile?.role, status: profile?.status }, e);
      setError(e?.message || 'Failed to delete question.');
    }
  };

  useEffect(() => {
    if (!user?.uid || questions.length === 0 || result || !selectedCategory) return;
    const quizKey = String(questions.map((q) => q.id).join('-')).slice(0, 180);
    saveQuizSession(user.uid, {
      quiz_key: quizKey,
      started_at_ms: Date.now(),
      expires_at_ms: Date.now() + QUIZ_SESSION_TTL_MS,
      answers,
      question_order: questions.map((q) => q.id),
      submitted: false,
    }).catch(() => {});
  }, [answers, questions, user?.uid, result, selectedCategory]);

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

  // CATEGORY LIST RENDERER
  if (!selectedCategory) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.title}>Quizzes</Text>
              <Text style={styles.subtitle}>Select a category to begin</Text>
            </View>
          </View>
        </View>

        {loadingCounts ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 10, color: COLORS.textMuted }}>Loading categories...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.categoryGrid}>
            {QUIZ_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0;
              return (
                <TouchableOpacity 
                  key={cat} 
                  style={styles.categoryCard} 
                  onPress={() => selectCategory(cat)}
                  disabled={count === 0 && !isAdmin}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryTitle}>{cat}</Text>
                  <Text style={styles.categoryCount}>
                    {count === 1 ? '1 Question' : `${count} Questions`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // QUIZ PLAYER RENDERER
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{selectedCategory}</Text>
            <Text style={styles.subtitle}>Quiz Session</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={quitQuiz} accessibilityRole="button">
            <Text style={styles.refreshText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isAdmin && !result ? (
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
          <TextInput style={styles.input} value={categoryInput || selectedCategory} onChangeText={setCategoryInput} placeholder="Category" placeholderTextColor={COLORS.textMuted} />
          <UIButton label={editingId ? 'Update Question' : 'Add Question'} onPress={saveQuestion} loading={savingQuestion} accessibilityLabel="Save quiz question" />
          {editingId ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setEditingId(''); setQuestionInput(''); setOptionInputs(['', '', '', '']); setCorrectAnswer(''); }}>
              <Text style={styles.secondaryBtnText}>Cancel Edit</Text>
            </TouchableOpacity>
          ) : null}
        </SectionCard>
      ) : null}

      {isAdmin && questions.length > 0 && !result ? (
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
          <TouchableOpacity style={styles.btn} onPress={() => loadQuiz(selectedCategory)}><Text style={styles.btnText}>Retry</Text></TouchableOpacity>
        </View>
      ) : result ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Your Score</Text>
            <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
            {(() => {
              const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
              const passed = pct >= 60;
              return (
                <>
                  <View style={[styles.resultBadge, passed ? styles.resultBadgePass : styles.resultBadgeFail]}>
                    <Text style={[styles.resultBadgeText, passed ? styles.resultBadgeTextPass : styles.resultBadgeTextFail]}>
                      {passed ? 'Passed' : 'Needs Practice'}
                    </Text>
                  </View>
                  <Text style={styles.resultPct}>{pct}% Correct</Text>
                  <Text style={styles.resultSummary}>
                    You got {result.score} correct and {result.total - result.score} wrong.
                  </Text>
                  <Text style={styles.resultMessage}>
                    {passed ? 'Great job! You have a solid understanding of this topic.' : 'Keep learning and try again. You can do this!'}
                  </Text>
                </>
              );
            })()}
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
          <TouchableOpacity style={styles.btn} onPress={quitQuiz}><Text style={styles.btnText}>Back to Categories</Text></TouchableOpacity>
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
                activeOpacity={0.7}
              >
                <View style={[styles.radioCircle, picked === opt && styles.radioCircleActive]}>
                  {picked === opt && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, picked === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!error && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.errorText}>{error}</Text>
              {(error.includes('try again') || error.includes('timed out') || error.includes('Network') || error.includes('connection')) && !submitting && (
                <TouchableOpacity
                  style={[styles.btn, { marginTop: 8, backgroundColor: COLORS.primary }]}
                  onPress={() => { void submitQuiz(); }}
                >
                  <Text style={styles.btnText}>Retry Submission</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
              <TouchableOpacity style={[styles.btn, (submitting || Boolean(result)) && { opacity: 0.7 }]} onPress={submitQuiz} disabled={submitting || Boolean(result)}>
                {submitting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.btnText}>Saving Quiz Results...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Submit Quiz</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  resultBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, marginBottom: 8 },
  resultBadgePass: { backgroundColor: '#E8F5EE' },
  resultBadgeFail: { backgroundColor: '#FDECEC' },
  resultBadgeText: { fontSize: 13, fontWeight: '800' },
  resultBadgeTextPass: { color: COLORS.primary },
  resultBadgeTextFail: { color: COLORS.error },
  resultPct: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  resultSummary: { fontSize: 14, color: COLORS.textMuted, marginBottom: 12 },
  resultMessage: { fontSize: 14, fontWeight: '600', color: COLORS.primary, textAlign: 'center', marginTop: 8 },

  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  refreshBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: COLORS.surfaceAlt },
  refreshText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  body: { padding: SPACING.md, gap: 10 },
  
  // Category Grid UI
  categoryGrid: { padding: SPACING.md, gap: 12 },
  categoryCard: { 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.xxl, 
    padding: SPACING.xl, 
    ...SHADOWS.card, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  categoryTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, flex: 1 },
  categoryCount: { fontSize: 13, fontWeight: '700', color: COLORS.primary, backgroundColor: '#E8F5EE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, overflow: 'hidden' },

  adminCard: { margin: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, gap: 8, ...SHADOWS.card },
  adminTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  inputLabel: { color: COLORS.textMain, fontSize: 12, fontWeight: '700', marginTop: 4 },
  adminQuestionList: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: 8 },
  adminQuestionChip: { width: 220, backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, gap: 8 },
  adminQuestionText: { color: COLORS.textMain, fontWeight: '700', fontSize: 12 },
  compactBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center', paddingVertical: 7, backgroundColor: COLORS.surfaceAlt },
  compactDeleteBtn: { borderColor: '#F2B8B5', backgroundColor: '#FDECEC' },
  compactBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },
  progress: { fontSize: 14, color: COLORS.primary, fontWeight: '800', marginBottom: 4 },
  questionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl, ...SHADOWS.card, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  question: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginBottom: 8, lineHeight: 26 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xxl, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.surface },
  optionBtnActive: { borderColor: COLORS.primary, backgroundColor: '#F4FAF6', borderWidth: 2 },
  optionText: { color: COLORS.textMain, fontSize: 15, flex: 1 },
  optionTextActive: { color: COLORS.primary, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  btnText: { color: COLORS.goldText, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  secondaryBtnText: { color: COLORS.textMain, fontWeight: '700', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 10 },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  errorText: { color: COLORS.error, fontSize: 12, textAlign: 'center' },
  resultCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, alignItems: 'center', ...SHADOWS.card },
  resultTitle: { color: COLORS.textMuted, fontWeight: '600' },
  resultScore: { fontSize: 42, color: COLORS.primary, fontWeight: '900', marginVertical: 8 },
  answerCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: 8, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  answerQ: { color: COLORS.textMain, fontWeight: '800', fontSize: 15, marginBottom: 4 },
  answerLine: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: SPACING.md, gap: 10, paddingBottom: 24 },
});
