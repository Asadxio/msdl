/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StatusBar,
  Linking,
  ActivityIndicator,
  AppState,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Audio } from "expo-av";
import { WebView } from "react-native-webview";
import {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
  getCourseImage,
  getTeacherAvatar,
} from "@/constants/theme";
import { useData } from "@/context/DataContext";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScalePressable, ScreenRefreshControl, EmptyState } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

import { normalizeMeetUrl, prepareExternalUrl } from "@/lib/links";
import { startLiveClass, subscribeActiveLiveClass, type LiveClass } from "@/lib/liveClasses";
import { loadAssignmentDraft, saveAssignmentDraft } from "@/lib/lmsHardening";
import {
  AUDIO_LESSON_MAX_BYTES,
  deleteAudioLesson,
  fetchAudioLessonsPage,
  updateAudioLesson,
  uploadAudioLesson,
  validateAudioLessonFile,
  type AudioLesson,
} from "@/lib/audioLessons";



function sanitizeFileName(fileName?: string | null): string {
  const base = String(fileName || "submission")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 90);
  return base.length >= 3 ? base : `submission_${Date.now()}`;
}


function formatAudioDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAudioUploadDate(value?: { toDate?: () => Date } | null): string {
  try {
    const date = value?.toDate ? value.toDate() : null;
    if (!date) return "Recently uploaded";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Recently uploaded";
  }
}



