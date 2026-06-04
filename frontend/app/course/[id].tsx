/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
import * as DocumentPicker from "expo-document-picker";
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
import { ScalePressable } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { uploadUriFile } from "@/lib/storage";
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

const MAX_ASSIGNMENT_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSIGNMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

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

function getPickerAsset(result: DocumentPicker.DocumentPickerResult): DocumentPicker.DocumentPickerAsset | null {
  if (result.canceled) return null;
  return result.assets?.[0] || null;
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
  const [assignmentUploadProgress, setAssignmentUploadProgress] = useState(0);
  const [submissionText, setSubmissionText] = useState("");
  const [selectedUpload, setSelectedUpload] = useState<{
    uri: string;
    name: string;
    mimeType?: string;
  } | null>(null);
  const [externalFileUrl, setExternalFileUrl] = useState("");

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewGrade, setReviewGrade] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [activeLiveClass, setActiveLiveClass] = useState<LiveClass | null>(null);
  const [startingLiveClass, setStartingLiveClass] = useState(false);
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
  const [selectedAudioUpload, setSelectedAudioUpload] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedAudioDuration, setSelectedAudioDuration] = useState(0);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState("");
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudioUri, setRecordedAudioUri] = useState("");
  const [recordedAudioSize, setRecordedAudioSize] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
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
  const isReviewer = profile?.role === "admin" || profile?.role === "teacher";


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
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && recordingState === "recording") {
        void pauseInAppRecording();
        setAudioUploadError("Recording paused because the app went to the background. Resume when ready.");
      }
    });
    return () => sub.remove();
  }, [recordingState]);

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
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    setEditingAudioLesson(null);
    setAudioTitle("");
    setAudioDescription("");
    setSelectedAudioUpload(null);
    setSelectedAudioDuration(0);
    setAudioUploadProgress(0);
    setAudioUploadError("");
    setRecordingState("idle");
    setRecordingDuration(0);
    setRecordedAudioUri("");
    setRecordedAudioSize(0);
  };

  const openAudioUploadModal = () => {
    resetAudioLessonForm();
    setAudioLessonModalVisible(true);
  };

  const openAudioRecordingModal = () => {
    resetAudioLessonForm();
    setAudioLessonModalVisible(true);
  };

  const openAudioEditModal = (lesson: AudioLesson) => {
    setEditingAudioLesson(lesson);
    setAudioTitle(lesson.title);
    setAudioDescription(lesson.description || "");
    setSelectedAudioUpload(null);
    setSelectedAudioDuration(lesson.duration || 0);
    setAudioUploadProgress(0);
    setAudioUploadError("");
    setAudioLessonModalVisible(true);
  };

  const setPlaybackAudioMode = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  const startInAppRecording = async () => {
    try {
      if (recordingRef.current) await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone permission required", "Please allow microphone access to record audio lessons.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const recording = new Audio.Recording();
      recording.setProgressUpdateInterval(500);
      recording.setOnRecordingStatusUpdate((status) => {
        setRecordingDuration(Math.round((status.durationMillis || 0) / 1000));
        if (status.isRecording) setRecordingState("recording");
      });
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setSelectedAudioUpload(null);
      setRecordedAudioUri("");
      setRecordedAudioSize(0);
      setRecordingState("recording");
      setAudioUploadError("");
    } catch (e: any) {
      setAudioUploadError(e?.message || "Could not start recording. Please check microphone access and retry.");
      await setPlaybackAudioMode().catch(() => {});
    }
  };

  const pauseInAppRecording = async () => {
    try {
      await recordingRef.current?.pauseAsync();
      setRecordingState("paused");
    } catch (e: any) {
      setAudioUploadError(e?.message || "Pause is not supported on this device. Stop the recording to save it.");
    }
  };

  const resumeInAppRecording = async () => {
    try {
      await recordingRef.current?.startAsync();
      setRecordingState("recording");
    } catch (e: any) {
      setAudioUploadError(e?.message || "Could not resume recording.");
    }
  };

  const stopInAppRecording = async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;
      const status = await recording.stopAndUnloadAsync();
      const uri = recording.getURI() || "";
      recordingRef.current = null;
      await setPlaybackAudioMode().catch(() => {});
      if (!uri) throw new Error("Recording file was not created.");
      const info = await FileSystem.getInfoAsync(uri);
      const durationSeconds = Math.max(recordingDuration, Math.round((status.durationMillis || 0) / 1000));
      setRecordedAudioUri(uri);
      setRecordedAudioSize(info.exists && typeof info.size === "number" ? info.size : 0);
      setSelectedAudioDuration(durationSeconds);
      setRecordingDuration(durationSeconds);
      setRecordingState("stopped");
      setSelectedAudioUpload(null);
      if (!audioTitle.trim()) setAudioTitle(`Audio Lesson ${new Date().toLocaleDateString()}`);
    } catch (e: any) {
      setAudioUploadError(e?.message || "Could not stop and save recording.");
      await setPlaybackAudioMode().catch(() => {});
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = getPickerAsset(result);
      if (!asset) return;
      validateAudioLessonFile(asset.name, asset.mimeType, asset.size);
      let durationSeconds = 0;
      try {
        const sound = new Audio.Sound();
        await sound.loadAsync({ uri: asset.uri }, {}, false);
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) durationSeconds = Math.round(status.durationMillis / 1000);
        await sound.unloadAsync();
      } catch {}
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      setRecordingState("idle");
      setRecordingDuration(0);
      setRecordedAudioUri("");
      setRecordedAudioSize(0);
      setSelectedAudioUpload(asset);
      setSelectedAudioDuration(durationSeconds);
      if (!audioTitle.trim()) setAudioTitle(asset.name.replace(/\.[^.]+$/, ""));
      setAudioUploadError("");
    } catch (e: any) {
      Alert.alert("Audio file rejected", e?.message || "Please choose an MP3, M4A, or AAC file.");
    }
  };

  const saveAudioLesson = async () => {
    if (!courseId || !user?.uid) return;
    if (!audioTitle.trim()) {
      Alert.alert("Title required", "Please enter an audio lesson title.");
      return;
    }
    if (!editingAudioLesson && !selectedAudioUpload && !recordedAudioUri) {
      Alert.alert("Audio required", "Please record audio in the app or choose an MP3, M4A, or AAC file to upload.");
      return;
    }
    if (!editingAudioLesson && recordingState === "recording") {
      Alert.alert("Stop recording first", "Please stop the recording before uploading it.");
      return;
    }
    setAudioUploading(true);
    setAudioUploadError("");
    try {
      if (editingAudioLesson) {
        await updateAudioLesson(editingAudioLesson.id, { title: audioTitle, description: audioDescription });
      } else {
        const source = selectedAudioUpload
          ? {
            uri: selectedAudioUpload.uri,
            name: selectedAudioUpload.name,
            mimeType: selectedAudioUpload.mimeType,
            size: selectedAudioUpload.size,
            duration: selectedAudioDuration,
          }
          : {
            uri: recordedAudioUri,
            name: `${audioTitle.trim().replace(/[^A-Za-z0-9._-]/g, "_") || "recorded_lesson"}.m4a`,
            mimeType: "audio/mp4",
            size: recordedAudioSize,
            duration: recordingDuration,
          };
        await uploadAudioLesson({
          courseId,
          teacherId: user.uid,
          title: audioTitle,
          description: audioDescription,
          duration: source.duration,
          uri: source.uri,
          fileName: source.name,
          mimeType: source.mimeType,
          fileSize: source.size,
        }, setAudioUploadProgress);
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
          "No built-in live class is active right now. Open the temporary Google Meet fallback?",
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

  const handleStartLiveClass = async () => {
    if (!course || !user?.uid || !profile) return;
    if (profile.role !== "teacher" && profile.role !== "admin") {
      Alert.alert("Access denied", "Only teachers/admins can start live classes.");
      return;
    }
    setStartingLiveClass(true);
    try {
      const classId = await startLiveClass({
        courseId: course.id,
        title: course.name,
        teacherId: user.uid,
        teacherName: profile.name || user.email || "Teacher",
        meetFallbackUrl: meetLink,
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
      setSelectedUpload(
        current?.file_url
          ? { uri: current.file_url, name: "Existing file" }
          : null,
      );
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

  const pickSubmissionFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/*",
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const file = picked.assets?.[0];
      if (!file?.uri) return;
      const mimeType = String(file.mimeType || "").toLowerCase().trim();
      if (!ALLOWED_ASSIGNMENT_MIME_TYPES.has(mimeType)) {
        Alert.alert(
          "Unsupported file",
          "Please upload a PDF, DOC, DOCX, JPG, PNG, or WebP file.",
        );
        return;
      }
      if ((file.size || 0) <= 0) {
        Alert.alert("Invalid file", "Selected file is empty.");
        return;
      }
      if ((file.size || 0) > MAX_ASSIGNMENT_UPLOAD_BYTES) {
        Alert.alert("File too large", "Maximum assignment file size is 10MB.");
        return;
      }
      setSelectedUpload({
        uri: file.uri,
        name: sanitizeFileName(file.name),
        mimeType,
      });
      setExternalFileUrl("");
    } catch (e) {
      console.log("[CourseDetail] pickSubmissionFile ERROR:", e);
      Alert.alert("Error", "Unable to select a file right now.");
    }
  };

  const submitAssignmentHandler = async () => {
    if (!activeAssignmentId) return;
    if (!submissionText.trim() && !selectedUpload && !externalFileUrl.trim()) {
      Alert.alert(
        "Missing data",
        "Please add a text answer, image upload, or file URL.",
      );
      return;
    }
    setSubmittingAssignment(true);
    try {
      console.log("[CourseDetail] submitAssignmentHandler started", {
        activeAssignmentId,
      });
      let fileUrl = "";
      if (externalFileUrl.trim()) {
        fileUrl = externalFileUrl.trim();
      } else if (selectedUpload?.uri) {
        if (!selectedUpload.uri.trim()) {
          throw new Error("Invalid file URI for upload.");
        }
        fileUrl = selectedUpload.uri;
        if (!selectedUpload.uri.startsWith("http")) {
          setAssignmentUploadProgress(0);
          const safeName = sanitizeFileName(selectedUpload.name);
          const storageFileName = `${Date.now()}_${safeName}`;
          fileUrl = await uploadUriFile({
            uri: selectedUpload.uri,
            path: `assignment_submissions/${user?.uid || "anonymous"}/${storageFileName}`,
            contentType: selectedUpload.mimeType,
            maxBytes: MAX_ASSIGNMENT_UPLOAD_BYTES,
            customMetadata: {
              upload_context: "assignment_submission",
              user_id: user?.uid || "anonymous",
              assignment_id: activeAssignmentId,
            },
            onProgress: setAssignmentUploadProgress,
          });
        }
      }
      const ok = await submitAssignment({
        assignmentId: activeAssignmentId,
        textAnswer: submissionText.trim(),
        fileUrl,
      });
      if (ok) {
        Alert.alert("Submitted", "Assignment submitted successfully.");
        setSubmissionModalVisible(false);
        setAssignmentUploadProgress(0);
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
          <View style={styles.heroGradient} />
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

        <View style={styles.body}>
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
              <Text style={styles.teacherLabel}>Instructor</Text>
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

          <View style={styles.infoCard} testID="course-detail-schedule">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.infoCardTitle}>Schedule</Text>
            </View>
            <Text style={styles.infoCardValue}>
              {course.schedule || "Schedule to be announced"}
            </Text>
            <Text style={styles.infoCardSubValue}>
              {classTimeLabel || "Time to be announced"}
            </Text>
          </View>

          <View style={styles.infoCard} testID="course-detail-meet-link">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="videocam-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.infoCardTitle}>Temporary Google Meet Fallback</Text>
            </View>
            <Text style={styles.infoCardValue} numberOfLines={2}>
              {meetLink || "Meet link will be shared by teacher"}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="mic-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Recordings</Text>
            </View>
            {generalRecordings.length === 0 ? (
              <Text style={styles.infoCardSubValue}>No recordings yet.</Text>
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

          <View style={styles.infoCard} testID="course-audio-lessons">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="headset-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>Audio Lessons</Text>
                <Text style={styles.infoCardSubValue}>Teacher-uploaded lectures for revision</Text>
              </View>
              {isReviewer ? (
                <View style={styles.audioHeaderActions}>
                  <TouchableOpacity style={styles.audioUploadBtn} onPress={openAudioRecordingModal}>
                    <Ionicons name="mic-outline" size={16} color={COLORS.goldText} />
                    <Text style={styles.audioUploadBtnText}>Record</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.audioUploadBtn} onPress={openAudioUploadModal}>
                    <Ionicons name="cloud-upload-outline" size={16} color={COLORS.goldText} />
                    <Text style={styles.audioUploadBtnText}>Upload</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <TextInput
              value={audioSearch}
              onChangeText={setAudioSearch}
              placeholder="Search audio lessons by title"
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
              <Text style={styles.infoCardSubValue}>No audio lessons yet. Teachers can upload MP3, M4A, or AAC lectures after class.</Text>
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

          <View style={styles.infoCard} testID="course-learning-structure">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="layers-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.infoCardTitle}>Learning Path</Text>
            </View>
            {safeModules.length === 0 ? (
              <Text style={styles.infoCardSubValue}>No modules added yet.</Text>
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
              {course.description || "Course details coming soon."}
            </Text>
          </View>

          {showJoinNow || activeLiveClass ? (
            <View style={styles.liveClassActions}>
              {isReviewer ? (
                <TouchableOpacity
                  style={[styles.startLiveBtn, startingLiveClass && styles.disabledBtn]}
                  activeOpacity={0.8}
                  disabled={startingLiveClass}
                  onPress={activeLiveClass ? () => safePushLiveClass(activeLiveClass.id) : handleStartLiveClass}
                >
                  {startingLiveClass ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name={activeLiveClass ? "radio" : "videocam"} size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.joinBtnText}>{activeLiveClass ? "Open Live Class" : "Start Live Class"}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.joinBtn, activeLiveClass && styles.liveNowBtn]}
                testID="join-class-btn"
                activeOpacity={0.8}
                onPress={handleJoinClass}
              >
                <Ionicons name={activeLiveClass ? "radio" : "videocam"} size={20} color="#FFFFFF" />
                <Text style={styles.joinBtnText}>{activeLiveClass ? "Join Live Class" : "Join Class"}</Text>
              </TouchableOpacity>
              {meetLink ? (
                <TouchableOpacity style={styles.meetFallbackBtn} onPress={() => { void openExternalLink(meetLink); }}>
                  <Text style={styles.meetFallbackText}>Temporary Google Meet fallback</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.joinLaterCard}>
              <Text style={styles.infoCardSubValue}>
                Next class at {classTimeLabel}. Join button appears 1 hour
                before class.
              </Text>
            </View>
          )}
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
            <TouchableOpacity
              style={styles.secondaryModalBtn}
              onPress={pickSubmissionFile}
            >
              <Text style={styles.secondaryModalBtnText}>
                {selectedUpload
                  ? `Image: ${selectedUpload.name}`
                  : "Upload Image"}
              </Text>
            </TouchableOpacity>
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
              {submittingAssignment && assignmentUploadProgress > 0 ? (
                <Text style={styles.assignmentUploadProgress}>
                  Uploading file... {Math.round(assignmentUploadProgress * 100)}
                  %
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={submitAssignmentHandler}
                disabled={submittingAssignment}
              >
                {submittingAssignment ? (
                  <ActivityIndicator size="small" color="#fff" />
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
                  <ActivityIndicator size="small" color="#fff" />
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
              <View style={styles.recorderPanel}>
                <Text style={styles.recorderTitle}>Record directly in the app (M4A)</Text>
                <Text style={styles.recorderTimer}>{formatAudioDuration(recordingDuration)}</Text>
                <View style={styles.recorderButtonRow}>
                  {recordingState === "idle" || recordingState === "stopped" ? (
                    <TouchableOpacity style={styles.recorderPrimaryBtn} onPress={startInAppRecording} disabled={audioUploading}>
                      <Ionicons name="mic" size={16} color="#fff" />
                      <Text style={styles.recorderPrimaryText}>Start Recording</Text>
                    </TouchableOpacity>
                  ) : null}
                  {recordingState === "recording" ? (
                    <TouchableOpacity style={styles.recorderSecondaryBtn} onPress={pauseInAppRecording} disabled={audioUploading}>
                      <Ionicons name="pause" size={16} color={COLORS.primary} />
                      <Text style={styles.recorderSecondaryText}>Pause</Text>
                    </TouchableOpacity>
                  ) : null}
                  {recordingState === "paused" ? (
                    <TouchableOpacity style={styles.recorderSecondaryBtn} onPress={resumeInAppRecording} disabled={audioUploading}>
                      <Ionicons name="play" size={16} color={COLORS.primary} />
                      <Text style={styles.recorderSecondaryText}>Resume</Text>
                    </TouchableOpacity>
                  ) : null}
                  {recordingState === "recording" || recordingState === "paused" ? (
                    <TouchableOpacity style={styles.recorderStopBtn} onPress={stopInAppRecording} disabled={audioUploading}>
                      <Ionicons name="stop" size={16} color="#fff" />
                      <Text style={styles.recorderStopText}>Stop</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {recordedAudioUri ? (
                  <Text style={styles.infoCardSubValue}>Recorded M4A ready • {formatAudioDuration(recordingDuration)} • {formatFileSize(recordedAudioSize)}</Text>
                ) : (
                  <Text style={styles.infoCardSubValue}>If the app goes to background, recording pauses automatically to protect the file.</Text>
                )}
              </View>
            ) : null}
            {!editingAudioLesson ? (
              <>
                <TouchableOpacity style={styles.secondaryModalBtn} onPress={pickAudioFile} disabled={audioUploading || recordingState === "recording"}>
                  <Text style={styles.secondaryModalBtnText}>
                    {selectedAudioUpload ? selectedAudioUpload.name : "Choose MP3, M4A, or AAC file"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.infoCardSubValue}>Recommended max size: {Math.round(AUDIO_LESSON_MAX_BYTES / (1024 * 1024))} MB. Detected duration: {formatAudioDuration(selectedAudioDuration)}</Text>
              </>
            ) : null}
            {audioUploading ? (
              <Text style={styles.assignmentUploadProgress}>Uploading audio... {Math.round(audioUploadProgress * 100)}%</Text>
            ) : null}
            {audioUploadError ? (
              <View style={styles.retryBox}>
                <Text style={styles.errorTextSmall}>{audioUploadError}</Text>
                {!editingAudioLesson && selectedAudioUpload ? (
                  <TouchableOpacity style={styles.secondaryModalBtn} onPress={saveAudioLesson} disabled={audioUploading}>
                    <Text style={styles.secondaryModalBtnText}>Retry Upload</Text>
                  </TouchableOpacity>
                ) : null}
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
                {audioUploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>{editingAudioLesson ? "Save" : "Upload"}</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
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

  heroWrapper: { position: "relative", height: 270 },
  heroImage: { width: "100%", height: "100%" },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,78,59,0.68)",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  heroContent: { position: "absolute", left: 20, right: 20, bottom: 24 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },

  body: { padding: SPACING.lg, gap: SPACING.md },

  teacherCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 12,
    ...SHADOWS.card,
  },
  teacherAvatar: { width: 48, height: 48, borderRadius: 24 },
  teacherInfo: { flex: 1 },
  teacherLabel: { color: COLORS.textMuted, fontSize: 12 },
  teacherNameText: { color: COLORS.textMain, fontSize: 15, fontWeight: "700" },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
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
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 8,
  },
  lessonRowDone: { borderColor: "#CFE9DB", backgroundColor: "#F7FBF9" },
  lessonTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  lessonMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  lessonDetailCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
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
    borderRadius: RADIUS.lg,
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
    paddingHorizontal: 12,
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
    padding: 8,
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
    borderRadius: RADIUS.lg,
    padding: 12,
  },

  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
  },
  audioPlayerCard: {
    borderWidth: 1,
    borderColor: "#B7E4CC",
    borderRadius: RADIUS.lg,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  audioLessonRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
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
    borderRadius: RADIUS.lg,
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recorderSecondaryText: { color: COLORS.primary, fontWeight: "800", fontSize: 12 },
  recorderStopBtn: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.error,
    paddingHorizontal: 12,
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
    borderRadius: 18,
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
});
