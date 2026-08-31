import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ScalePressable } from '@/components/ui';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type QuizResult = {
  id: string;
  score: number;
  total_questions: number;
  category?: string;
  created_at?: any;
};

const CARD_RADIUS = 20;
const CARD_BORDER = 'rgba(15, 23, 42, 0.06)';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const quizUnsub = onSnapshot(
      query(collection(db, 'quiz_results'), where('user_id', '==', user.uid), orderBy('created_at', 'desc')),
      (snap) => {
        const quizArr: QuizResult[] = [];
        snap.forEach((d) => quizArr.push({ id: d.id, ...(d.data() as any) }));
        setQuizResults(quizArr);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => quizUnsub();
  }, [user?.uid]);

  // Derived Analytics (STRICT ZERO REGRESSION - Exact existing calculations)
  const totalAttempts = quizResults.length;
  const totalQuestions = quizResults.reduce((sum, r) => sum + (r.total_questions || 0), 0);
  const correctAnswers = quizResults.reduce((sum, r) => sum + (r.score || 0), 0);
  const wrongAnswers = totalQuestions - correctAnswers;
  
  const overallAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  const avgQuizScore = totalAttempts > 0 
    ? Math.round(quizResults.reduce((sum, r) => sum + (r.total_questions ? (r.score / r.total_questions) * 100 : 0), 0) / totalAttempts)
    : 0;

  // Category Performance (STRICT ZERO REGRESSION)
  const categoryStats = useMemo(() => {
    const stats: Record<string, { attempts: number; correct: number; total: number }> = {};
    quizResults.forEach(r => {
      const cat = (r.category && typeof r.category === 'string' && r.category.trim().length > 0) ? r.category.trim() : 'Uncategorized';
      if (!stats[cat]) stats[cat] = { attempts: 0, correct: 0, total: 0 };
      stats[cat].attempts += 1;
      stats[cat].correct += (r.score || 0);
      stats[cat].total += (r.total_questions || 0);
    });
    
    return Object.keys(stats).map(cat => ({
      category: cat,
      accuracy: stats[cat].total > 0 ? Math.round((stats[cat].correct / stats[cat].total) * 100) : 0,
      attempts: stats[cat].attempts,
      correct: stats[cat].correct,
      total: stats[cat].total
    })).sort((a, b) => b.accuracy - a.accuracy); // Sort highest to lowest
  }, [quizResults]);

  const bestCategory = categoryStats.length > 0 ? categoryStats[0] : null;
  const weakestCategory = categoryStats.length > 0 ? categoryStats[categoryStats.length - 1] : null;
  const recentAttempts = quizResults.slice(0, 10);

  // Insights & Achievements (STRICT ZERO REGRESSION)
  const hasPerfectScore = quizResults.some(r => r.total_questions > 0 && r.score === r.total_questions);
  const hasHighAccuracy = overallAccuracy >= 90;
  const has10Attempts = totalAttempts >= 10;
  const has100Questions = totalQuestions >= 100;
  
  const handleNavigateToQuiz = () => {
    try {
      router.push('/(tabs)/quiz');
    } catch {
      // Fallback if router push fails
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBadge}>
        <Ionicons name="stats-chart" size={40} color="#4F46E5" />
      </View>
      <Text style={styles.emptyTitle}>No Learning Analytics Yet</Text>
      <Text style={styles.emptyText}>
        Complete your first course quiz to unlock real-time performance metrics, accuracy distributions, trend analysis, and learning achievements.
      </Text>
      <TouchableOpacity
        style={styles.emptyCtaBtn}
        onPress={handleNavigateToQuiz}
        accessibilityRole="button"
        accessibilityLabel="Take Your First Quiz"
      >
        <Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.emptyCtaText}>Take Your First Quiz</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Analyzing learning progress...</Text>
        </View>
      </View>
    );
  }

  if (totalAttempts === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroContent}>
            <View style={[styles.heroIconBadge, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="stats-chart" size={28} color="#4F46E5" />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Analytics Dashboard</Text>
              <Text style={styles.heroSubtitle}>Track your learning journey, performance metrics, and skill mastery</Text>
            </View>
          </View>
        </View>
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* ─── Hero Header ─── */}
      <View style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.heroContent}>
          <View style={[styles.heroIconBadge, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="stats-chart" size={28} color="#4F46E5" />
          </View>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>Analytics Dashboard</Text>
            <Text style={styles.heroSubtitle}>Track your learning journey, performance metrics, and skill mastery</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        
        {/* ─── Section 1: Hero Summary Card ─── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>📊  EXECUTIVE SUMMARY</Text>
          <View style={styles.heroSummaryCard}>
            <View style={styles.heroSummaryTop}>
              <View style={styles.heroSummaryMainItem}>
                <Text style={styles.heroSummaryLabel}>Overall Accuracy</Text>
                <View style={styles.heroSummaryValueRow}>
                  <Text style={styles.heroSummaryBigValue}>{overallAccuracy}%</Text>
                  <View style={[styles.accuracyBadge, { backgroundColor: overallAccuracy >= 75 ? '#ECFDF5' : '#FEF3C7' }]}>
                    <Text style={[styles.accuracyBadgeText, { color: overallAccuracy >= 75 ? '#047857' : '#B45309' }]}>
                      {overallAccuracy >= 75 ? 'Optimal' : 'Review'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.heroSummaryDivider} />
              <View style={styles.heroSummarySideItem}>
                <Text style={styles.heroSummaryLabel}>Average Score</Text>
                <Text style={styles.heroSummarySideValue}>{avgQuizScore}%</Text>
                <Text style={styles.heroSummarySubLabel}>across all attempts</Text>
              </View>
            </View>

            <View style={styles.heroSummaryBottomGrid}>
              <View style={styles.heroSummaryStatCell}>
                <Text style={styles.cellStatValue}>{totalAttempts}</Text>
                <Text style={styles.cellStatLabel}>Quizzes Taken</Text>
              </View>
              <View style={styles.heroSummaryStatCell}>
                <Text style={styles.cellStatValue}>{totalQuestions}</Text>
                <Text style={styles.cellStatLabel}>Total Questions</Text>
              </View>
              <View style={styles.heroSummaryStatCell}>
                <Text style={[styles.cellStatValue, { color: '#10B981' }]}>{correctAnswers}</Text>
                <Text style={styles.cellStatLabel}>Correct</Text>
              </View>
              <View style={styles.heroSummaryStatCell}>
                <Text style={[styles.cellStatValue, { color: '#EF4444' }]}>{wrongAnswers}</Text>
                <Text style={styles.cellStatLabel}>Incorrect</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Section 2: Overview Cards ─── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>📈  KEY METRICS</Text>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewCard}>
              <View style={[styles.overviewIconBox, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="analytics" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.overviewValue}>{overallAccuracy}%</Text>
              <Text style={styles.overviewLabel}>Overall Accuracy</Text>
              <Text style={styles.overviewSub}>Cumulative score rate</Text>
            </View>

            <View style={styles.overviewCard}>
              <View style={[styles.overviewIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="documents" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.overviewValue}>{totalAttempts}</Text>
              <Text style={styles.overviewLabel}>Total Quizzes</Text>
              <Text style={styles.overviewSub}>Completed sessions</Text>
            </View>

            <View style={styles.overviewCard}>
              <View style={[styles.overviewIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="help-circle" size={20} color="#D97706" />
              </View>
              <Text style={styles.overviewValue}>{totalQuestions}</Text>
              <Text style={styles.overviewLabel}>Total Questions</Text>
              <Text style={styles.overviewSub}>Questions attempted</Text>
            </View>

            <View style={styles.overviewCard}>
              <View style={[styles.overviewIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
              <Text style={[styles.overviewValue, { color: '#047857' }]}>{correctAnswers}</Text>
              <Text style={styles.overviewLabel}>Correct Answers</Text>
              <Text style={styles.overviewSub}>Successfully solved</Text>
            </View>

            <View style={styles.overviewCard}>
              <View style={[styles.overviewIconBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.overviewValue, { color: '#B91C1C' }]}>{wrongAnswers}</Text>
              <Text style={styles.overviewLabel}>Wrong Answers</Text>
              <Text style={styles.overviewSub}>Needs practice</Text>
            </View>

            <View style={styles.overviewCard}>
              <View style={[styles.overviewIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="calculator" size={20} color="#0284C7" />
              </View>
              <Text style={styles.overviewValue}>{avgQuizScore}%</Text>
              <Text style={styles.overviewLabel}>Average Score</Text>
              <Text style={styles.overviewSub}>Mean session performance</Text>
            </View>
          </View>
        </View>

        {/* ─── Section 3 & 4: Best & Needs Focus ─── */}
        {categoryStats.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>⚡  PERFORMANCE HIGHLIGHTS</Text>
            <View style={styles.highlightsGrid}>
              <View style={styles.highlightCard}>
                <View style={styles.highlightHeader}>
                  <View style={[styles.highlightIconBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="trophy" size={20} color="#D97706" />
                  </View>
                  <Text style={[styles.highlightTypeLabel, { color: '#B45309' }]}>TOP PERFORMING SUBJECT</Text>
                </View>
                <Text style={styles.highlightCategoryName} numberOfLines={2}>{bestCategory?.category || 'General'}</Text>
                <View style={styles.highlightFooter}>
                  <View style={[styles.accuracyBadge, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.accuracyBadgeText, { color: '#047857' }]}>{bestCategory?.accuracy || 0}% Accuracy</Text>
                  </View>
                  <Text style={styles.highlightAttemptsText}>{bestCategory?.attempts || 0} quizzes</Text>
                </View>
              </View>

              <View style={styles.highlightCard}>
                <View style={styles.highlightHeader}>
                  <View style={[styles.highlightIconBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trending-down" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.highlightTypeLabel, { color: '#B91C1C' }]}>PRIORITY FOR REVISION</Text>
                </View>
                <Text style={styles.highlightCategoryName} numberOfLines={2}>{weakestCategory?.category || 'General'}</Text>
                <View style={styles.highlightFooter}>
                  <View style={[styles.accuracyBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.accuracyBadgeText, { color: '#B45309' }]}>{weakestCategory?.accuracy || 0}% Accuracy</Text>
                  </View>
                  <Text style={styles.highlightAttemptsText}>{weakestCategory?.attempts || 0} quizzes</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ─── Section 5: Progress Trend ─── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>📉  PERFORMANCE TREND OVER TIME</Text>
          <View style={styles.card}>
            {totalAttempts < 2 ? (
              <View style={styles.trendEmptyBox}>
                <View style={[styles.trendEmptyIconBadge, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="trending-up-outline" size={32} color="#4F46E5" />
                </View>
                <Text style={styles.trendEmptyTitle}>Trend Data Unlocking Soon</Text>
                <Text style={styles.trendEmptyDesc}>
                  Complete at least 2 course quizzes to generate an interactive historical performance trend chart.
                </Text>
                <TouchableOpacity
                  style={styles.trendEmptyBtn}
                  onPress={handleNavigateToQuiz}
                  accessibilityRole="button"
                >
                  <Text style={styles.trendEmptyBtnText}>Take Another Quiz</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <View style={styles.chartYAxis}>
                  <Text style={styles.chartAxisLabel}>100%</Text>
                  <Text style={styles.chartAxisLabel}>50%</Text>
                  <Text style={styles.chartAxisLabel}>0%</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartContent}>
                  {quizResults.slice().reverse().map((r, i) => {
                    const pct = r.total_questions > 0 ? (r.score / r.total_questions) * 100 : 0;
                    return (
                      <View key={i} style={styles.chartBarCol}>
                        <Text style={styles.chartBarValueText}>{Math.round(pct)}%</Text>
                        <View style={styles.chartBarBg}>
                          <View
                            style={[
                              styles.chartBarFill,
                              {
                                height: `${Math.max(4, pct)}%`,
                                backgroundColor: pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartBarIndexText}>#{i + 1}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* ─── Section 6: Accuracy Distribution ─── */}
        {categoryStats.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>🎯  ACCURACY BY SUBJECT</Text>
            <View style={styles.card}>
              <View style={styles.distList}>
                {categoryStats.map((cat, i) => {
                  const barColor = cat.accuracy >= 80 ? '#10B981' : cat.accuracy >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <View key={i} style={styles.distRowCell}>
                      <View style={styles.distHeaderRow}>
                        <Text style={styles.distSubjectLabel} numberOfLines={1}>{cat.category}</Text>
                        <View style={styles.distRightInfo}>
                          <Text style={styles.distAttemptsLabel}>{cat.attempts} {cat.attempts === 1 ? 'quiz' : 'quizzes'}</Text>
                          <Text style={[styles.distValueText, { color: barColor }]}>{cat.accuracy}%</Text>
                        </View>
                      </View>
                      <View style={styles.distBarBg}>
                        <View style={[styles.distBarFill, { width: `${Math.max(2, cat.accuracy)}%`, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ─── Section 7: Achievements ─── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>🏆  LEARNING ACHIEVEMENTS</Text>
          <View style={styles.achievementsGrid}>
            
            {/* Achievement 1: 90%+ Accuracy */}
            <View style={[styles.achievementCard, hasHighAccuracy && styles.achievementCardUnlocked]}>
              <View style={[styles.badgeEmojiBadge, { backgroundColor: hasHighAccuracy ? '#FEF3C7' : '#F1F5F9' }]}>
                <Text style={styles.badgeEmoji}>{hasHighAccuracy ? '🥇' : '🔒'}</Text>
              </View>
              <View style={styles.achievementContent}>
                <Text style={[styles.badgeTitle, !hasHighAccuracy && styles.badgeTitleLocked]}>90%+ Accuracy</Text>
                <Text style={styles.badgeDesc}>{hasHighAccuracy ? 'Achieved 90% or higher overall quiz accuracy' : 'Reach 90%+ overall quiz accuracy'}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: hasHighAccuracy ? '#ECFDF5' : '#F1F5F9' }]}>
                <Text style={[styles.statusChipText, { color: hasHighAccuracy ? '#047857' : '#64748B' }]}>
                  {hasHighAccuracy ? '✓ Unlocked' : 'Locked'}
                </Text>
              </View>
            </View>

            {/* Achievement 2: 10 Quiz Streak */}
            <View style={[styles.achievementCard, has10Attempts && styles.achievementCardUnlocked]}>
              <View style={[styles.badgeEmojiBadge, { backgroundColor: has10Attempts ? '#FFEDD5' : '#F1F5F9' }]}>
                <Text style={styles.badgeEmoji}>{has10Attempts ? '🔥' : '🔒'}</Text>
              </View>
              <View style={styles.achievementContent}>
                <Text style={[styles.badgeTitle, !has10Attempts && styles.badgeTitleLocked]}>10 Quiz Streak</Text>
                <Text style={styles.badgeDesc}>{has10Attempts ? 'Dedicated learner with 10+ quizzes completed' : 'Complete at least 10 course quizzes'}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: has10Attempts ? '#ECFDF5' : '#F1F5F9' }]}>
                <Text style={[styles.statusChipText, { color: has10Attempts ? '#047857' : '#64748B' }]}>
                  {has10Attempts ? '✓ Unlocked' : `${totalAttempts}/10`}
                </Text>
              </View>
            </View>

            {/* Achievement 3: 100 Questions */}
            <View style={[styles.achievementCard, has100Questions && styles.achievementCardUnlocked]}>
              <View style={[styles.badgeEmojiBadge, { backgroundColor: has100Questions ? '#E0F2FE' : '#F1F5F9' }]}>
                <Text style={styles.badgeEmoji}>{has100Questions ? '📚' : '🔒'}</Text>
              </View>
              <View style={styles.achievementContent}>
                <Text style={[styles.badgeTitle, !has100Questions && styles.badgeTitleLocked]}>100 Questions</Text>
                <Text style={styles.badgeDesc}>{has100Questions ? 'Answered over 100 academic questions' : 'Answer a total of 100 quiz questions'}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: has100Questions ? '#ECFDF5' : '#F1F5F9' }]}>
                <Text style={[styles.statusChipText, { color: has100Questions ? '#047857' : '#64748B' }]}>
                  {has100Questions ? '✓ Unlocked' : `${totalQuestions}/100`}
                </Text>
              </View>
            </View>

            {/* Achievement 4: Perfect Score */}
            <View style={[styles.achievementCard, hasPerfectScore && styles.achievementCardUnlocked]}>
              <View style={[styles.badgeEmojiBadge, { backgroundColor: hasPerfectScore ? '#F3E8FF' : '#F1F5F9' }]}>
                <Text style={styles.badgeEmoji}>{hasPerfectScore ? '🎯' : '🔒'}</Text>
              </View>
              <View style={styles.achievementContent}>
                <Text style={[styles.badgeTitle, !hasPerfectScore && styles.badgeTitleLocked]}>Perfect Score</Text>
                <Text style={styles.badgeDesc}>{hasPerfectScore ? 'Scored 100% on a course quiz attempt' : 'Achieve a 100% score on any quiz'}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: hasPerfectScore ? '#ECFDF5' : '#F1F5F9' }]}>
                <Text style={[styles.statusChipText, { color: hasPerfectScore ? '#047857' : '#64748B' }]}>
                  {hasPerfectScore ? '✓ Unlocked' : 'Locked'}
                </Text>
              </View>
            </View>

          </View>
        </View>

        {/* ─── Section 8: Insights & Tips ─── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>💡  SMART LEARNING INSIGHTS</Text>
          <View style={styles.card}>
            <View style={styles.insightsList}>
              {bestCategory && (
                <View style={styles.insightCardRow}>
                  <View style={[styles.insightIconBadge, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                  <View style={styles.insightTextCol}>
                    <Text style={styles.insightTitleText}>Strong Performance</Text>
                    <Text style={styles.insightDescText}>You are performing exceptionally well in <Text style={{ fontWeight: '700', color: '#0F172A' }}>{bestCategory.category}</Text> with {bestCategory.accuracy}% accuracy.</Text>
                  </View>
                </View>
              )}

              {weakestCategory && (
                <View style={styles.insightCardRow}>
                  <View style={[styles.insightIconBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="alert-circle" size={20} color="#D97706" />
                  </View>
                  <View style={styles.insightTextCol}>
                    <Text style={styles.insightTitleText}>Revision Recommended</Text>
                    <Text style={styles.insightDescText}>Consider dedicating more practice time to <Text style={{ fontWeight: '700', color: '#0F172A' }}>{weakestCategory.category}</Text> ({weakestCategory.accuracy}% accuracy).</Text>
                  </View>
                </View>
              )}

              {overallAccuracy > 80 && (
                <View style={styles.insightCardRow}>
                  <View style={[styles.insightIconBadge, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="star" size={20} color="#4F46E5" />
                  </View>
                  <View style={styles.insightTextCol}>
                    <Text style={styles.insightTitleText}>Excellent Consistency</Text>
                    <Text style={styles.insightDescText}>Your overall academic score consistency exceeds the 80% enterprise benchmark.</Text>
                  </View>
                </View>
              )}

              {weakestCategory && (
                <View style={styles.insightCardRow}>
                  <View style={[styles.insightIconBadge, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="bulb" size={20} color="#15803D" />
                  </View>
                  <View style={styles.insightTextCol}>
                    <Text style={styles.insightTitleText}>Study Tip: Targeted Practice</Text>
                    <Text style={styles.insightDescText}>Focus your next study session on taking targeted quizzes in {weakestCategory.category}.</Text>
                  </View>
                </View>
              )}

              <View style={styles.insightCardRow}>
                <View style={[styles.insightIconBadge, { backgroundColor: '#FAF5FF' }]}>
                  <Ionicons name="refresh-circle" size={20} color="#9333EA" />
                </View>
                <View style={styles.insightTextCol}>
                  <Text style={styles.insightTitleText}>Study Tip: Active Recall</Text>
                  <Text style={styles.insightDescText}>Retrying quizzes where you missed questions reinforces active recall and boosts long-term memory.</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Section 9: Recent Attempts ─── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>📝  RECENT QUIZ HISTORY</Text>
          <View style={styles.recentList}>
            {recentAttempts.map((r, i) => {
              const pct = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0;
              const passed = pct >= 60;
              const dateStr = r.created_at ? format(r.created_at.toDate(), 'MMM d, yyyy') : 'Recent';
              const catName = (r.category && typeof r.category === 'string' && r.category.trim().length > 0) ? r.category.trim() : 'Uncategorized';
              return (
                <ScalePressable
                  key={i}
                  style={styles.attemptCard}
                  onPress={handleNavigateToQuiz}
                  accessibilityRole="button"
                  accessibilityLabel={`Quiz attempt for ${catName}, score ${pct}%`}
                >
                  <View style={[styles.attemptIconBadge, { backgroundColor: passed ? '#ECFDF5' : '#FEF3C7' }]}>
                    <Ionicons name={passed ? "checkmark-circle" : "time"} size={22} color={passed ? "#10B981" : "#D97706"} />
                  </View>
                  <View style={styles.attemptMainCol}>
                    <Text style={styles.attemptCategory} numberOfLines={1}>{catName}</Text>
                    <View style={styles.attemptSubRow}>
                      <Ionicons name="calendar-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.attemptDate}>{dateStr}</Text>
                      <Text style={styles.attemptDot}>•</Text>
                      <Text style={styles.attemptScoreText}>{r.score}/{r.total_questions} correct</Text>
                    </View>
                  </View>
                  <View style={styles.attemptRightCol}>
                    <Text style={[styles.attemptPctText, { color: passed ? '#047857' : '#B45309' }]}>{pct}%</Text>
                    <View style={[styles.attemptStatusChip, { backgroundColor: passed ? '#D1FAE5' : '#FEF3C7' }]}>
                      <Text style={[styles.attemptStatusText, { color: passed ? '#047857' : '#B45309' }]}>
                        {passed ? 'Passed' : 'Review'}
                      </Text>
                    </View>
                  </View>
                </ScalePressable>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '500' },

  /* Hero Header */
  heroHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.04,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Body & Section Headers */
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 24 },
  sectionBlock: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* Hero Summary Card */
  heroSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.06,
    gap: 20,
  },
  heroSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSummaryMainItem: {
    flex: 1,
  },
  heroSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  heroSummaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroSummaryBigValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -1,
  },
  accuracyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accuracyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroSummaryDivider: {
    width: 1,
    height: 56,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  heroSummarySideItem: {
    alignItems: 'flex-end',
  },
  heroSummarySideValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroSummarySubLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  heroSummaryBottomGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  heroSummaryStatCell: {
    alignItems: 'center',
    flex: 1,
  },
  cellStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  cellStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Overview Grid */
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  overviewCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.04,
    minHeight: 128,
    justifyContent: 'space-between',
  },
  overviewIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  overviewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  overviewSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  /* Highlights Grid */
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  highlightCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  highlightIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTypeLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  highlightCategoryName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  highlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  highlightAttemptsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Standard Card & Chart */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 160,
    paddingTop: 10,
  },
  chartYAxis: {
    justifyContent: 'space-between',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingBottom: 20,
  },
  chartAxisLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chartContent: {
    paddingHorizontal: 16,
    alignItems: 'flex-end',
    gap: 20,
  },
  chartBarCol: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  chartBarBg: {
    height: 110,
    width: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  chartBarIndexText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 6,
  },
  trendEmptyBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  trendEmptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendEmptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  trendEmptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  trendEmptyBtn: {
    marginTop: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  trendEmptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },

  /* Accuracy Distribution */
  distList: {
    gap: 16,
  },
  distRowCell: {
    gap: 6,
  },
  distHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distSubjectLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  distRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distAttemptsLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  distValueText: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
  distBarBg: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  distBarFill: {
    height: 10,
    borderRadius: 5,
  },

  /* Achievements Section */
  achievementsGrid: {
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.04,
    minHeight: 88,
  },
  achievementCardUnlocked: {
    borderColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: '#FFFCF5',
  },
  badgeEmojiBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  badgeEmoji: {
    fontSize: 26,
  },
  achievementContent: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  badgeTitleLocked: {
    color: '#64748B',
  },
  badgeDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Insights & Tips Section */
  insightsList: {
    gap: 16,
  },
  insightCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insightIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  insightTextCol: {
    flex: 1,
  },
  insightTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  insightDescText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },

  /* Recent Attempts List */
  recentList: {
    gap: 12,
  },
  attemptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    minHeight: 80,
  },
  attemptIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  attemptMainCol: {
    flex: 1,
    justifyContent: 'center',
  },
  attemptCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  attemptSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attemptDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  attemptDot: {
    fontSize: 12,
    color: '#CBD5E1',
    marginHorizontal: 6,
  },
  attemptScoreText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  attemptRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  attemptPctText: {
    fontSize: 17,
    fontWeight: '800',
  },
  attemptStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  attemptStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  /* Global Empty State */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...SHADOWS.card,
    shadowOpacity: 0.08,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 320,
  },
  emptyCtaBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.card,
    shadowOpacity: 0.15,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
