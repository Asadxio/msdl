import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Islamic Dashboard relocated to More
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
  Linking,
  Animated,
  Easing,
  Platform,
  useColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
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
} from "firebase/firestore";
import { stableQueryKey, subscribeDeduped } from "@/lib/queryPerformance";
import {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
  MEDIA,
  getCourseImage,
  getTeacherAvatar,
} from "@/constants/theme";
import { type Course, useData } from "@/context/DataContext";
import { db } from "@/lib/firebase";
import { EmptyState, ScalePressable, SkeletonCard } from "@/components/ui";
import { ExpandableSection } from "@/components/ExpandableSection";
import { useAuth } from "@/context/AuthContext";
import { normalizeGoogleDriveFileUrl } from "@/lib/links";
import { useTutorial } from "@/context/TutorialContext";
import { isTutorialCompleted, markTutorialCompleted } from "@/lib/tutorialStorage";
// Prayer engine moved to dedicated Prayer Times screen and Islamic Dashboard Widget

const DEFAULT_ANNOUNCEMENT_TITLE = "No announcements yet";
const DEFAULT_ANNOUNCEMENT_DESC =
  "Important updates from teachers and admins will appear here.";

let featuredCoursesExpandedCache = false;

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHr < 24) {
    return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function FeaturedCourseCard({
  course,
  imageUri,
  progressPercent,
  totalLessons,
  onPress,
}: {
  course: Course;
  imageUri: string;
  progressPercent: number;
  totalLessons: number;
  onPress: () => void;
}) {
  const safeProgress = Math.min(100, Math.max(0, progressPercent));

  return (
    <ScalePressable
      style={styles.courseCard}
      testID={`featured-course-card-${course.id}`}
      onPress={onPress}
    >
      <Image source={{ uri: imageUri }} style={styles.courseCardImage} />
      <View style={styles.courseCardContent}>
        <Text style={styles.courseCardName} numberOfLines={1}>
          {course.name}
        </Text>
        
        <View style={styles.courseTeacherRow}>
          <Ionicons name="person-circle-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.courseTeacherName}>{course.teacher_name || 'Unknown Teacher'}</Text>
        </View>

        <View style={styles.courseProgressRow}>
          <Text style={styles.courseProgressLabel}>{safeProgress}% Complete</Text>
          <Text style={styles.courseLessonsLabel}>
            {totalLessons > 0 ? `${totalLessons} Lessons` : 'No lessons available yet'}
          </Text>
        </View>

        <View style={styles.courseProgressTrack}>
          <View
            style={[styles.courseProgressFill, { width: `${safeProgress}%` }]}
          />
        </View>
      </View>
    </ScalePressable>
  );
}
function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    if (refetch) await refetch();
    if (refreshProfile) await refreshProfile();
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { courses, teachers, loading, getResumeLearning, getCourseProgress, refetch } =
    useData();
  const { profile, refreshProfile } = useAuth();
  const { showTutorial, setShowTutorial, setCurrentStep } = useTutorial();
  const tutorialStartedRef = useRef(false);
  const isAdmin = profile?.role === "admin";
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const featuredCourses = safeCourses.slice(0, 5);
  const [announcementTitle, setAnnouncementTitle] = useState(
    DEFAULT_ANNOUNCEMENT_TITLE,
  );
  const [announcementMessage, setAnnouncementMessage] = useState(
    DEFAULT_ANNOUNCEMENT_DESC,
  );
  const [noticeModalVisible, setNoticeModalVisible] = useState(false);
  const [noticeDraftTitle, setNoticeDraftTitle] = useState("");
  const [noticeDraftMessage, setNoticeDraftMessage] = useState("");
  const [savingNotice, setSavingNotice] = useState(false);
  const [useCustomNotice, setUseCustomNotice] = useState(false);
  const colorScheme = useColorScheme();
  const [featuredCoursesExpanded, setFeaturedCoursesExpanded] = useState(
    featuredCoursesExpandedCache,
  );

  const [hadithText, setHadithText] = useState("The best among you are those who learn the Qur'an and teach it.");
  const [hadithRef, setHadithRef] = useState("Sahih al-Bukhari 5027");
  const [hadithDraftText, setHadithDraftText] = useState("");
  const [hadithDraftRef, setHadithDraftRef] = useState("");
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);

  const [activeLiveClass, setActiveLiveClass] = useState<any | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "live_classes"),
      where("status", "==", "live"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveLiveClass(null);
      } else {
        const docSnap = snapshot.docs[0];
        setActiveLiveClass({
          id: docSnap.id,
          ...docSnap.data()
        });
      }
    }, (error) => {
      console.log("[HomeScreen] active live class snapshot error:", error);
      setActiveLiveClass(null);
    });
    return unsub;
  }, []);

  const safePushLiveClass = (id: string) => {
    try {
      if (!id) return;
      router.push({ pathname: "/live-class/[id]", params: { id } } as any);
    } catch (e) {
      console.log("[HomeScreen] navigation to live class failed:", e);
    }
  };

  const updateFeaturedCoursesExpanded = (expanded: boolean) => {
    featuredCoursesExpandedCache = expanded;
    setFeaturedCoursesExpanded(expanded);
  };


  // Tutorial trigger on first dashboard load
  useEffect(() => {
    if (!profile?.uid || tutorialStartedRef.current || showTutorial) return;

    const checkAndStartTutorial = async () => {
      try {
        const completed = await isTutorialCompleted();
        if (!completed) {
          tutorialStartedRef.current = true;
          setShowTutorial(true);
          setCurrentStep('dashboard');
        }
      } catch {
        // ignore tutorial errors
      }
    };

    const timeout = setTimeout(checkAndStartTutorial, 800);
    return () => clearTimeout(timeout);
  }, [profile?.uid, showTutorial]);

  useEffect(() => {
    const loadNotice = async () => {
      try {
        const snap = await getDoc(doc(db, "app_settings", "platform"));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const title = String(data.notice_title || "").trim();
        const message = String(data.notice_message || "").trim();
        if (title || message) {
          setAnnouncementTitle(title || DEFAULT_ANNOUNCEMENT_TITLE);
          setAnnouncementMessage(message || DEFAULT_ANNOUNCEMENT_DESC);
          setUseCustomNotice(true);
        }
        if (data.hadith_text) {
          setHadithText(data.hadith_text);
        }
        if (data.hadith_ref) {
          setHadithRef(data.hadith_ref);
        }
      } catch {
        // ignore and fallback to announcement stream
      }
    };
    loadNotice().catch(() => {});
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", "all"),
      orderBy("created_at", "desc"),
      limit(20),
    );
    const unsub = subscribeDeduped(stableQueryKey(["home_announcements"]), q as any, (snapshot) => {
      const latestAnnouncement = snapshot.docs
        .map(
          (docItem) =>
            docItem.data() as {
              title?: string;
              message?: string;
              category?: string;
            },
        )
        .find(
          (item) =>
            item.category === "announcement" ||
            item.title?.toLowerCase().includes("announcement"),
        );

      if (!useCustomNotice) {
        setAnnouncementTitle(
          latestAnnouncement?.title?.trim() || DEFAULT_ANNOUNCEMENT_TITLE,
        );
        setAnnouncementMessage(
          latestAnnouncement?.message?.trim() || DEFAULT_ANNOUNCEMENT_DESC,
        );
      }
    });
    return unsub;
  }, [useCustomNotice]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("user_id", "in", [profile.uid, "all"]),
      orderBy("created_at", "desc"),
      limit(3)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() });
      });
      setRecentNotifications(items);
    }, (err) => {
      console.log("[HomeScreen] recent notifications error:", err);
    });
    return unsub;
  }, [profile?.uid]);

  const isDefaultAnnouncement = useMemo(
    () =>
      announcementTitle === DEFAULT_ANNOUNCEMENT_TITLE &&
      announcementMessage === DEFAULT_ANNOUNCEMENT_DESC,
    [announcementMessage, announcementTitle],
  );
  const isDarkMode = colorScheme === "dark";
  // Islamic dashboard moved to More → Applications → Islamic Dashboard
  const resumeLearning = useMemo(
    () => getResumeLearning(),
    [getResumeLearning],
  );
  const openNoticeEditor = () => {
    setNoticeDraftTitle(announcementTitle);
    setNoticeDraftMessage(announcementMessage);
    setHadithDraftText(hadithText);
    setHadithDraftRef(hadithRef);
    setNoticeModalVisible(true);
  };

  const saveNotice = async () => {
    if (!isAdmin) return;
    if (!noticeDraftTitle.trim() || !noticeDraftMessage.trim()) {
      Alert.alert("Missing fields", "Notice title and message are required.");
      return;
    }
    setSavingNotice(true);
    try {
      await setDoc(
        doc(db, "app_settings", "platform"),
        {
          notice_title: noticeDraftTitle.trim(),
          notice_message: noticeDraftMessage.trim(),
          hadith_text: hadithDraftText.trim(),
          hadith_ref: hadithDraftRef.trim(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
      setAnnouncementTitle(noticeDraftTitle.trim());
      setAnnouncementMessage(noticeDraftMessage.trim());
      if (hadithDraftText.trim()) setHadithText(hadithDraftText.trim());
      if (hadithDraftRef.trim()) setHadithRef(hadithDraftRef.trim());
      setUseCustomNotice(true);
      setNoticeModalVisible(false);
    } catch {
      Alert.alert("Save failed", "Could not update notice.");
    } finally {
      setSavingNotice(false);
    }
  };
  const safePush = (path: string) => {
    try {
      if (!path || typeof path !== "string") return;
      router.push(path as any);
    } catch {
      // no-op: navigation safety guard
    }
  };


  const userName = profile?.name || 'Student';
  const userRole = (profile?.role || 'student').charAt(0).toUpperCase() + (profile?.role || 'student').slice(1);

  const QUICK_ACTIONS = [
    { label: 'Live Classes', icon: 'videocam' as const, route: '/live-class', color: '#EF4444' },
    { label: 'Library', icon: 'library' as const, route: '/(tabs)/library', color: '#3B82F6' },
    { label: 'Quiz', icon: 'help-circle' as const, route: '/(tabs)/quiz', color: '#8B5CF6' },
    { label: 'Attendance', icon: 'calendar' as const, route: '/(tabs)/attendance', color: '#F59E0B' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header Section */}
        <View style={styles.headerWrapper}>
          <Image
            source={{ uri: MEDIA.homeHeaderBg }}
            style={styles.headerBgImage}
          />
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.greeting} testID="greeting-text">
              السلام عليكم
            </Text>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.madrasaName} testID="madrasa-name">
              Madars tus salikat Lilbanat{"\n"}مدرسۃ السالکات للبنات
            </Text>
            <View style={styles.taglineRow}>
              <View style={styles.goldLine} />
              <Text style={styles.tagline}>Nurturing Knowledge & Faith</Text>
              <View style={styles.goldLine} />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.moreBtn, { top: insets.top + 12 }]}
            onPress={() => safePush("/more")}
            testID="goto-more-btn"
          >
            <Ionicons name="grid-outline" size={16} color={COLORS.primary} />
            <Text style={styles.moreBtnText}>More</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 1: Welcome Banner */}
        <View style={styles.welcomeBanner} testID="welcome-banner">
          <View style={styles.welcomeAvatarCircle}>
            <Text style={styles.welcomeAvatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeName}>Assalamu Alaikum, {userName}</Text>
            <View style={styles.roleBadge}>
              <Ionicons
                name={userRole === 'Admin' ? 'shield-checkmark' : userRole === 'Teacher' ? 'school' : 'person'}
                size={12}
                color={COLORS.goldText}
              />
              <Text style={styles.roleBadgeText}>{userRole}</Text>
            </View>
          </View>
        </View>

        {/* SECTION 2: Quick Actions */}
        <View style={styles.quickActionsRow} testID="quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <ScalePressable
              key={action.label}
              style={styles.quickActionCard}
              onPress={() => safePush(action.route)}
              testID={`qa-${action.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={1}>{action.label}</Text>
            </ScalePressable>
          ))}
        </View>

        {/* SECTION 3: Live Class */}
        {activeLiveClass ? (
          <ScalePressable
            style={[styles.liveClassCard, styles.liveClassCardActive]}
            onPress={() => safePushLiveClass(activeLiveClass.id)}
            testID="live-class-card"
          >
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>🔴 LIVE NOW</Text>
            </View>
            <Text style={styles.liveTitle} numberOfLines={1}>
              {activeLiveClass.title}
            </Text>
            <Text style={styles.liveTeacher} numberOfLines={1}>
              Teacher: {activeLiveClass.teacher_name}
            </Text>
            <TouchableOpacity
              style={styles.liveJoinBtn}
              onPress={() => safePushLiveClass(activeLiveClass.id)}
            >
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={styles.liveJoinBtnText}>Join Live Class</Text>
            </TouchableOpacity>
          </ScalePressable>
        ) : (
          <View style={styles.noLiveCard} testID="no-live-class-card">
            <Ionicons name="videocam-off-outline" size={24} color={COLORS.textMuted} />
            <Text style={styles.noLiveText}>No live classes currently running.</Text>
            <TouchableOpacity
              style={styles.scheduleBtn}
              onPress={() => safePush('/live-class')}
            >
              <Text style={styles.scheduleBtnText}>View Schedule</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SECTION 4: Today's Hadith */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]} testID="hadith-section">
          <View style={styles.hadithCard}>
            <View style={styles.hadithIconRow}>
              <View style={styles.hadithIconCircle}>
                <Ionicons name="book" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.hadithLabel}>📖 Today&apos;s Hadith</Text>
              {isAdmin ? (
                <TouchableOpacity onPress={openNoticeEditor} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="create-outline" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.hadithText}>&quot;{hadithText}&quot;</Text>
            <Text style={styles.hadithReference}>— {hadithRef}</Text>
          </View>
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingBlock} testID="home-loading">
            <SkeletonCard lines={2} />
          </View>
        ) : null}

        {/* Resume Learning */}
        {resumeLearning ? (
          <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
            <Text style={[styles.sectionTitle, { marginBottom: SPACING.md }]}>
              Resume Learning
            </Text>
            <ScalePressable
              style={styles.resumeCard}
              onPress={() => {
                if (!resumeLearning?.courseId) return;
                safePush(`/course/${resumeLearning.courseId}`);
              }}
              testID="resume-learning-card"
            >
              <Ionicons
                name="play-circle-outline"
                size={26}
                color={COLORS.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeCourse}>
                  {resumeLearning.courseName}
                </Text>
                <Text style={styles.resumeLesson}>
                  {resumeLearning.moduleTitle} • {resumeLearning.lessonTitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textMuted}
              />
            </ScalePressable>
          </View>
        ) : null}

        {/* My Courses */}
        <ExpandableSection
          title="My Courses"
          count={featuredCourses.length}
          initiallyExpanded={featuredCoursesExpanded}
          onExpandedChange={updateFeaturedCoursesExpanded}
          testID="featured-courses-accordion"
        >
          {featuredCourses.length === 0 ? (
            <EmptyState icon="book-outline" message="No courses available yet" />
          ) : (
            <View style={styles.verticalList}>
              {featuredCourses.map((item, index) => {
                const progress = getCourseProgress(item.id);
                return (
                  <FeaturedCourseCard
                    key={item.id}
                    course={item}
                    imageUri={getCourseImage(index)}
                    progressPercent={progress.completionPercent}
                    totalLessons={progress.totalLessons || 0}
                    onPress={() => {
                      if (!item?.id) return;
                      safePush(`/course/${item.id}`);
                    }}
                  />
                );
              })}
            </View>
          )}
        </ExpandableSection>

        {/* Teachers Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Teachers</Text>
            <TouchableOpacity
              testID="view-all-teachers-btn"
              onPress={() => safePush("/teachers")}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {safeTeachers.length === 0 ? (
            <EmptyState
              icon="people-outline"
              message="No teachers available."
            />
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
                  <Image
                    source={{
                      uri: item.photo_url
                        ? normalizeGoogleDriveFileUrl(item.photo_url)
                        : getTeacherAvatar(item.id),
                    }}
                    style={styles.teacherAvatar}
                  />
                  <Text style={styles.teacherPreviewName} numberOfLines={1}>
                    {item.name.split(" ").slice(-2).join(" ")}
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
                <Text style={styles.announcementBadgeText}>
                  {isDefaultAnnouncement ? "New" : "Live"}
                </Text>
              </View>
              <Text style={styles.announcementTitle}>{announcementTitle}</Text>
              <Text style={styles.announcementDesc}>{announcementMessage}</Text>
              <TouchableOpacity
                style={styles.announcementBtn}
                testID="learn-more-btn"
                onPress={() => safePush("/notifications")}
              >
                <Text style={styles.announcementBtnText}>
                  Open Announcements
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={COLORS.goldText}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SECTION 5: Recent Notifications */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]} testID="recent-notifications">
          <View style={[styles.sectionHeader, { paddingHorizontal: 0, marginBottom: SPACING.md }]}>
            <Text style={styles.sectionTitle}>Recent Notifications</Text>
            <TouchableOpacity onPress={() => safePush('/notifications')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentNotifications.length === 0 ? (
            <EmptyState icon="notifications-outline" message="No notifications yet" />
          ) : (
            <View style={{ gap: SPACING.sm }}>
              {recentNotifications.map((notif: any) => {
                const notifDate = notif.created_at?.toDate ? notif.created_at.toDate() : new Date();
                return (
                  <ScalePressable
                    key={notif.id}
                    style={styles.notifCard}
                    onPress={() => safePush('/notifications')}
                  >
                    <View style={styles.notifIconCircle}>
                      <Ionicons
                        name={notif.category === 'announcement' ? 'megaphone' : 'notifications'}
                        size={16}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTitle} numberOfLines={1}>{notif.title || 'Notification'}</Text>
                      <Text style={styles.notifBody} numberOfLines={2}>{notif.message || ''}</Text>
                      <Text style={styles.notifTime}>{formatRelativeTime(notifDate)}</Text>
                    </View>
                  </ScalePressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Admin Notice & Hadith Editor Modal */}
        <Modal
          visible={noticeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNoticeModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SPACING.md }}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Edit Home Notice & Hadith</Text>
                <Text style={styles.modalSectionLabel}>Announcement</Text>
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
                <Text style={[styles.modalSectionLabel, { marginTop: SPACING.sm }]}>Today&apos;s Hadith</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  value={hadithDraftText}
                  onChangeText={setHadithDraftText}
                  placeholder="Hadith text"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />
                <TextInput
                  style={styles.modalInput}
                  value={hadithDraftRef}
                  onChangeText={setHadithDraftRef}
                  placeholder="Hadith reference (e.g. Sahih al-Bukhari 5027)"
                  placeholderTextColor={COLORS.textMuted}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalBtnGhost}
                    onPress={() => setNoticeModalVisible(false)}
                  >
                    <Text style={styles.modalBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalBtnPrimary}
                    onPress={saveNotice}
                    disabled={savingNotice}
                  >
                    {savingNotice ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalBtnPrimaryText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerWrapper: { height: 284, position: "relative" },
  headerBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 32,
    backgroundColor: "rgba(6,78,59,0.88)",
  },
  moreBtn: {
    position: "absolute",
    left: SPACING.lg,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  moreBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.goldText },
  greeting: {
    fontSize: 28,
    color: COLORS.secondary,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  madrasaName: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 34,
    marginTop: 6,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 10,
  },
  goldLine: { width: 30, height: 1.5, backgroundColor: COLORS.secondary },
  tagline: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: SPACING.md,
  },
  loadingBlock: { paddingHorizontal: SPACING.lg },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: "500" },
  section: { marginTop: SPACING.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textMain },
  viewAllText: { fontSize: 14, fontWeight: "600", color: COLORS.secondary },
  horizontalList: {
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.sm,
    gap: SPACING.md,
  },
  verticalList: { paddingHorizontal: SPACING.md, gap: SPACING.md },
  courseCard: {
    borderRadius: RADIUS.xxl,
    overflow: "hidden",
    ...SHADOWS.card,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  courseCardImage: { width: "100%", height: 128 },
  courseCardContent: { padding: SPACING.lg, gap: 8 },
  courseCardName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 4,
  },
  courseTeacherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  courseTeacherName: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  courseLessonsLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  courseCardDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    fontWeight: "500",
  },
  courseProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  courseProgressLabel: {
    fontSize: 11,
    color: COLORS.textMain,
    fontWeight: "700",
  },
  courseProgressTrack: {
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 4,
    overflow: "hidden",
  },
  courseProgressFill: {
    height: "100%",
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  continueBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  continueBtnText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  teacherPreviewCard: { alignItems: "center", width: 110, gap: 8 },
  teacherAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.secondary,
  },
  teacherPreviewName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMain,
    textAlign: "center",
  },
  teacherTitleBadge: {
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  teacherTitleText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.goldText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  announcementCard: {
    borderRadius: RADIUS.xxl,
    overflow: "hidden",
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    backgroundColor: COLORS.surface,
  },
  lanternIcon: {
    position: "absolute",
    right: -10,
    top: -10,
    width: 110,
    height: 110,
    opacity: 0.12,
    zIndex: 1,
  },
  announcementContent: { padding: SPACING.xl },
  announcementBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.goldBg,
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginBottom: 12,
  },
  announcementBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.goldText,
  },
  announcementTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 10,
  },
  announcementDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  announcementBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  announcementBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.goldText,
  },
  // Welcome Banner
  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: -28,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    ...SHADOWS.card,
    zIndex: 10,
  },
  welcomeAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(212,175,55,0.1)",
    borderWidth: 2,
    borderColor: COLORS.goldBg,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeAvatarText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.primary,
  },
  welcomeName: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textMain,
    marginBottom: 6,
  },
  roleBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.goldText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  quickActionCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
    ...SHADOWS.card,
    gap: 10,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMain,
    textAlign: "center",
  },
  // Hadith Card
  hadithCard: {
    backgroundColor: "rgba(212,175,55,0.08)",
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
  },
  hadithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  hadithIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(212,175,55,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  hadithLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.goldText,
  },
  hadithText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textMain,
    lineHeight: 26,
    fontStyle: "italic",
    marginBottom: 12,
  },
  hadithReference: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  // Recent Notifications
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    ...SHADOWS.card,
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(6,78,59,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  // Modal section label
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dashboardOuter: {
    marginHorizontal: SPACING.lg,
    marginTop: -22,
    borderRadius: 28,
    overflow: "hidden",
    minHeight: 292,
    backgroundColor: COLORS.primary,
    ...SHADOWS.card,
  },
  dashboardBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  dashboardTint: { ...StyleSheet.absoluteFillObject },
  dashboardContent: { padding: SPACING.md, gap: SPACING.md },
  dashboardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  dashboardEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  dashboardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 24,
  },
  dashboardSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  urduDate: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    textAlign: "left",
  },
  themeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  themeButtonText: { fontSize: 11, fontWeight: "800" },
  prayerHeroRow: {
    flexDirection: "row",
    gap: SPACING.md,
    alignItems: "stretch",
  },
  countdownMeter: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  meterProgressHint: {
    position: "absolute",
    top: -8,
    width: 10,
    height: 46,
    borderRadius: RADIUS.full,
    opacity: 0.86,
  },
  currentPrayerLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  currentPrayerName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 1,
  },
  nextPrayerText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  countdownText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  glassPanel: {
    flex: 1,
    borderRadius: 24,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    justifyContent: "center",
  },
  glassPanelDark: { backgroundColor: "rgba(15,23,42,0.30)" },
  panelLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  locationTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5,
  },
  locationSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  locationMetaGrid: { marginTop: SPACING.sm, gap: 3 },
  locationMeta: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "700",
  },
  locationButton: {
    marginTop: SPACING.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(6,78,59,0.86)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  compactPrayerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  compactMetricCard: {
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  compactMetricLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  compactMetricValue: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  compactLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: 20,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  compactLocationText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  qiblaShortcutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: 22,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  qiblaShortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  qiblaShortcutTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  qiblaShortcutText: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "700", marginTop: 2 },

  qiblaModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.68)",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  qiblaEntryModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 30,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  qiblaEntryModalDark: { backgroundColor: "#0f172a" },
  qiblaModalEyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  qiblaModalTitle: { color: COLORS.text, fontSize: 23, fontWeight: "900" },
  qiblaEntryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: 22,
    padding: SPACING.md,
    backgroundColor: COLORS.goldBg,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.32)",
  },
  qiblaEntryIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  qiblaEntryTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  qiblaEntryText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  qiblaModalClose: { alignSelf: "center", padding: SPACING.sm },
  qiblaModalCloseText: { color: COLORS.primary, fontWeight: "900" },
  prayerTimesRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  prayerPill: {
    flexGrow: 1,
    minWidth: "30%",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  prayerPillActive: {
    backgroundColor: "rgba(212,175,55,0.32)",
    borderColor: "rgba(255,255,255,0.60)",
  },
  prayerPillName: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  prayerPillNameActive: { color: "#fff" },
  prayerPillTime: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
  },
  modalTextArea: { minHeight: 90, textAlignVertical: "top" },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  modalBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnGhostText: { color: COLORS.textMain, fontWeight: "700" },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnPrimaryText: { color: "#fff", fontWeight: "700" },
  resumeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  resumeCourse: { fontSize: 15, fontWeight: "700", color: COLORS.textMain },
  resumeLesson: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  liveClassCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(6, 78, 59, 0.08)',
    ...SHADOWS.card,
  },
  liveClassCardActive: {
    borderColor: 'rgba(185, 28, 28, 0.3)',
    backgroundColor: '#FFF5F5',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  liveTeacher: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  liveJoinBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    alignItems: 'center',
  },
  liveJoinBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  noLiveCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 6,
  },
  noLiveText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  scheduleBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 8,
    paddingHorizontal: SPACING.lg,
  },
  scheduleBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});
