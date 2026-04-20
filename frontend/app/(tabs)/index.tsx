import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS, MEDIA, getCourseImage, getTeacherAvatar } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import { db } from '@/lib/firebase';
import { EmptyState, ScalePressable, SkeletonCard } from '@/components/ui';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.72;
const DEFAULT_ANNOUNCEMENT_TITLE = 'Enrollment Open for 2025';
const DEFAULT_ANNOUNCEMENT_DESC = 'Admissions are now open for all courses. Register today and begin your journey of Islamic knowledge.';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { courses, teachers, loading, getResumeLearning } = useData();
  const featuredCourses = courses.slice(0, 5);
  const [announcementTitle, setAnnouncementTitle] = useState(DEFAULT_ANNOUNCEMENT_TITLE);
  const [announcementMessage, setAnnouncementMessage] = useState(DEFAULT_ANNOUNCEMENT_DESC);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', 'all'),
      orderBy('created_at', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const latestAnnouncement = snapshot.docs
        .map((docItem) => docItem.data() as { title?: string; message?: string; category?: string })
        .find((item) => (
          item.category === 'announcement' || item.title?.toLowerCase().includes('announcement')
        ));

      setAnnouncementTitle(latestAnnouncement?.title?.trim() || DEFAULT_ANNOUNCEMENT_TITLE);
      setAnnouncementMessage(latestAnnouncement?.message?.trim() || DEFAULT_ANNOUNCEMENT_DESC);
    });
    return unsub;
  }, []);

  const isDefaultAnnouncement = useMemo(
    () => announcementTitle === DEFAULT_ANNOUNCEMENT_TITLE && announcementMessage === DEFAULT_ANNOUNCEMENT_DESC,
    [announcementMessage, announcementTitle]
  );
  const resumeLearning = useMemo(() => getResumeLearning(), [getResumeLearning]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header Section */}
        <View style={styles.headerWrapper}>
          <Image source={{ uri: MEDIA.homeHeaderBg }} style={styles.headerBgImage} />
          <LinearGradient
            colors={['rgba(15,56,34,0.85)', 'rgba(15,56,34,0.95)']}
            style={[styles.headerOverlay, { paddingTop: insets.top + 20 }]}
          >
            <Text style={styles.greeting} testID="greeting-text">السلام عليكم</Text>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.madrasaName} testID="madrasa-name">
              Madrasa Tus Salikat{'\n'}Lil Banat
            </Text>
            <View style={styles.taglineRow}>
              <View style={styles.goldLine} />
              <Text style={styles.tagline}>Nurturing Knowledge & Faith</Text>
              <View style={styles.goldLine} />
            </View>
          </LinearGradient>
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingBlock} testID="home-loading">
            <SkeletonCard lines={2} />
          </View>
        ) : null}

        {/* Featured Courses */}
        {resumeLearning ? (
          <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
            <Text style={[styles.sectionTitle, { marginBottom: SPACING.md }]}>Resume Learning</Text>
            <ScalePressable
              style={styles.resumeCard}
              onPress={() => router.push(`/course/${resumeLearning.courseId}`)}
              testID="resume-learning-card"
            >
              <Ionicons name="play-circle-outline" size={26} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeCourse}>{resumeLearning.courseName}</Text>
                <Text style={styles.resumeLesson}>
                  {resumeLearning.moduleTitle} • {resumeLearning.lessonTitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </ScalePressable>
          </View>
        ) : null}

        {/* Featured Courses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Courses</Text>
            <TouchableOpacity testID="view-all-courses-btn" onPress={() => router.push('/courses')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {featuredCourses.length === 0 ? (
            <EmptyState icon="book-outline" message="No featured courses available." />
          ) : (
            <FlatList
              horizontal
              data={featuredCourses}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              testID="featured-courses-scroll"
              initialNumToRender={4}
              maxToRenderPerBatch={6}
              windowSize={5}
              renderItem={({ item, index }) => (
                <ScalePressable
                  style={styles.courseCard}
                  testID={`featured-course-card-${item.id}`}
                  onPress={() => router.push(`/course/${item.id}`)}
                >
                  <Image source={{ uri: getCourseImage(index) }} style={styles.courseCardImage} />
                  <LinearGradient
                    colors={['transparent', 'rgba(15,56,34,0.9)']}
                    style={styles.courseCardGradient}
                  >
                    <View style={styles.courseCardContent}>
                      <Text style={styles.courseCardName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.courseCardTeacher} numberOfLines={1}>{item.teacher_name}</Text>
                    </View>
                  </LinearGradient>
                </ScalePressable>
              )}
            />
          )}
        </View>

        {/* Teachers Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Teachers</Text>
            <TouchableOpacity testID="view-all-teachers-btn" onPress={() => router.push('/teachers')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {teachers.length === 0 ? (
            <EmptyState icon="people-outline" message="No teachers available." />
          ) : (
            <FlatList
              horizontal
              data={teachers}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              testID="teachers-preview-scroll"
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={5}
              renderItem={({ item }) => (
                <ScalePressable
                  style={styles.teacherPreviewCard}
                  testID={`teacher-preview-${item.id}`}
                  onPress={() => router.push(`/teacher/${item.id}`)}
                >
                  <Image source={{ uri: getTeacherAvatar(item.id) }} style={styles.teacherAvatar} />
                  <Text style={styles.teacherPreviewName} numberOfLines={1}>
                    {item.name.split(' ').slice(-2).join(' ')}
                  </Text>
                  <View style={styles.teacherTitleBadge}>
                    <Text style={styles.teacherTitleText}>{item.title}</Text>
                  </View>
                </ScalePressable>
              )}
            />
          )}
        </View>

        {/* Announcements */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
          <Text style={[styles.sectionTitle, { marginBottom: SPACING.md }]}>Announcements</Text>
          <View style={styles.announcementCard} testID="announcement-card">
            <Image source={{ uri: MEDIA.lanternIcon }} style={styles.lanternIcon} />
            <LinearGradient colors={[COLORS.primary, '#0A2B1A']} style={styles.announcementGradient}>
              <View style={styles.announcementContent}>
                <View style={styles.announcementBadge}>
                  <Ionicons name="megaphone" size={14} color={COLORS.secondary} />
                  <Text style={styles.announcementBadgeText}>{isDefaultAnnouncement ? 'New' : 'Live'}</Text>
                </View>
                <Text style={styles.announcementTitle}>{announcementTitle}</Text>
                <Text style={styles.announcementDesc}>{announcementMessage}</Text>
                <TouchableOpacity style={styles.announcementBtn} testID="learn-more-btn" onPress={() => router.push('/notifications')}>
                  <Text style={styles.announcementBtnText}>Open Announcements</Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.secondary} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="stat-courses">
              <Text style={styles.statNumber}>{courses.length}</Text>
              <Text style={styles.statLabel}>Courses</Text>
            </View>
            <View style={styles.statCard} testID="stat-teachers">
              <Text style={styles.statNumber}>{teachers.length}</Text>
              <Text style={styles.statLabel}>Teachers</Text>
            </View>
            <View style={styles.statCard} testID="stat-students">
              <Text style={styles.statNumber}>100+</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerWrapper: { height: 320, position: 'relative' },
  headerBgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 30 },
  greeting: { fontSize: 32, color: COLORS.secondary, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  welcomeText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '400', letterSpacing: 2, textTransform: 'uppercase' },
  madrasaName: { fontSize: 26, color: '#FFFFFF', fontWeight: '800', textAlign: 'center', lineHeight: 34, marginTop: 4 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  goldLine: { width: 30, height: 1.5, backgroundColor: COLORS.secondary },
  tagline: { color: COLORS.secondary, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: SPACING.md },
  loadingBlock: { paddingHorizontal: SPACING.lg },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  section: { marginTop: SPACING.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textMain },
  viewAllText: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
  horizontalList: { paddingLeft: SPACING.lg, paddingRight: SPACING.sm, gap: SPACING.md },
  courseCard: { width: CARD_WIDTH, height: 200, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.card },
  courseCardImage: { width: '100%', height: '100%' },
  courseCardGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  courseCardContent: { padding: SPACING.md },
  courseCardName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  courseCardTeacher: { fontSize: 13, color: COLORS.secondaryLight, fontWeight: '500' },
  teacherPreviewCard: { alignItems: 'center', width: 110, gap: 8 },
  teacherAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.secondary },
  teacherPreviewName: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, textAlign: 'center' },
  teacherTitleBadge: { backgroundColor: COLORS.goldBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  teacherTitleText: { fontSize: 10, fontWeight: '700', color: COLORS.goldText, textTransform: 'uppercase', letterSpacing: 0.5 },
  announcementCard: { borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.card },
  lanternIcon: { position: 'absolute', right: -10, top: -10, width: 120, height: 120, opacity: 0.3, zIndex: 1 },
  announcementGradient: { borderRadius: RADIUS.xl, overflow: 'hidden' },
  announcementContent: { padding: SPACING.lg },
  announcementBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, marginBottom: 12 },
  announcementBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  announcementTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  announcementDesc: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 22, marginBottom: 16 },
  announcementBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  announcementBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', ...SHADOWS.card },
  statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginTop: 2 },
  resumeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  resumeCourse: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  resumeLesson: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
