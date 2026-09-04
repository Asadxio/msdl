/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getCountFromServer, query, serverTimestamp, setDoc, updateDoc, where, Timestamp, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { QUIZ_SESSION_TTL_MS, clearQuizSession, loadQuizSession, saveQuizSession, saveQuizCounts, loadQuizCounts } from '@/lib/lmsHardening';
import { FeedbackBanner, SkeletonCard } from '@/components/ui';
import { UIButton } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { trackSecurity } from '@/lib/securityMonitor';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { QUIZ_CATEGORIES } from '@/constants/quizCategories';
import { Ionicons } from '@expo/vector-icons';
import { IslamicCertificateModal } from '@/components/IslamicCertificateModal';
import { saveQuizCertificate, type QuizCertificateData } from '@/lib/quizCertificate';


type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  category?: string;
};

type ScoreBreakdownItem = {
  id: string;
  question: string;
  selected: string;
  correctAnswer?: string;
  explanation?: string;
  ok: boolean;
};

type QuizAttemptHistory = {
  id: string;
  category: string;
  score: number;
  total: number;
  percentage: number;
  createdAt: number;
};

const QUESTION_TIME_LIMIT = 30; // 30 seconds per question

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
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTeacher = profile?.role === 'teacher' || isAdmin;
  
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
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdownItem[]>([]);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [generatedCert, setGeneratedCert] = useState<QuizCertificateData | null>(null);
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [revisionFilter, setRevisionFilter] = useState<'all' | 'mistakes'>('all');
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [scoreHistory, setScoreHistory] = useState<QuizAttemptHistory[]>([]);
  const [isRetryingMistakes, setIsRetryingMistakes] = useState(false);
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

      // 1️⃣ Check AsyncStorage cache first — avoids any network call for 1 hour
      const cached = await loadQuizCounts();
      if (cached && mounted) {
        setCategoryCounts(cached);
        setLoadingCounts(false);
        return;
      }

      // 2️⃣ Cache miss — single Cloud Function call instead of 44 Firestore calls
      try {
        const getCountsFn = httpsCallable<Record<string, never>, { counts: Record<string, number>; fetchedAt: number }>(
          functions,
          'getQuizCategoryCounts'
        );
        const res = await getCountsFn({});
        const counts = res.data.counts ?? {};
        if (mounted) {
          setCategoryCounts(counts);
          // Save to AsyncStorage for next 1 hour
          await saveQuizCounts(counts).catch(() => {});
          setLoadingCounts(false);
        }
      } catch (e) {
        // Fallback: show categories without counts (better than 8-second loading)
        console.warn('[QuizScreen] getQuizCategoryCounts failed, using empty counts', e);
        const emptyCounts: Record<string, number> = {};
        QUIZ_CATEGORIES.forEach((cat) => { emptyCounts[cat] = 0; });
        if (mounted) {
          setCategoryCounts(emptyCounts);
          setLoadingCounts(false);
        }
      }
    };
    fetchCounts();
    return () => { mounted = false; };
  }, []);

  // Fetch recent quiz score history for performance trend chart
  useEffect(() => {
    if (!user?.uid) return;
    try {
      const q = query(
        collection(db, 'quiz_results'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc'),
        limit(7)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const results: QuizAttemptHistory[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const score = Number(data.score || 0);
          const total = Number(data.total || data.total_questions || 0);
          const pct = total > 0 ? Math.round((score / total) * 100) : 0;
          let createdMs = Date.now();
          if (data.created_at?.toMillis) {
            createdMs = data.created_at.toMillis();
          } else if (typeof data.created_at === 'number') {
            createdMs = data.created_at;
          }
          results.push({
            id: docSnap.id,
            category: String(data.category || 'General'),
            score,
            total,
            percentage: pct,
            createdAt: createdMs,
          });
        });
        setScoreHistory(results);
      }, (err) => {
        console.warn('[QuizScreen] score history fetch note:', err?.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('[QuizScreen] score history setup error:', err);
    }
  }, [user?.uid]);

  const loadQuiz = useCallback(async (category: string) => {
    setLoading(true);
    setError('');
    setResult(null);
    setAnswers({});
    setIndex(0);
    setTimeLeft(QUESTION_TIME_LIMIT);
    setIsRetryingMistakes(false);
    setSessionExpired(false);
    
    try {
      const getQuizQuestionsFn = httpsCallable(functions, 'getQuizQuestions');
      const res = await getQuizQuestionsFn({ category });
      const data = res.data as { questions: QuizQuestion[] };
      const all: QuizQuestion[] = data.questions;
      
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
    setTimeLeft(QUESTION_TIME_LIMIT);
    setIsRetryingMistakes(false);
  };

  // 3.2 Retry Only Wrong Answers Handler
  const retryMistakes = () => {
    if (!result || questions.length === 0) return;
    const wrongIds = new Set(scoreBreakdown.filter((item) => !item.ok).map((item) => item.id));
    const mistakeQuestions = questions.filter((q) => wrongIds.has(q.id));

    if (mistakeQuestions.length === 0) {
      Alert.alert('ماشاءاللہ', 'آپ کے تمام جوابات درست ہیں! دوبارہ مشق کرنے کے لیے کوئی غلط جواب نہیں ملا۔');
      return;
    }

    submissionLockRef.current = false;
    currentAttemptIdRef.current = null;
    setQuestions(mistakeQuestions);
    setAnswers({});
    setIndex(0);
    setResult(null);
    setScoreBreakdown([]);
    setError('');
    setTimeLeft(QUESTION_TIME_LIMIT);
    setIsRetryingMistakes(true);
  };

  // 3.4 WhatsApp Share Result Handler
  const shareQuizResultViaWhatsApp = () => {
    if (!result) return;
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const passed = pct >= 60;
    const studentName = profile?.name || user?.displayName || 'طالبہ';
    const categoryName = selectedCategory || 'دینی معلومات';

    const text = 
      `🎓 *مدرسۃ السالکات للبنات — کوئز رپورٹ*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 *طالبہ:* ${studentName}\n` +
      `📚 *موضوع:* ${categoryName}\n` +
      `📊 *حاصل کردہ نمبر:* ${result.score} / ${result.total} (${pct}%)\n` +
      `🎖️ *نتیجہ:* ${passed ? '✅ کامیاب (Passed)' : '🔄 مزید محنت کی ضرورت (Needs Practice)'}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✨ *علم نافع اور عمل صالح کی دعا کے ساتھ* ✨\n` +
      `📱 مدرسۃ السالکات آن لائن پورٹل`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `whatsapp://send?text=${encodedText}`;

    Linking.canOpenURL(whatsappUrl).then((supported) => {
      if (supported) {
        Linking.openURL(whatsappUrl);
      } else {
        const webUrl = `https://wa.me/?text=${encodedText}`;
        Linking.openURL(webUrl);
      }
    }).catch((err) => {
      Alert.alert('خطا', 'WhatsApp کھولنے میں مسئلہ پیش آیا۔');
    });
  };

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const picked = current ? answers[current.id] : '';



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
      const cleanCat = selectedCategory && typeof selectedCategory === 'string' && selectedCategory.trim().length > 0
        ? selectedCategory.trim().slice(0, 100)
        : 'Uncategorized';

      console.info('[QuizSubmission] 3. Payload creation complete:', { user_id: user.uid, category: cleanCat, attemptDocId });

      let lastErr: any = null;
      let submitResult: any = null;
      const submitQuizFn = httpsCallable(functions, 'submitQuiz');

      console.info('[QuizSubmission] 4. API request start - calling submitQuiz Cloud Function');
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          submitResult = await Promise.race([
            submitQuizFn({
              category: cleanCat,
              answers: answers,
              nonce: attemptDocId,
            }),
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

      const serverResult = submitResult.data as any;

      console.info('[QuizSubmission] 5. API request success - quiz result saved');
      setResult({ score: serverResult.score, total: serverResult.total });
      
      const serverBreakdown = serverResult.breakdown || [];
      setScoreBreakdown(
        questions.map((q) => {
          const breakdownItem = serverBreakdown.find((b: any) => b.id === q.id);
          return {
            id: q.id,
            question: q.question,
            selected: answers[q.id] || '',
            correctAnswer: breakdownItem?.correctAnswer || '',
            explanation: breakdownItem?.explanation || '',
            ok: breakdownItem ? Boolean(breakdownItem.wasCorrect) : false,
          };
        })
      );

      // Trigger Official Certificate generation if passed (>= 60%)
      const percentage = serverResult.total > 0 ? Math.round((serverResult.score / serverResult.total) * 100) : 0;
      if (percentage >= 60 && user?.uid) {
        saveQuizCertificate(
          user.uid,
          profile?.name || user.displayName || 'Student',
          selectedCategory || 'Islamic Assessment',
          serverResult.score,
          serverResult.total,
        ).then((cert) => {
          setGeneratedCert(cert);
          setCertModalVisible(true);
        }).catch((certErr) => {
          console.warn('[Quiz] Certificate generation notice:', certErr);
        });
      }

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

  const editQuestion = async (q: QuizQuestion) => {
    setEditingId(q.id);
    setQuestionInput(q.question);
    
    // For the correct answer, fetch the full document server-side
    // (admin has direct Firestore read access per security rules)
    // This is intentionally NOT done via getQuizQuestions (which strips answer keys for students)
    try {
      const fullDoc = await getDoc(doc(db, 'quizzes', q.id));
      if (fullDoc.exists()) {
        const data = fullDoc.data() as any;
        const correctAnswerValue = String(data.correctAnswer ?? data.correct_answer ?? '');
        setCorrectAnswer(correctAnswerValue);
      }
    } catch (e) {
      // Fallback: correct answer field will be empty — admin must re-enter it
      setCorrectAnswer('');
    }
    
    const opts = [...q.options, '', '', '', ''].slice(0, 4);
    setOptionInputs(opts);
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

  // 3.1 Per-question 30-second countdown timer
  useEffect(() => {
    if (loading || result || questions.length === 0 || !selectedCategory) return;
    
    // Reset timer on question change
    setTimeLeft(QUESTION_TIME_LIMIT);

    const qTimer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time expired for this question: auto-advance to next question if available
          setIndex((currIdx) => {
            if (currIdx < questions.length - 1) {
              return currIdx + 1;
            }
            return currIdx;
          });
          return QUESTION_TIME_LIMIT;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(qTimer);
  }, [loading, result, questions.length, index, selectedCategory]);

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
            {/* Teacher / Admin Action Banners */}
            {isTeacher && (
              <View style={{ gap: 8, marginBottom: 4 }}>
                <TouchableOpacity
                  style={styles.aiQuizMakerBanner}
                  onPress={() => router.push('/admin/ai-quiz-maker' as any)}
                  activeOpacity={0.88}
                >
                  <View style={styles.aiQuizMakerLeft}>
                    <View style={styles.aiQuizMakerIcon}>
                      <Ionicons name="sparkles" size={20} color="#C8A84E" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiQuizMakerTitle}>AI Auto-Quiz & Exam Maker</Text>
                      <Text style={styles.aiQuizMakerSubtitle}>Generate & publish new questions in 5 seconds</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C8A84E" />
                </TouchableOpacity>

                {isAdmin && (
                  <TouchableOpacity
                    style={[styles.aiQuizMakerBanner, { backgroundColor: '#00382B', borderColor: 'rgba(200,168,78,0.3)' }]}
                    onPress={() => router.push('/admin/manage-quizzes' as any)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.aiQuizMakerLeft}>
                      <View style={[styles.aiQuizMakerIcon, { backgroundColor: '#00251C' }]}>
                        <Ionicons name="list" size={20} color="#34D399" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.aiQuizMakerTitle, { color: '#FFFFFF' }]}>Manage Quiz Question Bank</Text>
                        <Text style={[styles.aiQuizMakerSubtitle, { color: '#A7F3D0' }]}>Edit, update or delete any question from Firestore</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#34D399" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* 3.3 Score History Trend Card */}
            {scoreHistory.length > 0 && (
              <View style={styles.trendCard}>
                <View style={styles.trendHeaderRow}>
                  <View style={styles.trendTitleRow}>
                    <Ionicons name="analytics" size={18} color="#C8A84E" />
                    <Text style={styles.trendTitleText}>حالیہ امتحانات کا ریکارڈ و کارکردگی</Text>
                  </View>
                  <Text style={styles.trendSubText}>Recent Quiz Score Trend</Text>
                </View>

                <View style={styles.trendChartContainer}>
                  <View style={styles.trendYAxis}>
                    <Text style={styles.trendAxisLabel}>100%</Text>
                    <Text style={styles.trendAxisLabel}>50%</Text>
                    <Text style={styles.trendAxisLabel}>0%</Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendBarsRow}>
                    {scoreHistory.slice().reverse().map((item, idx) => (
                      <View key={item.id || idx} style={styles.trendBarCol}>
                        <Text style={styles.trendBarPct}>{item.percentage}%</Text>
                        <View style={styles.trendBarTrack}>
                          <View
                            style={[
                              styles.trendBarFill,
                              {
                                height: `${Math.max(6, item.percentage)}%`,
                                backgroundColor: item.percentage >= 60 ? '#10B981' : '#EF4444',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.trendBarLabel} numberOfLines={1}>
                          {item.category.length > 8 ? item.category.slice(0, 7) + '..' : item.category}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

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
                <TouchableOpacity style={styles.compactBtn} onPress={() => { editQuestion(q).catch(() => {}); }}>
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

                  {/* 3.4 WhatsApp Share Result Button */}
                  <TouchableOpacity
                    style={styles.whatsappShareBtn}
                    onPress={shareQuizResultViaWhatsApp}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.whatsappShareBtnText}>نتیجہ واٹس ایپ پر شیئر کریں (Share via WhatsApp)</Text>
                  </TouchableOpacity>

                  {/* 3.2 Retry Mistakes Only Button */}
                  {result.score < result.total && (
                    <TouchableOpacity
                      style={styles.retryMistakesBtn}
                      onPress={retryMistakes}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="refresh-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.retryMistakesBtnText}>
                        صرف غلط سوالات کا دوبارہ امتحان ({result.total - result.score} سوالات)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {passed && generatedCert ? (
                    <TouchableOpacity
                      style={styles.claimCertBtn}
                      onPress={() => setCertModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="ribbon" size={20} color="#FFFFFF" />
                      <Text style={styles.claimCertBtnText}>View & Share Official Certificate</Text>
                      <Ionicons name="sparkles" size={16} color="#FDE68A" />
                    </TouchableOpacity>
                  ) : null}
                </>
              );
            })()}
          </View>
          {/* ─── Islamic Revision Mode ("غلط جوابات کا جائزہ") ─── */}
          <View style={styles.revisionHeaderBlock}>
            <View style={styles.revisionHeaderTop}>
              <View style={styles.revisionTitleRow}>
                <Ionicons name="book" size={18} color="#C8A84E" />
                <Text style={styles.revisionTitleUrdu}>غلط جوابات کا جائزہ و اصلاح</Text>
              </View>
              <Text style={styles.revisionSub}>Islamic Revision Mode & Explanations</Text>
            </View>

            {/* Filter Toggle: All vs Only Mistakes */}
            <View style={styles.revisionFilterRow}>
              <TouchableOpacity
                style={[styles.revisionFilterBtn, revisionFilter === 'all' && styles.revisionFilterBtnActive]}
                onPress={() => setRevisionFilter('all')}
                activeOpacity={0.8}
              >
                <Text style={[styles.revisionFilterBtnText, revisionFilter === 'all' && styles.revisionFilterBtnTextActive]}>
                  سب سوالات ({scoreBreakdown.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.revisionFilterBtn, revisionFilter === 'mistakes' && styles.revisionFilterBtnActiveMistakes]}
                onPress={() => setRevisionFilter('mistakes')}
                activeOpacity={0.8}
              >
                <Text style={[styles.revisionFilterBtnText, revisionFilter === 'mistakes' && styles.revisionFilterBtnTextActiveMistakes]}>
                  صرف غلط جوابات ({scoreBreakdown.filter((item) => !item.ok).length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Render Questions / Mistakes with Islamic Explanation */}
          {scoreBreakdown
            .filter((item) => (revisionFilter === 'mistakes' ? !item.ok : true))
            .map((item, i) => (
              <View key={item.id} style={[styles.answerCard, !item.ok && styles.answerCardMistake]}>
                <View style={styles.answerQRow}>
                  <View style={[styles.statusMiniBadge, item.ok ? styles.statusBadgeCorrect : styles.statusBadgeWrong]}>
                    <Ionicons name={item.ok ? 'checkmark' : 'close'} size={14} color="#FFF" />
                    <Text style={styles.statusMiniBadgeText}>{item.ok ? 'صحیح' : 'غلط'}</Text>
                  </View>
                  <Text style={styles.answerQ}>{i + 1}. {item.question}</Text>
                </View>

                {/* Student's Answer */}
                <View style={[styles.answerAnswerRow, !item.ok ? styles.answerRowWrong : styles.answerRowCorrect]}>
                  <Text style={styles.answerLabelUrdu}>آپ کا جواب:</Text>
                  <Text style={[styles.answerTextValue, !item.ok && { color: '#B91C1C', fontWeight: '800' }]}>
                    {item.selected || 'جواب نہیں دیا گیا'}
                  </Text>
                </View>

                {/* Correct Answer if student got it wrong */}
                {!item.ok && item.correctAnswer ? (
                  <View style={[styles.answerAnswerRow, styles.answerRowCorrectAnswer]}>
                    <Text style={styles.correctLabelUrdu}>صحیح جواب (درست):</Text>
                    <Text style={styles.correctAnswerValue}>{item.correctAnswer}</Text>
                  </View>
                ) : null}

                {/* Islamic Explanation & Daleel Card */}
                {item.explanation ? (
                  <View style={styles.explanationBox}>
                    <View style={styles.explanationHeader}>
                      <Ionicons name="information-circle" size={16} color="#005F46" />
                      <Text style={styles.explanationHeaderUrdu}>شرعی و فقہی وضاحت / دلیل:</Text>
                    </View>
                    <Text style={styles.explanationText}>{item.explanation}</Text>
                  </View>
                ) : null}

                {isAdmin ? (
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => {
                        const q = questions.find((question) => question.id === item.id);
                        if (!q) return;
                        editQuestion(q).catch(() => {});
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
          {/* Question Counter & 3.1 Per-Question Countdown Timer Badge */}
          <View style={styles.questionHeaderRow}>
            <View style={styles.questionCountBadge}>
              <Text style={styles.progress}>
                {isRetryingMistakes ? 'اصلاحِ غلطیاں: ' : ''}سوال {index + 1} / {questions.length}
              </Text>
            </View>

            <View style={[
              styles.timerBadge,
              timeLeft <= 5 ? styles.timerBadgeDanger : timeLeft <= 10 ? styles.timerBadgeWarning : styles.timerBadgeNormal
            ]}>
              <Ionicons
                name="timer-outline"
                size={16}
                color={timeLeft <= 5 ? '#DC2626' : timeLeft <= 10 ? '#D97706' : '#047857'}
              />
              <Text style={[
                styles.timerText,
                timeLeft <= 5 ? styles.timerTextDanger : timeLeft <= 10 ? styles.timerTextWarning : styles.timerTextNormal
              ]}>
                {timeLeft}s
              </Text>
            </View>
          </View>

          {/* 30s Countdown Visual Bar */}
          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerFill,
                {
                  width: `${Math.round((timeLeft / QUESTION_TIME_LIMIT) * 100)}%`,
                  backgroundColor: timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#F59E0B' : '#10B981',
                }
              ]}
            />
          </View>

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

      <IslamicCertificateModal
        visible={certModalVisible}
        certificate={generatedCert}
        onClose={() => setCertModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  claimCertBtn: {
    marginTop: 14,
    backgroundColor: '#0FA958',
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    ...SHADOWS.card,
  },
  claimCertBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
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
  aiQuizMakerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#003D2E',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    ...SHADOWS.card,
  },
  aiQuizMakerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiQuizMakerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(200, 168, 78, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiQuizMakerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  aiQuizMakerSubtitle: {
    fontSize: 10,
    color: '#C8A84E',
    fontWeight: '600',
    marginTop: 2,
  },
  // Islamic Revision Mode Styles
  revisionHeaderBlock: {
    backgroundColor: '#003D2E',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#C8A84E',
    ...SHADOWS.card,
  },
  revisionHeaderTop: {
    marginBottom: 10,
  },
  revisionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revisionTitleUrdu: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  revisionSub: {
    fontSize: 11,
    color: '#C8A84E',
    marginTop: 2,
    fontWeight: '600',
  },
  revisionFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  revisionFilterBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.4)',
  },
  revisionFilterBtnActive: {
    backgroundColor: '#C8A84E',
    borderColor: '#C8A84E',
  },
  revisionFilterBtnActiveMistakes: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  revisionFilterBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  revisionFilterBtnTextActive: {
    color: '#003D2E',
    fontWeight: '900',
  },
  revisionFilterBtnTextActiveMistakes: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  answerCardMistake: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: '#FFFDFD',
  },
  answerQRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  statusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  statusBadgeCorrect: {
    backgroundColor: '#059669',
  },
  statusBadgeWrong: {
    backgroundColor: '#DC2626',
  },
  statusMiniBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  answerAnswerRow: {
    padding: 10,
    borderRadius: RADIUS.md,
    marginVertical: 3,
  },
  answerRowWrong: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  answerRowCorrect: {
    backgroundColor: '#ECFDF5',
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  answerRowCorrectAnswer: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  answerLabelUrdu: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginBottom: 2,
  },
  answerTextValue: {
    fontSize: 14,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  correctLabelUrdu: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '700',
    marginBottom: 2,
  },
  correctAnswerValue: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '800',
  },
  explanationBox: {
    backgroundColor: '#F7F4E9',
    borderRadius: RADIUS.lg,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2D5B4',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  explanationHeaderUrdu: {
    fontSize: 12,
    fontWeight: '800',
    color: '#005F46',
  },
  explanationText: {
    fontSize: 13,
    color: '#2D3748',
    lineHeight: 20,
    fontWeight: '500',
  },

  // 3.1 Question Header and Timer Bar Styles
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  questionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  timerBadgeNormal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  timerBadgeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  timerBadgeDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
  },
  timerTextNormal: {
    color: '#047857',
  },
  timerTextWarning: {
    color: '#D97706',
  },
  timerTextDanger: {
    color: '#DC2626',
  },
  timerTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },

  // 3.4 WhatsApp Share Result Button
  whatsappShareBtn: {
    marginTop: 14,
    backgroundColor: '#25D366',
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    ...SHADOWS.card,
  },
  whatsappShareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // 3.2 Retry Mistakes Only Button
  retryMistakesBtn: {
    marginTop: 10,
    backgroundColor: '#D97706',
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    ...SHADOWS.card,
  },
  retryMistakesBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // 3.3 Score Trend Card Styles
  trendCard: {
    backgroundColor: '#003D2E',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    ...SHADOWS.card,
  },
  trendHeaderRow: {
    marginBottom: 10,
  },
  trendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  trendSubText: {
    fontSize: 11,
    color: '#C8A84E',
    fontWeight: '600',
    marginTop: 2,
  },
  trendChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  trendYAxis: {
    height: 100,
    justifyContent: 'space-between',
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(200, 168, 78, 0.3)',
  },
  trendAxisLabel: {
    fontSize: 9,
    color: '#C8A84E',
    fontWeight: '700',
  },
  trendBarsRow: {
    paddingHorizontal: 12,
    alignItems: 'flex-end',
    gap: 14,
    height: 120,
  },
  trendBarCol: {
    alignItems: 'center',
    width: 44,
  },
  trendBarPct: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 4,
  },
  trendBarTrack: {
    width: 22,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 6,
  },
  trendBarLabel: {
    fontSize: 9,
    color: '#C8A84E',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
