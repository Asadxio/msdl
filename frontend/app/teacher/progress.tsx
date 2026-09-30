/**
 * /teacher/progress.tsx
 *
 * Phase 70B — Complete Teacher Teaching Workflow
 * Dedicated Student Academic Progress & Analytics Screen.
 *
 * Provides teachers with aggregated progress metrics across their assigned classes:
 * - Attendance rates & presence
 * - Quiz performance & exam scores
 * - Assignment completion & evaluation rates
 * - Lesson completion tracking
 *
 * Scoped strictly to courses and subjects assigned to this teacher.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { getTeacherAcademicScope } from '@/lib/teacherScoping';
import { fetchTeacherStudentRoster, TeacherStudentRosterItem } from '@/lib/teacherAcademics';
import { goBackOrReplace } from '@/lib/navigation';

export default function TeacherProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { courses, teachers } = useData();
  const { courseId: initialCourseId } = useLocalSearchParams<{ courseId?: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roster, setRoster] = useState<TeacherStudentRosterItem[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(initialCourseId || 'all');

  const currentTeacher = useMemo(() => {
    return teachers.find(
      (t) =>
        t.id === user?.uid ||
        t.user_uid === user?.uid ||
        (profile?.name && t.name?.toLowerCase().includes(profile.name.toLowerCase()))
    );
  }, [teachers, user?.uid, profile?.name]);

  const scope = useMemo(() => {
    return getTeacherAcademicScope(courses, currentTeacher, user?.uid);
  }, [courses, currentTeacher, user?.uid]);

  const loadData = useCallback(async () => {
    if (!scope.teacherUid && !user?.uid) return;
    setLoading(true);
    try {
      const data = await fetchTeacherStudentRoster(scope);
      setRoster(data);
    } catch (err) {
      console.error('[TeacherProgressScreen] Error loading progress data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Filtered by course
  const filteredRoster = useMemo(() => {
    if (selectedCourseFilter === 'all') return roster;
    return roster.filter((r) => r.course_id.toLowerCase() === selectedCourseFilter.toLowerCase());
  }, [roster, selectedCourseFilter]);

  // Aggregated class metrics
  const classMetrics = useMemo(() => {
    const totalStudents = filteredRoster.length;
    if (totalStudents === 0) {
      return {
        avgAttendance: 0,
        avgQuiz: 0,
        assignmentCompletionRate: 0,
        passingStudentsCount: 0,
      };
    }

    const totalAttPercent = filteredRoster.reduce((acc, s) => acc + s.attendance.percentage, 0);
    const quizEligible = filteredRoster.filter((s) => s.quizzes.count > 0);
    const totalQuizPercent = quizEligible.reduce((acc, s) => acc + s.quizzes.avgPercentage, 0);

    const totalAssignments = filteredRoster.reduce((acc, s) => acc + s.assignments.total, 0);
    const reviewedAssignments = filteredRoster.reduce((acc, s) => acc + s.assignments.reviewed, 0);

    const passingCount = filteredRoster.filter(
      (s) => s.attendance.percentage >= 70 && (s.quizzes.count === 0 || s.quizzes.avgPercentage >= 60)
    ).length;

    return {
      avgAttendance: Math.round(totalAttPercent / totalStudents),
      avgQuiz: quizEligible.length > 0 ? Math.round(totalQuizPercent / quizEligible.length) : 0,
      assignmentCompletionRate: totalAssignments > 0 ? Math.round((reviewedAssignments / totalAssignments) * 100) : 100,
      passingStudentsCount: passingCount,
    };
  }, [filteredRoster]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Student Academic Progress</Text>
          <Text style={styles.headerSubtitle}>
            {filteredRoster.length} Active Students Analyzed Across Your Classes
          </Text>
        </View>
      </View>

      {/* Course Filter Pills */}
      <View style={styles.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, selectedCourseFilter === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedCourseFilter('all')}
          >
            <Text style={[styles.filterPillText, selectedCourseFilter === 'all' && styles.filterPillTextActive]}>
              All Classes ({roster.length})
            </Text>
          </TouchableOpacity>

          {scope.assignedCourses.map((c) => {
            const isSelected = selectedCourseFilter.toLowerCase() === c.id.toLowerCase();
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => setSelectedCourseFilter(c.id)}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Computing student academic performance...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Executive Progress KPI Grid */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkbox" size={20} color="#059669" />
              </View>
              <Text style={styles.kpiNum}>{classMetrics.avgAttendance}%</Text>
              <Text style={styles.kpiLabel}>Avg Attendance</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="school" size={20} color="#2563EB" />
              </View>
              <Text style={styles.kpiNum}>
                {classMetrics.avgQuiz > 0 ? `${classMetrics.avgQuiz}%` : 'N/A'}
              </Text>
              <Text style={styles.kpiLabel}>Quiz Average</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="document-text" size={20} color="#D97706" />
              </View>
              <Text style={styles.kpiNum}>{classMetrics.assignmentCompletionRate}%</Text>
              <Text style={styles.kpiLabel}>Task Evaluated</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="ribbon" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.kpiNum}>
                {classMetrics.passingStudentsCount}/{filteredRoster.length}
              </Text>
              <Text style={styles.kpiLabel}>On-Track Students</Text>
            </View>
          </View>

          {/* Section: Individual Student Progress Table */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Student Progress Breakdown</Text>
            <Text style={styles.sectionSub}>Attendance • Tasks • Quizzes</Text>
          </View>

          {filteredRoster.length > 0 ? (
            filteredRoster.map((student) => {
              const attColor = student.attendance.percentage >= 75 ? '#059669' : '#D97706';
              const quizColor = student.quizzes.avgPercentage >= 60 ? '#059669' : '#DC2626';

              return (
                <View key={`${student.uid}_${student.course_id}`} style={styles.progressRowCard}>
                  <View style={styles.studentInfoCol}>
                    <View style={styles.avatarMini}>
                      {student.photo_url ? (
                        <Image source={{ uri: student.photo_url }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarMiniText}>
                          {student.student_name[0]?.toUpperCase() || 'S'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.studentRowName} numberOfLines={1}>
                        {student.student_name}
                      </Text>
                      <Text style={styles.studentRowCourse} numberOfLines={1}>
                        {student.course_name}
                      </Text>
                    </View>
                  </View>

                  {/* Visual Progress Bar */}
                  <View style={styles.progressBarSection}>
                    <View style={styles.barLabelsRow}>
                      <Text style={styles.barLabelText}>Attendance Presence</Text>
                      <Text style={[styles.barPercentText, { color: attColor }]}>
                        {student.attendance.percentage}%
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(student.attendance.percentage, 100)}%`,
                            backgroundColor: attColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Summary badges */}
                  <View style={styles.summaryBadgesRow}>
                    <View style={styles.summaryBadge}>
                      <Ionicons name="checkbox-outline" size={12} color="#059669" />
                      <Text style={styles.summaryBadgeText}>
                        {student.attendance.present}/{student.attendance.total} Dars attended
                      </Text>
                    </View>

                    <View style={styles.summaryBadge}>
                      <Ionicons name="document-text-outline" size={12} color="#2563EB" />
                      <Text style={styles.summaryBadgeText}>
                        {student.assignments.reviewed}/{student.assignments.total} Tasks evaluated
                      </Text>
                    </View>

                    {student.quizzes.count > 0 && (
                      <View style={styles.summaryBadge}>
                        <Ionicons name="trophy-outline" size={12} color="#D97706" />
                        <Text style={styles.summaryBadgeText}>
                          Quiz Avg: {student.quizzes.avgPercentage}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Progress Records Available</Text>
              <Text style={styles.emptySubtitle}>
                No student progress entries found for the selected course filter.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  filterStrip: {
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  contentScroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    gap: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiNum: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  sectionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  progressRowCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.card,
  },
  studentInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarMiniText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  studentRowCourse: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  progressBarSection: {
    gap: 4,
  },
  barLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabelText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  barPercentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barTrack: {
    height: 7,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
