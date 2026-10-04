/**
 * /teacher/assignments.tsx
 *
 * Phase 70B — Complete Teacher Teaching Workflow
 * Dedicated Teacher Assignment Creation & Submission Evaluation Screen.
 *
 * Scoped strictly to courses and subjects assigned to this teacher.
 * Allows teachers to create homework/dars assignments and review student submissions with feedback & marks.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  StatusBar,
  RefreshControl,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { getTeacherAcademicScope } from '@/lib/teacherScoping';
import {
  createTeacherAssignment,
  reviewTeacherSubmission,
  CreateAssignmentInput,
} from '@/lib/teacherAcademics';
import { goBackOrReplace } from '@/lib/navigation';

interface LocalAssignment {
  id: string;
  course_id: string;
  module_id?: string;
  lesson_id?: string;
  subject_id?: string;
  subject_name?: string;
  title: string;
  description: string;
  due_date?: string;
  file_url?: string;
  created_at?: any;
  submissionCount?: number;
  pendingCount?: number;
}

interface LocalSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  student_name?: string;
  assignment_title?: string;
  course_id?: string;
  course_name?: string;
  file_url?: string;
  file_name?: string;
  text_answer?: string;
  status: 'submitted' | 'reviewed';
  feedback?: string;
  grade?: string;
  submitted_at?: any;
  reviewed_at?: any;
  reviewed_by?: string;
}

export default function TeacherAssignmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { courses, teachers } = useData();
  const { courseId: initialCourseId } = useLocalSearchParams<{ courseId?: string }>();

  // Teacher scope
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

  // Active Tab: 'assignments' | 'submissions'
  const [activeTab, setActiveTab] = useState<'assignments' | 'submissions'>('assignments');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(
    initialCourseId || 'all'
  );

  // Data states
  const [assignments, setAssignments] = useState<LocalAssignment[]>([]);
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Assignment Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCourseId, setNewCourseId] = useState(
    selectedCourseFilter !== 'all' ? selectedCourseFilter : (scope.assignedCourses[0]?.id ?? '')
  );
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Review Submission Modal
  const [selectedSubmission, setSelectedSubmission] = useState<LocalSubmission | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [gradeInput, setGradeInput] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // Available subjects for the new assignment's selected course
  const availableSubjectsForNew = useMemo(() => {
    if (!newCourseId) return [];
    return scope.subjectsByCourseId.get(newCourseId) || [];
  }, [newCourseId, scope]);

  // Load assignments and submissions for all assigned courses
  const loadData = useCallback(async () => {
    if (scope.assignedCourseIds.size === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const courseIdList = Array.from(
        new Set([
          ...scope.assignedCourses.map((c) => c.id).filter(Boolean),
          ...scope.assignedCourses.map((c) => c.name).filter(Boolean),
          ...Array.from(scope.assignedCourseIds),
        ])
      );
      const queryChunks: string[][] = [];
      for (let i = 0; i < courseIdList.length; i += 25) {
        queryChunks.push(courseIdList.slice(i, i + 25));
      }

      // 1. Fetch Assignments
      const allAssignments: LocalAssignment[] = [];
      for (const chunk of queryChunks) {
        const q = query(
          collection(db, 'assignments'),
          where('course_id', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data();
          allAssignments.push({
            id: d.id,
            course_id: data.course_id,
            module_id: data.module_id,
            lesson_id: data.lesson_id,
            subject_id: data.subject_id,
            subject_name: data.subject_name,
            title: data.title || 'Untitled Assignment',
            description: data.description || '',
            due_date: data.due_date,
            file_url: data.file_url,
            created_at: data.created_at,
          });
        });
      }

      // 2. Fetch Submissions
      const assignmentIdMap = new Map(allAssignments.map((a) => [a.id, a]));
      const allSubmissions: LocalSubmission[] = [];

      // Query submissions collection (ordered in memory to support docs with created_at or submitted_at)
      const subQ = query(
        collection(db, 'submissions'),
        limit(200)
      );
      const subSnap = await getDocs(subQ);

      // Student UIDs to fetch names
      const studentUidsToFetch = new Set<string>();

      subSnap.forEach((d) => {
        const data = d.data();
        const matchedAssignment = assignmentIdMap.get(data.assignment_id);
        const isAssignedCourse = data.course_id && (
          scope.assignedCourseIds.has(String(data.course_id)) ||
          scope.assignedCourseIds.has(String(data.course_id).toLowerCase())
        );

        if (matchedAssignment || isAssignedCourse) {
          const cId = data.course_id || matchedAssignment?.course_id || '';
          const targetCourse = scope.assignedCourses.find((c) =>
            c.id === cId ||
            c.id.toLowerCase() === cId.toLowerCase() ||
            c.name === cId ||
            c.name.toLowerCase() === cId.toLowerCase()
          );
          const sUid = data.user_id || '';
          if (sUid) studentUidsToFetch.add(sUid);

          allSubmissions.push({
            id: d.id,
            assignment_id: data.assignment_id || '',
            user_id: sUid,
            assignment_title: matchedAssignment?.title || 'Assignment Task',
            course_id: cId,
            course_name: targetCourse?.name || 'Class Course',
            file_url: data.file_url,
            file_name: data.file_name,
            text_answer: data.text_answer,
            status: data.status === 'reviewed' ? 'reviewed' : 'submitted',
            feedback: data.feedback || '',
            grade: data.grade || '',
            submitted_at: data.submitted_at || data.created_at,
            reviewed_at: data.reviewed_at,
            reviewed_by: data.reviewed_by,
          });
        }
      });

      // Sort submissions by timestamp descending
      allSubmissions.sort((a, b) => {
        const timeA = (a.submitted_at as any)?.toMillis ? (a.submitted_at as any).toMillis() : ((a.submitted_at as any)?._seconds ? (a.submitted_at as any)._seconds * 1000 : 0);
        const timeB = (b.submitted_at as any)?.toMillis ? (b.submitted_at as any).toMillis() : ((b.submitted_at as any)?._seconds ? (b.submitted_at as any)._seconds * 1000 : 0);
        return timeB - timeA;
      });

      // Fetch student names for display
      const uidsArray = Array.from(studentUidsToFetch);
      const studentNameMap = new Map<string, string>();
      for (let i = 0; i < uidsArray.length; i += 25) {
        const chunk = uidsArray.slice(i, i + 25);
        const uq = query(collection(db, 'users'), where('__name__', 'in', chunk));
        const usnap = await getDocs(uq);
        usnap.forEach((ud) => {
          studentNameMap.set(ud.id, ud.data()?.name || `Student (${ud.id.slice(0, 6)})`);
        });
      }

      // Attach student names to submissions
      allSubmissions.forEach((sub) => {
        sub.student_name = studentNameMap.get(sub.user_id) || `Student (${sub.user_id.slice(0, 6)})`;
      });

      // Compute submission counts per assignment
      allAssignments.forEach((a) => {
        const matchingSubs = allSubmissions.filter((s) => s.assignment_id === a.id);
        a.submissionCount = matchingSubs.length;
        a.pendingCount = matchingSubs.filter((s) => s.status === 'submitted').length;
      });

      setAssignments(allAssignments);
      setSubmissions(allSubmissions);
    } catch (err) {
      console.error('[TeacherAssignmentsScreen] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    if (selectedCourseFilter === 'all') return assignments;
    return assignments.filter((a) => a.course_id.toLowerCase() === selectedCourseFilter.toLowerCase());
  }, [assignments, selectedCourseFilter]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    if (selectedCourseFilter === 'all') return submissions;
    return submissions.filter((s) => s.course_id?.toLowerCase() === selectedCourseFilter.toLowerCase());
  }, [submissions, selectedCourseFilter]);

  // Create Assignment Action
  const handleCreateAssignment = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter an assignment title.');
      return;
    }
    if (!newDescription.trim()) {
      Alert.alert('Required', 'Please enter instructions or tasks for the student.');
      return;
    }
    if (!newCourseId) {
      Alert.alert('Required', 'Please choose an assigned course.');
      return;
    }

    setSavingAssignment(true);
    try {
      const selectedSub = availableSubjectsForNew.find((s) => s.name === newSubjectName);

      const input: CreateAssignmentInput = {
        courseId: newCourseId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        subjectId: selectedSub?.id,
        subjectName: newSubjectName || undefined,
        dueDate: newDueDate.trim() || undefined,
        fileUrl: newFileUrl.trim() || undefined,
      };

      const res = await createTeacherAssignment(scope, input, user?.uid || '', profile?.name);
      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to create assignment.');
        return;
      }

      Alert.alert('Assignment Published', 'Enrolled students have been notified of this new assignment.');
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      setNewFileUrl('');
      setCreateModalVisible(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to publish assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  // Open Review Submission Modal
  const handleOpenReview = (submission: LocalSubmission) => {
    setSelectedSubmission(submission);
    setFeedbackInput(submission.feedback || '');
    setGradeInput(submission.grade || '');
  };

  // Save Submission Review
  const handleSaveReview = async () => {
    if (!selectedSubmission) return;
    if (!feedbackInput.trim() && !gradeInput.trim()) {
      Alert.alert('Required', 'Please enter feedback notes or marks for the student.');
      return;
    }

    setSavingReview(true);
    try {
      const res = await reviewTeacherSubmission(
        selectedSubmission.id,
        feedbackInput.trim(),
        gradeInput.trim() || undefined,
        user?.uid || '',
        profile?.name || 'Faculty Member'
      );

      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to record review.');
        return;
      }

      Alert.alert('Evaluation Saved', 'Your marks and feedback have been shared with the student.');
      setSelectedSubmission(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save review.');
    } finally {
      setSavingReview(false);
    }
  };

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
          <Text style={styles.headerTitle}>Assignments & Evaluations</Text>
          <Text style={styles.headerSubtitle}>
            {assignments.length} Tasks Created • {submissions.filter((s) => s.status === 'submitted').length} Awaiting Review
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createTaskHeaderBtn}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.createTaskHeaderBtnText}>New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs: Assignments vs Submissions */}
      <View style={styles.tabsStrip}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'assignments' && styles.tabBtnActive]}
          onPress={() => setActiveTab('assignments')}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={activeTab === 'assignments' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabBtnText, activeTab === 'assignments' && styles.tabBtnTextActive]}>
            Created Tasks ({assignments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'submissions' && styles.tabBtnActive]}
          onPress={() => setActiveTab('submissions')}
        >
          <Ionicons
            name="clipboard-outline"
            size={16}
            color={activeTab === 'submissions' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabBtnText, activeTab === 'submissions' && styles.tabBtnTextActive]}>
            Submissions ({submissions.length})
          </Text>
          {submissions.filter((s) => s.status === 'submitted').length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {submissions.filter((s) => s.status === 'submitted').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Course Filter Strip */}
      <View style={styles.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, selectedCourseFilter === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedCourseFilter('all')}
          >
            <Text style={[styles.filterPillText, selectedCourseFilter === 'all' && styles.filterPillTextActive]}>
              All Classes
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

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading assignments & student submissions...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: CREATED ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <>
              {filteredAssignments.length > 0 ? (
                filteredAssignments.map((item) => {
                  const targetCourse = scope.assignedCourses.find((c) => c.id.toLowerCase() === item.course_id.toLowerCase());
                  return (
                    <View key={item.id} style={styles.assignmentCard}>
                      <View style={styles.assignmentHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.assignmentTitle}>{item.title}</Text>
                          <Text style={styles.assignmentCourseTag}>
                            {targetCourse?.name || 'Class Course'}
                            {item.subject_name ? ` • ${item.subject_name}` : ''}
                          </Text>
                        </View>
                        {item.due_date && (
                          <View style={styles.dueDateBadge}>
                            <Ionicons name="time-outline" size={12} color="#92400E" />
                            <Text style={styles.dueDateText}>Due: {item.due_date}</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.assignmentDescription} numberOfLines={3}>
                        {item.description}
                      </Text>

                      {item.file_url ? (
                        <TouchableOpacity
                          style={styles.attachmentLink}
                          onPress={() => item.file_url && Linking.openURL(item.file_url).catch(() => {})}
                        >
                          <Ionicons name="attach" size={14} color={COLORS.primary} />
                          <Text style={styles.attachmentLinkText} numberOfLines={1}>
                            Attached Reference Material
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {/* Submissions Summary */}
                      <View style={styles.assignmentFooter}>
                        <View style={styles.subCountBadge}>
                          <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
                          <Text style={styles.subCountText}>
                            {item.submissionCount || 0} Submissions
                          </Text>
                        </View>

                        {item.pendingCount && item.pendingCount > 0 ? (
                          <View style={styles.needsReviewPill}>
                            <Text style={styles.needsReviewText}>
                              {item.pendingCount} Needs Review
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.allDonePill}>
                            <Ionicons name="checkmark-circle" size={12} color="#059669" />
                            <Text style={styles.allDoneText}>Evaluations Current</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No Assignments Created</Text>
                  <Text style={styles.emptySubtitle}>
                    Post your first homework, recitation task, or writing assignment for your students.
                  </Text>
                  <TouchableOpacity
                    style={styles.initTaskBtn}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.initTaskBtnText}>Create Assignment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* TAB 2: STUDENT SUBMISSIONS & EVALUATIONS */}
          {activeTab === 'submissions' && (
            <>
              {filteredSubmissions.length > 0 ? (
                filteredSubmissions.map((sub) => {
                  const dateStr = sub.submitted_at?.toDate
                    ? sub.submitted_at.toDate().toLocaleDateString()
                    : 'Recent';

                  return (
                    <View key={sub.id} style={styles.submissionCard}>
                      <View style={styles.subHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subStudentName}>{sub.student_name}</Text>
                          <Text style={styles.subTaskTitle} numberOfLines={1}>
                            {sub.assignment_title} • {sub.course_name}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            sub.status === 'reviewed' ? styles.statusBadgeReviewed : styles.statusBadgePending,
                          ]}
                        >
                          <Ionicons
                            name={sub.status === 'reviewed' ? 'checkmark-circle' : 'time-outline'}
                            size={12}
                            color={sub.status === 'reviewed' ? '#059669' : '#D97706'}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              sub.status === 'reviewed' ? styles.statusTextReviewed : styles.statusTextPending,
                            ]}
                          >
                            {sub.status === 'reviewed' ? 'Evaluated' : 'Needs Review'}
                          </Text>
                        </View>
                      </View>

                      {/* Student's answer or attached file */}
                      {sub.text_answer ? (
                        <View style={styles.studentAnswerBox}>
                          <Text style={styles.answerBoxLabel}>STUDENT ANSWER</Text>
                          <Text style={styles.answerBoxText}>{sub.text_answer}</Text>
                        </View>
                      ) : null}

                      {sub.file_url ? (
                        <TouchableOpacity
                          style={styles.subFileBtn}
                          onPress={() => sub.file_url && Linking.openURL(sub.file_url).catch(() => {})}
                        >
                          <Ionicons name="document-attach-outline" size={16} color={COLORS.primary} />
                          <Text style={styles.subFileBtnText} numberOfLines={1}>
                            View Submitted File: {sub.file_name || 'Assignment File'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {/* Existing Feedback preview if already reviewed */}
                      {sub.status === 'reviewed' && (sub.feedback || sub.grade) ? (
                        <View style={styles.existingFeedbackBox}>
                          {sub.grade ? (
                            <Text style={styles.existingGradeText}>Marks / Grade: {sub.grade}</Text>
                          ) : null}
                          {sub.feedback ? (
                            <Text style={styles.existingFeedbackText}>Note: {sub.feedback}</Text>
                          ) : null}
                          {sub.reviewed_by ? (
                            <Text style={styles.reviewedMetaText}>By {sub.reviewed_by}</Text>
                          ) : null}
                        </View>
                      ) : null}

                      <View style={styles.subFooter}>
                        <Text style={styles.subDateText}>Submitted: {dateStr}</Text>

                        <TouchableOpacity
                          style={styles.reviewActionBtn}
                          onPress={() => handleOpenReview(sub)}
                        >
                          <Ionicons
                            name="create-outline"
                            size={14}
                            color="#FFFFFF"
                          />
                          <Text style={styles.reviewActionBtnText}>
                            {sub.status === 'reviewed' ? 'Edit Evaluation' : 'Evaluate & Grade'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="#059669" />
                  <Text style={styles.emptyTitle}>All Submissions Evaluated</Text>
                  <Text style={styles.emptySubtitle}>
                    There are no student submissions pending evaluation for the selected course filter.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* CREATE ASSIGNMENT MODAL */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Assignment</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={{ maxHeight: 460 }}
            >
              <View style={styles.formBox}>
                {/* Course Selection */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>ASSIGNED CLASS / COURSE *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    {scope.assignedCourses.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.smallPill,
                          newCourseId.toLowerCase() === c.id.toLowerCase() && styles.smallPillActive,
                        ]}
                        onPress={() => {
                          setNewCourseId(c.id);
                          setNewSubjectName('');
                        }}
                      >
                        <Text
                          style={[
                            styles.smallPillText,
                            newCourseId.toLowerCase() === c.id.toLowerCase() && styles.smallPillTextActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Subject Selection */}
                {availableSubjectsForNew.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>SUBJECT (OPTIONAL)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {availableSubjectsForNew.map((sub) => (
                        <TouchableOpacity
                          key={sub.id}
                          style={[
                            styles.smallPill,
                            newSubjectName === sub.name && styles.smallPillActive,
                          ]}
                          onPress={() => setNewSubjectName(sub.name)}
                        >
                          <Text
                            style={[
                              styles.smallPillText,
                              newSubjectName === sub.name && styles.smallPillTextActive,
                            ]}
                          >
                            {sub.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Title */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>ASSIGNMENT TITLE *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Surah al-Mulk Ayat 1-10 Tajweed Recitation"
                    placeholderTextColor={COLORS.textMuted}
                    value={newTitle}
                    onChangeText={setNewTitle}
                  />
                </View>

                {/* Description & Tasks */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>INSTRUCTIONS & REQUIRED WORK *</Text>
                  <TextInput
                    style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
                    placeholder="Detail the exercises, questions, or audio recitation students must submit..."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    value={newDescription}
                    onChangeText={setNewDescription}
                  />
                </View>

                {/* Due Date */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>DUE DATE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Next Monday, 5:00 PM"
                    placeholderTextColor={COLORS.textMuted}
                    value={newDueDate}
                    onChangeText={setNewDueDate}
                  />
                </View>

                {/* Attachment Link */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>ATTACHMENT / REFERENCE URL (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://... worksheet PDF or reference audio"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={newFileUrl}
                    onChangeText={setNewFileUrl}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.publishBtn, savingAssignment && { opacity: 0.7 }]}
                  disabled={savingAssignment}
                  onPress={handleCreateAssignment}
                >
                  {savingAssignment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.publishBtnText}>Publish Assignment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EVALUATION & GRADING MODAL */}
      <Modal
        visible={!!selectedSubmission}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSubmission(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Evaluate Submission</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedSubmission?.student_name} • {selectedSubmission?.assignment_title}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSubmission(null)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedSubmission && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={{ maxHeight: 440 }}
              >
                <View style={styles.formBox}>
                  {/* Submission detail */}
                  {selectedSubmission.text_answer ? (
                    <View style={styles.studentAnswerBox}>
                      <Text style={styles.answerBoxLabel}>STUDENT ANSWER</Text>
                      <Text style={styles.answerBoxText}>{selectedSubmission.text_answer}</Text>
                    </View>
                  ) : null}

                  {selectedSubmission.file_url ? (
                    <TouchableOpacity
                      style={styles.subFileBtn}
                      onPress={() => selectedSubmission.file_url && Linking.openURL(selectedSubmission.file_url).catch(() => {})}
                    >
                      <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.subFileBtnText}>
                        Open Submitted File ({selectedSubmission.file_name || 'Document'})
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Marks / Grade Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>MARKS / GRADE (OPTIONAL)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 9/10, A+, or Mumtaz"
                      placeholderTextColor={COLORS.textMuted}
                      value={gradeInput}
                      onChangeText={setGradeInput}
                    />
                  </View>

                  {/* Teacher Feedback Notes */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>TEACHER FEEDBACK & ADVICE *</Text>
                    <TextInput
                      style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
                      placeholder="Provide constructive feedback, pronunciation tips, or praise..."
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      value={feedbackInput}
                      onChangeText={setFeedbackInput}
                    />
                  </View>

                  {/* Save Review Button */}
                  <TouchableOpacity
                    style={[styles.publishBtn, savingReview && { opacity: 0.7 }]}
                    disabled={savingReview}
                    onPress={handleSaveReview}
                  >
                    {savingReview ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                        <Text style={styles.publishBtnText}>Submit Evaluation</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
  createTaskHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  createTaskHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterStrip: {
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
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
    paddingTop: 12,
    gap: 12,
  },
  assignmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.card,
  },
  assignmentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  assignmentCourseTag: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  assignmentDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  attachmentLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  assignmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  needsReviewPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  needsReviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  allDonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  allDoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  submissionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.card,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subStudentName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  subTaskTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeReviewed: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextReviewed: {
    color: '#059669',
  },
  studentAnswerBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  answerBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  answerBoxText: {
    fontSize: 13,
    color: COLORS.textMain,
    lineHeight: 18,
  },
  subFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  subFileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    flex: 1,
  },
  existingFeedbackBox: {
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 2,
  },
  existingGradeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  existingFeedbackText: {
    fontSize: 12,
    color: '#166534',
  },
  reviewedMetaText: {
    fontSize: 10,
    color: '#15803D',
    marginTop: 2,
  },
  subFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subDateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  reviewActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
  initTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginTop: 16,
  },
  initTaskBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  formBox: {
    paddingVertical: 12,
    gap: 12,
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
  },
  smallPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  smallPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  smallPillTextActive: {
    color: '#FFFFFF',
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginTop: 8,
    ...SHADOWS.card,
  },
  publishBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
