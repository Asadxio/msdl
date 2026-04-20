import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type QuizResult = { id: string; score: number; total_questions: number };
type Attendance = { id: string; status: 'present' | 'absent' };

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const [quizSnap, attendanceSnap] = await Promise.all([
          getDocs(query(collection(db, 'quiz_results'), where('user_id', '==', user.uid), orderBy('created_at', 'desc'))),
          getDocs(query(collection(db, 'attendance'), where('user_id', '==', user.uid), orderBy('created_at', 'desc'))),
        ]);
        const quizArr: QuizResult[] = [];
        quizSnap.forEach((d) => quizArr.push({ id: d.id, ...(d.data() as any) }));
        const attendanceArr: Attendance[] = [];
        attendanceSnap.forEach((d) => attendanceArr.push({ id: d.id, ...(d.data() as any) }));
        setQuizResults(quizArr);
        setAttendance(attendanceArr);
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => setLoading(false));
  }, [user?.uid]);

  const avgQuizScore = useMemo(() => {
    if (!quizResults.length) return 0;
    const totalPct = quizResults.reduce((sum, r) => sum + (r.total_questions ? (r.score / r.total_questions) * 100 : 0), 0);
    return Math.round(totalPct / quizResults.length);
  }, [quizResults]);

  const attendancePct = useMemo(() => {
    if (!attendance.length) return 0;
    const present = attendance.filter((a) => a.status === 'present').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Progress</Text>
        <Text style={styles.subtitle}>Quiz + attendance insights</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.metricLabel}>Quiz Attempts</Text>
            <Text style={styles.metricValue}>{quizResults.length}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.metricLabel}>Average Quiz Score</Text>
            <Text style={styles.metricValue}>{avgQuizScore}%</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.metricLabel}>Attendance Present</Text>
            <Text style={styles.metricValue}>{attendancePct}%</Text>
          </View>
          {quizResults.length === 0 && attendance.length === 0 ? (
            <Text style={styles.empty}>No progress data yet. Complete quiz and attendance to see insights.</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.md, gap: 10, paddingBottom: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  metricLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  metricValue: { fontSize: 28, color: COLORS.primary, fontWeight: '800', marginTop: 4 },
  empty: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
