import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS, MEDIA, getCourseImage, getTeacherAvatar } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import { db } from '@/lib/firebase';
import { EmptyState, ScalePressable, SkeletonCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { normalizeGoogleDriveFileUrl } from '@/lib/links';

const DEFAULT_ANNOUNCEMENT_TITLE = 'Enrollment Open for 2025';
const DEFAULT_ANNOUNCEMENT_DESC = 'Admissions are now open for all courses. Register today and begin your journey of Islamic knowledge.';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { courses, teachers, loading, getResumeLearning, getCourseProgress } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const featuredCourses = safeCourses.slice(0, 5);
  const [announcementTitle, setAnnouncementTitle] = useState(DEFAULT_ANNOUNCEMENT_TITLE);
  const [announcementMessage, setAnnouncementMessage] = useState(DEFAULT_ANNOUNCEMENT_DESC);
  const [noticeModalVisible, setNoticeModalVisible] = useState(false);
  const [noticeDraftTitle, setNoticeDraftTitle] = useState('');
  const [noticeDraftMessage, setNoticeDraftMessage] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);
  const [useCustomNotice, setUseCustomNotice] = useState(false);

  useEffect(() => {
    const loadNotice = async () => {
      try {
        const snap = await getDoc(doc(db, 'app_settings', 'platform'));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const title = String(data?.notice_title || '').trim();
        const message = String(data?.notice_message || '').trim();
        if (title || message) {
          setAnnouncementTitle(title || DEFAULT_ANNOUNCEMENT_TITLE);
          setAnnouncementMessage(message || DEFAULT_ANNOUNCEMENT_DESC);
          setUseCustomNotice(true);
        }
      } catch (e) {
        console.log('[Home] loadNotice ERROR:', e);
        // ignore and fallback to announcement stream
      }
    };
    loadNotice().catch((e) => console.log('[Home] loadNotice outer ERROR:', e));
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', 'all'),
        orderBy('created_at', 'desc'),
        limit(20),
      );
      unsub = onSnapshot(q, (snapshot) => {
        try {
          const latestAnnouncement = snapshot.docs
            .map((docItem) => docItem.data() as { title?: string; message?: string; category?: string })
            .find((item) => (
              item?.category === 'announcement' || item?.title?.toLowerCase().includes('announcement')
            ));

          if (!useCustomNotice) {
            setAnnouncementTitle(latestAnnouncement?.title?.trim() || DEFAULT_ANNOUNCEMENT_TITLE);
            setAnnouncementMessage(latestAnnouncement?.message?.trim() || DEFAULT_ANNOUNCEMENT_DESC);
          }
        } catch (e) {
          console.log('[Home] onSnapshot inner ERROR:', e);
        }
      }, (err) => {
        console.log('[Home] onSnapshot ERROR:', err);
      });
    } catch (e) {
      console.log('[Home] announcement useEffect ERROR:', e);
    }
    return () => { if (unsub) unsub(); };
  }, [useCustomNotice]);

  const isDefaultAnnouncement = useMemo(
    () => announcementTitle === DEFAULT_ANNOUNCEMENT_TITLE && announcementMessage === DEFAULT_ANNOUNCEMENT_DESC,
    [announcementMessage, announcementTitle]
  );
  const resumeLearning = useMemo(() => getResumeLearning(), [getResumeLearning]);
  const openNoticeEditor = () => {
    setNoticeDraftTitle(announcementTitle);
    setNoticeDraftMessage(announcementMessage);
    setNoticeModalVisible(true);
  };

  const saveNotice = async () => {
    if (!isAdmin) return;
    if (!noticeDraftTitle.trim() || !noticeDraftMessage.trim()) {
      Alert.alert('Missing fields', 'Notice title and message are required.');
      return;
    }
    setSavingNotice(true);
    try {
      await setDoc(doc(db, 'app_settings', 'platform'), {
        notice_title: noticeDraftTitle.trim(),
        notice_message: noticeDraftMessage.trim(),
        updated_at: serverTimestamp(),
      }, { merge: true });
      setAnnouncementTitle(noticeDraftTitle.trim());
      setAnnouncementMessage(noticeDraftMessage.trim());
      setUseCustomNotice(true);
      setNoticeModalVisible(false);
    } catch (e) {
      console.log('[Home] saveNotice ERROR:', e);
      Alert.alert('Save failed', 'Could not update notice.');
    } finally {
      setSavingNotice(false);
    }
  };
  const safePush = (path: string) => {
    try {
      if (!path || typeof path !== 'string') return;
      router.push(path as any);
    } catch {
      // no-op: navigation safety guard
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header Section */}
        <View style={styles.headerWrapper}>
          <Image source={{ uri: MEDIA.homeHeaderBg }} style={styles.headerBgImage} />
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.greeting} testID="greeting-text">السلام عليكم</Text>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.madrasaName} testID="madrasa-name">
              Madars tus salikat Lilbanat{'\n'}مدرسۃ السالکات للبنات
            </Text>
            <View style={styles.taglineRow}>
              <View style={styles.goldLine} />
              <Text style={styles.tagline}>Nurturing Knowledge & Faith</Text>
              <View style={styles.goldLine} />
            </View>
          </View>
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
              onPress={() => {
                if (!resumeLearning?.courseId) return;
                safePush(`/course/${resumeLearning.courseId}`);
              }}
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
            <TouchableOpacity testID="view-all-courses-btn" onPress={() => safePush('/courses')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {featuredCourses.length === 0 ? (
            <EmptyState icon="book-outline" message="No featured courses available." />
          ) : (
            <View style={styles.verticalList}>
              {featuredCourses.map((item, index) => {
                const progress = getCourseProgress(item.id);
                return (
                  <ScalePressable
                    key={item.id}
                    style={styles.courseCard}
                    testID={`featured-course-card-${item.id}`}
                    onPress={() => {
                      if (!item?.id) return;
                      safePush(`/course/${item.id}`);
                    }}
                  >
                    <Image source={{ uri: getCourseImage(index) }} style={styles.courseCardImage} />
                    <View style={styles.courseCardContent}>
                      <Text style={styles.courseCardName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.courseCardTeacher} numberOfLines={1}>{item.teacher_name}</Text>
                      <View style={styles.courseProgressRow}>
                        <Text style={styles.courseProgressLabel}>Progress {progress.completionPercent}%</Text>
                      </View>
                      <View style={styles.courseProgressTrack}>
                        <View style={[styles.courseProgressFill, { width: `${Math.min(100, Math.max(0, progress.completionPercent))}%` }]} />
                      </View>
                    </View>
                  </ScalePressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Teachers Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Teachers</Text>
            <TouchableOpacity testID="view-all-teachers-btn" onPress={() => safePush('/teachers')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {safeTeachers.length === 0 ? (
            <EmptyState icon="people-outline" message="No teachers available." />
          ) : (
            <FlatList
              horizontal
              data={safeTeachers}
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
                  onPress={() => {
                    if (!item?.id) return;
                    safePush(`/teacher/${item.id}`);
                  }}
                >
                  <Image source={{ uri: item.photo_url ? normalizeGoogleDriveFileUrl(item.photo_url) : getTeacherAvatar(item.id) }} style={styles.teacherAvatar} />
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
          <View style={[styles.sectionHeader, { marginBottom: SPACING.md }]}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {isAdmin ? (
              <TouchableOpacity onPress={openNoticeEditor}>
                <Text style={styles.viewAllText}>Edit Notice</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.announcementCard} testID="announcement-card">
            <View style={styles.announcementContent}>
              <View style={styles.announcementBadge}>
                <Ionicons name="megaphone" size={14} color={COLORS.goldText} />
                <Text style={styles.announcementBadgeText}>{isDefaultAnnouncement ? 'New' : 'Live'}</Text>
              </View>
              <Text style={styles.announcementTitle}>{announcementTitle}</Text>
              <Text style={styles.announcementDesc}>{announcementMessage}</Text>
              <TouchableOpacity style={styles.announcementBtn} testID="learn-more-btn" onPress={() => safePush('/notifications')}>
                <Text style={styles.announcementBtnText}>Open Announcements</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.goldText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Modal visible={noticeModalVisible} transparent animationType="fade" onRequestClose={() => setNoticeModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Home Notice</Text>
              <TextInput
                style={styles.modalInput}
                value={noticeDraftTitle}
                onChangeText={setNoticeDraftTitle}
                placeholder="Notice title"
                placeholderTextColor={COLORS.textMuted}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={noticeDraftMessage}
                onChangeText={setNoticeDraftMessage}
                placeholder="Notice message"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setNoticeModalVisible(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnPrimary} onPress={saveNotice} disabled={savingNotice}>
                  {savingNotice ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Quick Stats */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="stat-courses">
              <Text style={styles.statNumber}>{safeCourses.length}</Text>
              <Text style={styles.statLabel}>Courses</Text>
            </View>
            <View style={styles.statCard} testID="stat-teachers">
              <Text style={styles.statNumber}>{safeTeachers.length}</Text>
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
  headerWrapper: { height: 284, position: 'relative' },
  headerBgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 24, backgroundColor: 'rgba(6,78,59,0.82)' },
  greeting: { fontSize: 28, color: COLORS.secondary, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  welcomeText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500', letterSpacing: 1.6, textTransform: 'uppercase' },
  madrasaName: { fontSize: 22, color: '#FFFFFF', fontWeight: '800', textAlign: 'center', lineHeight: 30, marginTop: 4 },
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
  verticalList: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
  courseCard: { borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.card, backgroundColor: COLORS.surface },
  courseCardImage: { width: '100%', height: 118 },
  courseCardContent: { padding: SPACING.md, gap: 4 },
  courseCardName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 2 },
  courseCardTeacher: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  courseProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  courseProgressLabel: { fontSize: 11, color: COLORS.textMain, fontWeight: '700' },
  courseProgressTrack: { height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, marginTop: 4, overflow: 'hidden' },
  courseProgressFill: { height: '100%', borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  teacherPreviewCard: { alignItems: 'center', width: 110, gap: 8 },
  teacherAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.secondary },
  teacherPreviewName: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, textAlign: 'center' },
  teacherTitleBadge: { backgroundColor: COLORS.goldBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  teacherTitleText: { fontSize: 10, fontWeight: '700', color: COLORS.goldText, textTransform: 'uppercase', letterSpacing: 0.5 },
  announcementCard: { borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  lanternIcon: { position: 'absolute', right: -10, top: -10, width: 110, height: 110, opacity: 0.12, zIndex: 1 },
  announcementContent: { padding: SPACING.lg },
  announcementBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.goldBg, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, marginBottom: 12 },
  announcementBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.goldText },
  announcementTitle: { fontSize: 19, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  announcementDesc: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginBottom: 16 },
  announcementBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  announcementBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.goldText },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', ...SHADOWS.card },
  statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: SPACING.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: SPACING.sm, ...SHADOWS.card },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 9, color: COLORS.textMain, backgroundColor: COLORS.surfaceAlt },
  modalTextArea: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  modalBtnGhost: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  modalBtnGhostText: { color: COLORS.textMain, fontWeight: '700' },
  modalBtnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
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
