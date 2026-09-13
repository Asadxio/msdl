import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Animated, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { calculatePrayerTimes, getPrayerCalculationSettings, getPrayerWindow, PrayerTime } from '@/lib/prayerTimes';
import { loadPrayerSettings, PrayerSettings, subscribeToPrayerSettings } from '@/lib/prayerStorage';
import { scheduleOfflinePrayerAlarms } from '@/lib/prayerAlarmService';
import { DAILY_WISDOM, MASNOON_DUAS, HADITHS, MOTIVATIONAL_QUOTES } from '@/constants/wisdomData';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { TeacherDashboard } from '@/components/teacher/TeacherDashboard';
import { MADRASA_WEBSITE_URL } from '@/lib/links';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcherSheet } from '@/components/LanguageSwitcherSheet';
import { StudentLearningCard } from '@/components/dashboard/StudentLearningCard';
import { DailyWisdomCard } from '@/components/dashboard/DailyWisdomCard';
import { SpiritualMomentsRow } from '@/components/dashboard/SpiritualMomentsRow';
import { PrayerTimesHeroCard } from '@/components/dashboard/PrayerTimesHeroCard';
import { TodaysJourneyCard } from '@/components/dashboard/TodaysJourneyCard';
import { QuickAccessGrid } from '@/components/dashboard/QuickAccessGrid';

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
    loading: dataLoading,
    getResumeLearning, 
    getCourseProgress,
    lessonProgress,
    isEnrolledInCourse,
    refetch,
    refetchLearning,
  } = useData();

  const { languageName } = useLanguage();
  const [langSheetVisible, setLangSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prayerSettings, setPrayerSettings] = useState<PrayerSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const [badgeCount, setBadgeCount] = useState(0);

  // Animation ref for subtle footer fade-in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Blinking badge pulse animation for pending lesson
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Interval ref — dynamic (1s when namaz < 5 min, 10s otherwise)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    loadPrayerSettings().then((st) => {
      setPrayerSettings(st);
      void scheduleOfflinePrayerAlarms(st).catch(() => {});
    });
    const unsub = subscribeToPrayerSettings((st) => {
      setPrayerSettings(st);
      void scheduleOfflinePrayerAlarms(st).catch(() => {});
    });

    Notifications.getBadgeCountAsync().then(count => setBadgeCount(count)).catch(() => {});

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Pulse animation for pending lesson indicator (blinking dot)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      unsub();
    };
  }, [fadeAnim, pulseAnim]);

  // 1.4 — Dynamic countdown interval: 1s when namaz < 5 min, 10s otherwise
  // 1.4 — Dynamic countdown interval managed via a separate effect AFTER prayerWindow is available

  const randomWisdom = useMemo(() => DAILY_WISDOM[Math.floor(Math.random() * DAILY_WISDOM.length)], []);
  const randomDua = useMemo(() => MASNOON_DUAS[Math.floor(Math.random() * MASNOON_DUAS.length)], []);
  const randomHadith = useMemo(() => HADITHS[Math.floor(Math.random() * HADITHS.length)], []);
  const randomQuote = useMemo(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)], []);

  const hijriDate = useMemo(() => formatHijri(now), [now]);

  const prayerCalculationData = useMemo(() => {
    if (!prayerSettings) return { prayers: [] as PrayerTime[], current: null, next: null, progress: 0 };
    const calcSettings = getPrayerCalculationSettings(
      prayerSettings.method === "auto" ? prayerSettings.country : prayerSettings.method
    );
    const prayers = calculatePrayerTimes(now, prayerSettings.latitude, prayerSettings.longitude, calcSettings, prayerSettings.altitude);
    const window = getPrayerWindow(prayers, now, prayerSettings.latitude, prayerSettings.longitude, calcSettings, prayerSettings.altitude);
    return {
      prayers,
      current: window.current,
      next: window.next,
      progress: window.progress,
    };
  }, [prayerSettings, now]);

  const currentPrayer = prayerCalculationData.current;
  const nextPrayer = prayerCalculationData.next;
  const progressRatio = prayerCalculationData.progress;
  const prayersList = prayerCalculationData.prayers;

  // Urdu Next Namaz Countdown (e.g. "عصر کا وقت 35 منٹ میں شروع ہوگا")
  const nextPrayerCountdownUrdu = useMemo(() => {
    if (!nextPrayer) return '';
    const msDiff = nextPrayer.time.getTime() - now.getTime();
    if (msDiff <= 0) return '';
    const totalMinutes = Math.max(1, Math.round(msDiff / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const urduPrayerNames: Record<string, string> = {
      Fajr: 'فجر',
      Sunrise: 'طلوعِ آفتاب',
      Zuhr: 'ظہر',
      Asr: 'عصر',
      Maghrib: 'مغرب',
      Isha: 'عشاء',
    };
    const nameUrdu = urduPrayerNames[nextPrayer.name] || nextPrayer.name;

    if (hours > 0 && minutes > 0) {
      return `${nameUrdu} کا وقت ${hours} گھنٹے ${minutes} منٹ میں شروع ہوگا`;
    } else if (hours > 0) {
      return `${nameUrdu} کا وقت ${hours} گھنٹے میں شروع ہوگا`;
    } else {
      return `${nameUrdu} کا وقت ${minutes} منٹ میں شروع ہوگا`;
    }
  }, [nextPrayer, now]);

  // 1.4 — Dynamic interval: 1s when next namaz < 5 min, 10s otherwise
  const nextPrayerTimestamp = nextPrayer?.time?.getTime() ?? null;
  useEffect(() => {
    const getIntervalMs = () => {
      if (!nextPrayerTimestamp) return 10000;
      const diff = nextPrayerTimestamp - Date.now();
      return diff > 0 && diff < 5 * 60 * 1000 ? 1000 : 10000;
    };
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setNow(new Date()), getIntervalMs());
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [nextPrayerTimestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = useMemo(() => getResumeLearning(), [getResumeLearning]);
  const activeCourseProgress = useMemo(() => {
    if (!resume) return null;
    return getCourseProgress(resume.courseId);
  }, [resume, getCourseProgress]);
  
  // Calculate verified academic statistics scoped to enrolled courses
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
      const candidateCourses = profile?.role === 'student'
        ? courses.filter(c => isEnrolledInCourse(c.id))
        : courses;
      candidateCourses.forEach(c => {
        const prog = getCourseProgress(c.id);
        if (prog && prog.totalLessons > 0 && prog.completionPercent === 100) {
          cCount += 1;
        }
      });
    }
    return { completedLessonsCount: lCount, quizAttemptsCount: qCount, coursesCompletedCount: cCount };
  }, [lessonProgress, courses, getCourseProgress, profile?.role, isEnrolledInCourse]);

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

  // 1.1 — Time-based Islamic greeting
  const islamicGreeting = useMemo(() => {
    const hour = now.getHours();
    if (hour >= 4 && hour < 7)  return 'صُبْحُكَ خَيْر'; // Fajr/Subah: Good Morning
    if (hour >= 7 && hour < 12) return 'السَّلَامُ عَلَيْكُم'; // Morning greeting
    if (hour >= 12 && hour < 15) return 'مَرْحَبًا';          // Zuhr: Welcome
    if (hour >= 15 && hour < 19) return 'مَسَاءُ الخَيْر';   // Asr/Sham: Good Evening
    if (hour >= 19 && hour < 22) return 'مَسَاءُ النُّور';   // Maghrib/Isha
    return 'لَيْلَةٌ مُبَارَكَة';                           // Late night: Blessed night
  }, [now]);

  // 1.2 — Is current lesson still pending (not completed)?
  const isLessonPending = !!resume && !(lessonProgress[resume.lessonId]?.completed);

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

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'assistant_teacher';
  if (isTeacher) {
    return (
      <TeacherDashboard
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 52 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Section 1: Institutional Header with Architectural Background */}
        <View style={styles.heroSection}>
          <Image
            source={require('@/assets/images/islamic_header_bg.jpg')}
            style={styles.heroBackgroundImage}
            contentFit="cover"
          />
          <View style={styles.heroOverlay} />

          <View style={[styles.heroContent, { paddingTop: insets.top + SPACING.xs }]}>
            {/* Top Navigation Row */}
            <View style={styles.headerActionsRow}>
              {/* 1-Tap Language Quick Switcher */}
              <TouchableOpacity
                onPress={() => setLangSheetVisible(true)}
                style={styles.langPillBtn}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Change Language"
                activeOpacity={0.8}
              >
                <Ionicons name="globe-outline" size={14} color="#D8C28A" />
                <Text style={styles.langPillText}>{languageName}</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity 
                onPress={() => router.push('/search')} 
                style={styles.headerActionBtn}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/(tabs)/notifications')} 
                style={styles.headerActionBtn}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
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
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Bismillah */}
            <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>

            {/* Dynamic Greeting & Subtitle */}
            <View style={styles.greetingBox}>
              <Text style={styles.greetingTitle}>
                Assalamu Alaikum, {profile?.name ? profile.name.split(' ')[0] : 'Taliba'} 👋
              </Text>
              <Text style={styles.greetingSubtitle}>
                Ready for today&apos;s learning? • {hijriDate}
              </Text>
            </View>

            {/* Institutional Tagline */}
            <View style={styles.taglineRow}>
              <View style={styles.goldLine} />
              <Text style={styles.tagline}>MADRASATU-S-SALIKAT LIL BANAT</Text>
              <View style={styles.goldLine} />
            </View>
          </View>
        </View>

        {/* Section 2: Student Identity & Learning Card */}
        <StudentLearningCard
          profile={profile}
          resumeCourseName={resume?.courseName}
          totalLessons={activeCourseProgress?.totalLessons}
          lessonsDone={activeCourseProgress?.lessonsDone}
          completionPercent={activeCourseProgress?.completionPercent}
          coursesCount={courses?.length}
        />

        {/* Global Quick Search Bar */}
        <TouchableOpacity
          style={styles.homeSearchBar}
          onPress={() => router.push('/search')}
          activeOpacity={0.85}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Search everything in app"
        >
          <Ionicons name="search" size={18} color="#075B49" />
          <Text style={styles.homeSearchPlaceholder}>Search courses, lessons, library and more...</Text>
          <View style={styles.searchPillBadge}>
            <Text style={styles.searchPillBadgeText}>Search</Text>
          </View>
        </TouchableOpacity>

        {/* Section 3: Daily Wisdom */}
        <DailyWisdomCard
          arabic={randomWisdom.arabic}
          translation={randomWisdom.translation}
          reference={randomWisdom.reference}
        />

        {/* Section 4: Today's Spiritual Moments (Dua + Hadith) */}
        <SpiritualMomentsRow
          dua={randomDua}
          hadith={randomHadith}
        />

        {/* Section 5: Prayer Times Hero Card */}
        <PrayerTimesHeroCard
          city={prayerSettings?.city}
          state={prayerSettings?.state}
          isLocationUnavailable={isLocationUnavailable}
          currentPrayer={currentPrayer}
          nextPrayer={nextPrayer}
          progressRatio={progressRatio}
          urduCountdown={nextPrayerCountdownUrdu}
          prayers={prayersList}
          now={now}
          formatTime={formatTime}
        />

        {/* Section 6: Continue Learning */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Continue Learning</Text>
          {dataLoading ? (
            <View style={styles.skeletonContinueCard}>
              <View style={styles.skeletonRow}>
                <View style={styles.skeletonIconBox} />
                <View style={styles.skeletonTextCol}>
                  <View style={[styles.skeletonLine, { width: '70%' }]} />
                  <View style={[styles.skeletonLine, { width: '50%', marginTop: 6 }]} />
                </View>
              </View>
              <View style={[styles.skeletonLine, { width: '100%', height: 8, marginTop: 16, borderRadius: 4 }]} />
              <View style={[styles.skeletonLine, { width: '40%', height: 10, marginTop: 8 }]} />
            </View>
          ) : resume && activeCourseProgress ? (
            <TouchableOpacity 
               style={styles.continueCard}
               onPress={() => router.push(`/course/${resume.courseId}` as any)}
               accessible={true}
               accessibilityRole="button"
               accessibilityLabel={`Continue ${resume.courseName}, lesson ${resume.lessonTitle}`}
               activeOpacity={0.85}
            >
               <View style={styles.continueHeaderRow}>
                 <View style={styles.resumeIconWrapper}>
                   <View style={styles.resumeIconBox}>
                     <Ionicons name="play" size={18} color="#FFFFFF" />
                   </View>
                   {isLessonPending && (
                     <Animated.View style={[styles.pendingPulseDot, { opacity: pulseAnim }]} />
                   )}
                 </View>
                 <View style={styles.resumeTextCol}>
                   <Text style={styles.resumeCourseName} numberOfLines={1}>{resume.courseName}</Text>
                   <Text style={styles.resumeLessonName} numberOfLines={1}>{resume.lessonTitle}</Text>
                   {isLessonPending && (
                     <Text style={styles.pendingLessonLabel}>⏳ Sabaq mukammal nahi hua</Text>
                   )}
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
                 <Ionicons name="arrow-forward" size={14} color="#075B49" />
               </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyLearningCard}>
              <View style={styles.emptyLearningIconBox}>
                <Ionicons name="book-outline" size={26} color="#075B49" />
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
                activeOpacity={0.8}
              >
                <Text style={styles.exploreBtnText}>Explore Courses</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Section 7: Today's Journey Checklist */}
        <TodaysJourneyCard
          items={checklistItems}
          loading={dataLoading}
        />

        {/* Section 8: Quick Access Grid (ALL 18 SERVICES including Islamic Utilities: Smart Tasbeeh -> /tasbeeh) */}
        <QuickAccessGrid />

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
          <TouchableOpacity
            style={styles.websiteFooterBtn}
            onPress={() => Linking.openURL(MADRASA_WEBSITE_URL)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Visit Official Madrasa Website"
          >
            <Ionicons name="globe-outline" size={16} color={COLORS.primary} />
            <Text style={styles.websiteFooterBtnText}>Visit Official Website</Text>
            <Ionicons name="open-outline" size={13} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.ornamentText}>❁ ❖ ❁</Text>
          <Text style={styles.footerQuote}>&quot;{randomQuote.text}&quot;</Text>
          <Text style={styles.footerInstitutionText}>Madrasa Tus Salikat Lil Banat • Nurturing Faith & Excellence</Text>
        </Animated.View>

      </ScrollView>

      {/* 1-Tap Language Switcher Modal Sheet */}
      <LanguageSwitcherSheet
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroSection: {
    backgroundColor: '#043C32',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 38,
    ...SHADOWS.header,
  },
  heroBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.38,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#043C32',
    opacity: 0.55,
  },
  heroContent: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    width: '100%',
  },
  greetingBox: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  greetingSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D8C28A',
    marginTop: 2,
    textAlign: 'center',
  },
  headerActionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  langPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    fontSize: 18,
    color: COLORS.secondaryLight,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  madrasaName: {
    fontSize: 22,
    color: COLORS.surface,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  madrasaArabic: {
    fontSize: 19,
    color: COLORS.secondaryLight,
    marginTop: 4,
    fontWeight: '600',
    lineHeight: 30,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  goldLine: {
    height: 1,
    width: 28,
    backgroundColor: COLORS.secondary,
  },
  tagline: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  welcomeCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: -20,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  welcomeInfo: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: SPACING.md,
  },
  welcomeBackText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  roleBadge: {
    backgroundColor: 'rgba(200, 168, 78, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.3)',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldText,
    letterSpacing: 0.8,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.surface,
  },
  sectionContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  wisdomCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  arabicTextLarge: {
    fontSize: 21,
    color: COLORS.textMain,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 34,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  referenceText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  gridCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  arabicTextMedium: {
    fontSize: 16,
    color: COLORS.textMain,
    textAlign: 'right',
    marginBottom: 6,
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationTextSmall: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 6,
  },
  referenceTextSmall: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  prayerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  prayerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.surface,
  },
  prayerLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginTop: 3,
  },
  locationPromptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 168, 78, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.4)',
  },
  locationPromptText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryLight,
  },
  glassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 10,
    color: COLORS.secondaryLight,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prayerName: {
    fontSize: 20,
    color: COLORS.surface,
    fontWeight: '800',
    marginTop: 2,
  },
  prayerTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    marginTop: 2,
  },
  prayerDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.md,
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  prayerCountdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 46, 35, 0.85)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 78, 0.4)',
    gap: 8,
  },
  prayerCountdownText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FDE68A',
    flex: 1,
    textAlign: 'center',
  },
  prayerFallbackBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: 6,
  },
  prayerFallbackText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  islamicGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  islamicGridCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  islamicIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  islamicGridTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    textAlign: 'center',
  },
  islamicGridSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  calendarTextCol: {
    flex: 1,
  },
  hijriTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  gregorianSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  continueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.lg,
    ...SHADOWS.premiumCard,
    borderWidth: 1,
    borderColor: '#E7E4DA',
  },
  continueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  resumeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#075B49',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTextCol: {
    flex: 1,
  },
  resumeCourseName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17332C',
  },
  resumeLessonName: {
    fontSize: 12,
    color: '#71817B',
    marginTop: 2,
  },
  progressBarContainer: {
    marginBottom: SPACING.md,
  },
  progressTrackBar: {
    height: 6,
    backgroundColor: '#E7E4DA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillBar: {
    height: '100%',
    backgroundColor: '#075B49',
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71817B',
    marginTop: 4,
    textAlign: 'right',
  },
  continueBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE1',
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#075B49',
  },
  emptyLearningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.premiumCard,
    borderWidth: 1,
    borderColor: '#E7E4DA',
  },
  emptyLearningIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FCFBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#EFECE2',
  },
  emptyLearningTextCol: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyLearningTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17332C',
  },
  emptyLearningSubtitle: {
    fontSize: 12,
    color: '#71817B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  exploreBtn: {
    backgroundColor: '#075B49',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  checklistCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    minHeight: 56,
    gap: SPACING.sm,
  },
  checklistItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkboxCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
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
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  checklistTitleDone: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  checklistSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickAccessItem: {
    width: '48%',
    minHeight: 56,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickAccessIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    minHeight: 96,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  homeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E7E4DA',
    gap: 10,
    ...SHADOWS.card,
  },
  homeSearchPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: '#71817B',
    fontWeight: '500',
  },
  searchPillBadge: {
    backgroundColor: '#075B49',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  searchPillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerContainer: {
    marginTop: 36,
    marginBottom: 20,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  footerDivider: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(200, 168, 78, 0.4)',
    marginBottom: 12,
  },
  ornamentText: {
    fontSize: 13,
    color: COLORS.secondary,
    marginBottom: 8,
    letterSpacing: 3,
  },
  footerQuote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: 8,
  },
  websiteFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...SHADOWS.card,
  },
  websiteFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footerInstitutionText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // ── R1 FIX: Skeleton styles ──────────────────────────────────────────────
  skeletonContinueCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  skeletonIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
  },
  skeletonTextCol: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
  },
  // ── Home Screen Improvements ─────────────────────────────────────────────
  // 1.1 Islamic Greeting
  islamicGreetingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    letterSpacing: 0.3,
    marginBottom: 2,
    writingDirection: 'rtl',
  },
  // 1.2 Pending lesson badge styles
  resumeIconWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  pendingPulseDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F59E0B', // amber — "pending" warning color
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  pendingLessonLabel: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
  },
  // 1.3 Daily Wisdom WhatsApp share button
  wisdomShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(37,211,102,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(37,211,102,0.25)',
  },
  wisdomShareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#128C7E',
    writingDirection: 'rtl',
  },
});