function getAssignmentUploadError(error: any): string {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("permission") || message.includes("unauthorized")) {
    return "Upload permission denied. Please sign in again and retry.";
  }
  if (message.includes("network")) {
    return "Network issue during upload. Please check your internet and retry.";
  }
  if (message.includes("unsupported")) return String(error?.message);
  if (message.includes("too large")) return String(error?.message);
  return "Unable to upload assignment file right now. Please retry.";
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const courseId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    courses,
    teachers,
    loading,
    getModulesForCourse,
    getLessonsForModule,
    lessonProgress,
    markLessonComplete,
    markLessonOpened,
    getAssignmentsForLesson,
    getSubmissionForAssignment,
    getSubmissionsForAssignment,
    submitAssignment,
    reviewSubmission,
    isEnrolledInCourse,
  } = useData();
  const { user, profile } = useAuth();
  const [recordings, setRecordings] = useState<
    {
      id: string;
      title: string;
      description: string;
      file_url: string;
      lesson_id?: string;
    }[]
  >([]);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playerUrl, setPlayerUrl] = useState("");
  const [playerSourceUrl, setPlayerSourceUrl] = useState("");
  const [playerError, setPlayerError] = useState(false);

  const [activeAssignmentId, setActiveAssignmentId] = useState<string>("");
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [externalFileUrl, setExternalFileUrl] = useState("");

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewGrade, setReviewGrade] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [activeLiveClass, setActiveLiveClass] = useState<LiveClass | null>(null);
  const [startingLiveClass, setStartingLiveClass] = useState(false);
  const [meetUrlModalVisible, setMeetUrlModalVisible] = useState(false);
  const [meetUrlInput, setMeetUrlInput] = useState("");
  const [fatalError] = useState<string>("");
  const [audioLessons, setAudioLessons] = useState<AudioLesson[]>([]);
  const [audioSearch, setAudioSearch] = useState("");
  const [audioCursor, setAudioCursor] = useState<any>(null);
  const [audioHasMore, setAudioHasMore] = useState(false);
  const [loadingAudioLessons, setLoadingAudioLessons] = useState(false);
  const [audioLessonModalVisible, setAudioLessonModalVisible] = useState(false);
  const [editingAudioLesson, setEditingAudioLesson] = useState<AudioLesson | null>(null);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioDescription, setAudioDescription] = useState("");
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState("");
  const [audioUrlInput, setAudioUrlInput] = useState("");
  const [activeAudioLesson, setActiveAudioLesson] = useState<AudioLesson | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioSoundRef = useRef<Audio.Sound | null>(null);

  const course = courses.find((c) => c.id === courseId);
  const classTimeLabel = course?.class_time || course?.time || "";
  const meetLink = normalizeMeetUrl(
    course?.meet_link || course?.class_link || "",
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'live' | 'audio' | 'curriculum'>('overview');
  const isReviewer = profile?.role === "admin" || profile?.role === "teacher";
  const isEnrolled = courseId ? isEnrolledInCourse(courseId) : false;
  const isStudent = profile?.role === "student";
  const isLockedForStudent = isStudent && !isEnrolled;


  useEffect(() => {
    if (!courseId) return;
    const unsub = subscribeActiveLiveClass(courseId, setActiveLiveClass);
    return unsub;
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    try {
      const q = query(
        collection(db, "recordings"),
        where("course_id", "==", courseId),
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const arr: {
            id: string;
            title: string;
            description: string;
            file_url: string;
            lesson_id?: string;
          }[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
          setRecordings(arr);
        },
        () => {
          setRecordings([]);
        },
      );
      return unsub;
    } catch {
      setRecordings([]);
      return () => {};
    }
  }, [courseId]);

  const loadAudioLessons = async (reset = true) => {
    if (!courseId) return;
    setLoadingAudioLessons(true);
    try {
      const page = await fetchAudioLessonsPage(courseId, audioSearch, reset ? null : audioCursor);
      setAudioLessons((prev) => (reset ? page.lessons : [...prev, ...page.lessons]));
      setAudioCursor(page.cursor);
      setAudioHasMore(page.hasMore);
    } catch (e) {
      console.log("[CourseDetail] loadAudioLessons ERROR", e);
      if (reset) setAudioLessons([]);
    } finally {
      setLoadingAudioLessons(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { void loadAudioLessons(true); }, 250);
    return () => clearTimeout(t);
  }, [courseId, audioSearch]);

  useEffect(() => () => {
    audioSoundRef.current?.unloadAsync().catch(() => {});
    audioSoundRef.current = null;
  }, []);

  const showJoinNow = useMemo(() => {
    if (!classTimeLabel) return true;
    const [hh, mm] = classTimeLabel.split(":").map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return true;
    const now = new Date();
    const slot = new Date();
    slot.setHours(hh, mm, 0, 0);
    return Math.abs(now.getTime() - slot.getTime()) <= 60 * 60 * 1000;
  }, [classTimeLabel]);
  const modules = useMemo(
    () => (course ? getModulesForCourse(course.id) : []),
    [course, getModulesForCourse],
  );
  const generalRecordings = useMemo(
    () => recordings.filter((r) => !r.lesson_id),
    [recordings],
  );
  const safeModules = Array.isArray(modules) ? modules : [];
  const safeProgress = lessonProgress || {};

  const toEmbeddableUrl = (url: string): string => {
    const clean = url.trim();
    if (!clean) return clean;
    const youtubeWatchMatch = clean.match(/youtube\.com\/watch\?v=([^&]+)/i);
    if (youtubeWatchMatch?.[1])
      return `https://www.youtube.com/embed/${youtubeWatchMatch[1]}`;
    const youtubeShortMatch = clean.match(/youtu\.be\/([^?&]+)/i);
    if (youtubeShortMatch?.[1])
      return `https://www.youtube.com/embed/${youtubeShortMatch[1]}`;
    const driveMatch = clean.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveMatch?.[1])
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    return clean;
  };

  const openRecordingPlayer = (url: string) => {
    try {
      const embedUrl = toEmbeddableUrl(url);
      if (!embedUrl) return;
      setPlayerError(false);
      setPlayerSourceUrl(url);
      setPlayerUrl(embedUrl);
      setPlayerVisible(true);
    } catch {
      Alert.alert("Error", "Unable to open recording right now.");
    }
  };

  const resetAudioLessonForm = () => {
    setEditingAudioLesson(null);
    setAudioTitle("");
    setAudioDescription("");
    setAudioUrlInput("");
    setAudioUploadError("");
  };

  const openAudioUploadModal = () => {
    resetAudioLessonForm();
    setAudioLessonModalVisible(true);
  };

  const openAudioEditModal = (lesson: AudioLesson) => {
    setEditingAudioLesson(lesson);
    setAudioTitle(lesson.title);
    setAudioDescription(lesson.description || "");
    setAudioUrlInput(lesson.audio_url || "");
    setAudioUploadError("");
    setAudioLessonModalVisible(true);
  };

  const saveAudioLesson = async () => {
    if (!courseId || !user?.uid) return;
    if (!audioTitle.trim()) {
      Alert.alert("Title required", "Please enter an audio lesson title.");
      return;
    }
    if (!editingAudioLesson && !audioUrlInput.trim()) {
      Alert.alert("URL required", "Please provide a valid audio link (SoundCloud, Drive, etc.).");
      return;
    }
    setAudioUploading(true);
    setAudioUploadError("");
    try {
      if (editingAudioLesson) {
        await updateAudioLesson(editingAudioLesson.id, { title: audioTitle, description: audioDescription });
      } else {
        await uploadAudioLesson({
          courseId,
          teacherId: user.uid,
          title: audioTitle,
          description: audioDescription,
          duration: 0,
          uri: audioUrlInput.trim(),
          fileName: "External Link",
        });
      }
      setAudioLessonModalVisible(false);
      resetAudioLessonForm();
      await loadAudioLessons(true);
    } catch (e: any) {
      setAudioUploadError(e?.message || "Audio lesson save failed. Please retry.");
    } finally {
      setAudioUploading(false);
    }
  };

  const confirmDeleteAudioLesson = (lesson: AudioLesson) => {
    Alert.alert("Delete audio lesson", `Delete “${lesson.title}”? Students will no longer see this audio.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (activeAudioLesson?.id === lesson.id) {
              await audioSoundRef.current?.unloadAsync().catch(() => {});
              audioSoundRef.current = null;
              setActiveAudioLesson(null);
              setAudioPlaying(false);
            }
            await deleteAudioLesson(lesson);
            await loadAudioLessons(true);
          } catch (e: any) {
            Alert.alert("Delete failed", e?.message || "Could not delete this audio lesson.");
          }
        },
      },
    ]);
  };

  const playAudioLesson = async (lesson: AudioLesson) => {
    try {
      if (activeAudioLesson?.id !== lesson.id) {
        await audioSoundRef.current?.unloadAsync().catch(() => {});
        const { sound } = await Audio.Sound.createAsync(
          { uri: lesson.audio_url },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setAudioPlaying(status.isPlaying);
            setAudioPosition(Math.round((status.positionMillis || 0) / 1000));
            setAudioDuration(Math.round((status.durationMillis || lesson.duration * 1000 || 0) / 1000));
          },
        );
        audioSoundRef.current = sound;
        setActiveAudioLesson(lesson);
        setAudioPlaying(true);
        return;
      }
      await audioSoundRef.current?.playAsync();
    } catch (e: any) {
      Alert.alert("Playback failed", e?.message || "Could not stream this audio lesson.");
    }
  };

  const pauseAudioLesson = async () => {
    await audioSoundRef.current?.pauseAsync().catch(() => {});
    setAudioPlaying(false);
  };

  const seekAudioLesson = async (deltaSeconds: number) => {
    const sound = audioSoundRef.current;
    if (!sound) return;
    const nextPosition = Math.max(0, Math.min((audioDuration || activeAudioLesson?.duration || 0) * 1000, (audioPosition + deltaSeconds) * 1000));
    await sound.setPositionAsync(nextPosition).catch(() => {});
  };

  const downloadAudioLesson = async (lesson: AudioLesson) => {
    try {
      const fileName = lesson.file_name || `${lesson.title.replace(/[^A-Za-z0-9._-]/g, "_")}.mp3`;
      const destination = `${FileSystem.documentDirectory}${fileName}`;
      const result = await FileSystem.downloadAsync(lesson.audio_url, destination);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: lesson.mime_type || "audio/mpeg", dialogTitle: lesson.title });
      } else {
        await Linking.openURL(result.uri);
      }
    } catch (e: any) {
      Alert.alert("Download failed", e?.message || "Could not download this audio lesson.");
    }
  };


  useEffect(() => {
    if (!user?.uid || !activeAssignmentId || !submissionModalVisible) return;
    const t = setTimeout(() => {
      saveAssignmentDraft(user.uid, {
        assignment_id: activeAssignmentId,
        text: submissionText,
        external_file_url: externalFileUrl,
        updated_at_ms: Date.now(),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [user?.uid, activeAssignmentId, submissionText, externalFileUrl, submissionModalVisible]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading course...</Text>
        </View>
      </View>
    );
  }

  if (fatalError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.errorBackBtn}
          onPress={() => goBackOrReplace(router, "/(tabs)/courses")}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Go Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>{fatalError}</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.errorBackBtn}
          onPress={() => goBackOrReplace(router, "/(tabs)/courses")}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Go Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Course not found</Text>
      </View>
    );
  }

  const teacher = teachers.find((t) =>
    (course.teacher_name || "").includes(
      (t.name || "").split(" ").slice(-2).join(" "),
    ),
  );
  const getAudioLessonTeacherName = (teacherId: string) => {
    const match = teachers.find((t) => t.id === teacherId || (t as any).user_id === teacherId || (t as any).uid === teacherId);
    return match?.name || course.teacher_name || "Teacher";
  };
  const courseIndex = courses.findIndex((c) => c.id === courseId);

  const openExternalLink = async (url?: string) => {
    try {
      const link = prepareExternalUrl(url || "");
      if (!link) {
        Alert.alert("Error", "Invalid link");
        return;
      }
      console.log("[CourseDetail] Opening link:", link);
      await Linking.openURL(link).catch(() => {
        Alert.alert("Error", "Invalid link");
      });
    } catch (e) {
      console.log("[CourseDetail] openExternalLink ERROR:", e);
      Alert.alert("Error", "Invalid link");
    }
  };

  const handleJoinClass = () => {
    try {
      if (activeLiveClass?.id) {
        safePushLiveClass(activeLiveClass.id);
        return;
      }
      if (meetLink && meetLink.trim().length > 0) {
        Alert.alert(
          "Live class not active",
          "No live class is currently active. Would you like to join via Google Meet?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Meet", onPress: () => { void openExternalLink(meetLink); } },
          ],
        );
      } else {
        Alert.alert("Join Class", "Live class will be started by teacher.", [
          { text: "OK", style: "default" },
        ]);
      }
    } catch (e) {
      console.log("[CourseDetail] handleJoinClass ERROR:", e);
      Alert.alert("Error", "Unable to open class right now.");
    }
  };

  const openStartClassModal = () => {
    if (!course || !user?.uid || !profile) return;
    if (profile.role !== "teacher" && profile.role !== "admin") {
      Alert.alert("Access denied", "Only teachers/admins can start live classes.");
      return;
    }
    setMeetUrlInput(meetLink || "");
    setMeetUrlModalVisible(true);
  };

  const handleStartLiveClass = async () => {
    if (!course || !user?.uid || !profile) return;
    if (!meetUrlInput.trim()) {
      Alert.alert("Required", "Please enter a valid Google Meet URL.");
      return;
    }
    const meetRegex = /^https?:\/\/(meet\.google\.com\/[a-z0-9\-]+|meet\.google\.com\/lookup\/[a-z0-9\-]+)(?:\?.*)?$/i;
    if (!meetRegex.test(meetUrlInput.trim())) {
      Alert.alert("Invalid URL", "Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij)");
      return;
    }
    setMeetUrlModalVisible(false);
    setStartingLiveClass(true);
    try {
      const classId = await startLiveClass({
        courseId: course.id,
        title: course.name,
        teacherId: user.uid,
        teacherName: profile.name || user.email || "Teacher",
        meetUrl: meetUrlInput.trim(),
        profile,
      });
      safePushLiveClass(classId);
    } catch (e: any) {
      Alert.alert("Start failed", e?.message || "Could not start live class.");
    } finally {
      setStartingLiveClass(false);
    }
  };

  const openSubmissionModal = async (assignmentId: string) => {
    try {
      if (!assignmentId) return;
      const current = getSubmissionForAssignment(assignmentId);
      setActiveAssignmentId(assignmentId);
      setSubmissionText(current?.text_answer || "");
      setExternalFileUrl(current?.file_url || "");
      if (user?.uid) {
        const draft = await loadAssignmentDraft(user.uid, assignmentId).catch(() => null);
        if (draft) {
          setSubmissionText(draft.text || current?.text_answer || "");
          setExternalFileUrl(draft.external_file_url || current?.file_url || "");
        }
      }
      setSubmissionModalVisible(true);
    } catch (e) {
      console.log("[CourseDetail] openSubmissionModal ERROR:", e);
      Alert.alert("Error", "Unable to open assignment submission.");
    }
  };

  const submitAssignmentHandler = async () => {
    if (!activeAssignmentId) return;
    if (!submissionText.trim() && !externalFileUrl.trim()) {
      Alert.alert(
        "Missing data",
        "Please add a text answer or file URL.",
      );
      return;
    }
    setSubmittingAssignment(true);
    try {
      console.log("[CourseDetail] submitAssignmentHandler started", {
        activeAssignmentId,
      });
      const ok = await submitAssignment({
        assignmentId: activeAssignmentId,
        textAnswer: submissionText.trim(),
        fileUrl: externalFileUrl.trim(),
      });
      if (ok) {
        Alert.alert("Submitted", "Assignment submitted successfully.");
        setSubmissionModalVisible(false);
      } else {
        Alert.alert("Error", "Unable to submit assignment. Please try again.");
      }
    } catch (e) {
      console.log("[CourseDetail] submitAssignmentHandler ERROR:", e);
      Alert.alert("Upload failed", getAssignmentUploadError(e));
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const openReviewModal = (
    submissionId: string,
    feedback?: string,
    grade?: string,
  ) => {
    setActiveSubmissionId(submissionId);
    setReviewFeedback(feedback || "");
    setReviewGrade(grade || "");
    setReviewModalVisible(true);
  };

  const reviewSubmissionHandler = async () => {
    if (!activeSubmissionId) return;
    if (!reviewFeedback.trim()) {
      Alert.alert(
        "Missing feedback",
        "Please enter feedback before reviewing.",
      );
      return;
    }
    setReviewing(true);
    try {
      const ok = await reviewSubmission({
        submissionId: activeSubmissionId,
        feedback: reviewFeedback.trim(),
        grade: reviewGrade.trim(),
      });
      if (ok) {
        Alert.alert("Reviewed", "Feedback and marks saved.");
        setReviewModalVisible(false);
      } else {
        Alert.alert("Error", "Unable to review submission.");
      }
    } catch (e) {
      console.log("[CourseDetail] reviewSubmissionHandler ERROR:", e);
      Alert.alert("Error", "Something went wrong");
    } finally {
      setReviewing(false);
    }
  };

  const safePush = (path: string) => {
    try {
      if (!path) return;
      router.push(path as never);
    } catch {
      // no-op: keep app responsive
    }
  };

  const safePushLiveClass = (liveClassId?: string | null) => {
    try {
      const id = String(liveClassId || "").trim();
      if (!id) return;
      router.push({ pathname: "/live-class/[id]", params: { id } });
    } catch {
      // no-op: keep app responsive
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.heroWrapper}>
          <Image
            source={{ uri: getCourseImage(courseIndex) }}
            style={styles.heroImage}
          />
          <View style={styles.heroGradient} /><View style={styles.heroGradientBottom} />
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => goBackOrReplace(router, "/(tabs)/courses")}
            testID="course-detail-back-btn"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{course.name}</Text>
          </View>
        </View>

        
        {/* ─── Segmented Navigation Tabs ─── */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={15} color={activeTab === 'overview' ? '#FFF' : '#C8A84E'} />
            <Text style={[styles.tabItemText, activeTab === 'overview' && styles.tabItemTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'live' && styles.tabItemActive]}
            onPress={() => setActiveTab('live')}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam-outline" size={15} color={activeTab === 'live' ? '#FFF' : '#C8A84E'} />
            <Text style={[styles.tabItemText, activeTab === 'live' && styles.tabItemTextActive]}>Live & Rec</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'audio' && styles.tabItemActive]}
            onPress={() => setActiveTab('audio')}
            activeOpacity={0.8}
          >
            <Ionicons name="headset-outline" size={15} color={activeTab === 'audio' ? '#FFF' : '#C8A84E'} />
            <Text style={[styles.tabItemText, activeTab === 'audio' && styles.tabItemTextActive]}>Audio Dars</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'curriculum' && styles.tabItemActive]}
            onPress={() => setActiveTab('curriculum')}
            activeOpacity={0.8}
          >
            <Ionicons name="layers-outline" size={15} color={activeTab === 'curriculum' ? '#FFF' : '#C8A84E'} />
            <Text style={[styles.tabItemText, activeTab === 'curriculum' && styles.tabItemTextActive]}>Curriculum</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* ══════════════════ TAB 1: OVERVIEW ══════════════════ */}
          {activeTab === 'overview' && (
            <>
              {/* Progress Summary Card */}
              {safeProgress && (
                <View style={styles.progressSummaryCard}>
                  <View style={styles.progressSummaryHeader}>
                    <Text style={styles.progressSummaryTitle}>Your Learning Progress</Text>
                    {(() => {
                      const total = safeModules.reduce((acc, m) => acc + (Array.isArray(getLessonsForModule(m.id)) ? getLessonsForModule(m.id).length : 0), 0);
                      const completed = Object.values(safeProgress).filter(p => p?.completed).length;
                      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                      return (
                        <View style={{ width: '100%' }}>
                          {pct === 100 && (
                            <View style={styles.completedBadgeLarge}>
                              <Ionicons name="trophy" size={14} color="#FFFFFF" />
                              <Text style={styles.completedBadgeLargeText}>Completed</Text>
                            </View>
                          )}
                          <View style={{ width: '100%', marginTop: SPACING.sm }}>
                            <View style={styles.progressSummaryTrack}>
                              <View style={[styles.progressSummaryFill, { width: `${Math.min(100, pct)}%` }]} />
                            </View>
                            <View style={styles.progressSummaryStats}>
                              <Text style={styles.progressSummaryStatText}>{completed} completed</Text>
                              <Text style={styles.progressSummaryStatText}>{pct}%</Text>
                              <Text style={styles.progressSummaryStatText}>{Math.max(0, total - completed)} remaining</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}

              {/* Teacher Card */}
              <TouchableOpacity
                style={styles.teacherCard}
                testID="course-detail-teacher-link"
                activeOpacity={0.8}
                onPress={() => {
                  if (teacher?.id) safePush(`/teacher/${teacher.id}`);
                }}
              >
                {teacher && (
                  <Image
                    source={{ uri: getTeacherAvatar(teacher.id) }}
                    style={styles.teacherAvatar}
                  />
                )}
                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherLabel}>Instructor / Ustaadha</Text>
                  <Text style={styles.teacherNameText}>{course.teacher_name}</Text>
                </View>
                {teacher && (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.textMuted}
                  />
                )}
              </TouchableOpacity>

              {/* Schedule Card */}
              <View style={styles.infoCard} testID="course-detail-schedule">
                <View style={styles.infoCardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoCardTitle}>Class Schedule & Timings</Text>
                    <Text style={styles.infoCardSubValue}>Weekly regular recitation sessions</Text>
                  </View>
                </View>
                <View style={styles.scheduleDetailRow}>
                  <View style={styles.scheduleBadge}>
                    <Ionicons name="time-outline" size={14} color="#005F46" />
                    <Text style={styles.scheduleBadgeText}>{classTimeLabel || "Schedule to be announced"}</Text>
                  </View>
                  {course.schedule ? (
                    <View style={[styles.scheduleBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                      <Ionicons name="calendar" size={14} color="#92400E" />
                      <Text style={[styles.scheduleBadgeText, { color: '#92400E' }]}>{course.schedule}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Google Meet Live Class Launcher Card */}
              <View style={styles.infoCard} testID="course-detail-meet-link">
                <View style={styles.infoCardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons
                      name="videocam"
                      size={20}
                      color="#EF4444"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoCardTitle}>Online Interactive Classroom</Text>
                    <Text style={styles.infoCardSubValue}>Live video and audio conferencing</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.launchMeetBtn}
                  onPress={() => {
                    if (isLockedForStudent) {
                      Alert.alert("Class Enrollment Required", "Please enroll in this class to attend live conferencing sessions.");
                      return;
                    }
                    if (meetLink) {
                      void openExternalLink(meetLink);
                    } else {
                      Alert.alert("Class Link", "Live link will be activated when class starts.");
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="open-outline" size={18} color="#FFF" />
                  <Text style={styles.launchMeetBtnText}>Launch Live Class Room</Text>
                </TouchableOpacity>
              </View>

              {/* Academic Subjects & Faculty Assigned Card */}
              {Array.isArray(course.subjects) && course.subjects.length > 0 ? (
                <View style={styles.infoCard}>
                  <View style={styles.infoCardHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="library" size={20} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoCardTitle}>Academic Subjects & Faculty</Text>
                      <Text style={styles.infoCardSubValue}>Course syllabus subjects and assigned ustaadhas</Text>
                    </View>
                  </View>
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {course.subjects.map((sub, idx) => (
                      <View key={sub.id || idx} style={styles.subjectRow}>
                        <View style={styles.subjectIconBox}>
                          <Ionicons name="book-outline" size={16} color="#059669" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subjectTitle}>{sub.name}</Text>
                          {sub.schedule ? <Text style={styles.subjectSchedule}>{sub.schedule}</Text> : null}
                        </View>
                        <TouchableOpacity
                          style={styles.subjectTeacherBadge}
                          onPress={() => {
                            if (sub.teacher_id) {
                              router.push(`/chat/${sub.teacher_id}` as any);
                            } else {
                              router.push('/(tabs)/chats');
                            }
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel={`Chat with ${sub.teacher_name || 'Ustaadha'}`}
                        >
                          <Ionicons name="chatbubbles-outline" size={12} color={COLORS.primary} />
                          <Text style={styles.subjectTeacherText}>{sub.teacher_name || 'Assigned Ustaadha'}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* About this Course Card */}
              <View style={styles.infoCard} testID="course-detail-description">
                <View style={styles.infoCardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text style={styles.infoCardTitle}>About this Course</Text>
                </View>
                <Text style={styles.descriptionText}>
                  {course.description || "Course syllabus and educational details are being structured."}
                </Text>
              </View>

              {/* Enrollment Required Notice for Unenrolled Students */}
              {isLockedForStudent ? (
                <View style={styles.enrollPromptCard}>
                  <View style={styles.enrollPromptIconCircle}>
                    <Ionicons name="lock-closed" size={22} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enrollPromptTitle}>Enrollment Required for Full Access</Text>
                    <Text style={styles.enrollPromptSub}>
                      You are currently viewing the course overview. To attend live purdah classrooms, listen to audio dars lectures, and submit assignments, please enroll in this class.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.enrollPromptBtn}
                    onPress={() => router.push('/payment')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.enrollPromptBtnText}>Pay Fee & Enroll</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}

          {/* ══════════════════ TAB 2: LIVE & RECORDINGS ══════════════════ */}
          {activeTab === 'live' && (
            isLockedForStudent ? (
              <View style={styles.lockedGateCard}>
                <View style={styles.lockedGateIconCircle}>
                  <Ionicons name="lock-closed" size={32} color="#D97706" />
                </View>
                <Text style={styles.lockedGateTitle}>Live Classroom Locked</Text>
                <Text style={styles.lockedGateArabic}>داخلہ لازمی ہے</Text>
                <Text style={styles.lockedGateDesc}>
                  Live interactive purdah classrooms and recordings archive are restricted to officially enrolled students of this class.
                </Text>
                <View style={styles.lockedGateActionRow}>
                  <TouchableOpacity
                    style={styles.lockedGatePrimaryBtn}
                    onPress={() => router.push('/payment')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="card-outline" size={16} color="#FFF" />
                    <Text style={styles.lockedGatePrimaryBtnText}>Pay Fees & Request Enrollment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lockedGateSecondaryBtn}
                    onPress={() => router.push('/(tabs)/chats')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.lockedGateSecondaryBtnText}>Contact Administration</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Live Session Banner */}
                <View style={styles.liveClassBanner}>
                  <View style={styles.liveClassBannerHeader}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.liveClassBannerTitle}>{activeLiveClass ? "Live Session in Progress" : "Class Starting Soon"}</Text>
                  </View>
                  <Text style={styles.liveClassBannerSub}>
                    {activeLiveClass
                      ? "Your Ustaadha is currently live in the classroom. Tap below to join now."
                      : "The live class session is scheduled to begin shortly."}
                  </Text>
                  <View style={styles.liveClassActions}>
                    {isReviewer ? (
                      <TouchableOpacity
                        style={[styles.startLiveBtn, startingLiveClass && styles.disabledBtn]}
                        activeOpacity={0.8}
                        disabled={startingLiveClass}
                        onPress={activeLiveClass ? () => safePushLiveClass(activeLiveClass.id) : openStartClassModal}
                      >
                        {startingLiveClass ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                          <Ionicons name={activeLiveClass ? "radio" : "videocam"} size={20} color="#FFFFFF" />
                        )}
                        <Text style={styles.joinBtnText}>{activeLiveClass ? "Open Live Class" : "Start Live Class"}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.joinBtn, activeLiveClass && styles.liveNowBtn]}
                      testID="banner-join-class-btn"
                      activeOpacity={0.8}
                      onPress={handleJoinClass}
                    >
                      <Ionicons name={activeLiveClass ? "radio" : "videocam"} size={20} color="#FFFFFF" />
                      <Text style={styles.joinBtnText}>{activeLiveClass ? "Join Live Class" : "Join Class"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Class Recordings Archive */}
                <View style={styles.infoCard}>
                  <View style={styles.infoCardHeader}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="mic-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoCardTitle}>Class Recordings Archive</Text>
                      <Text style={styles.infoCardSubValue}>Recorded live sessions for revision</Text>
                    </View>
                  </View>
                  {generalRecordings.length === 0 ? (
                    <EmptyState
                      icon="videocam-outline"
                      title="No Recordings Available"
                      message="Past live session recordings and lecture archives will be published here once available."
                    />
                  ) : (
                    generalRecordings.map((rec) => (
                      <TouchableOpacity
                        key={rec.id}
                        style={styles.recordingRow}
                        onPress={() => openRecordingPlayer(rec.file_url)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordingTitle}>
                            {rec.title || "Recording"}
                          </Text>
                          <Text style={styles.recordingDesc}>
                            {rec.description || "Tap to play recording"}
                          </Text>
                        </View>
                        <Ionicons
                          name="play-circle-outline"
                          size={24}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            )
          )}

          {/* ══════════════════ TAB 3: AUDIO DARS ══════════════════ */}
          {activeTab === 'audio' && (
            isLockedForStudent ? (
              <View style={styles.lockedGateCard}>
                <View style={styles.lockedGateIconCircle}>
                  <Ionicons name="lock-closed" size={32} color="#D97706" />
                </View>
                <Text style={styles.lockedGateTitle}>Audio Dars Lectures Locked</Text>
                <Text style={styles.lockedGateArabic}>داخلہ لازمی ہے</Text>
                <Text style={styles.lockedGateDesc}>
                  Audio recordings and summary dars lectures uploaded by ustaadhas are restricted to enrolled students.
                </Text>
                <View style={styles.lockedGateActionRow}>
                  <TouchableOpacity
                    style={styles.lockedGatePrimaryBtn}
                    onPress={() => router.push('/payment')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="card-outline" size={16} color="#FFF" />
                    <Text style={styles.lockedGatePrimaryBtnText}>Pay Fees & Request Enrollment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lockedGateSecondaryBtn}
                    onPress={() => router.push('/(tabs)/chats')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.lockedGateSecondaryBtnText}>Contact Administration</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infoCard} testID="course-audio-lessons">
                <View style={styles.infoCardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="headset-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoCardTitle}>Audio Lessons & Lectures</Text>
                    <Text style={styles.infoCardSubValue}>Teacher-uploaded Dars summaries for revision</Text>
                  </View>
                  {isReviewer ? (
                    <View style={styles.audioHeaderActions}>
                      <TouchableOpacity style={styles.audioUploadBtn} onPress={openAudioUploadModal}>
                        <Ionicons name="link-outline" size={16} color={COLORS.goldText} />
                        <Text style={styles.audioUploadBtnText}>Add Link</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                <TextInput
                  value={audioSearch}
                  onChangeText={setAudioSearch}
                  placeholder="Search audio lessons by title..."
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.audioSearchInput}
                />
                {activeAudioLesson ? (
                  <View style={styles.audioPlayerCard}>
                    <Text style={styles.audioPlayerTitle} numberOfLines={1}>{activeAudioLesson.title}</Text>
                    <Text style={styles.audioPlayerMeta}>{formatAudioDuration(audioPosition)} / {formatAudioDuration(audioDuration || activeAudioLesson.duration)}</Text>
                    <View style={styles.audioProgressTrack}>
                      <View style={[styles.audioProgressFill, { width: `${Math.min(100, Math.max(0, (audioPosition / Math.max(1, audioDuration || activeAudioLesson.duration)) * 100))}%` }]} />
                    </View>
                    <View style={styles.audioControlRow}>
                      <TouchableOpacity style={styles.audioControlBtn} onPress={() => seekAudioLesson(-15)}>
                        <Ionicons name="play-back" size={18} color={COLORS.primary} />
                        <Text style={styles.audioControlText}>15s</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.audioMainControlBtn} onPress={audioPlaying ? pauseAudioLesson : () => playAudioLesson(activeAudioLesson)}>
                        <Ionicons name={audioPlaying ? "pause" : "play"} size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.audioControlBtn} onPress={() => seekAudioLesson(15)}>
                        <Text style={styles.audioControlText}>15s</Text>
                        <Ionicons name="play-forward" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.audioControlBtn} onPress={() => downloadAudioLesson(activeAudioLesson)}>
                        <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                {loadingAudioLessons && audioLessons.length === 0 ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : audioLessons.length === 0 ? (
                  <EmptyState
                    icon="headset-outline"
                    title="No Audio Lectures"
                    message="Revision podcasts and audio summaries will be shared here by your instructor."
                  />
                ) : (
                  audioLessons.map((lesson) => (
                    <View key={lesson.id} style={styles.audioLessonRow}>
                      <TouchableOpacity style={styles.audioLessonPlayArea} onPress={() => playAudioLesson(lesson)}>
                        <Ionicons name={activeAudioLesson?.id === lesson.id && audioPlaying ? "pause-circle" : "play-circle-outline"} size={28} color={COLORS.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordingTitle}>{lesson.title}</Text>
                          <Text style={styles.recordingDesc}>By {getAudioLessonTeacherName(lesson.teacher_id)} • {formatAudioUploadDate(lesson.upload_date)}</Text>
                          <Text style={styles.recordingDesc}>{formatAudioDuration(lesson.duration)} • {formatFileSize(lesson.file_size)}</Text>
                          {lesson.description ? <Text style={styles.recordingDesc} numberOfLines={2}>{lesson.description}</Text> : null}
                        </View>
                      </TouchableOpacity>
                      <View style={styles.audioLessonActions}>
                        <TouchableOpacity style={styles.audioIconBtn} onPress={() => downloadAudioLesson(lesson)}>
                          <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                        {isReviewer ? (
                          <>
                            <TouchableOpacity style={styles.audioIconBtn} onPress={() => openAudioEditModal(lesson)}>
                              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.audioIconBtn} onPress={() => confirmDeleteAudioLesson(lesson)}>
                              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
                {audioHasMore ? (
                  <TouchableOpacity style={styles.loadMoreBtn} disabled={loadingAudioLessons} onPress={() => { void loadAudioLessons(false); }}>
                    {loadingAudioLessons ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.loadMoreText}>Load more audio lessons</Text>}
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          )}

          {/* ══════════════════ TAB 4: CURRICULUM ══════════════════ */}
          {activeTab === 'curriculum' && (
            isLockedForStudent ? (
              <View style={styles.lockedGateCard}>
                <View style={styles.lockedGateIconCircle}>
                  <Ionicons name="lock-closed" size={32} color="#D97706" />
                </View>
                <Text style={styles.lockedGateTitle}>Sabaq Curriculum Locked</Text>
                <Text style={styles.lockedGateArabic}>داخلہ لازمی ہے</Text>
                <Text style={styles.lockedGateDesc}>
                  Structured sabaq lessons, recitation notes, and assignment submissions are reserved for enrolled students.
                </Text>
                <View style={styles.lockedGateActionRow}>
                  <TouchableOpacity
                    style={styles.lockedGatePrimaryBtn}
                    onPress={() => router.push('/payment')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="card-outline" size={16} color="#FFF" />
                    <Text style={styles.lockedGatePrimaryBtnText}>Pay Fees & Request Enrollment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lockedGateSecondaryBtn}
                    onPress={() => router.push('/(tabs)/chats')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubbles-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.lockedGateSecondaryBtnText}>Contact Administration</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infoCard} testID="course-learning-structure">
                <View style={styles.infoCardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="layers-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoCardTitle}>Syllabus & Sabaq Lessons</Text>
                    <Text style={styles.infoCardSubValue}>Structured course modules and assignments</Text>
                  </View>
                </View>
              {safeModules.length === 0 ? (
                <EmptyState
                  icon="layers-outline"
                  title="Curriculum Under Development"
                  message="The course modules, lessons, and assignments are currently being structured by the instructor."
                />
              ) : (
                safeModules.map((module) => {
                  const moduleLessonsRaw = getLessonsForModule(module.id);
                  const moduleLessons = Array.isArray(moduleLessonsRaw)
                    ? moduleLessonsRaw
                    : [];
                  const completedCount = moduleLessons.filter(
                    (lesson) => safeProgress[lesson.id]?.completed,
                  ).length;
                  return (
                    <View key={module.id} style={styles.moduleBlock}>
                      <Text style={styles.moduleTitle}>{module.title}</Text>
                      <Text style={styles.moduleMeta}>
                        {completedCount}/{moduleLessons.length} completed
                      </Text>
                      {moduleLessons.map((lesson) => {
                        const done = !!safeProgress[lesson.id]?.completed;
                        const lessonAssignmentsRaw = getAssignmentsForLesson(
                          lesson.id,
                        );
                        const lessonAssignments = Array.isArray(
                          lessonAssignmentsRaw,
                        )
                          ? lessonAssignmentsRaw
                          : [];
                        const isExpanded = expandedLessonId === lesson.id;
                        const lessonRecordings = (
                          Array.isArray(recordings) ? recordings : []
                        ).filter((rec) => rec.lesson_id === lesson.id);
                        return (
                          <View key={lesson.id}>
                            <ScalePressable
                              style={[
                                styles.lessonRow,
                                done && styles.lessonRowDone,
                              ]}
                              onPress={async () => {
                                try {
                                  await markLessonOpened(lesson);
                                } catch (e) {
                                  console.log(
                                    "[CourseDetail] markLessonOpened ERROR:",
                                    e,
                                  );
                                  Alert.alert("Error", "Something went wrong");
                                } finally {
                                  setExpandedLessonId((prev) =>
                                    prev === lesson.id ? null : lesson.id,
                                  );
                                }
                              }}
                              testID={`lesson-${lesson.id}`}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.lessonTitle}>
                                  {lesson.title}
                                </Text>
                                <Text style={styles.lessonMeta}>
                                  {lesson.duration_minutes
                                    ? `${lesson.duration_minutes} min`
                                    : "Tap to open lesson"}
                                </Text>
                              </View>
                              <Ionicons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={18}
                                color={COLORS.textMuted}
                              />
                              <Ionicons
                                name={
                                  done ? "checkmark-circle" : "ellipse-outline"
                                }
                                size={20}
                                color={done ? COLORS.primary : COLORS.textMuted}
                              />
                            </ScalePressable>
                            {isExpanded ? (
                              <View style={styles.lessonDetailCard}>
                                <TouchableOpacity
                                  style={styles.completeBtn}
                                  onPress={async () => {
                                    try {
                                      await markLessonComplete(lesson);
                                    } catch (e) {
                                      console.log(
                                        "[CourseDetail] markLessonComplete ERROR:",
                                        e,
                                      );
                                      Alert.alert(
                                        "Error",
                                        "Something went wrong",
                                      );
                                    }
                                  }}
                                >
                                  <Ionicons
                                    name="checkmark-done"
                                    size={16}
                                    color="#fff"
                                  />
                                  <Text style={styles.completeBtnText}>
                                    {done ? "Completed" : "Mark lesson complete"}
                                  </Text>
                                </TouchableOpacity>
                                <View style={styles.lessonRecordingBlock}>
                                  <Text style={styles.lessonRecordingTitle}>
                                    Class Recordings
                                  </Text>
                                  {lessonRecordings.length === 0 ? (
                                    <Text style={styles.infoCardSubValue}>
                                      No recording attached to this lesson yet.
                                    </Text>
                                  ) : (
                                    lessonRecordings.map((rec) => (
                                      <TouchableOpacity
                                        key={rec.id}
                                        style={styles.recordingRow}
                                        onPress={() =>
                                          openRecordingPlayer(rec.file_url)
                                        }
                                      >
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.recordingTitle}>
                                            {rec.title || "Recording"}
                                          </Text>
                                          <Text style={styles.recordingDesc}>
                                            {rec.description || "Tap to play"}
                                          </Text>
                                        </View>
                                        <Ionicons
                                          name="play-circle-outline"
                                          size={22}
                                          color={COLORS.primary}
                                        />
                                      </TouchableOpacity>
                                    ))
                                  )}
                                </View>
                                {lessonAssignments.length === 0 ? (
                                  <Text style={styles.infoCardSubValue}>
                                    No assignments in this lesson yet.
                                  </Text>
                                ) : (
                                  lessonAssignments.map((assignment) => {
                                    const mySubmission =
                                      getSubmissionForAssignment(assignment.id);
                                    const assignmentSubmissionsRaw = isReviewer
                                      ? getSubmissionsForAssignment(assignment.id)
                                      : [];
                                    const assignmentSubmissions = Array.isArray(
                                      assignmentSubmissionsRaw,
                                    )
                                      ? assignmentSubmissionsRaw
                                      : [];
                                  
                                    return (
                                      <View
                                        key={assignment.id}
                                        style={styles.assignmentCard}
                                      >
                                        <Text style={styles.assignmentTitle}>
                                          {assignment.title}
                                        </Text>
                                        <Text style={styles.assignmentDesc}>
                                          {assignment.description ||
                                            "No description provided."}
                                        </Text>
                                        {assignment.due_date ? (
                                          <Text style={styles.assignmentDue}>
                                            Due: {assignment.due_date}
                                          </Text>
                                        ) : null}
                                        {assignment.file_url ? (
                                          <TouchableOpacity
                                            onPress={() => {
                                              void openExternalLink(
                                                assignment.file_url || "",
                                              );
                                            }}
                                          >
                                            <Text style={styles.assignmentLink}>
                                              Open assignment file
                                            </Text>
                                          </TouchableOpacity>
                                        ) : null}
                                        {!isReviewer ? (
                                          <View
                                            style={styles.studentSubmissionBlock}
                                          >
                                            <Text style={styles.assignmentStatus}>
                                              Status:{" "}
                                              {mySubmission?.status ||
                                                "not_submitted"}
                                            </Text>
                                            {mySubmission?.feedback ? (
                                              <Text
                                                style={styles.assignmentFeedback}
                                              >
                                                Feedback: {mySubmission.feedback}
                                              </Text>
                                            ) : null}
                                            {mySubmission?.grade ? (
                                              <Text
                                                style={styles.assignmentGrade}
                                              >
                                                Marks: {mySubmission.grade}
                                              </Text>
                                            ) : null}
                                            <TouchableOpacity
                                              style={styles.assignmentActionBtn}
                                              onPress={() => { void openSubmissionModal(assignment.id); }}
                                            >
                                              <Text
                                                style={
                                                  styles.assignmentActionText
                                                }
                                              >
                                                {mySubmission
                                                  ? "Update submission"
                                                  : "Submit assignment"}
                                              </Text>
                                            </TouchableOpacity>
                                          </View>
                                        ) : (
                                          <View style={styles.reviewerBlock}>
                                            <Text style={styles.assignmentStatus}>
                                              Submissions:{" "}
                                              {assignmentSubmissions.length}
                                            </Text>
                                            {assignmentSubmissions.length ===
                                            0 ? (
                                              <Text
                                                style={styles.infoCardSubValue}
                                              >
                                                No student submissions yet.
                                              </Text>
                                            ) : null}
                                            {assignmentSubmissions
                                              .slice(0, 6)
                                              .map((submission) => (
                                                <View
                                                  key={submission.id}
                                                  style={
                                                    styles.reviewerSubmissionRow
                                                  }
                                                >
                                                  <View style={{ flex: 1 }}>
                                                    <Text
                                                      style={
                                                        styles.reviewerSubmissionMeta
                                                      }
                                                    >
                                                      Student:{" "}
                                                      {submission.user_id}
                                                    </Text>
                                                    <Text
                                                      style={
                                                        styles.reviewerSubmissionMeta
                                                      }
                                                    >
                                                      Status: {submission.status}
                                                    </Text>
                                                    {submission.text_answer ? (
                                                      <Text
                                                        style={
                                                          styles.reviewerSubmissionText
                                                        }
                                                        numberOfLines={2}
                                                      >
                                                        {submission.text_answer}
                                                      </Text>
                                                    ) : null}
                                                    {submission.file_url ? (
                                                      <TouchableOpacity
                                                        onPress={() => {
                                                          void openExternalLink(
                                                            submission.file_url ||
                                                              "",
                                                          );
                                                        }}
                                                      >
                                                        <Text
                                                          style={
                                                            styles.assignmentLink
                                                          }
                                                        >
                                                          Open submitted file
                                                        </Text>
                                                      </TouchableOpacity>
                                                    ) : null}
                                                    {submission.feedback ? (
                                                      <Text
                                                        style={
                                                          styles.assignmentFeedback
                                                        }
                                                      >
                                                        Feedback:{" "}
                                                        {submission.feedback}
                                                      </Text>
                                                    ) : null}
                                                    {submission.grade ? (
                                                      <Text
                                                        style={
                                                          styles.assignmentGrade
                                                        }
                                                      >
                                                        Marks: {submission.grade}
                                                      </Text>
                                                    ) : null}
                                                  </View>
                                                  <TouchableOpacity
                                                    style={styles.reviewBtn}
                                                    onPress={() =>
                                                      openReviewModal(
                                                        submission.id,
                                                        submission.feedback,
                                                        submission.grade,
                                                      )
                                                    }
                                                  >
                                                    <Text
                                                      style={styles.reviewBtnText}
                                                    >
                                                      {submission.status ===
                                                      "reviewed"
                                                        ? "Edit Review"
                                                        : "Review"}
                                                    </Text>
                                                  </TouchableOpacity>
                                                </View>
                                              ))}
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })
                                )}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </View>
          )
        )}

          {/* Floating Bottom Quick Action */}
          <View style={styles.floatingActionRow}>
            {meetLink ? (
              <TouchableOpacity
                style={styles.meetQuickActionBtn}
                onPress={() => { void openExternalLink(meetLink); }}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-google" size={16} color="#FFF" />
                <Text style={styles.meetQuickActionText}>Join Google Meet</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.mainJoinActionBtn, activeLiveClass && styles.liveNowBtn]}
              testID="join-class-btn"
              activeOpacity={0.88}
              onPress={handleJoinClass}
            >
              <Ionicons name={activeLiveClass ? "radio" : "videocam"} size={18} color="#FFFFFF" />
              <Text style={styles.mainJoinActionText}>{activeLiveClass ? "Join Live Class Now" : "Enter Classroom"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={submissionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSubmissionModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit Assignment</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={submissionText}
              onChangeText={setSubmissionText}
              placeholder="Write your answer..."
              multiline
            />

            <TextInput
              style={styles.modalInput}
              value={externalFileUrl}
              onChangeText={setExternalFileUrl}
              placeholder="Or paste PDF/Image URL"
              autoCapitalize="none"
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSubmissionModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={submitAssignmentHandler}
                disabled={submittingAssignment}
              >
                {submittingAssignment ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review Submission</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={reviewFeedback}
              onChangeText={setReviewFeedback}
              placeholder="Write feedback..."
              multiline
            />
            <TextInput
              style={styles.modalInput}
              value={reviewGrade}
              onChangeText={setReviewGrade}
              placeholder="Marks / Grade (optional)"
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={reviewSubmissionHandler}
                disabled={reviewing}
              >
                {reviewing ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={audioLessonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setAudioLessonModalVisible(false); resetAudioLessonForm(); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingAudioLesson ? "Edit Audio Lesson" : "Upload Audio Lesson"}</Text>
            <TextInput
              style={styles.modalInput}
              value={audioTitle}
              onChangeText={setAudioTitle}
              placeholder="Lesson title"
              placeholderTextColor={COLORS.textMuted}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={audioDescription}
              onChangeText={setAudioDescription}
              placeholder="Description (optional)"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            {!editingAudioLesson ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={audioUrlInput}
                  onChangeText={setAudioUrlInput}
                  placeholder="Paste external audio URL..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                />
              </>
            ) : null}
            {audioUploadError ? (
              <View style={styles.retryBox}>
                <Text style={styles.errorTextSmall}>{audioUploadError}</Text>
              </View>
            ) : null}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setAudioLessonModalVisible(false); resetAudioLessonForm(); }}
                disabled={audioUploading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={saveAudioLesson} disabled={audioUploading}>
                {audioUploading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.modalSubmitText}>{editingAudioLesson ? "Save" : "Upload"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={playerVisible}
        animationType="slide"
        onRequestClose={() => setPlayerVisible(false)}
      >
        <View style={styles.playerContainer}>
          <View style={[styles.playerTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.playerCloseBtn}
              onPress={() => setPlayerVisible(false)}
            >
              <Ionicons name="close" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.playerTitle}>Class Recording</Text>
            <View style={{ width: 36 }} />
          </View>
          {playerUrl && !playerError ? (
            <WebView
              source={{ uri: playerUrl }}
              style={styles.playerWebView}
              allowsFullscreenVideo
              onError={() => setPlayerError(true)}
              onHttpError={() => setPlayerError(true)}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                Couldn&apos;t preview this file. It may be too large.
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => {
                    void openExternalLink(playerSourceUrl || playerUrl);
                  }}
                >
                  <Text style={styles.infoBtnText}>Open Externally</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => {
                    void openExternalLink(playerSourceUrl || playerUrl);
                  }}
                >
                  <Text style={styles.infoBtnText}>Download / Open</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={meetUrlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMeetUrlModalVisible(false)}
      >
        <View style={styles.startClassModalOverlay}>
          <View style={styles.startClassModalContent}>
            <View style={styles.startClassModalHeader}>
              <Text style={styles.startClassModalTitle}>Start Live Class</Text>
              <TouchableOpacity onPress={() => setMeetUrlModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: COLORS.textMuted, marginBottom: 16 }}>
              Enter the Google Meet link for this session.
            </Text>
            <TextInput
              style={styles.startClassModalInput}
              placeholder="https://meet.google.com/..."
              placeholderTextColor={COLORS.textMuted}
              value={meetUrlInput}
              onChangeText={setMeetUrlInput}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.startClassPrimaryModalBtn, { marginTop: 24 }]}
              onPress={handleStartLiveClass}
              disabled={startingLiveClass}
            >
              {startingLiveClass ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.startClassPrimaryModalBtnText}>Start Class</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heroGradientBottom: {
    position: "absolute",
    left: 0, right: 0, bottom: 0, height: "60%",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  progressSummaryCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card, marginBottom: SPACING.md },
  progressSummaryHeader: { alignItems: 'flex-start', width: '100%' },
  progressSummaryTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 4 },
  completedBadgeLarge: { position: 'absolute', top: -30, right: 0, backgroundColor: COLORS.goldText, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, gap: 4 },
  completedBadgeLargeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  progressSummaryTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden', width: '100%' },
  progressSummaryFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.primary },
  progressSummaryStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressSummaryStatText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  startClassModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  startClassModalContent: { width: "90%", maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl },
  startClassModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
  startClassModalTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.textMain },
  startClassModalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.textMain, backgroundColor: COLORS.background },
  startClassPrimaryModalBtn: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  startClassPrimaryModalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  errorBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: SPACING.lg,
  },
  errorBackText: { fontSize: 15, fontWeight: "600", color: COLORS.textMain },
  errorText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 40,
  },

  heroWrapper: { position: "relative", height: 300 },
  heroImage: { width: "100%", height: "100%" },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  heroContent: { position: "absolute", left: 20, right: 20, bottom: 24 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },

  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: "#003D2E",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#C8A84E",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabItemActive: {
    backgroundColor: "#005F46",
    borderWidth: 1,
    borderColor: "#C8A84E",
  },
  tabItemText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C8A84E",
  },
  tabItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  scheduleDetailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  scheduleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5EE",
    borderWidth: 1,
    borderColor: "#C6E8D4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  scheduleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#005F46",
  },

  launchMeetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginTop: 6,
  },
  launchMeetBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  floatingActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
  },
  meetQuickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#4285F4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
  },
  meetQuickActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  mainJoinActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#005F46",
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    ...SHADOWS.card,
  },
  mainJoinActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  body: { padding: SPACING.lg, gap: SPACING.md },

  teacherCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  teacherAvatar: { width: 48, height: 48, borderRadius: 24 },
  teacherInfo: { flex: 1 },
  teacherLabel: { color: COLORS.textMuted, fontSize: 12 },
  teacherNameText: { color: COLORS.textMain, fontSize: 15, fontWeight: "700" },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  infoCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5EE",
  },
  infoCardTitle: { color: COLORS.textMain, fontWeight: "700", fontSize: 15 },
  infoCardValue: { color: COLORS.textMain, fontSize: 14, fontWeight: "600" },
  infoCardSubValue: { color: COLORS.textMuted, fontSize: 12 },

  moduleBlock: { marginTop: 8 },
  moduleTitle: { color: COLORS.textMain, fontWeight: "700", fontSize: 14 },
  moduleMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    marginTop: 8,
    ...SHADOWS.card,
  },
  lessonRowDone: { borderColor: COLORS.primary, backgroundColor: "#F4FAF6" },
  lessonTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  lessonMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  lessonDetailCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.surface,
    marginTop: 8,
    padding: 10,
    gap: 8,
  },
  completeBtn: {
    backgroundColor: COLORS.goldText,
    borderRadius: RADIUS.full,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  completeBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  lessonRecordingBlock: { marginTop: 4, gap: 4 },
  lessonRecordingTitle: {
    color: COLORS.textMain,
    fontSize: 13,
    fontWeight: "700",
  },

  assignmentCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    padding: 10,
    backgroundColor: COLORS.surfaceAlt,
    gap: 4,
  },
  assignmentTitle: { color: COLORS.textMain, fontWeight: "700", fontSize: 14 },
  assignmentDesc: { color: COLORS.textMuted, fontSize: 12 },
  assignmentDue: { color: COLORS.goldText, fontSize: 12, fontWeight: "600" },
  assignmentLink: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  assignmentStatus: {
    color: COLORS.textMain,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  assignmentFeedback: { color: COLORS.textMain, fontSize: 12, marginTop: 2 },
  assignmentGrade: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  studentSubmissionBlock: { marginTop: 4, gap: 4 },
  assignmentActionBtn: {
    marginTop: 4,
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    alignSelf: "flex-start",
  },
  assignmentActionText: {
    color: COLORS.goldText,
    fontWeight: "700",
    fontSize: 12,
  },

  reviewerBlock: { marginTop: 6, gap: 8 },
  reviewerSubmissionRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: COLORS.surface,
  },
  reviewerSubmissionMeta: { color: COLORS.textMuted, fontSize: 11 },
  reviewerSubmissionText: {
    color: COLORS.textMain,
    fontSize: 12,
    marginTop: 2,
  },
  reviewBtn: {
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reviewBtnText: { color: COLORS.goldText, fontWeight: "700", fontSize: 11 },

  descriptionText: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 21,
  },
  joinBtn: {
    marginTop: 18,
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...SHADOWS.card,
  },
  joinBtnText: { color: COLORS.goldText, fontWeight: "700", fontSize: 16 },
  liveClassActions: { gap: 10, marginTop: SPACING.md },
  startLiveBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...SHADOWS.card,
  },
  liveNowBtn: { backgroundColor: "#16A34A" },
  meetFallbackBtn: { alignItems: "center", paddingVertical: 8 },
  meetFallbackText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  disabledBtn: { opacity: 0.65 },
  joinLaterCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xxl,
    padding: SPACING.md,
  },

  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    padding: 10,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 8,
  },
  recordingTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  recordingDesc: { fontSize: 12, color: COLORS.textMuted },
  audioHeaderActions: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  audioUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.goldText,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  audioUploadBtnText: { color: COLORS.goldText, fontWeight: "800", fontSize: 12 },
  audioSearchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
  },
  audioPlayerCard: {
    borderWidth: 1,
    borderColor: "#B7E4CC",
    borderRadius: RADIUS.xxl,
    padding: 10,
    gap: 8,
    backgroundColor: "#F2FBF6",
  },
  audioPlayerTitle: { color: COLORS.textMain, fontWeight: "800", fontSize: 14 },
  audioPlayerMeta: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  audioProgressTrack: { height: 6, borderRadius: 3, backgroundColor: "#DCEFE5", overflow: "hidden" },
  audioProgressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  audioControlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  audioControlBtn: {
    minHeight: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  audioControlText: { color: COLORS.primary, fontWeight: "800", fontSize: 12 },
  audioMainControlBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  audioLessonRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.surfaceAlt,
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  audioLessonPlayArea: { flexDirection: "row", alignItems: "center", gap: 10 },
  audioLessonActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  audioIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreBtn: { alignItems: "center", paddingVertical: 10 },
  loadMoreText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  retryBox: { gap: 8 },
  errorTextSmall: { color: COLORS.error, fontSize: 12, fontWeight: "700" },
  recorderPanel: {
    borderWidth: 1,
    borderColor: "#CFE9DB",
    borderRadius: RADIUS.xxl,
    padding: 10,
    gap: 8,
    backgroundColor: "#F7FBF9",
  },
  recorderTitle: { color: COLORS.textMain, fontWeight: "800", fontSize: 13 },
  recorderTimer: { color: COLORS.primary, fontWeight: "900", fontSize: 28, textAlign: "center" },
  recorderButtonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  recorderPrimaryBtn: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recorderPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  recorderSecondaryBtn: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recorderSecondaryText: { color: COLORS.primary, fontWeight: "800", fontSize: 12 },
  recorderStopBtn: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recorderStopText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: 10,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
  },
  modalTextArea: { minHeight: 90, textAlignVertical: "top" },
  secondaryModalBtn: {
    borderWidth: 1,
    borderColor: COLORS.goldText,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryModalBtnText: {
    color: COLORS.goldText,
    fontWeight: "700",
    fontSize: 13,
  },
  modalActionRow: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  modalCancelText: { color: COLORS.textMain, fontWeight: "700" },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 11,
    alignItems: "center",
  },
  assignmentUploadProgress: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  modalSubmitText: { color: COLORS.goldText, fontWeight: "700" },
  playerContainer: { flex: 1, backgroundColor: "#000" },
  playerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
  },
  playerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.xxl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  playerTitle: { color: COLORS.textMain, fontWeight: "700", fontSize: 15 },
  playerWebView: { flex: 1, backgroundColor: "#000" },
  infoBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoBtnText: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  liveClassBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.goldBg,
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  liveClassBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    marginRight: 8,
  },
  liveClassBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  liveClassBannerSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  subjectIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  subjectTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  subjectSchedule: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  subjectTeacherBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 169, 88, 0.1)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subjectTeacherText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  enrollPromptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    flexWrap: "wrap",
  },
  enrollPromptIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  enrollPromptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },
  enrollPromptSub: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 17,
    marginTop: 2,
  },
  enrollPromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D97706",
    borderRadius: RADIUS.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  enrollPromptBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  lockedGateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  lockedGateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  lockedGateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
    textAlign: "center",
  },
  lockedGateArabic: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginTop: 4,
    marginBottom: 8,
  },
  lockedGateDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  lockedGateActionRow: {
    width: "100%",
    gap: 10,
  },
  lockedGatePrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    ...SHADOWS.card,
  },
  lockedGatePrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  lockedGateSecondaryBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
  },
  lockedGateSecondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
