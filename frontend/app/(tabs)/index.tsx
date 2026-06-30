import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
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
  const { profile } = useAuth();
  const { 
    getResumeLearning, 
    lessonProgress,
    refetch,
    refetchLearning,
  } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [prayerSettings, setPrayerSettings] = useState<PrayerSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const [badgeCount, setBadgeCount] = useState(0);

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

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

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
  
  let completedLessonsCount = 0;
  let quizAttemptsCount = 0;

  if (lessonProgress) {
    Object.values(lessonProgress).forEach(p => {
      if (p.completed) {
        completedLessonsCount += 1;
      }
      if (p.quizCompleted) {
        quizAttemptsCount += 1;
      }
    });
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
            <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')} style={styles.headerActionBtn}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.surface} />
              {badgeCount > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.headerActionBtn}>
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

        {/* Section 2: Premium Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeInfo}>
            <Text style={styles.welcomeBackText}>Welcome Back</Text>
            <Text style={styles.userName}>{profile?.name || 'Student'}</Text>
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

        {/* Section 6: Prayer Card */}
        {prayerSettings && currentPrayer && nextPrayer ? (
          <View style={styles.sectionContainer}>
            <View style={styles.prayerCard}>
              <View style={styles.prayerHeader}>
                <View>
                  <Text style={styles.prayerTitle}>Prayer Times</Text>
                  <Text style={styles.prayerLocation}>{prayerSettings.city}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/prayer-times')} style={styles.glassBtn}>
                  <Ionicons name="time-outline" size={16} color={COLORS.secondary} />
                  <Text style={styles.glassBtnText}>View All</Text>
                </TouchableOpacity>
              </View>
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
            </View>
          </View>
        ) : null}

        {/* Section 9: Islamic Calendar */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity 
             style={styles.calendarCard}
             onPress={() => router.push('/islamic-calendar')}
          >
            <Ionicons name="calendar" size={24} color={COLORS.secondary} />
            <View style={styles.calendarTextCol}>
               <Text style={styles.hijriTitle}>{hijriDate}</Text>
               <Text style={styles.gregorianSubtitle}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section 7: Continue Learning */}
        {resume && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Continue Learning</Text>
            <TouchableOpacity 
               style={styles.resumeCard}
               onPress={() => router.push(`/course/${resume.courseId}` as any)}
            >
              <View style={styles.resumeIconBox}>
                <Ionicons name="play" size={20} color={COLORS.surface} />
              </View>
              <View style={styles.resumeTextCol}>
                <Text style={styles.resumeCourseName}>{resume.courseName}</Text>
                <Text style={styles.resumeLessonName}>{resume.lessonTitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Section 8: Today's Goal */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Today&apos;s Goal</Text>
          <View style={styles.goalCard}>
             <Ionicons name="flag" size={24} color={COLORS.secondary} />
             <View style={styles.goalTextCol}>
                <Text style={styles.goalTitle}>
                  {resume ? 'Complete Your Next Lesson' : 'Start a New Course'}
                </Text>
                <Text style={styles.goalSubtitle}>
                  {resume ? `Continue with "${resume.courseName}" to maintain your streak.` : 'Explore the library and enroll in a new subject today.'}
                </Text>
             </View>
          </View>
        </View>

        {/* Section 10: Quick Access */}
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
             ].map((item, idx) => (
               <TouchableOpacity 
                 key={idx} 
                 style={styles.quickAccessItem}
                 onPress={() => router.push(item.route as any)}
               >
                 <View style={styles.quickAccessIcon}>
                   <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
                 </View>
                 <Text style={styles.quickAccessText}>{item.name}</Text>
               </TouchableOpacity>
             ))}
          </View>
        </View>

        {/* Section 11: Dashboard Statistics */}
        {(completedLessonsCount > 0 || quizAttemptsCount > 0) ? (
          <View style={styles.sectionContainer}>
             <Text style={styles.sectionTitle}>Dashboard Statistics</Text>
             <View style={styles.statsGrid}>
                {completedLessonsCount > 0 && (
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{completedLessonsCount}</Text>
                    <Text style={styles.statLabel}>Completed Lessons</Text>
                  </View>
                )}
                {quizAttemptsCount > 0 && (
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{quizAttemptsCount}</Text>
                    <Text style={styles.statLabel}>Quiz Attempts</Text>
                  </View>
                )}
             </View>
          </View>
        ) : null}

        {/* Section 12: Motivational Footer */}
        <View style={styles.footerContainer}>
           <Ionicons name="leaf" size={24} color={COLORS.primary} style={{ opacity: 0.2, marginBottom: 8 }} />
           <Text style={styles.footerQuote}>&quot;{randomQuote.text}&quot;</Text>
        </View>

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
    paddingBottom: 40,
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
    marginBottom: SPACING.lg,
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
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  badgeDotText: {
    color: COLORS.surface,
    fontSize: 8,
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
    fontSize: 24,
    color: COLORS.surface,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  madrasaArabic: {
    fontSize: 20,
    color: COLORS.secondary,
    marginTop: 6,
    fontWeight: '600',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  goldLine: {
    height: 1,
    width: 30,
    backgroundColor: COLORS.secondary,
  },
  tagline: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  welcomeCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: -24,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  welcomeInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  welcomeBackText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textMain,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.goldText,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  avatarText: {
    fontSize: 24,
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
    marginBottom: 12,
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
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  translationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
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
    lineHeight: 28,
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginTop: 2,
  },
  glassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
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
    fontSize: 20,
    color: COLORS.surface,
    fontWeight: '900',
    marginTop: 2,
  },
  prayerTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    marginTop: 2,
  },
  prayerDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.lg,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    ...SHADOWS.card,
  },
  calendarTextCol: {
    flex: 1,
  },
  hijriTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  gregorianSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  resumeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTextCol: {
    flex: 1,
  },
  resumeCourseName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  resumeLessonName: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  goalTextCol: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  goalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickAccessItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...SHADOWS.card,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  footerContainer: {
    marginTop: 40,
    marginBottom: 20,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  footerQuote: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
