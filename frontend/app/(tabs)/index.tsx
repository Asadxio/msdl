import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { calculatePrayerTimes, getPrayerCalculationSettings, getPrayerWindow, PrayerTime } from '@/lib/prayerTimes';
import { loadPrayerSettings, PrayerSettings, subscribeToPrayerSettings } from '@/lib/prayerStorage';
import { DAILY_WISDOM, MASNOON_DUAS, HADITHS, MOTIVATIONAL_QUOTES } from '@/constants/wisdomData';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

const HIJRI_MONTH_NORMALIZATION: Record<string, string> = {
  "Dhuʻl-Qiʻdah": 'Zul Qidah', 'Dhu’l-Qi’dah': 'Zul Qidah',
  "Dhuʻl-Hijjah": 'Zul Hijjah', 'Dhu’l-Hijjah': 'Zul Hijjah',
  'Dhu al-Hijjah': 'Zul Hijjah',
  'Rabiʻ I': 'Rabi al-Awwal', 'Rabi’ I': 'Rabi al-Awwal',
  'Rabiʻ II': 'Rabi al-Thani', 'Rabi’ II': 'Rabi al-Thani',
};

function formatHijri(date: Date) {
  const raw = new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
  return Object.entries(HIJRI_MONTH_NORMALIZATION).reduce((value, [from, to]) => value.replace(from, to), raw);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user } = useAuth();
  const { 
    courses,
    getResumeLearning, 
    getCourseProgress,
    lessonProgress,
    refetch,
    refetchLearning,
  } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [prayerSettings, setPrayerSettings] = useState<PrayerSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const [badgeCount, setBadgeCount] = useState(0);

  // Animation ref for subtle footer fade-in
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      refetch();
      await refetchLearning();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPrayerSettings().then(setPrayerSettings);
    const unsub = subscribeToPrayerSettings(setPrayerSettings);
    const interval = setInterval(() => setNow(new Date()), 60000);
    
    Notifications.getBadgeCountAsync().then(count => setBadgeCount(count)).catch(() => {});

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [fadeAnim]);

  const randomWisdom = useMemo(() => DAILY_WISDOM[Math.floor(Math.random() * DAILY_WISDOM.length)], []);
  const randomDua = useMemo(() => MASNOON_DUAS[Math.floor(Math.random() * MASNOON_DUAS.length)], []);
  const randomHadith = useMemo(() => HADITHS[Math.floor(Math.random() * HADITHS.length)], []);
  const randomQuote = useMemo(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)], []);

  const hijriDate = useMemo(() => formatHijri(now), [now]);

  let currentPrayer: PrayerTime | null = null;
  let nextPrayer: PrayerTime | null = null;
  let progressRatio = 0;
  
  if (prayerSettings) {
    const calcSettings = getPrayerCalculationSettings(
      prayerSettings.method === "auto" ? prayerSettings.country : prayerSettings.method
    );
    const prayers = calculatePrayerTimes(now, prayerSettings.latitude, prayerSettings.longitude, calcSettings, prayerSettings.altitude);
    const window = getPrayerWindow(prayers, now, prayerSettings.latitude, prayerSettings.longitude, calcSettings, prayerSettings.altitude);
    currentPrayer = window.current;
    nextPrayer = window.next;
    progressRatio = window.progress;
  }

  const resume = getResumeLearning();
  const activeCourseProgress = useMemo(() => {
    if (!resume) return null;
    return getCourseProgress(resume.courseId);
  }, [resume, getCourseProgress]);
  
  // Calculate existing verified statistics (no fake numbers or placeholders)
  const { completedLessonsCount, quizAttemptsCount, coursesCompletedCount } = useMemo(() => {
    let lCount = 0;
    let qCount = 0;
    if (lessonProgress) {
      Object.values(lessonProgress).forEach(p => {
        if (p.completed) lCount += 1;
        if (p.quizCompleted) qCount += 1;
      });
    }
    let cCount = 0;
    if (courses && courses.length > 0) {
      courses.forEach(c => {
        const prog = getCourseProgress(c.id);
        if (prog && prog.totalLessons > 0 && prog.completionPercent === 100) {
          cCount += 1;
        }
      });
    }
    return { completedLessonsCount: lCount, quizAttemptsCount: qCount, coursesCompletedCount: cCount };
  }, [lessonProgress, courses, getCourseProgress]);

  // Generate dynamic Today's Goal checklist from existing activity
  const checklistItems = useMemo(() => {
    const isLessonDone = resume && lessonProgress[resume.lessonId]?.completed;
    const isAnyQuizDone = quizAttemptsCount > 0;
    return [
      {
        id: 'continue_course',
        title: resume ? `Continue "${resume.courseName}"` : 'Enroll in a Course',
        subtitle: resume ? `Next lesson: ${resume.lessonTitle}` : 'Explore subjects in our catalog',
        completed: !!isLessonDone,
        route: resume ? `/course/${resume.courseId}` : '/(tabs)/courses',
      },
      {
        id: 'complete_quiz',
        title: 'Complete a Lesson Quiz',
        subtitle: 'Test your understanding and earn progress',
        completed: !!isAnyQuizDone,
        route: '/(tabs)/quiz',
      },
      {
        id: 'read_library',
        title: 'Read Islamic Library Book',
        subtitle: 'Enhance knowledge from classic texts',
        completed: false, // Always keep open for daily reading engagement
        route: '/(tabs)/library',
      },
      {
        id: 'prayer_check',
        title: 'Check Daily Prayer Times',
        subtitle: 'Stay punctual with local prayer schedules',
        completed: !!(currentPrayer && nextPrayer),
        route: '/prayer-times',
      },
    ];
  }, [resume, lessonProgress, quizAttemptsCount, currentPrayer, nextPrayer]);

  const isLocationUnavailable = !prayerSettings || !prayerSettings.city || prayerSettings.city === 'Location unavailable' || prayerSettings.state === 'Permission needed';

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.founder;
  if (isAdmin) {
    return (
      <AdminDashboard
        profile={profile}
        user={user}
        hijriDate={hijriDate}
        currentPrayer={currentPrayer}
        nextPrayer={nextPrayer}
        formatTime={formatTime}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Section 1: Premium Hero Branding */}
        <View style={[styles.heroSection, { paddingTop: insets.top + SPACING.sm }]}>
          <View style={styles.headerActionsRow}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/notifications')} 
              style={styles.headerActionBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.surface} />
              {badgeCount > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/settings')} 
              style={styles.headerActionBtn}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={24} color={COLORS.surface} />
            </TouchableOpacity>
          </View>
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
          <Text style={styles.welcomeTo}>WELCOME TO</Text>
          <Text style={styles.madrasaName}>Madrasa Tus Salikat Lil Banat</Text>
          <Text style={styles.madrasaArabic}>مدرسۃ السالکات للبنات</Text>
          <View style={styles.taglineRow}>
            <View style={styles.goldLine} />
            <Text style={styles.tagline}>Nurturing Knowledge & Faith</Text>
            <View style={styles.goldLine} />
          </View>
        </View>

        {/* Section 2: Phase 1 — Welcome Card Enhancement */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeInfo}>
            <Text style={styles.welcomeBackText}>Welcome Back</Text>
            <Text style={styles.userName} numberOfLines={1}>{profile?.name || 'Student'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {profile?.role === 'super_admin' || profile?.founder ? 'ADMINISTRATOR' : (profile?.role === 'teacher' ? 'TEACHER' : 'STUDENT')}
              </Text>
            </View>
          </View>
          <View style={styles.avatarCircle}>
             <Text style={styles.avatarText}>
                {profile?.name ? profile.name.charAt(0).toUpperCase() : 'S'}
             </Text>
          </View>
        </View>

        {/* Section 3: Daily Wisdom */}
        <View style={styles.sectionContainer}>
          <View style={styles.wisdomCard}>
             <View style={styles.sectionHeaderRow}>
               <Ionicons name="sparkles" size={16} color={COLORS.secondary} />
               <Text style={[styles.sectionEyebrow, { color: COLORS.secondary }]}>Daily Wisdom</Text>
             </View>
             <Text style={styles.arabicTextLarge}>{randomWisdom.arabic}</Text>
             <Text style={styles.translationText}>&quot;{randomWisdom.translation}&quot;</Text>
             <Text style={styles.referenceText}>— {randomWisdom.reference}</Text>
          </View>
        </View>

        {/* Section 4 & 5: Today's Dua & Hadith */}
        <View style={styles.twoColumnGrid}>
          <View style={[styles.gridCard, { flex: 1 }]}>
             <View style={styles.sectionHeaderRow}>
               <Ionicons name="moon-outline" size={16} color={COLORS.secondary} />
               <Text style={[styles.sectionEyebrow, { color: COLORS.textMuted }]}>Today&apos;s Dua</Text>
             </View>
             <Text style={styles.arabicTextMedium}>{randomDua.arabic}</Text>
             <Text style={styles.translationTextSmall}>&quot;{randomDua.translation}&quot;</Text>
             <Text style={styles.referenceTextSmall}>{randomDua.reference}</Text>
          </View>
          <View style={[styles.gridCard, { flex: 1 }]}>
             <View style={styles.sectionHeaderRow}>
               <Ionicons name="book-outline" size={16} color={COLORS.secondary} />
               <Text style={[styles.sectionEyebrow, { color: COLORS.textMuted }]}>Today&apos;s Hadith</Text>
             </View>
             <Text style={styles.arabicTextMedium}>{randomHadith.arabic}</Text>
             <Text style={styles.translationTextSmall}>&quot;{randomHadith.translation}&quot;</Text>
             <Text style={styles.referenceTextSmall}>{randomHadith.reference}</Text>
          </View>
        </View>

        {/* Section 6: Phase 2 — Prayer Times Card with Location UX Fallback */}
        <View style={styles.sectionContainer}>
          <View style={styles.prayerCard}>
            <View style={styles.prayerHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.prayerTitle}>Prayer Times</Text>
                {isLocationUnavailable ? (
                  <TouchableOpacity 
                    style={styles.locationPromptBadge}
                    onPress={() => router.push('/prayer-times')}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Enable Location or Select City"
                  >
                    <Ionicons name="location" size={14} color={COLORS.secondary} />
                    <Text style={styles.locationPromptText}>📍 Select City • Enable Location</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.prayerLocation}>
                    {prayerSettings?.city}{prayerSettings?.state && prayerSettings.state !== 'Permission needed' ? `, ${prayerSettings.state}` : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                onPress={() => router.push('/prayer-times')} 
                style={styles.glassBtn}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="View All Prayer Times"
              >
                <Ionicons name="time-outline" size={16} color={COLORS.secondary} />
                <Text style={styles.glassBtnText}>View All</Text>
              </TouchableOpacity>
            </View>
            {currentPrayer && nextPrayer ? (
              <>
                <View style={styles.prayerContentRow}>
                  <View style={styles.prayerInfoCol}>
                     <Text style={styles.prayerLabel}>Current</Text>
                     <Text style={styles.prayerName}>{currentPrayer.name}</Text>
                     <Text style={styles.prayerTime}>{formatTime(currentPrayer.time)}</Text>
                  </View>
                  <View style={styles.prayerDivider} />
                  <View style={styles.prayerInfoCol}>
                     <Text style={styles.prayerLabel}>Next</Text>
                     <Text style={styles.prayerName}>{nextPrayer.name}</Text>
                     <Text style={styles.prayerTime}>{formatTime(nextPrayer.time)}</Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                   <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                </View>
              </>
            ) : (
              <View style={styles.prayerFallbackBox}>
                <Text style={styles.prayerFallbackText}>
                  Setup your location to view accurate daily prayer schedules and real-time countdowns.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Section 7: Islamic Calendar */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity 
             style={styles.calendarCard}
             onPress={() => router.push('/islamic-calendar')}
             accessible={true}
             accessibilityRole="button"
             accessibilityLabel={`Islamic Calendar: ${hijriDate}`}
          >
            <Ionicons name="calendar" size={24} color={COLORS.secondary} />
            <View style={styles.calendarTextCol}>
               <Text style={styles.hijriTitle}>{hijriDate}</Text>
               <Text style={styles.gregorianSubtitle}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section 8: Phase 3 — Continue Learning */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Continue Learning</Text>
          {resume && activeCourseProgress ? (
            <TouchableOpacity 
               style={styles.continueCard}
               onPress={() => router.push(`/course/${resume.courseId}` as any)}
               accessible={true}
               accessibilityRole="button"
               accessibilityLabel={`Continue ${resume.courseName}, lesson ${resume.lessonTitle}`}
            >
               <View style={styles.continueHeaderRow}>
                 <View style={styles.resumeIconBox}>
                   <Ionicons name="play" size={20} color={COLORS.surface} />
                 </View>
                 <View style={styles.resumeTextCol}>
                   <Text style={styles.resumeCourseName}>{resume.courseName}</Text>
                   <Text style={styles.resumeLessonName}>{resume.lessonTitle}</Text>
                 </View>
               </View>
               <View style={styles.progressBarContainer}>
                 <View style={styles.progressTrackBar}>
                   <View style={[styles.progressFillBar, { width: `${activeCourseProgress.completionPercent}%` }]} />
                 </View>
                 <Text style={styles.progressPercentText}>{activeCourseProgress.lessonsDone}/{activeCourseProgress.totalLessons} Lessons ({activeCourseProgress.completionPercent}%)</Text>
               </View>
               <View style={styles.continueBtnRow}>
                 <Text style={styles.continueBtnText}>Continue Learning</Text>
                 <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
               </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyLearningCard}>
              <View style={styles.emptyLearningIconBox}>
                <Ionicons name="book-outline" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.emptyLearningTextCol}>
                <Text style={styles.emptyLearningTitle}>Start Your Journey</Text>
                <Text style={styles.emptyLearningSubtitle}>
                  You haven&apos;t started any courses yet. Explore our structured curriculum and enroll today.
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.exploreBtn} 
                onPress={() => router.push('/(tabs)/courses')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Explore Courses"
              >
                <Text style={styles.exploreBtnText}>Explore Courses</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Section 9: Phase 5 — Today's Goal Checklist */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Today&apos;s Goal</Text>
          <View style={styles.checklistCard}>
            {checklistItems.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.checklistItemRow,
                  idx < checklistItems.length - 1 && styles.checklistItemBorder
                ]}
                onPress={() => router.push(item.route as any)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.completed ? 'Completed' : 'Pending'}`}
              >
                <View style={[styles.checkboxCircle, item.completed && styles.checkboxCircleDone]}>
                  <Ionicons 
                    name={item.completed ? "checkmark" : "square-outline"} 
                    size={item.completed ? 16 : 20} 
                    color={item.completed ? COLORS.surface : COLORS.textMuted} 
                  />
                </View>
                <View style={styles.checklistTextCol}>
                  <Text style={[styles.checklistTitle, item.completed && styles.checklistTitleDone]}>{item.title}</Text>
                  <Text style={styles.checklistSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section 10: Phase 6 — Quick Access */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessGrid}>
             {[
               { name: 'Courses', icon: 'book', route: '/(tabs)/courses' },
               { name: 'Library', icon: 'library', route: '/(tabs)/library' },
               { name: 'Quiz', icon: 'help-circle', route: '/(tabs)/quiz' },
               { name: 'Prayer', icon: 'time', route: '/prayer-times' },
               { name: 'Qibla', icon: 'compass', route: '/qibla' },
               { name: 'Live Classes', icon: 'videocam', route: '/live-class' },
               { name: 'Progress', icon: 'trending-up', route: '/(tabs)/progress' },
               { name: 'View All', icon: 'grid', route: '/more' },
             ].map((item, idx) => (
               <TouchableOpacity 
                 key={idx} 
                 style={styles.quickAccessItem}
                 onPress={() => router.push(item.route as any)}
                 accessible={true}
                 accessibilityRole="button"
                 accessibilityLabel={item.name}
                 activeOpacity={0.7}
               >
                 <View style={styles.quickAccessIcon}>
                   <Ionicons name={item.icon as any} size={24} color={COLORS.primary} />
                 </View>
                 <Text style={styles.quickAccessText} numberOfLines={1}>{item.name}</Text>
               </TouchableOpacity>
             ))}
          </View>
        </View>

        {/* Section 11: Phase 4 — Dashboard Statistics */}
        {(completedLessonsCount > 0 || quizAttemptsCount > 0 || coursesCompletedCount > 0) ? (
          <View style={styles.sectionContainer}>
             <Text style={styles.sectionTitle}>Dashboard Statistics</Text>
             <View style={styles.statsGrid}>
                {completedLessonsCount > 0 && (
                  <View style={styles.statCard}>
                    <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statValue}>{completedLessonsCount}</Text>
                    <Text style={styles.statLabel}>Lessons Done</Text>
                  </View>
                )}
                {quizAttemptsCount > 0 && (
                  <View style={styles.statCard}>
                    <Ionicons name="ribbon-outline" size={24} color={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statValue}>{quizAttemptsCount}</Text>
                    <Text style={styles.statLabel}>Quiz Attempts</Text>
                  </View>
                )}
                {coursesCompletedCount > 0 && (
                  <View style={styles.statCard}>
                    <Ionicons name="trophy-outline" size={24} color="#C59B27" style={styles.statIcon} />
                    <Text style={styles.statValue}>{coursesCompletedCount}</Text>
                    <Text style={styles.statLabel}>Courses Done</Text>
                  </View>
                )}
             </View>
          </View>
        ) : null}

        {/* Section 12: Phase 7 — Footer Polish */}
        <Animated.View style={[styles.footerContainer, { opacity: fadeAnim }]}>
          <View style={styles.footerDivider} />
          <Text style={styles.ornamentText}>❁ ❖ ❁</Text>
          <Text style={styles.footerQuote}>&quot;{randomQuote.text}&quot;</Text>
          <Text style={styles.footerInstitutionText}>Madrasa Tus Salikat Lil Banat • Nurturing Faith & Excellence</Text>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  heroSection: {
    backgroundColor: COLORS.primary,
    paddingBottom: 45,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    ...SHADOWS.card,
  },
  headerActionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  headerActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  badgeDotText: {
    color: COLORS.surface,
    fontSize: 9,
    fontWeight: '800',
  },
  bismillah: {
    fontSize: 24,
    color: COLORS.secondary,
    fontWeight: '400',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  welcomeTo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  madrasaName: {
    fontSize: 26,
    color: COLORS.surface,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  madrasaArabic: {
    fontSize: 22,
    color: COLORS.secondary,
    marginTop: 6,
    fontWeight: '600',
    lineHeight: 34,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  goldLine: {
    height: 1.5,
    width: 36,
    backgroundColor: COLORS.secondary,
  },
  tagline: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  welcomeCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: -28,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
  },
  welcomeInfo: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: SPACING.md,
  },
  welcomeBackText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  roleBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C59B27',
    letterSpacing: 1,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.secondary,
    ...SHADOWS.card,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.surface,
  },
  sectionContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  wisdomCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  arabicTextLarge: {
    fontSize: 24,
    color: COLORS.surface,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 38,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  referenceText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  gridCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(6,78,59,0.08)',
  },
  arabicTextMedium: {
    fontSize: 18,
    color: COLORS.textMain,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 30,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationTextSmall: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  referenceTextSmall: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  prayerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  prayerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.surface,
  },
  prayerLocation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginTop: 4,
  },
  locationPromptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  locationPromptText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  glassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    minHeight: 36,
  },
  glassBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.surface,
  },
  prayerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prayerInfoCol: {
    flex: 1,
  },
  prayerLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prayerName: {
    fontSize: 22,
    color: COLORS.surface,
    fontWeight: '900',
    marginTop: 2,
  },
  prayerTime: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    marginTop: 2,
  },
  prayerDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.lg,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  prayerFallbackBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: 8,
  },
  prayerFallbackText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    ...SHADOWS.card,
  },
  calendarTextCol: {
    flex: 1,
  },
  hijriTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  gregorianSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 3,
  },
  continueCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(6,78,59,0.1)',
  },
  continueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  resumeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  resumeTextCol: {
    flex: 1,
  },
  resumeCourseName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  resumeLessonName: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  progressBarContainer: {
    marginBottom: SPACING.md,
  },
  progressTrackBar: {
    height: 8,
    backgroundColor: 'rgba(6,78,59,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFillBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'right',
  },
  continueBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  emptyLearningCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  emptyLearningIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6,78,59,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyLearningTextCol: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyLearningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  emptyLearningSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  exploreBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  exploreBtnText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  checklistCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    minHeight: 64,
    gap: SPACING.md,
  },
  checklistItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  checkboxCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircleDone: {
    backgroundColor: COLORS.primary,
  },
  checklistTextCol: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  checklistTitleDone: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  checklistSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickAccessItem: {
    width: '48%',
    minHeight: 64,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  quickAccessIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6,78,59,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    minHeight: 110,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    ...SHADOWS.card,
  },
  statIcon: {
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 48,
    marginBottom: 24,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  footerDivider: {
    width: 60,
    height: 1.5,
    backgroundColor: 'rgba(212,175,55,0.4)',
    marginBottom: 16,
  },
  ornamentText: {
    fontSize: 14,
    color: COLORS.secondary,
    marginBottom: 12,
    letterSpacing: 4,
  },
  footerQuote: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 10,
  },
  footerInstitutionText: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.4)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
