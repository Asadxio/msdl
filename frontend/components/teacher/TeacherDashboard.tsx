import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { UserProfile } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { db } from '@/lib/firebase';
import { DAILY_WISDOM, HADITHS } from '@/constants/wisdomData';
import { MADRASA_WEBSITE_URL } from '@/lib/links';
import * as Linking from 'expo-linking';
import { filterTeacherAssignedCourses } from '@/lib/enrollments';

interface TeacherDashboardProps {
  profile: UserProfile | null;
  user: any;
  hijriDate: string;
  currentPrayer: any;
  nextPrayer: any;
  formatTime: (date: Date) => string;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

interface LiveClassSummary {
  id: string;
  title: string;
  teacher_name: string;
  status: 'live' | 'scheduled';
  class_time?: string;
}

interface PendingSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  file_name?: string;
  submitted_at?: any;
}

export function TeacherDashboard({
  profile,
  user,
  hijriDate,
  currentPrayer,
  nextPrayer,
  formatTime,
  onRefresh,
  refreshing,
}: TeacherDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { courses, teachers, enrolledCourses } = useData();

  const [liveClasses, setLiveClasses] = useState<LiveClassSummary[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(
    new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  );

  // Filter courses strictly assigned to this teacher
  const myAssignedCourses = useMemo(() => {
    if (Array.isArray(enrolledCourses) && enrolledCourses.length > 0) {
      return enrolledCourses;
    }
    const currentTeacher = teachers.find(
      (t) =>
        t.id === user?.uid ||
        (profile?.name && t.name?.toLowerCase().includes(profile.name.toLowerCase()))
    );
    return filterTeacherAssignedCourses(courses, currentTeacher, user?.uid);
  }, [enrolledCourses, courses, teachers, user?.uid, profile?.name]);

  // Real-time live classes listener
  useEffect(() => {
    const q = query(
      collection(db, 'live_classes'),
      where('status', 'in', ['live', 'scheduled']),
      limit(5)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: LiveClassSummary[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            title: data.title || 'Untitled Class',
            teacher_name: data.teacher_name || 'Teacher',
            status: data.status === 'live' ? 'live' : 'scheduled',
            class_time: data.class_time || data.time || 'Today',
          });
        });
        setLiveClasses(list);
        setLoadingSchedule(false);
      },
      () => {
        setLoadingSchedule(false);
      }
    );
    return () => unsub();
  }, []);

  // Real-time pending submissions listener for teacher reviews
  useEffect(() => {
    const q = query(
      collection(db, 'submissions'),
      where('status', '==', 'submitted'),
      limit(6)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PendingSubmission[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            assignment_id: data.assignment_id || 'Assignment',
            user_id: data.user_id || 'Student',
            file_name: data.file_name || 'Submission',
            submitted_at: data.submitted_at || null,
          });
        });
        setPendingSubmissions(list);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Real-time today's attendance records count
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const q = query(
      collection(db, 'attendance'),
      where('date', '==', todayStr),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAttendanceCount(snap.size);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* ========================================================================= */}
        {/* SECTION 1: INSTITUTIONAL TEACHER HERO & BADGING                           */}
        {/* ========================================================================= */}
        <View style={[styles.heroSection, { paddingTop: insets.top + SPACING.sm }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandingRow}>
              <View style={styles.avatarRing}>
                <Image
                  source={{ uri: profile?.photo_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=160&auto=format&fit=crop&q=80' }}
                  style={styles.teacherAvatar}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <View style={styles.teacherBadge}>
                    <Ionicons name="school" size={12} color="#FFFFFF" />
                    <Text style={styles.teacherBadgeText}>FACULTY / USTAADHA</Text>
                  </View>
                  <View style={styles.verifiedPill}>
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                    <Text style={styles.verifiedText}>Approved</Text>
                  </View>
                </View>
                <Text style={styles.teacherName} numberOfLines={1}>
                  {profile?.name || 'Faculty Member'}
                </Text>
                <Text style={styles.teacherIdText}>
                  ID: #TCH-{user?.uid ? user.uid.slice(0, 6).toUpperCase() : '000000'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={() => router.push('/(tabs)/notifications' as any)}
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color={COLORS.surface} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={() => router.push('/settings' as any)}
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-outline" size={20} color={COLORS.surface} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hijri Date & Prayer Indicator Banner */}
          <View style={styles.datePrayerBanner}>
            <View style={styles.dateCol}>
              <Text style={styles.dateLabel}>ISLAMIC CALENDAR</Text>
              <Text style={styles.hijriText}>{hijriDate}</Text>
            </View>
            {currentPrayer && (
              <View style={styles.prayerCol}>
                <Text style={styles.dateLabel}>CURRENT WAQT</Text>
                <Text style={styles.prayerValText}>{currentPrayer.name.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 2: TEACHING OVERVIEW METRICS (CLICKABLE KPIS)                      */}
        {/* ========================================================================= */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Teaching Overview</Text>
          <View style={styles.metricsGrid}>
            <TouchableOpacity
              style={styles.metricCard}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/courses' as any)}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="book" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.metricNumber}>{myAssignedCourses.length}</Text>
              <Text style={styles.metricLabel}>My Courses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              activeOpacity={0.8}
              onPress={() => router.push('/live-class' as any)}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="videocam" size={20} color="#D97706" />
              </View>
              <Text style={styles.metricNumber}>{liveClasses.length}</Text>
              <Text style={styles.metricLabel}>Live Classes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              activeOpacity={0.8}
              onPress={() => router.push('/attendance' as any)}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people" size={20} color="#2563EB" />
              </View>
              <Text style={styles.metricNumber}>{attendanceCount}</Text>
              <Text style={styles.metricLabel}>Attendance Log</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/quiz' as any)}
            >
              <View style={[styles.metricIconWrap, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="clipboard" size={20} color="#DB2777" />
              </View>
              <Text style={styles.metricNumber}>{pendingSubmissions.length}</Text>
              <Text style={styles.metricLabel}>Submissions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 3: TEACHING QUICK ACTIONS (CATEGORIZED 2-COL GRID)                 */}
        {/* ========================================================================= */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Teaching Actions</Text>

          {/* Academic & Curriculum */}
          <Text style={styles.categorySubheading}>ACADEMIC & CURRICULUM</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/courses' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="library" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Assigned Courses</Text>
                <Text style={styles.actionSubtitle}>Manage syllabus & lessons</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/library' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="book-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Islamic Library</Text>
                <Text style={styles.actionSubtitle}>Reference books & PDFs</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Classroom & Live Sessions */}
          <Text style={[styles.categorySubheading, { marginTop: 14 }]}>CLASSROOM & STUDENTS</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/live-class' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="videocam-outline" size={20} color="#2563EB" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Live Classroom</Text>
                <Text style={styles.actionSubtitle}>Start or host live stream</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/attendance' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="checkbox-outline" size={20} color="#16A34A" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Mark Attendance</Text>
                <Text style={styles.actionSubtitle}>Daily student presence</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/recordings' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="mic-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Dars Recordings</Text>
                <Text style={styles.actionSubtitle}>Audio & Tajweed notes</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/quiz' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="trophy-outline" size={20} color="#DB2777" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Student Quizzes</Text>
                <Text style={styles.actionSubtitle}>Evaluate assessments</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/chats' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="chatbubbles-outline" size={20} color="#9333EA" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Faculty & Student Chat</Text>
                <Text style={styles.actionSubtitle}>Direct 1-on-1 guidance</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/certificate' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#FEF9C3' }]}>
                <Ionicons name="ribbon-outline" size={20} color="#CA8A04" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Issue Sanads / Certs</Text>
                <Text style={styles.actionSubtitle}>Official graduation credentials</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/tasbeeh' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="finger-print-outline" size={20} color="#059669" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Smart Tasbeeh</Text>
                <Text style={styles.actionSubtitle}>Daily Dhikr & Wazaif</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push('/admin/manage-academics' as any)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="school-outline" size={20} color="#2563EB" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Manage Academics</Text>
                <Text style={styles.actionSubtitle}>Curriculum & module structure</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 3.5: 7-DAY VISUAL WEEKLY TIMETABLE & AUTOMATION WIDGET           */}
        {/* ========================================================================= */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Weekly Teaching Timetable</Text>
              <Text style={styles.sectionSubtitle}>Class schedules & quick session launcher</Text>
            </View>
            <TouchableOpacity
              style={styles.quickRecordPill}
              onPress={() => router.push('/live-class' as any)}
            >
              <Ionicons name="radio-button-on" size={13} color="#fff" />
              <Text style={styles.quickRecordText}>Start Class</Text>
            </TouchableOpacity>
          </View>

          {/* 7 Days Strip */}
          <View style={styles.daysStripRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => {
              const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
              const isToday = idx === currentDayIndex;
              const isSelected = idx === selectedDayIdx;
              return (
                <TouchableOpacity
                  key={dayName}
                  style={[
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                    isToday && !isSelected && styles.dayPillToday,
                  ]}
                  onPress={() => setSelectedDayIdx(idx)}
                >
                  <Text
                    style={[
                      styles.dayPillName,
                      isSelected && styles.dayPillNameSelected,
                      isToday && !isSelected && styles.dayPillNameToday,
                    ]}
                  >
                    {dayName}
                  </Text>
                  {isToday && (
                    <View
                      style={[
                        styles.todayDot,
                        isSelected ? { backgroundColor: '#fff' } : { backgroundColor: COLORS.primary },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Day Schedule Content Card */}
          <View style={styles.timetableContentCard}>
            <View style={styles.timetableHeader}>
              <Ionicons name="calendar" size={16} color={COLORS.primary} />
              <Text style={styles.timetableDayTitle}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][selectedDayIdx]}’s
                Teaching Schedule
              </Text>
            </View>

            {myAssignedCourses.length > 0 ? (
              <View style={styles.timetableCoursesList}>
                {myAssignedCourses.map((c, idx) => (
                  <View key={c.id || idx} style={styles.timetableRow}>
                    <View style={styles.timetableCourseMeta}>
                      <Text style={styles.timetableCourseTitle} numberOfLines={1}>
                        {c.name || (c as any).title || 'Madrasa Course'}
                      </Text>
                      <Text style={styles.timetableCourseTiming}>
                        {c.schedule || c.time || c.class_time || 'Regular Class Session • 1 Hour'}
                      </Text>
                    </View>
                    <View style={styles.timetableActions}>
                      <TouchableOpacity
                        style={styles.timetableAttendanceBtn}
                        onPress={() => router.push('/attendance' as any)}
                      >
                        <Ionicons name="checkbox-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.timetableAttendanceText}>Register</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.timetableLaunchBtn}
                        onPress={() => router.push('/live-class' as any)}
                      >
                        <Ionicons name="play" size={12} color="#fff" />
                        <Text style={styles.timetableLaunchText}>Host</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.timetableEmptyText}>
                No specific classes scheduled for this day. Tap "+ Schedule Live Class" below.
              </Text>
            )}
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 4: UPCOMING TEACHING SCHEDULE & LIVE SESSIONS                     */}
        {/* ========================================================================= */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Live Class Schedule</Text>
            <TouchableOpacity onPress={() => router.push('/live-class' as any)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingSchedule ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : liveClasses.length > 0 ? (
            liveClasses.map((cls) => (
              <View key={cls.id} style={styles.classCard}>
                <View style={styles.classStatusPill}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: cls.status === 'live' ? '#EF4444' : '#3B82F6' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.classStatusText,
                      { color: cls.status === 'live' ? '#EF4444' : '#3B82F6' },
                    ]}
                  >
                    {cls.status === 'live' ? 'LIVE NOW' : 'SCHEDULED'}
                  </Text>
                </View>
                <Text style={styles.classTitle}>{cls.title}</Text>
                <Text style={styles.classMeta}>Time: {cls.class_time} • Instructor: {cls.teacher_name}</Text>
                <TouchableOpacity
                  style={styles.classJoinBtn}
                  onPress={() => router.push(`/live-class/${cls.id}` as any)}
                >
                  <Ionicons name="play" size={14} color="#FFFFFF" />
                  <Text style={styles.classJoinText}>
                    {cls.status === 'live' ? 'Enter Classroom' : 'Manage Session'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyScheduleCard}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyScheduleTitle}>No Live Classes Scheduled</Text>
              <Text style={styles.emptyScheduleText}>
                You can schedule a new online lecture or interactive session anytime.
              </Text>
              <TouchableOpacity
                style={styles.createScheduleBtn}
                onPress={() => router.push('/live-class' as any)}
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.createScheduleBtnText}>Schedule Live Class</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ========================================================================= */}
        {/* SECTION 5: PENDING WORK & SUBMISSION REVIEWS                              */}
        {/* ========================================================================= */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Pending Evaluations</Text>
          {pendingSubmissions.length > 0 ? (
            pendingSubmissions.map((sub) => (
              <View key={sub.id} style={styles.submissionCard}>
                <View style={styles.submissionLeft}>
                  <View style={styles.submissionIcon}>
                    <Ionicons name="document-text" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.submissionTitle} numberOfLines={1}>
                      {sub.file_name || 'Assignment Task'}
                    </Text>
                    <Text style={styles.submissionMeta}>
                      Student UID: #{sub.user_id.slice(0, 6).toUpperCase()} • Needs Review
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => router.push('/(tabs)/quiz' as any)}
                >
                  <Text style={styles.reviewBtnText}>Review</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.allClearCard}>
              <Ionicons name="checkmark-done-circle" size={32} color="#059669" />
              <Text style={styles.allClearTitle}>All Submissions Reviewed</Text>
              <Text style={styles.allClearSubtitle}>No pending student tasks require evaluation right now.</Text>
            </View>
          )}
        </View>

        {/* ========================================================================= */}
        {/* SECTION 6: ISLAMIC INSPIRATION FOR TEACHERS                               */}
        {/* ========================================================================= */}
        <View style={styles.sectionContainer}>
          <View style={styles.hadithCard}>
            <View style={styles.hadithHeader}>
              <Ionicons name="sparkles" size={16} color={COLORS.secondary} />
              <Text style={styles.hadithHeaderTitle}>HADITH OF THE DAY</Text>
            </View>
            <Text style={styles.arabicCalligraphy}>
              خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
            </Text>
            <Text style={styles.hadithMeaning}>
              "The best amongst you are those who learn the Qur'an and teach it to others."
            </Text>
            <Text style={styles.hadithCitation}>— Sahih al-Bukhari 5027</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 7: OFFICIAL MADRASA LINK BANNER                                   */}
        {/* ========================================================================= */}
        <View style={[styles.sectionContainer, { marginBottom: SPACING.md }]}>
          <TouchableOpacity
            style={styles.portalLinkCard}
            activeOpacity={0.85}
            onPress={() => Linking.openURL(MADRASA_WEBSITE_URL).catch(() => {})}
          >
            <View style={styles.portalLeft}>
              <View style={styles.portalIconBox}>
                <Ionicons name="globe-outline" size={22} color={COLORS.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.portalTitle}>Madrasatu-s-Salikat Official Portal</Text>
                <Text style={styles.portalSub}>Visit institutional portal: madrasa-website-299.netlify.app</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroSection: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
    ...SHADOWS.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    overflow: 'hidden',
  },
  teacherAvatar: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  teacherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 168, 78, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  teacherBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  teacherName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  teacherIdText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  datePrayerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.3)',
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hijriText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  prayerCol: {
    alignItems: 'flex-end',
  },
  prayerValText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  categorySubheading: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  metricIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 64,
    ...SHADOWS.card,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 1,
  },
  actionSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    ...SHADOWS.card,
  },
  classStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  classStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  classMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  classJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
  },
  classJoinText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyScheduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyScheduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  emptyScheduleText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  createScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  createScheduleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  submissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  submissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  submissionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  submissionMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  reviewBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  allClearCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 6,
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  allClearSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  hadithCard: {
    backgroundColor: '#0F2922',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  hadithHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  hadithHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.6,
  },
  arabicCalligraphy: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
  },
  hadithMeaning: {
    fontSize: 13,
    color: '#E2E8E4',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  hadithCitation: {
    fontSize: 11,
    color: COLORS.secondary,
    textAlign: 'right',
    fontWeight: '600',
  },
  portalLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A2E24',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  portalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  portalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(200, 168, 78, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  portalSub: {
    fontSize: 11,
    color: '#E2E8E4',
  },
  quickRecordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  quickRecordText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  daysStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: SPACING.sm,
    gap: 4,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayPillToday: {
    borderColor: COLORS.primary,
  },
  dayPillName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  dayPillNameSelected: {
    color: '#fff',
  },
  dayPillNameToday: {
    color: COLORS.primary,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  timetableContentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  timetableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timetableDayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  timetableCoursesList: {
    gap: 8,
  },
  timetableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  timetableCourseMeta: {
    flex: 1,
    paddingRight: 8,
  },
  timetableCourseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  timetableCourseTiming: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timetableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timetableAttendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: '#E8F5EE',
    gap: 4,
  },
  timetableAttendanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  timetableLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    gap: 4,
  },
  timetableLaunchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  timetableEmptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
});
