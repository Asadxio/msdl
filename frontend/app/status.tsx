import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation";
import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { COLORS, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import { auth, db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/context/AuthContext";
import { ReportReasonModal } from "@/components/ReportReasonModal";
import { submitUgcReport, type ReportReason } from "@/lib/ugcReports";
import { getListenerMetrics, stableQueryKey, subscribeDeduped } from "@/lib/queryPerformance";
import { trackPerformanceMetric } from "@/lib/performanceEngine";
import * as DocumentPicker from "expo-document-picker";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

type StatusComment = {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  text: string;
  created_at_ms: number;
  edited_at?: { toDate?: () => Date };
  deleted?: boolean;
};

type StatusItem = {
  id: string;
  user_id: string;
  user_name: string;
  role: "teacher" | "student" | "admin";
  text: string;
  media_url?: string;
  media_type?: "image" | "video" | "audio" | "";
  audio_title?: string;
  duration_ms?: number;
  created_at?: { toDate?: () => Date };
  likes?: string[];
  comments?: StatusComment[];
  audience?: "everyone" | "teachers" | "students" | "custom";
  audience_user_ids?: string[];
  hidden_user_ids?: string[];
  muted_by?: string[];
  expires_at_ms?: number;
  reaction_counts?: Record<string, number>;
};

const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000;
const STATUS_API_URL = String(
  process.env.EXPO_PUBLIC_PUSH_API_URL
  || process.env.EXPO_PUBLIC_LIVE_API_URL
  || String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, ''),
).replace(/\/$/, '');

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = () => goBackOrReplace(router, "/(tabs)");
  const { user, profile } = useAuth();
  const canPostStatus =
    profile?.role === "teacher" || profile?.role === "admin";
  const isStudent = profile?.role === "student";

  const [statusText, setStatusText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StatusItem[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [updatingId, setUpdatingId] = useState("");
  const [statusMediaUrl, setStatusMediaUrl] = useState("");
  const [selectedAudio, setSelectedAudio] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [audioTitle, setAudioTitle] = useState("تلاوت کلام پاک / Tilawat");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [audience, setAudience] = useState<"everyone" | "teachers" | "students">("students");
  const [seenTracker, setSeenTracker] = useState<Record<string, boolean>>({});
  const [commentsByStatus, setCommentsByStatus] = useState<Record<string, StatusComment[]>>({});
  const [expandedStatusId, setExpandedStatusId] = useState("");
  const [reportStatusTarget, setReportStatusTarget] = useState<StatusItem | null>(null);
  const prefetchQueueRef = useRef<string[]>([]);
  const prefetchInFlightRef = useRef(0);
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "status_updates"),
      orderBy("created_at", "desc"),
    );
    const unsub = subscribeDeduped(
      stableQueryKey(["status_feed", user?.uid || "", profile?.role || ""]),
      q as any,
      async (snap) => {
        const now = Date.now();
        const next: StatusItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const createdAt = data.created_at?.toDate
            ? data.created_at.toDate().getTime()
            : 0;
          const expiresAt = Number(data.expires_at_ms || 0) || (createdAt ? (createdAt + STATUS_EXPIRY_MS) : 0);
          if (!createdAt || (expiresAt > 0 && now > expiresAt)) {
            return;
          }
          const hiddenUsers = Array.isArray(data.hidden_user_ids) ? data.hidden_user_ids : [];
          if (user?.uid && hiddenUsers.includes(user.uid)) return;
          const aud = data.audience === "teachers" || data.audience === "students" || data.audience === "custom" ? data.audience : "everyone";
          const audUsers = Array.isArray(data.audience_user_ids) ? data.audience_user_ids : [];
          const canView = aud === "everyone"
            || (aud === "teachers" && profile?.role === "teacher")
            || (aud === "students" && profile?.role === "student")
            || (aud === "custom" && user?.uid && audUsers.includes(user.uid))
            || profile?.role === "admin";
          if (!canView) return;
          next.push({
            id: d.id,
            user_id: data.user_id || "",
            user_name: data.user_name || "Teacher",
            role: data.role || "teacher",
            text: data.text || "",
            media_url: typeof data.media_url === "string" ? data.media_url : "",
            media_type:
              data.media_type === "video"
                ? "video"
                : data.media_type === "image"
                  ? "image"
                  : data.media_type === "audio"
                    ? "audio"
                    : "",
            audio_title: typeof data.audio_title === "string" ? data.audio_title : undefined,
            duration_ms: typeof data.duration_ms === "number" ? data.duration_ms : undefined,
            created_at: data.created_at || null,
            likes: Array.isArray(data.likes) ? data.likes : [],
            comments: Array.isArray(data.comments) ? data.comments : [],
            audience: aud,
            audience_user_ids: audUsers,
            hidden_user_ids: hiddenUsers,
            muted_by: Array.isArray(data.muted_by) ? data.muted_by : [],
            expires_at_ms: expiresAt,
            reaction_counts: data.reaction_counts && typeof data.reaction_counts === "object" ? data.reaction_counts : {},
          });
        });
        setItems(next);
        setLoading(false);
      },
      (error) => {
        console.log("[Status] onSnapshot ERROR", error);
        setLoading(false);
      },
    );
    return unsub;
  }, [profile?.role, user?.uid]);

  const toggleFeedAudio = async (item: StatusItem) => {
    if (!item.media_url) return;
    try {
      if (playingAudioId === item.id && soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setPlayingAudioId(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: item.media_url },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) {
            if (status.error) setPlayingAudioId(null);
            return;
          }
          if (status.didJustFinish) {
            setPlayingAudioId(null);
          }
        }
      );

      soundRef.current = sound;
      setPlayingAudioId(item.id);
    } catch (err) {
      console.warn("[Status] Audio playback error", err);
      Alert.alert("چلانے میں مسئلہ", "آڈیو لوڈ نہیں ہو سکی۔");
      setPlayingAudioId(null);
    }
  };

  const pickAudioStatus = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const asset = res.assets[0];
      if (asset.size && asset.size > 20 * 1024 * 1024) {
        Alert.alert("فائل بڑی ہے", "آڈیو فائل 20MB سے کم ہونی چاہیے (30 سیکنڈ تلاوت/نعت)۔");
        return;
      }
      setSelectedAudio({
        uri: asset.uri,
        name: asset.name || "Tilawat_30s.m4a",
        size: asset.size,
      });
    } catch (err: any) {
      Alert.alert("آڈیو سلیکشن میں مسئلہ", err?.message || "آڈیو منتخب نہ ہو سکی۔");
    }
  };

  const postStatus = async () => {
    if (__DEV__) {
      console.log("[Status] Post button clicked");
    }
    if (!canPostStatus || !user?.uid || !profile) return;
    if (!statusText.trim() && !statusMediaUrl.trim() && !selectedAudio) {
      Alert.alert("Missing content", "براہ کرم تحریر، آڈیو یا میڈیا لنک شامل کریں۔");
      return;
    }
    setPosting(true);
    try {
      let mediaType: "" | "image" | "video" | "audio" = "";
      let finalMediaUrl = statusMediaUrl.trim();

      if (selectedAudio) {
        setUploadingAudio(true);
        const resp = await fetch(selectedAudio.uri);
        const blob = await resp.blob();
        const cleanName = selectedAudio.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-40);
        const filePath = `status_updates/${user.uid}/${Date.now()}_${cleanName}`;
        const refObj = storageRef(getStorage(), filePath);
        await uploadBytes(refObj, blob, { contentType: "audio/mp4" });
        finalMediaUrl = await getDownloadURL(refObj);
        mediaType = "audio";
      } else if (finalMediaUrl) {
        if (!finalMediaUrl.startsWith("https://")) {
          throw new Error("Media URL must be a valid HTTPS link.");
        }
        if (finalMediaUrl.match(/\.(mp3|m4a|aac|wav|ogg)$/i)) {
          mediaType = "audio";
        } else if (finalMediaUrl.match(/\.(mp4|mov|webm)$/i)) {
          mediaType = "video";
        } else {
          mediaType = "image";
        }
      }

      await addDoc(collection(db, "status_updates"), {
        user_id: user.uid,
        user_name: profile.name || (profile.role === "admin" ? "مدیر اعلیٰ" : "معلمہ محترمہ"),
        role: profile.role === "admin" ? "admin" : "teacher",
        text: statusText.trim(),
        media_url: finalMediaUrl,
        media_type: mediaType,
        audio_title: mediaType === "audio" ? (audioTitle.trim() || "تلاوت کلام پاک / Tilawat") : "",
        duration_ms: mediaType === "audio" ? 30000 : 5000,
        likes: [],
        comments: [],
        audience,
        audience_user_ids: [],
        hidden_user_ids: [],
        muted_by: [],
        reaction_counts: {},
        expires_at_ms: Date.now() + STATUS_EXPIRY_MS,
        created_at: serverTimestamp(),
      });
      setStatusText("");
      setStatusMediaUrl("");
      setSelectedAudio(null);
      setAudioTitle("تلاوت کلام پاک / Tilawat");
    } catch (error: any) {
      console.log("[Status] postStatus ERROR", error);
      Alert.alert("Post failed", error?.message || "Could not post status right now.");
    } finally {
      setPosting(false);
      setUploadingAudio(false);
    }
  };

  const markViewed = async (item: StatusItem) => {
    if (!user?.uid || seenTracker[item.id]) return;
    setSeenTracker((prev) => ({ ...prev, [item.id]: true }));
    await setDoc(doc(db, "status_updates", item.id, "views", user.uid), {
      user_id: user.uid,
      viewed_at: serverTimestamp(),
      viewed_at_ms: Date.now(),
    }, { merge: true }).catch(() => {});
  };

  const reactEmoji = async (item: StatusItem, emoji: "❤️" | "🔥" | "👏") => {
    if (!user?.uid) return;
    try {
      const reactToStatusFn = httpsCallable(functions, 'reactToStatus');
      await reactToStatusFn({ statusId: item.id, reaction: emoji });
    } catch (error) {
      console.error('[status] reactToStatus error:', error);
      // Fallback to direct local optimistic update if needed, but the cloud function will handle it.
    }
  };

  const submitStatusReport = async (reason: ReportReason) => {
    if (!user?.uid || !reportStatusTarget) return;
    const target = reportStatusTarget;
    setReportStatusTarget(null);
    try {
      await submitUgcReport({
        reportedBy: user.uid,
        targetType: "status_post",
        targetId: target.id,
        reason,
        accusedUserId: target.user_id,
        accusedRole: target.role,
        metadata: { audience: target.audience || "public", media_type: target.media_type || "" },
      });
      Alert.alert("Report submitted", "Thank you. An admin will review this status post.");
    } catch {
      Alert.alert("Report failed", "Could not report status.");
    }
  };

  const hideStatus = async (item: StatusItem) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, "status_updates", item.id), {
      hidden_user_ids: arrayUnion(user.uid),
    }).catch(() => {});
  };

  const muteStatus = async (item: StatusItem) => {
    if (!user?.uid) return;
    const muted = (item.muted_by || []).includes(user.uid);
    await updateDoc(doc(db, "status_updates", item.id), {
      muted_by: muted ? arrayRemove(user.uid) : arrayUnion(user.uid),
    }).catch(() => {});
  };


  const toggleLike = async (item: StatusItem) => {
    if (!isStudent || !user?.uid) return;
    setUpdatingId(item.id);
    try {
      const liked = (item.likes || []).includes(user.uid);
      await updateDoc(doc(db, "status_updates", item.id), {
        likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch {
      Alert.alert("Update failed", "Could not update like.");
    } finally {
      setUpdatingId("");
    }
  };

  const addComment = async (item: StatusItem) => {
    if (!isStudent || !user?.uid || !profile) return;
    const text = (commentInputs[item.id] || "").trim();
    if (!text) return;
    setUpdatingId(item.id);
    try {
      const commentId = `${user.uid}_${Date.now()}`;
      const comment: StatusComment = {
        id: commentId,
        user_id: user.uid,
        user_name: profile.name || "Student",
        user_avatar: profile.avatar || profile.photo_url || "",
        text,
        created_at_ms: Date.now(),
        deleted: false,
      };
      await setDoc(doc(db, "status_updates", item.id, "comments", commentId), {
        ...comment,
        created_at: serverTimestamp(),
      });
      setCommentInputs((prev) => ({ ...prev, [item.id]: "" }));
    } catch {
      Alert.alert("Comment failed", "Could not add comment.");
    } finally {
      setUpdatingId("");
    }
  };

  const visibleItems = useMemo(
    () => (Array.isArray(items) ? items : []),
    [items],
  );

  useEffect(() => {
    if (!expandedStatusId) return;
    const q = query(collection(db, "status_updates", expandedStatusId, "comments"), orderBy("created_at_ms", "desc"), limit(40));
    const unsub = subscribeDeduped(stableQueryKey(["status_comments", expandedStatusId]), q as any, (snap) => {
      const arr: StatusComment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setCommentsByStatus((prev) => ({ ...prev, [expandedStatusId]: arr }));
    });
    return unsub;
  }, [expandedStatusId]);

  useEffect(() => {
    if (!__DEV__) return;
    const t = setInterval(() => {
      const lm = getListenerMetrics();
      trackPerformanceMetric("status_feed_listener_metrics", lm.active_subscriptions, { keys: lm.active_keys, prefetch_q: prefetchQueueRef.current.length, prefetch_in_flight: prefetchInFlightRef.current });
    }, 12000);
    return () => clearInterval(t);
  }, []);

  const keyExtractor = useCallback((item: StatusItem) => item.id, []);
  const listEmpty = useMemo(() => <Text style={styles.empty}>No status updates right now.</Text>, []);
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const visible = viewableItems.map((v: any) => v?.item).filter(Boolean) as StatusItem[];
    const candidates = visible.filter((i) => i.media_type === "image" && i.media_url).slice(0, 3);
    candidates.forEach((i) => {
      if (i.media_url && !prefetchQueueRef.current.includes(i.media_url)) prefetchQueueRef.current.push(i.media_url);
    });
    const pump = () => {
      while (prefetchInFlightRef.current < 2 && prefetchQueueRef.current.length > 0) {
        const uri = prefetchQueueRef.current.shift();
        if (!uri) break;
        prefetchInFlightRef.current += 1;
        Image.prefetch(uri).catch(() => {}).finally(() => { prefetchInFlightRef.current = Math.max(0, prefetchInFlightRef.current - 1); pump(); });
      }
    };
    pump();
  }).current;

  const deleteCommentSoft = async (statusId: string, commentId: string, ownerId: string) => {
    if (!user?.uid || ownerId !== user.uid) return;
    await updateDoc(doc(db, "status_updates", statusId, "comments", commentId), {
      deleted: true,
      text: "",
      edited_at: serverTimestamp(),
    }).catch(() => Alert.alert("Delete failed", "Could not delete comment."));
  };

  const deleteStatusUpdate = async (item: StatusItem) => {
    if (!user?.uid || (item.user_id !== user.uid && profile?.role !== "admin")) return;
    Alert.alert("Delete Status", "Are you sure you want to delete this status update?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "status_updates", item.id));
            setItems((prev) => prev.filter((s) => s.id !== item.id));
          } catch {
            Alert.alert("Delete failed", "Could not delete status update.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Status</Text>
          <Text style={styles.subtitle}>
            Teacher updates disappear after 24 hours
          </Text>
        </View>
      </View>

      {canPostStatus ? (
        <View style={styles.composeCard}>
          <Text style={styles.composeTitle}>
            Post Status ({profile?.role === "admin" ? "Admin" : "Teacher"})
          </Text>
          <TextInput
            style={styles.input}
            value={statusText}
            onChangeText={setStatusText}
            placeholder="Share update with students..."
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <TextInput
            style={styles.input}
            value={statusMediaUrl}
            onChangeText={setStatusMediaUrl}
            placeholder="Optional external media URL (https://...)"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />
          {selectedAudio ? (
            <View style={styles.selectedAudioCard}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="musical-notes" size={20} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedAudioTitle} numberOfLines={1}>
                    {selectedAudio.name} (30s Status)
                  </Text>
                  <TextInput
                    style={[styles.input, { minHeight: 36, paddingVertical: 4, marginTop: 4 }]}
                    value={audioTitle}
                    onChangeText={setAudioTitle}
                    placeholder="عنوان: تلاوت / نعت رسول ﷺ"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedAudio(null)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.audioPickBtn} onPress={pickAudioStatus}>
              <Ionicons name="mic" size={18} color="#059669" />
              <Text style={styles.audioPickBtnText}>آڈیو تلاوت / نعت کا 30-سیکنڈ سٹیٹس لگائیں</Text>
            </TouchableOpacity>
          )}
          <View style={styles.row}>
            {(["everyone", "students", "teachers"] as const).map((a) => (
              <TouchableOpacity key={a} style={styles.ghostBtn} onPress={() => setAudience(a)}>
                <Text style={[styles.ghostBtnText, audience === a && { color: COLORS.error }]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={postStatus}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.primaryBtnText}>{uploadingAudio ? "Uploading Tilawat..." : "Post Status"}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={45}
          windowSize={5}
          removeClippedSubviews
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          ListEmptyComponent={listEmpty}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {void markViewed(item)}
              <View style={styles.authorRow}>
                <Text style={styles.cardName}>{item.user_name}</Text>
                {(item.role === "teacher" || item.role === "admin") ? (
                  <View style={styles.ustaadhaBadge}>
                    <Ionicons name="shield-checkmark" size={13} color="#059669" />
                    <Text style={styles.ustaadhaBadgeText}>مستند معلمہ (Ustaadha)</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push({ pathname: "/status-player", params: { itemsJson: JSON.stringify(visibleItems), start: String(visibleItems.findIndex((x) => x.id === item.id)) } } as never)}>
                <Text style={styles.ghostBtnText}>Open story</Text>
              </TouchableOpacity>
              {item.text ? (
                <Text style={styles.cardText}>{item.text}</Text>
              ) : null}
              {item.media_url ? (
                item.media_type === "video" ? (
                  <View style={styles.videoBadge}>
                    <Ionicons
                      name="videocam"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={styles.cardMeta}>Video status</Text>
                  </View>
                ) : item.media_type === "audio" ? (
                  <View style={styles.audioStatusCard}>
                    <View style={styles.audioIconBox}>
                      <Ionicons name="musical-note" size={24} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.audioStatusTitle}>
                        {item.audio_title || "تلاوت کلام پاک / Tilawat Status"}
                      </Text>
                      <Text style={styles.audioStatusSub}>
                        30 سیکنڈ آڈیو تلاوت و نصیحت • مستند معلمہ
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.playAudioBtn}
                      onPress={() => toggleFeedAudio(item)}
                    >
                      <Ionicons
                        name={playingAudioId === item.id ? "pause" : "play"}
                        size={20}
                        color="#ffffff"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Image
                    source={{ uri: item.media_url }}
                    style={styles.statusImage}
                  />
                )
              ) : null}
              <Text style={styles.cardMeta}>
                {item.created_at?.toDate
                  ? item.created_at.toDate().toLocaleString()
                  : "Just now"}
              </Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push(`/status-player?data=${encodeURIComponent(JSON.stringify(visibleItems.map((s) => ({ id: s.id, user_name: s.user_name, text: s.text, media_url: s.media_url, media_type: s.media_type || '' }))))}`)}>
                  <Text style={styles.ghostBtnText}>Open Story Player</Text>
                </TouchableOpacity>
                <Text style={styles.cardMeta}>
                  Likes: {(item.likes || []).length}
                </Text>
                <Text style={styles.cardMeta}>
                  Comments: {(item.comments || []).length}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.cardMeta}>❤️ {item.reaction_counts?.["❤️"] || 0}</Text>
                <Text style={styles.cardMeta}>🔥 {item.reaction_counts?.["🔥"] || 0}</Text>
                <Text style={styles.cardMeta}>👏 {item.reaction_counts?.["👏"] || 0}</Text>
              </View>

              {isStudent ? (
                <>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => toggleLike(item)}
                      disabled={updatingId === item.id}
                    >
                      <Text style={styles.ghostBtnText}>
                        {(item.likes || []).includes(user?.uid || "")
                          ? "Unlike"
                          : "Like"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => reactEmoji(item, "❤️")}><Text style={styles.ghostBtnText}>❤️</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => reactEmoji(item, "🔥")}><Text style={styles.ghostBtnText}>🔥</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => reactEmoji(item, "👏")}><Text style={styles.ghostBtnText}>👏</Text></TouchableOpacity>
                  </View>
                  <View style={styles.commentRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, minHeight: 42 }]}
                      value={commentInputs[item.id] || ""}
                      onChangeText={(text) =>
                        setCommentInputs((prev) => ({
                          ...prev,
                          [item.id]: text,
                        }))
                      }
                      placeholder="Add comment..."
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TouchableOpacity
                      style={styles.primaryBtnSmall}
                      onPress={() => addComment(item)}
                      disabled={updatingId === item.id}
                    >
                      <Text style={styles.primaryBtnText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {(Array.isArray(item.comments) ? item.comments : [])
                .slice(-3)
                .map((comment) => (
                  <Text key={comment.id} style={styles.commentText}>
                    • {comment.user_name}: {comment.text}
                  </Text>
                ))}
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setExpandedStatusId(expandedStatusId === item.id ? "" : item.id)}>
                <Text style={styles.ghostBtnText}>{expandedStatusId === item.id ? "Hide replies" : "View replies"}</Text>
              </TouchableOpacity>
              {expandedStatusId === item.id ? (
                <View style={{ gap: 6 }}>
                  {(commentsByStatus[item.id] || []).map((comment) => (
                    <View key={comment.id} style={styles.row}>
                      <Text style={styles.commentText}>• {comment.user_name}: {comment.deleted ? "Comment deleted" : comment.text}</Text>
                      {comment.user_id === user?.uid && !comment.deleted ? (
                        <TouchableOpacity onPress={() => deleteCommentSoft(item.id, comment.id, comment.user_id)}>
                          <Text style={styles.cardMeta}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.row}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => hideStatus(item)}><Text style={styles.ghostBtnText}>Hide</Text></TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => muteStatus(item)}><Text style={styles.ghostBtnText}>{(item.muted_by || []).includes(user?.uid || "") ? "Unmute" : "Mute"}</Text></TouchableOpacity>
                {item.user_id === user?.uid || profile?.role === "admin" ? (
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => deleteStatusUpdate(item)}><Text style={[styles.ghostBtnText, { color: "#E53E3E" }]}>Delete</Text></TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => setReportStatusTarget(item)}><Text style={styles.ghostBtnText}>Report</Text></TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
      <ReportReasonModal
        visible={!!reportStatusTarget}
        title="Report status post"
        onClose={() => setReportStatusTarget(null)}
        onSelectReason={(reason) => { void submitStatusReport(reason); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceAlt,
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  composeCard: {
    margin: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
    gap: 8,
  },
  composeTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    gap: 6,
  },
  cardName: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  cardText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  cardMeta: { fontSize: 11, color: COLORS.textMuted },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnSmall: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  uploadingText: { fontSize: 12, color: COLORS.textMuted, textAlign: "center" },
  ghostBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceAlt,
  },
  ghostBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  commentText: { fontSize: 12, color: COLORS.textMuted },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  empty: { color: COLORS.textMuted, fontSize: 13 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  previewVideo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewVideoText: { fontSize: 12, color: COLORS.textMain, fontWeight: "600" },
  clearMediaText: { fontSize: 12, fontWeight: "700", color: COLORS.error },
  statusImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
  },
  videoBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  ustaadhaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  ustaadhaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  audioPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
  },
  audioPickBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  selectedAudioCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: RADIUS.lg,
    padding: 10,
  },
  selectedAudioTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  audioStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: RADIUS.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginVertical: 4,
  },
  audioIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  audioStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },
  audioStatusSub: {
    fontSize: 11,
    color: "#15803D",
    marginTop: 2,
  },
  playAudioBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

});
