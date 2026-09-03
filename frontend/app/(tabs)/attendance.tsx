import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { filterTeacherAssignedCourses } from '@/lib/enrollments';

// ── Types ────────────────────────────────────────────────────────────────────

export type AttendanceItem = {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  date: string;
  status: 'present' | 'absent';
  marked_by: string;
  marked_by_uid?: string;
  marked_by_name?: string;
  course_id?: string;
  live_class_id?: string;
  duration_seconds?: number;
  created_at?: { toDate?: () => Date };
  marked_at?: { toDate?: () => Date };
  updated_at?: { toDate?: () => Date };
};

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

function getMillis(value?: { toDate?: () => Date }): number {
  try {
    return value?.toDate ? value.toDate().getTime() : 0;
  } catch {
    return 0;
  }
}

function formatMarkedAt(value?: { toDate?: () => Date }): string {
  try {
    const dt = value?.toDate ? value.toDate() : null;
    if (!dt) return 'Recent';
    return dt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recent';
  }
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { courses, teachers, enrolledCourses, userEnrollments } = useData();

  const isTeacher = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const canMark = isTeacher || isAdmin;

  // Selected Date & Course filter
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchStudentQuery, setSearchStudentQuery] = useState('');

  // Data states
  const [history, setHistory] = useState<AttendanceItem[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<AppUser[]>([]);
  const [savingUserId, setSavingUserId] = useState<string>('');
  const [markingAllLoading, setMarkingAllLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Determine available courses for the current user
  const availableCourses = useMemo(() => {
    if (isAdmin) {
      return courses;
    }
    if (isTeacher) {
      const currentTeacher = teachers.find(
        (t) => t.id === user?.uid || t.name === profile?.name
      );
      return filterTeacherAssignedCourses(courses, currentTeacher, user?.uid);
    }
    // Student: Show only enrolled courses
    return enrolledCourses.length > 0
      ? enrolledCourses
      : courses.filter((c) => Boolean(userEnrollments[c.id]));
  }, [isAdmin, isTeacher, courses, teachers, user?.uid, profile?.name, enrolledCourses, userEnrollments]);

  // Set default selectedCourseId when courses load
  useEffect(() => {
    if (canMark && selectedCourseId === 'all' && availableCourses.length > 0) {
      setSelectedCourseId(availableCourses[0].id);
    } else if (!canMark && selectedCourseId === 'all' && availableCourses.length === 1) {
      setSelectedCourseId(availableCourses[0].id);
    }
  }, [availableCourses, canMark, selectedCourseId]);

  // ── Firestore Listeners ────────────────────────────────────────────────────

  // 1. Attendance History Listener
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const attQuery = canMark
      ? query(
          collection(db, 'attendance'),
          where('date', '==', selectedDate),
          orderBy('marked_at', 'desc'),
          limit(600)
        )
      : query(collection(db, 'attendance'), where('user_id', '==', user.uid));

    const unsub = onSnapshot(
      attQuery,
      (snap) => {
        const arr: AttendanceItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));

        arr.sort((a, b) => {
          const bTime = getMillis(b.marked_at || b.created_at);
          const aTime = getMillis(a.marked_at || a.created_at);
          if (bTime !== aTime) return bTime - aTime;
          return String(b.date || '').localeCompare(String(a.date || ''));
        });

        setHistory(arr);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.warn('[Attendance] history listener ERROR', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsub;
  }, [canMark, selectedDate, user?.uid, reloadKey]);

  // 2. Approved Students Listener (Teachers & Admins)
  useEffect(() => {
    if (!canMark) {
      setApprovedStudents([]);
      return;
    }

    const usersQ = query(
      collection(db, 'users'),
      where('status', '==', 'approved'),
      where('role', '==', 'student')
    );

    const unsub = onSnapshot(
      usersQ,
      (snap) => {
        const arr: AppUser[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          arr.push({
            id: d.id,
            name: data.name || 'Taliba (Student)',
            email: data.email || '',
            role: data.role || 'student',
            status: data.status,
          });
        });
        arr.sort((a, b) => a.name.localeCompare(b.name));
        setApprovedStudents(arr);
      },
      (error) => {
        console.warn('[Attendance] students listener ERROR', error);
        setApprovedStudents([]);
      }
    );

    return unsub;
  }, [canMark, reloadKey]);

  // ── Handlers & Actions ─────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((prev) => prev + 1);
  }, []);

  const markStudentAttendance = async (
    targetUser: AppUser,
    status: 'present' | 'absent',
    courseIdTarget?: string
  ) => {
    if (!user?.uid) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      Alert.alert('Invalid date', 'Please use YYYY-MM-DD format.');
      return;
    }

    const cId = courseIdTarget !== undefined ? courseIdTarget : (selectedCourseId !== 'all' ? selectedCourseId : '');
    const activeCourse = availableCourses.find((c) => c.id === cId);
    const courseName = activeCourse ? activeCourse.name : 'General Class';

    // Unique document per student, date, and course
    const docId = cId
      ? `${targetUser.id}_${selectedDate}_${cId}`
      : `${targetUser.id}_${selectedDate}`;

    setSavingUserId(targetUser.id);
    try {
      const attendanceRef = doc(db, 'attendance', docId);
      const existing = await getDoc(attendanceRef);

      const nextRecord: Record<string, any> = {
        user_id: targetUser.id,
        user_name: targetUser.name,
        user_email: targetUser.email,
        date: selectedDate,
        status,
        marked_by: isTeacher ? 'teacher' : 'admin',
        marked_by_uid: user.uid,
        marked_by_name: profile?.name || user.email || (isTeacher ? 'Ustaadha' : 'Admin'),
        marked_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      if (cId) {
        nextRecord.course_id = cId;
      }

      if (!existing.exists()) {
        nextRecord.created_at = serverTimestamp();
      }

      await setDoc(attendanceRef, nextRecord, { merge: true });

      // Send in-app notification to student
      await addDoc(collection(db, 'notifications'), {
        title: `Attendance: ${status === 'present' ? 'Present ✓' : 'Absent ✕'}`,
        message: `${courseName} attendance for ${selectedDate} has been recorded as ${status}.`,
        user_id: targetUser.id,
        created_at: serverTimestamp(),
      }).catch(() => {});

      setFeedbackMsg(`✓ ${targetUser.name} marked ${status} for ${courseName}`);
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (e: unknown) {
      console.error('[Attendance] Error marking attendance', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark attendance.');
    } finally {
      setSavingUserId('');
    }
  };

  const handleMarkAllPresent = async () => {
    if (!user?.uid || filteredStudents.length === 0) return;
    const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
    const courseName = targetCourse ? targetCourse.name : 'Selected Class';

    Alert.alert(
      'Mark All Present',
      `Mark all ${filteredStudents.length} students as PRESENT for ${courseName} on ${selectedDate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Mark All Present',
          onPress: async () => {
            setMarkingAllLoading(true);
            try {
              const batch = writeBatch(db);
              const cId = selectedCourseId !== 'all' ? selectedCourseId : '';

              for (const student of filteredStudents) {
                const docId = cId
                  ? `${student.id}_${selectedDate}_${cId}`
                  : `${student.id}_${selectedDate}`;
                const ref = doc(db, 'attendance', docId);

                const payload: any = {
                  user_id: student.id,
                  user_name: student.name,
                  user_email: student.email,
                  date: selectedDate,
                  status: 'present',
                  marked_by: isTeacher ? 'teacher' : 'admin',
                  marked_by_uid: user.uid,
                  marked_by_name: profile?.name || user.email || 'Teacher',
                  marked_at: serverTimestamp(),
                  updated_at: serverTimestamp(),
                  created_at: serverTimestamp(),
                };
                if (cId) payload.course_id = cId;

                batch.set(ref, payload, { merge: true });
              }

              await batch.commit();
              setFeedbackMsg(`✓ Marked all ${filteredStudents.length} students PRESENT!`);
              setTimeout(() => setFeedbackMsg(''), 4000);
            } catch (err: any) {
              Alert.alert('Batch Error', err?.message || 'Failed to batch update attendance.');
            } finally {
              setMarkingAllLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Filtered Computations ──────────────────────────────────────────────────

  // Filter students for Teacher/Admin by name or email
  const filteredStudents = useMemo(() => {
    if (!searchStudentQuery.trim()) return approvedStudents;
    const q = searchStudentQuery.toLowerCase();
    return approvedStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [approvedStudents, searchStudentQuery]);

  // Current Date Attendance Map for fast lookup (studentId -> status)
  const todayAttendanceMap = useMemo(() => {
    const map: Record<string, { status: 'present' | 'absent'; markedAt?: { toDate?: () => Date } }> = {};
    history.forEach((h) => {
      if (!h.user_id) return;
      if (selectedCourseId !== 'all' && h.course_id && h.course_id !== selectedCourseId) {
        return;
      }
      map[h.user_id] = {
        status: h.status,
        markedAt: h.marked_at || h.created_at,
      };
    });
    return map;
  }, [history, selectedCourseId]);

  // Student: Filtered History based on selectedCourseId tab
  const studentFilteredHistory = useMemo(() => {
    if (selectedCourseId === 'all') return history;
    return history.filter((h) => h.course_id === selectedCourseId || (!h.course_id && availableCourses.length === 1));
  }, [history, selectedCourseId, availableCourses.length]);

  // Student: Per-Course Metrics Breakdown
  const courseWiseMetrics = useMemo(() => {
    const map: Record<string, { total: number; present: number; absent: number; pct: number }> = {};

    availableCourses.forEach((c) => {
      map[c.id] = { total: 0, present: 0, absent: 0, pct: 100 };
    });

    history.forEach((h) => {
      const cId = h.course_id || (availableCourses.length === 1 ? availableCourses[0].id : 'general');
      if (!map[cId]) {
        map[cId] = { total: 0, present: 0, absent: 0, pct: 100 };
      }
      map[cId].total += 1;
      if (h.status === 'present') map[cId].present += 1;
      if (h.status === 'absent') map[cId].absent += 1;
    });

    Object.keys(map).forEach((k) => {
      const item = map[k];
      item.pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 100;
    });

    return map;
  }, [availableCourses, history]);

  // Overall Student Attendance Percent
  const overallStudentPercent = useMemo(() => {
    if (!studentFilteredHistory.length) return 100;
    const presentCount = studentFilteredHistory.filter((h) => h.status === 'present').length;
    return Math.round((presentCount / studentFilteredHistory.length) * 100);
  }, [studentFilteredHistory]);

  // Consecutive Streak calculation
  const attendanceStreak = useMemo(() => {
    if (!studentFilteredHistory.length) return 0;
    let streak = 0;
    for (const item of studentFilteredHistory) {
      if (item.status === 'present') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [studentFilteredHistory]);

  const selectedCourseObj = useMemo(() => {
    return availableCourses.find((c) => c.id === selectedCourseId);
  }, [availableCourses, selectedCourseId]);

  // ── Render Components ──────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Top Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.title}>Attendance Register</Text>
              <View style={styles.badgeRole}>
                <Text style={styles.badgeRoleText}>
                  {isAdmin ? 'Admin' : isTeacher ? 'Ustaadha' : 'Taliba'}
                </Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              {canMark
                ? 'Mark, verify & review class attendance'
                : `Your attendance record (${overallStudentPercent}% Present)`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh attendance"
          >
            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
            <Text style={styles.refreshText}>Sync</Text>
          </TouchableOpacity>
        </View>

        {/* ── Course / Class Switcher Bar (Multi-Class Support) ── */}
        <View style={styles.courseTabsWrapper}>
          <Text style={styles.courseTabsLabel}>
            {canMark ? 'Select Class / Batch:' : 'Enrolled Classes:'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.courseTabsContainer}
          >
            {!canMark && availableCourses.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.courseTabItem,
                  selectedCourseId === 'all' && styles.courseTabItemActive,
                ]}
                onPress={() => setSelectedCourseId('all')}
              >
                <Ionicons
                  name="grid-outline"
                  size={14}
                  color={selectedCourseId === 'all' ? '#FFFFFF' : '#005F46'}
                />
                <Text
                  style={[
                    styles.courseTabItemText,
                    selectedCourseId === 'all' && styles.courseTabItemTextActive,
                  ]}
                >
                  All Classes ({availableCourses.length})
                </Text>
              </TouchableOpacity>
            )}

            {availableCourses.map((c) => {
              const isSel = selectedCourseId === c.id;
              const metrics = courseWiseMetrics[c.id];
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.courseTabItem, isSel && styles.courseTabItemActive]}
                  onPress={() => setSelectedCourseId(c.id)}
                >
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={isSel ? '#FFFFFF' : '#005F46'}
                  />
                  <Text
                    style={[
                      styles.courseTabItemText,
                      isSel && styles.courseTabItemTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {!canMark && metrics && (
                    <View
                      style={[
                        styles.courseTabBadge,
                        isSel && { backgroundColor: 'rgba(255,255,255,0.25)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.courseTabBadgeText,
                          isSel && { color: '#FFFFFF' },
                        ]}
                      >
                        {metrics.pct}%
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {availableCourses.length === 0 && (
              <Text style={styles.noCoursesText}>No assigned classes found.</Text>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Floating feedback message */}
      {!!feedbackMsg && (
        <View style={styles.feedbackToast}>
          <Ionicons name="checkmark-circle" size={16} color="#059669" />
          <Text style={styles.feedbackToastText}>{feedbackMsg}</Text>
        </View>
      )}

      {/* ── Main Body ── */}
      {canMark ? (
        /* ════════════ TEACHER / ADMIN REGISTER MODE ════════════ */
        <ScrollView
          style={styles.panel}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Class Information Banner */}
          {selectedCourseObj && (
            <View style={styles.classInfoBanner}>
              <View style={styles.classInfoIconBox}>
                <Ionicons name="school" size={20} color="#005F46" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.classInfoTitle}>{selectedCourseObj.name}</Text>
                <Text style={styles.classInfoSub}>
                  Teacher: {selectedCourseObj.teacher_name || 'Assigned Ustaadha'} •{' '}
                  {selectedCourseObj.schedule || 'Regular Class'}
                </Text>
              </View>
            </View>
          )}

          {/* Date Selector Row */}
          <View style={styles.dateControlCard}>
            <View style={styles.dateLabelRow}>
              <Ionicons name="calendar" size={16} color="#005F46" />
              <Text style={styles.dateControlTitle}>Register Date:</Text>
            </View>
            <View style={styles.dateInputRow}>
              <TextInput
                style={styles.dateInput}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity
                style={[
                  styles.quickDateChip,
                  selectedDate === todayStr() && styles.quickDateChipActive,
                ]}
                onPress={() => setSelectedDate(todayStr())}
              >
                <Text
                  style={[
                    styles.quickDateChipText,
                    selectedDate === todayStr() && styles.quickDateChipTextActive,
                  ]}
                >
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickDateChip,
                  selectedDate === yesterdayStr() && styles.quickDateChipActive,
                ]}
                onPress={() => setSelectedDate(yesterdayStr())}
              >
                <Text
                  style={[
                    styles.quickDateChipText,
                    selectedDate === yesterdayStr() && styles.quickDateChipTextActive,
                  ]}
                >
                  Yesterday
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Actions & Search Bar */}
          <View style={styles.registerActionBar}>
            <View style={styles.searchBarBox}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search student by name..."
                placeholderTextColor={COLORS.textMuted}
                value={searchStudentQuery}
                onChangeText={setSearchStudentQuery}
              />
              {!!searchStudentQuery && (
                <TouchableOpacity onPress={() => setSearchStudentQuery('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.markAllBtn,
                markingAllLoading && { opacity: 0.7 },
              ]}
              onPress={handleMarkAllPresent}
              disabled={markingAllLoading || filteredStudents.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Mark all present"
            >
              {markingAllLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                  <Text style={styles.markAllBtnText}>1-Tap Mark All</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Student Roster Header */}
          <View style={styles.rosterHeader}>
            <Text style={styles.sectionHeaderTitle}>
              Enrolled Students ({filteredStudents.length})
            </Text>
            <Text style={styles.sectionHeaderSub}>
              {Object.values(todayAttendanceMap).filter((v) => v.status === 'present').length} Present •{' '}
              {Object.values(todayAttendanceMap).filter((v) => v.status === 'absent').length} Absent
            </Text>
          </View>

          {/* Students List */}
          {filteredStudents.map((item) => {
            const currentAtt = todayAttendanceMap[item.id];
            const isSaving = savingUserId === item.id;
            const isPresent = currentAtt?.status === 'present';
            const isAbsent = currentAtt?.status === 'absent';

            return (
              <View style={styles.studentCard} key={item.id}>
                {/* Student Avatar */}
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.studentEmail} numberOfLines={1}>
                    {item.email}
                  </Text>
                  {currentAtt ? (
                    <Text style={styles.lastMarkedText}>
                      Marked: {formatMarkedAt(currentAtt.markedAt)}
                    </Text>
                  ) : (
                    <Text style={styles.unmarkedText}>Not yet marked for this date</Text>
                  )}
                </View>

                {/* Present / Absent Action Buttons */}
                <View style={styles.actionBtnGroup}>
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      isPresent && styles.statusToggleBtnPresentActive,
                      isSaving && { opacity: 0.6 },
                    ]}
                    onPress={() => markStudentAttendance(item, 'present')}
                    disabled={isSaving}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isPresent ? 'checkmark-circle' : 'checkmark'}
                      size={14}
                      color={isPresent ? '#FFFFFF' : '#059669'}
                    />
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        isPresent && styles.statusToggleBtnTextActive,
                      ]}
                    >
                      {isSaving && isPresent ? '...' : 'Present'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      isAbsent && styles.statusToggleBtnAbsentActive,
                      isSaving && { opacity: 0.6 },
                    ]}
                    onPress={() => markStudentAttendance(item, 'absent')}
                    disabled={isSaving}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isAbsent ? 'close-circle' : 'close'}
                      size={14}
                      color={isAbsent ? '#FFFFFF' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        { color: isAbsent ? '#FFFFFF' : '#DC2626' },
                      ]}
                    >
                      {isSaving && isAbsent ? '...' : 'Absent'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredStudents.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySub}>
                {searchStudentQuery
                  ? 'No approved students match your search criteria.'
                  : 'No approved students currently registered.'}
              </Text>
            </View>
          )}

          {/* Recent Class Attendance History */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 24, marginBottom: 10 }]}>
            Recent Attendance Log (Audit History)
          </Text>
          {history.slice(0, 40).map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{item.date}</Text>
                  <Text style={styles.historyStudent}>
                    {item.user_name || item.user_email || item.user_id}
                  </Text>
                </View>
                <View
                  style={
                    item.status === 'present'
                      ? styles.badgePresentCompact
                      : styles.badgeAbsentCompact
                  }
                >
                  <Text
                    style={
                      item.status === 'present'
                        ? styles.badgeTextPresent
                        : styles.badgeTextAbsent
                    }
                  >
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyTeacherText}>
                Recorded by: {item.marked_by_name || item.marked_by || 'Ustaadha'} •{' '}
                {formatMarkedAt(item.marked_at || item.created_at)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : loading ? (
        /* ════════════ LOADING STATE ════════════ */
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Syncing Attendance Records...</Text>
        </View>
      ) : (
        /* ════════════ STUDENT ATTENDANCE DASHBOARD ════════════ */
        <ScrollView
          style={styles.panel}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Class Summary Banner */}
          {selectedCourseObj ? (
            <View style={styles.studentClassBanner}>
              <View style={styles.studentClassIconBox}>
                <Ionicons name="ribbon" size={24} color="#005F46" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentClassTitle}>{selectedCourseObj.name}</Text>
                <Text style={styles.studentClassTeacher}>
                  Ustaadha: {selectedCourseObj.teacher_name || 'Honorable Teacher'}
                </Text>
                <Text style={styles.studentClassSchedule}>
                  Schedule: {selectedCourseObj.schedule || 'Regular Daily Class'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.studentClassBanner}>
              <View style={styles.studentClassIconBox}>
                <Ionicons name="school" size={24} color="#005F46" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentClassTitle}>Madrasa Academic Summary</Text>
                <Text style={styles.studentClassTeacher}>
                  Enrolled in {availableCourses.length} Islamic Course
                  {availableCourses.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Metrics Row */}
          <View style={styles.studentMetricsRow}>
            {/* Attendance Rate */}
            <View style={styles.metricCard}>
              <Text style={styles.metricBigNum}>{overallStudentPercent}%</Text>
              <Text style={styles.metricLabel}>Attendance Rate</Text>
              <View style={styles.metricProgressBar}>
                <View
                  style={[
                    styles.metricProgressFill,
                    {
                      width: `${Math.min(100, Math.max(0, overallStudentPercent))}%`,
                      backgroundColor:
                        overallStudentPercent >= 80
                          ? '#059669'
                          : overallStudentPercent >= 60
                          ? '#D97706'
                          : '#DC2626',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Streak */}
            <View style={styles.metricCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.metricBigNum}>{attendanceStreak}</Text>
                <Ionicons name="flame" size={20} color="#EA580C" />
              </View>
              <Text style={styles.metricLabel}>Day Streak</Text>
              <Text style={styles.streakSubText}>Consistent Taliba</Text>
            </View>

            {/* Total Lectures */}
            <View style={styles.metricCard}>
              <Text style={styles.metricBigNum}>{studentFilteredHistory.length}</Text>
              <Text style={styles.metricLabel}>Total Lectures</Text>
              <Text style={styles.streakSubText}>
                {studentFilteredHistory.filter((h) => h.status === 'present').length} Present
              </Text>
            </View>
          </View>

          {/* Multi-Class Breakdown Cards (When enrolled in multiple courses) */}
          {availableCourses.length > 1 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.sectionHeaderTitle}>Class-Wise Attendance Breakdown</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {availableCourses.map((c) => {
                  const m = courseWiseMetrics[c.id] || {
                    total: 0,
                    present: 0,
                    absent: 0,
                    pct: 100,
                  };
                  const isSelected = selectedCourseId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.classBreakdownCard,
                        isSelected && styles.classBreakdownCardActive,
                      ]}
                      onPress={() => setSelectedCourseId(c.id)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.classBreakdownName}>{c.name}</Text>
                        <Text style={styles.classBreakdownSub}>
                          Teacher: {c.teacher_name || 'Ustaadha'} • {m.present}/{m.total} Lectures
                          Attended
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.classPctBadge,
                          {
                            backgroundColor:
                              m.pct >= 80
                                ? '#ECFDF5'
                                : m.pct >= 60
                                ? '#FEF3C7'
                                : '#FEE2E2',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.classPctBadgeText,
                            {
                              color:
                                m.pct >= 80
                                  ? '#047857'
                                  : m.pct >= 60
                                  ? '#B45309'
                                  : '#B91C1C',
                            },
                          ]}
                        >
                          {m.pct}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Detailed Timeline Header */}
          <View style={[styles.rosterHeader, { marginTop: 20 }]}>
            <Text style={styles.sectionHeaderTitle}>
              Attendance Timeline ({studentFilteredHistory.length})
            </Text>
            {selectedCourseId !== 'all' && (
              <TouchableOpacity onPress={() => setSelectedCourseId('all')}>
                <Text style={styles.viewAllLink}>View All Classes</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Timeline list */}
          {studentFilteredHistory.map((item) => {
            const isPresent = item.status === 'present';
            const courseObj = availableCourses.find((c) => c.id === item.course_id);

            return (
              <View style={styles.timelineItem} key={item.id}>
                {/* Status Dot & Line */}
                <View style={styles.timelineIndicator}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: isPresent ? '#10B981' : '#EF4444' },
                    ]}
                  />
                </View>

                {/* Content Card */}
                <View style={styles.timelineCard}>
                  <View style={styles.timelineCardHeader}>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                    <View
                      style={
                        isPresent ? styles.badgePresentCompact : styles.badgeAbsentCompact
                      }
                    >
                      <Text
                        style={
                          isPresent ? styles.badgeTextPresent : styles.badgeTextAbsent
                        }
                      >
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.timelineCourse}>
                    {courseObj ? courseObj.name : 'Islamic Study Lecture'}
                  </Text>
                  <Text style={styles.timelineMeta}>
                    Verified by: {item.marked_by_name || 'Ustaadha'} • Recorded on{' '}
                    {formatMarkedAt(item.marked_at || item.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}

          {studentFilteredHistory.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Attendance Records Yet</Text>
              <Text style={styles.emptySub}>
                Your teacher will record your attendance as soon as live lectures commence.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...SHADOWS.header,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#002E23',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRole: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Course Switcher Bar
  courseTabsWrapper: {
    marginTop: 10,
  },
  courseTabsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  courseTabsContainer: {
    gap: 8,
    paddingBottom: 2,
  },
  courseTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  courseTabItemActive: {
    backgroundColor: '#002E23',
    borderColor: '#002E23',
  },
  courseTabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
  },
  courseTabItemTextActive: {
    color: '#FFFFFF',
  },
  courseTabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  courseTabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  noCoursesText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  // Feedback Toast
  feedbackToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  feedbackToastText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },

  panel: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
  },

  // ── Teacher / Admin Register Styles ──
  classInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    ...SHADOWS.card,
  },
  classInfoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classInfoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  classInfoSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  dateControlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dateControlTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickDateChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDateChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  quickDateChipTextActive: {
    color: '#047857',
  },
  registerActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#005F46',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  markAllBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  sectionHeaderSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    ...SHADOWS.card,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  studentAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#005F46',
  },
  studentName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  lastMarkedText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  unmarkedText: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggleBtnPresentActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  statusToggleBtnAbsentActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  statusToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  statusToggleBtnTextActive: {
    color: '#FFFFFF',
  },

  // ── Student Dashboard Styles ──
  studentClassBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    ...SHADOWS.card,
  },
  studentClassIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  studentClassTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#002E23',
  },
  studentClassTeacher: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
  },
  studentClassSchedule: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  studentMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...SHADOWS.card,
  },
  metricBigNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#002E23',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  metricProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  streakSubText: {
    fontSize: 9.5,
    color: '#059669',
    fontWeight: '700',
    marginTop: 4,
  },
  classBreakdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  classBreakdownCardActive: {
    borderColor: '#005F46',
    borderWidth: 1.5,
    backgroundColor: '#FAFCFB',
  },
  classBreakdownName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  classBreakdownSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  classPctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  classPctBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  viewAllLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 16,
    paddingTop: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineCourse: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
    marginBottom: 2,
  },
  timelineMeta: {
    fontSize: 10.5,
    color: '#64748B',
  },

  // ── History Cards (Teacher/Admin View) ──
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyStudent: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  historyTeacherText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  badgePresentCompact: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeAbsentCompact: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeTextPresent: {
    color: '#047857',
    fontSize: 9.5,
    fontWeight: '800',
  },
  badgeTextAbsent: {
    color: '#B91C1C',
    fontSize: 9.5,
    fontWeight: '800',
  },

  // Common Empty & Loading states
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
});
