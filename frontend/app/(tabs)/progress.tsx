import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

type QuizResult = {
  id: string;
  score: number;
  total_questions: number;
  category?: string;
  created_at?: any;
};

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
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

  // Derived Analytics
  const totalAttempts = quizResults.length;
  const totalQuestions = quizResults.reduce((sum, r) => sum + (r.total_questions || 0), 0);
  const correctAnswers = quizResults.reduce((sum, r) => sum + (r.score || 0), 0);
  const wrongAnswers = totalQuestions - correctAnswers;
  
  const overallAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  const avgQuizScore = totalAttempts > 0 
    ? Math.round(quizResults.reduce((sum, r) => sum + (r.total_questions ? (r.score / r.total_questions) * 100 : 0), 0) / totalAttempts)
    : 0;

  // Category Performance
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

  // Insights
  const hasPerfectScore = quizResults.some(r => r.total_questions > 0 && r.score === r.total_questions);
  const hasHighAccuracy = overallAccuracy >= 90;
  const has10Attempts = totalAttempts >= 10;
  const has100Questions = totalQuestions >= 100;
  
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bar-chart-outline" size={64} color={COLORS.border} />
      <Text style={styles.emptyTitle}>No Analytics Yet</Text>
      <Text style={styles.emptyText}>Complete your first quiz to unlock personalized insights, trends, and achievements.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </View>
    );
  }

  if (totalAttempts === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>Analytics Dashboard</Text>
          <Text style={styles.subtitle}>Track your learning journey</Text>
        </View>
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <Text style={styles.subtitle}>Track your learning journey</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Section 1 - Analytics Overview */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.overviewGrid}>
          <View style={styles.overviewCard}>
            <Ionicons name="analytics" size={20} color={COLORS.primary} style={styles.overviewIcon} />
            <Text style={styles.overviewValue}>{overallAccuracy}%</Text>
            <Text style={styles.overviewLabel}>Overall Accuracy</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="documents" size={20} color="#8B5CF6" style={styles.overviewIcon} />
            <Text style={styles.overviewValue}>{totalAttempts}</Text>
            <Text style={styles.overviewLabel}>Total Quizzes</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="help-circle" size={20} color="#F59E0B" style={styles.overviewIcon} />
            <Text style={styles.overviewValue}>{totalQuestions}</Text>
            <Text style={styles.overviewLabel}>Questions</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} style={styles.overviewIcon} />
            <Text style={styles.overviewValue}>{correctAnswers}</Text>
            <Text style={styles.overviewLabel}>Correct</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="close-circle" size={20} color={COLORS.error} style={styles.overviewIcon} />
            <Text style={styles.overviewValue}>{wrongAnswers}</Text>
            <Text style={styles.overviewLabel}>Wrong</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="calculator" size={20} color={COLORS.secondary} style={styles.overviewIcon} />
            <Text style={styles.overviewValue}>{avgQuizScore}%</Text>
            <Text style={styles.overviewLabel}>Avg Score</Text>
          </View>
        </View>

        {/* Section 3 & 4 - Best and Weakest */}
        {categoryStats.length > 0 && (
          <View style={styles.rowGrid}>
            <View style={[styles.card, { flex: 1 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="trophy" size={18} color="#F59E0B" />
                <Text style={styles.cardTitle}>Best</Text>
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>{bestCategory?.category}</Text>
              <Text style={styles.categoryAcc}>{bestCategory?.accuracy}% Accuracy</Text>
            </View>
            <View style={[styles.card, { flex: 1 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="trending-down" size={18} color={COLORS.error} />
                <Text style={styles.cardTitle}>Needs Focus</Text>
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>{weakestCategory?.category}</Text>
              <Text style={styles.categoryAcc}>{weakestCategory?.accuracy}% Accuracy</Text>
            </View>
          </View>
        )}

        {/* Section 6 - Progress Trend */}
        <Text style={styles.sectionTitle}>Progress Trend</Text>
        <View style={styles.card}>
          {totalAttempts < 2 ? (
            <Text style={styles.chartEmpty}>Complete at least 2 quizzes to see your trend over time.</Text>
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
                      <View style={styles.chartBarBg}>
                        <View style={[styles.chartBarFill, { height: `${pct}%`, backgroundColor: pct >= 80 ? COLORS.success : pct >= 50 ? '#F59E0B' : COLORS.error }]} />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Section 7 - Accuracy Distribution */}
        {categoryStats.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Accuracy Distribution</Text>
            <View style={styles.card}>
              {categoryStats.map((cat, i) => (
                <View key={i} style={styles.distRow}>
                  <Text style={styles.distLabel} numberOfLines={1}>{cat.category}</Text>
                  <View style={styles.distBarBg}>
                    <View style={[styles.distBarFill, { width: `${cat.accuracy}%`, backgroundColor: COLORS.primary }]} />
                  </View>
                  <Text style={styles.distValue}>{cat.accuracy}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Section 9 - Achievement Cards */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
          {hasHighAccuracy ? (
            <View style={styles.badgeCard}>
              <Text style={styles.badgeEmoji}>🥇</Text>
              <Text style={styles.badgeTitle}>90%+ Accuracy</Text>
            </View>
          ) : null}
          {has10Attempts ? (
            <View style={styles.badgeCard}>
              <Text style={styles.badgeEmoji}>🔥</Text>
              <Text style={styles.badgeTitle}>10 Quiz Streak</Text>
            </View>
          ) : null}
          {has100Questions ? (
            <View style={styles.badgeCard}>
              <Text style={styles.badgeEmoji}>📚</Text>
              <Text style={styles.badgeTitle}>100 Questions</Text>
            </View>
          ) : null}
          {hasPerfectScore ? (
            <View style={styles.badgeCard}>
              <Text style={styles.badgeEmoji}>🎯</Text>
              <Text style={styles.badgeTitle}>Perfect Score</Text>
            </View>
          ) : null}
          {!hasHighAccuracy && !has10Attempts && !has100Questions && !hasPerfectScore && (
             <Text style={styles.chartEmpty}>Keep practicing to earn achievements!</Text>
          )}
        </ScrollView>

        {/* Section 8 & 10 - Insights & Tips */}
        <Text style={styles.sectionTitle}>Insights & Tips</Text>
        <View style={styles.card}>
          <View style={styles.insightRow}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.insightText}>Strong in {bestCategory?.category}</Text>
          </View>
          <View style={styles.insightRow}>
            <Ionicons name="alert-circle" size={16} color="#F59E0B" />
            <Text style={styles.insightText}>Needs revision in {weakestCategory?.category}</Text>
          </View>
          {overallAccuracy > 80 && (
            <View style={styles.insightRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.insightText}>Excellent consistency overall</Text>
            </View>
          )}
          <View style={styles.insightRow}>
            <Ionicons name="bulb" size={16} color={COLORS.primary} />
            <Text style={styles.insightText}>Tip: Practice {weakestCategory?.category} quizzes</Text>
          </View>
          <View style={styles.insightRow}>
            <Ionicons name="refresh" size={16} color={COLORS.secondary} />
            <Text style={styles.insightText}>Tip: Retry incorrect questions</Text>
          </View>
        </View>

        {/* Section 5 - Recent Attempts */}
        <Text style={styles.sectionTitle}>Recent Attempts</Text>
        <View style={styles.recentList}>
          {recentAttempts.map((r, i) => {
            const pct = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0;
            const passed = pct >= 60;
            const dateStr = r.created_at ? format(r.created_at.toDate(), 'MMM d, yyyy') : 'Unknown Date';
            return (
              <View key={i} style={styles.attemptCard}>
                <View style={styles.attemptTop}>
                  <Text style={styles.attemptCategory}>{(r.category && typeof r.category === 'string' && r.category.trim().length > 0) ? r.category.trim() : 'Uncategorized'}</Text>
                  <View style={[styles.attemptStatusBadge, passed ? styles.badgeSuccess : styles.badgeWarning]}>
                    <Text style={[styles.attemptStatusText, passed ? styles.textSuccess : styles.textWarning]}>
                      {passed ? 'Passed' : 'Needs Improvement'}
                    </Text>
                  </View>
                </View>
                <View style={styles.attemptBottom}>
                  <Text style={styles.attemptScore}>{pct}% ({r.score}/{r.total_questions})</Text>
                  <Text style={styles.attemptDate}>{dateStr}</Text>
                </View>
              </View>
            );
          })}
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.md, paddingBottom: 40 },
  
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginTop: 24, marginBottom: 12, marginLeft: 4 },
  
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  overviewCard: { width: '31%', backgroundColor: COLORS.surface, padding: 12, borderRadius: RADIUS.lg, ...SHADOWS.card, alignItems: 'center' },
  overviewIcon: { marginBottom: 4 },
  overviewValue: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  overviewLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  
  rowGrid: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  categoryName: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  categoryAcc: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  
  chartContainer: { flexDirection: 'row', height: 120, paddingTop: 10 },
  chartYAxis: { justifyContent: 'space-between', paddingRight: 8, borderRightWidth: 1, borderRightColor: COLORS.border },
  chartAxisLabel: { fontSize: 10, color: COLORS.textMuted },
  chartContent: { paddingHorizontal: 12, alignItems: 'flex-end', gap: 16 },
  chartBarCol: { height: '100%', width: 24, justifyContent: 'flex-end', alignItems: 'center' },
  chartBarBg: { height: '100%', width: 8, backgroundColor: COLORS.background, borderRadius: 4, justifyContent: 'flex-end' },
  chartBarFill: { width: 8, borderRadius: 4 },
  chartEmpty: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },

  distRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  distLabel: { width: 100, fontSize: 12, color: COLORS.textMain, fontWeight: '600' },
  distBarBg: { flex: 1, height: 8, backgroundColor: COLORS.background, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  distBarFill: { height: 8, borderRadius: 4 },
  distValue: { width: 40, fontSize: 12, color: COLORS.textMuted, textAlign: 'right', fontWeight: '700' },
  
  badgesScroll: { gap: 12, paddingRight: 20 },
  badgeCard: { backgroundColor: COLORS.surface, padding: 12, borderRadius: RADIUS.lg, ...SHADOWS.card, alignItems: 'center', minWidth: 100 },
  badgeEmoji: { fontSize: 24, marginBottom: 4 },
  badgeTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMain },
  
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  insightText: { fontSize: 14, color: COLORS.textMain },

  recentList: { gap: 12 },
  attemptCard: { backgroundColor: COLORS.surface, padding: 16, borderRadius: RADIUS.xl, ...SHADOWS.card },
  attemptTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  attemptCategory: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  attemptStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  badgeWarning: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  attemptStatusText: { fontSize: 10, fontWeight: '700' },
  textSuccess: { color: COLORS.success },
  textWarning: { color: '#D97706' },
  attemptBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attemptScore: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  attemptDate: { fontSize: 12, color: COLORS.textMuted },
  
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});
