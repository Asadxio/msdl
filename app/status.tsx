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
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
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
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { isHttpsUrl, uploadUriFile } from "@/lib/storage";
import { ReportReasonModal } from "@/components/ReportReasonModal";
import { submitUgcReport, type ReportReason } from "@/lib/ugcReports";
import { getListenerMetrics, stableQueryKey, subscribeDeduped } from "@/lib/queryPerformance";
import { trackPerformanceMetric } from "@/lib/performanceEngine";

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
  media_type?: "image" | "video" | "";
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
  const [statusMedia, setStatusMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cleaningExpired, setCleaningExpired] = useState(false);
  const [audience, setAudience] = useState<"everyone" | "teachers" | "students">("students");
  const [seenTracker, setSeenTracker] = useState<Record<string, boolean>>({});
  const [commentsByStatus, setCommentsByStatus] = useState<Record<string, StatusComment[]>>({});
  const [expandedStatusId, setExpandedStatusId] = useState("");
  const [reportStatusTarget, setReportStatusTarget] = useState<StatusItem | null>(null);
  const prefetchQueueRef = useRef<string[]>([]);
  const prefetchInFlightRef = useRef(0);

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
                  : "",
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

  const postStatus = async () => {
    console.log("[Status] Post button clicked");
    if (!canPostStatus || !user?.uid || !profile) return;
    if (!statusText.trim() && !statusMedia?.uri) {
      Alert.alert("Missing content", "Please add text, image, or video.");
      return;
    }
    setPosting(true);
    try {
      let mediaUrl = "";
      let mediaType: "" | "image" | "video" = "";
      if (statusMedia?.uri) {
        setUploadingMedia(true);
        setUploadProgress(0);
        const extension = statusMedia.type === "video" ? "mp4" : "jpg";
        const contentType =
          statusMedia.type === "video" ? "video/mp4" : "image/jpeg";
        const storagePath = `status_updates/${user.uid}/${Date.now()}.${extension}`;
        mediaUrl = await uploadUriFile({
          uri: statusMedia.uri,
          path: storagePath,
          contentType,
          onProgress: setUploadProgress,
        });
        if (!isHttpsUrl(mediaUrl)) {
          throw new Error("Media upload did not return a valid HTTPS URL.");
        }
        mediaType = statusMedia.type;
      }
      await addDoc(collection(db, "status_updates"), {
        user_id: user.uid,
        user_name: profile.name || "Teacher",
        role: profile.role === "admin" ? "admin" : "teacher",
        text: statusText.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
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
      setStatusMedia(null);
      setUploadProgress(0);
    } catch (error) {
      console.log("[Status] postStatus ERROR", error);
      Alert.alert("Post failed", "Could not post status right now.");
    } finally {
      setUploadingMedia(false);
      setPosting(false);
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
    if (STATUS_API_URL && auth.currentUser) {
      const token = await auth.currentUser.getIdToken().catch(() => "");
      if (token) {
        const response = await fetch(`${STATUS_API_URL}/api/status/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status_id: item.id, reaction: emoji }),
        }).catch(() => null);
        if (response?.ok) return;
      }
    }
    const reactionRef = doc(db, "status_updates", item.id, "reactions", user.uid);
    const prevSnap = await getDoc(reactionRef).catch(() => null);
    const prevReaction = prevSnap?.exists() ? String((prevSnap.data() as any).reaction || "") : "";
    if (prevReaction === emoji) return;
    const updates: Record<string, any> = {};
    if (prevReaction) updates[`reaction_counts.${prevReaction}`] = increment(-1);
    updates[`reaction_counts.${emoji}`] = increment(1);
    await setDoc(reactionRef, { reaction: emoji, user_id: user.uid, updated_at: serverTimestamp() }, { merge: true });
    await updateDoc(doc(db, "status_updates", item.id), updates).catch(() => Alert.alert("Reaction failed", "Could not react right now."));
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

  const pickStatusMedia = async () => {
    try {
      console.log("[Status] Pick media button clicked");
      const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log(
        "[Status] Existing media permission",
        existing?.status,
        existing?.granted,
      );
      if (!existing.granted && !existing.canAskAgain) {
        Alert.alert(
          "Permission blocked",
          "Enable gallery permission from settings to upload status media.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ],
        );
        return;
      }
      const permission = existing.granted
        ? existing
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log(
        "[Status] Requested media permission",
        permission?.status,
        permission?.granted,
      );
      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Gallery permission is required to upload status media.",
        );
        return;
      }
      let result: ImagePicker.ImagePickerResult;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.7,
        });
      } catch (pickerError: any) {
        console.log("[Status] Native picker launch ERROR", pickerError);
        Alert.alert(
          "Error",
          pickerError?.message || "Unable to open gallery right now.",
        );
        return;
      }
      console.log("[Status] Picker result", {
        canceled: result.canceled,
        assetsCount: result?.assets?.length || 0,
      });
      if (result.canceled) return;
      const asset = result?.assets?.[0];
      if (!asset?.uri || (typeof asset.uri === "string" && !asset.uri.trim())) {
        Alert.alert(
          "Invalid media",
          "Selected media is missing a valid file path.",
        );
        return;
      }
      const mediaType = asset.type === "video" ? "video" : "image";
      setStatusMedia({ uri: asset.uri, type: mediaType });
    } catch (error) {
      console.log("[Status] pickStatusMedia ERROR", error);
      Alert.alert("Error", "Unable to open gallery right now.");
    }
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
          {statusMedia?.uri ? (
            <View style={styles.previewRow}>
              {statusMedia.type === "image" ? (
                <Image
                  source={{ uri: statusMedia.uri }}
                  style={styles.previewImage}
                />
              ) : (
                <View style={styles.previewVideo}>
                  <Ionicons name="videocam" size={18} color={COLORS.primary} />
                  <Text style={styles.previewVideoText}>Video selected</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setStatusMedia(null)}>
                <Text style={styles.clearMediaText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity style={styles.ghostBtn} onPress={pickStatusMedia}>
            <Text style={styles.ghostBtnText}>Add Image / Video</Text>
          </TouchableOpacity>
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
            disabled={posting || uploadingMedia}
          >
            {posting || uploadingMedia ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Post Status</Text>
            )}
          </TouchableOpacity>
          {uploadingMedia ? (
            <Text style={styles.uploadingText}>
              Uploading media... {Math.round(uploadProgress * 100)}%
            </Text>
          ) : null}
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
              <Text style={styles.cardName}>{item.user_name}</Text>
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
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setReportStatusTarget(item)}><Text style={styles.ghostBtnText}>Report</Text></TouchableOpacity>
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
    minHeight: 70,
    textAlignVertical: "top",
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
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnSmall: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
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
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
  },
  previewVideo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewVideoText: { fontSize: 12, color: COLORS.textMain, fontWeight: "600" },
  clearMediaText: { fontSize: 12, fontWeight: "700", color: COLORS.error },
  statusImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
  videoBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
});
