/**
 * /teacher/students.tsx
 *
 * Phase 70B — Complete Teacher Teaching Workflow
 * Dedicated Teacher Student Roster Screen.
 *
 * Relationship:
 * Teacher -> assigned course/subject -> active enrollments -> enrolled students.
 *
 * Scoped strictly to courses and subjects assigned to this teacher.
 * Zero cross-course student leakage.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  StatusBar,
  RefreshControl,
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

export default function TeacherStudentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { courses, teachers } = useData();
  const { courseId: initialCourseId } = useLocalSearchParams<{ courseId?: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roster, setRoster] = useState<TeacherStudentRosterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(initialCourseId || 'all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<TeacherStudentRosterItem | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'attendance' | 'assignments' | 'quizzes'>('overview');

  // Match canonical teacher record
  const currentTeacher = useMemo(() => {
    return teachers.find(
      (t) =>
        t.id === user?.uid ||
        t.user_uid === user?.uid ||
        (profile?.name && t.name?.toLowerCase().includes(profile.name.toLowerCase()))
    );
  }, [teachers, user?.uid, profile?.name]);

  // Academic scope for this teacher
  const scope = useMemo(() => {
    return getTeacherAcademicScope(courses, currentTeacher, user?.uid);
  }, [courses, currentTeacher, user?.uid]);

  const loadRoster = useCallback(async () => {
    if (!scope.teacherUid && !user?.uid) return;
    setLoading(true);
    try {
      const data = await fetchTeacherStudentRoster(scope);
      setRoster(data);
    } catch (err) {
      console.error('[TeacherStudentsScreen] Error loading roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, user?.uid]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRoster();
  };

  // Available subjects for the currently selected course filter
  const availableSubjectsForFilter = useMemo(() => {
    if (selectedCourseFilter === 'all') {
      const allSubs = new Set<string>();
      scope.subjectsByCourseId.forEach((subs) => {
        subs.forEach((s) => allSubs.add(s.name));
      });
      return Array.from(allSubs);
    }
    const subs = scope.subjectsByCourseId.get(selectedCourseFilter) || [];
    return subs.map((s) => s.name);
  }, [selectedCourseFilter, scope]);

  // Filtered roster based on course, subject, and search query
  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      // Course filter
      if (selectedCourseFilter !== 'all' && item.course_id.toLowerCase() !== selectedCourseFilter.toLowerCase()) {
        return false;
      }
      // Subject filter
      if (selectedSubjectFilter !== 'all' && !item.subjects_enrolled.includes(selectedSubjectFilter)) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.student_name.toLowerCase().includes(q);
        const matchesEmail = item.student_email?.toLowerCase().includes(q);
        const matchesId = item.student_id?.toLowerCase().includes(q) || item.uid.toLowerCase().includes(q);
        const matchesCourse = item.course_name.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesId || matchesCourse;
      }
      return true;
    });
  }, [roster, selectedCourseFilter, selectedSubjectFilter, searchQuery]);

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
          <Text style={styles.headerTitle}>My Students Roster</Text>
          <Text style={styles.headerSubtitle}>
            {scope.assignedCourses.length} Assigned Class(es) • {roster.length} Enrolled Students
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name, ID or course..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Course Filter Pills */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, selectedCourseFilter === 'all' && styles.filterPillActive]}
            onPress={() => {
              setSelectedCourseFilter('all');
              setSelectedSubjectFilter('all');
            }}
          >
            <Text style={[styles.filterPillText, selectedCourseFilter === 'all' && styles.filterPillTextActive]}>
              All Classes ({roster.length})
            </Text>
          </TouchableOpacity>

          {scope.assignedCourses.map((c) => {
            const count = roster.filter((r) => r.course_id.toLowerCase() === c.id.toLowerCase()).length;
            const isSelected = selectedCourseFilter.toLowerCase() === c.id.toLowerCase();
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => {
                  setSelectedCourseFilter(c.id);
                  setSelectedSubjectFilter('all');
                }}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {c.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Subject Filter Pills (if multiple subjects exist in selected course) */}
      {availableSubjectsForFilter.length > 0 && (
        <View style={styles.subjectFilterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.subFilterPill, selectedSubjectFilter === 'all' && styles.subFilterPillActive]}
              onPress={() => setSelectedSubjectFilter('all')}
            >
              <Text style={[styles.subFilterPillText, selectedSubjectFilter === 'all' && styles.subFilterPillTextActive]}>
                All Subjects
              </Text>
            </TouchableOpacity>

            {availableSubjectsForFilter.map((subName) => {
              const isSelected = selectedSubjectFilter === subName;
              return (
                <TouchableOpacity
                  key={subName}
                  style={[styles.subFilterPill, isSelected && styles.subFilterPillActive]}
                  onPress={() => setSelectedSubjectFilter(subName)}
                >
                  <Text style={[styles.subFilterPillText, isSelected && styles.subFilterPillTextActive]}>
                    {subName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Roster List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading assigned student roster...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredRoster.length > 0 ? (
            filteredRoster.map((student) => (
              <TouchableOpacity
                key={`${student.uid}_${student.course_id}`}
                style={styles.studentCard}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedStudent(student);
                  setModalTab('overview');
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatarWrap}>
                    {student.photo_url ? (
                      <Image source={{ uri: student.photo_url }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                          {student.student_name ? student.student_name[0].toUpperCase() : 'S'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.studentName} numberOfLines={1}>
                      {student.student_name}
                    </Text>
                    <Text style={styles.courseTag} numberOfLines={1}>
                      {student.course_name}
                    </Text>
                    {student.subjects_enrolled.length > 0 && (
                      <Text style={styles.subjectTag} numberOfLines={1}>
                        Subject(s): {student.subjects_enrolled.join(', ')}
                      </Text>
                    )}
                  </View>

                  <View style={styles.actionChevron}>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </View>
                </View>

                {/* Academic Metrics Row */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>ATTENDANCE</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: student.attendance.percentage >= 75 ? '#059669' : '#D97706' },
                      ]}
                    >
                      {student.attendance.percentage}%
                    </Text>
                    <Text style={styles.metricSub}>
                      {student.attendance.present}/{student.attendance.total} days
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>ASSIGNMENTS</Text>
                    <Text style={styles.metricValue}>
                      {student.assignments.reviewed}/{student.assignments.total}
                    </Text>
                    <Text style={styles.metricSub}>
                      {student.assignments.pendingReview > 0
                        ? `${student.assignments.pendingReview} pending`
                        : 'Reviewed'}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>QUIZ AVG</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: student.quizzes.avgPercentage >= 60 ? '#059669' : '#DC2626' },
                      ]}
                    >
                      {student.quizzes.count > 0 ? `${student.quizzes.avgPercentage}%` : 'N/A'}
                    </Text>
                    <Text style={styles.metricSub}>
                      {student.quizzes.count} taken
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No students matched your search criteria.'
                  : 'No active student enrollments found for the selected academic filter.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Student Academic Details Modal */}
      <Modal
        visible={!!selectedStudent}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            {selectedStudent && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalAvatarWrap}>
                    {selectedStudent.photo_url ? (
                      <Image source={{ uri: selectedStudent.photo_url }} style={styles.modalAvatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                          {selectedStudent.student_name[0]?.toUpperCase() || 'S'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.modalStudentName}>{selectedStudent.student_name}</Text>
                    <Text style={styles.modalStudentCourse}>
                      {selectedStudent.course_name} • {selectedStudent.subjects_enrolled.join(', ')}
                    </Text>
                    {selectedStudent.student_email && (
                      <Text style={styles.modalStudentEmail}>{selectedStudent.student_email}</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedStudent(null)}>
                    <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Modal Sub-Tabs */}
                <View style={styles.modalTabsRow}>
                  <TouchableOpacity
                    style={[styles.modalTab, modalTab === 'overview' && styles.modalTabActive]}
                    onPress={() => setModalTab('overview')}
                  >
                    <Text style={[styles.modalTabText, modalTab === 'overview' && styles.modalTabTextActive]}>
                      Overview
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalTab, modalTab === 'attendance' && styles.modalTabActive]}
                    onPress={() => setModalTab('attendance')}
                  >
                    <Text style={[styles.modalTabText, modalTab === 'attendance' && styles.modalTabTextActive]}>
                      Attendance
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalTab, modalTab === 'assignments' && styles.modalTabActive]}
                    onPress={() => setModalTab('assignments')}
                  >
                    <Text style={[styles.modalTabText, modalTab === 'assignments' && styles.modalTabTextActive]}>
                      Work
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalTab, modalTab === 'quizzes' && styles.modalTabActive]}
                    onPress={() => setModalTab('quizzes')}
                  >
                    <Text style={[styles.modalTabText, modalTab === 'quizzes' && styles.modalTabTextActive]}>
                      Quizzes
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                  {modalTab === 'overview' && (
                    <View style={styles.tabContentBox}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Enrollment Status</Text>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{selectedStudent.status.toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Class / Course</Text>
                        <Text style={styles.detailValue}>{selectedStudent.course_name}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Assigned Subject(s)</Text>
                        <Text style={styles.detailValue}>{selectedStudent.subjects_enrolled.join(', ')}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Attendance Presence</Text>
                        <Text style={styles.detailValue}>
                          {selectedStudent.attendance.present} Present / {selectedStudent.attendance.absent} Absent ({selectedStudent.attendance.percentage}%)
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Submitted Tasks</Text>
                        <Text style={styles.detailValue}>
                          {selectedStudent.assignments.total} assignments recorded ({selectedStudent.assignments.reviewed} evaluated)
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quiz Assessment Average</Text>
                        <Text style={styles.detailValue}>
                          {selectedStudent.quizzes.count > 0 ? `${selectedStudent.quizzes.avgPercentage}%` : 'No quizzes attempted'}
                        </Text>
                      </View>

                      {/* Quick Action Navigation */}
                      <View style={styles.modalActionsRow}>
                        <TouchableOpacity
                          style={styles.modalActionBtn}
                          onPress={() => {
                            setSelectedStudent(null);
                            router.push({ pathname: '/(tabs)/attendance', params: { courseId: selectedStudent.course_id } } as any);
                          }}
                        >
                          <Ionicons name="checkbox-outline" size={16} color={COLORS.primary} />
                          <Text style={styles.modalActionBtnText}>Mark Attendance</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.modalActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                          onPress={() => {
                            setSelectedStudent(null);
                            router.push('/(tabs)/chats' as any);
                          }}
                        >
                          <Ionicons name="chatbubbles-outline" size={16} color="#2563EB" />
                          <Text style={[styles.modalActionBtnText, { color: '#2563EB' }]}>Message Student</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {modalTab === 'attendance' && (
                    <View style={styles.tabContentBox}>
                      <View style={styles.metricSummaryCard}>
                        <Text style={styles.summaryTitle}>Attendance Performance</Text>
                        <Text style={styles.summaryRate}>{selectedStudent.attendance.percentage}%</Text>
                        <Text style={styles.summaryDetail}>
                          Total Sessions Recorded: {selectedStudent.attendance.total} • Present: {selectedStudent.attendance.present} • Absent: {selectedStudent.attendance.absent}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.openFullBtn}
                        onPress={() => {
                          setSelectedStudent(null);
                          router.push({ pathname: '/(tabs)/attendance', params: { courseId: selectedStudent.course_id } } as any);
                        }}
                      >
                        <Text style={styles.openFullBtnText}>Open Class Attendance Register</Text>
                        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {modalTab === 'assignments' && (
                    <View style={styles.tabContentBox}>
                      <View style={styles.metricSummaryCard}>
                        <Text style={styles.summaryTitle}>Assignments & Tasks</Text>
                        <Text style={styles.summaryRate}>
                          {selectedStudent.assignments.reviewed} / {selectedStudent.assignments.total}
                        </Text>
                        <Text style={styles.summaryDetail}>
                          Reviewed Submissions: {selectedStudent.assignments.reviewed} • Pending Review: {selectedStudent.assignments.pendingReview}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.openFullBtn}
                        onPress={() => {
                          setSelectedStudent(null);
                          router.push('/teacher/assignments' as any);
                        }}
                      >
                        <Text style={styles.openFullBtnText}>Open Assignment Evaluation Workspace</Text>
                        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {modalTab === 'quizzes' && (
                    <View style={styles.tabContentBox}>
                      <View style={styles.metricSummaryCard}>
                        <Text style={styles.summaryTitle}>Quiz Assessments</Text>
                        <Text style={styles.summaryRate}>
                          {selectedStudent.quizzes.count > 0 ? `${selectedStudent.quizzes.avgPercentage}%` : 'N/A'}
                        </Text>
                        <Text style={styles.summaryDetail}>
                          Assessments Completed: {selectedStudent.quizzes.count}
                          {selectedStudent.quizzes.lastResult
                            ? ` • Last: ${selectedStudent.quizzes.lastResult.category} (${selectedStudent.quizzes.lastResult.percentage}%)`
                            : ''}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textMain,
  },
  filterSection: {
    marginTop: 10,
  },
  subjectFilterSection: {
    marginTop: 6,
  },
  filterScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
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
  subFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subFilterPillActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  subFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  subFilterPillTextActive: {
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
  listContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    gap: 12,
  },
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  courseTag: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  subjectTag: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionChevron: {
    paddingLeft: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.md,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalAvatar: {
    width: '100%',
    height: '100%',
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalStudentCourse: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  modalStudentEmail: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginTop: 8,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  modalTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabContentBox: {
    paddingVertical: 14,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.textMain,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: '#ECFDF5',
  },
  modalActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  metricSummaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  summaryRate: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    marginVertical: 6,
  },
  summaryDetail: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  openFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    marginTop: 8,
  },
  openFullBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
