import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, Linking, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type StatusComment = {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at_ms: number;
};

type StatusItem = {
  id: string;
  user_id: string;
  user_name: string;
  role: 'teacher' | 'student' | 'admin';
  text: string;
  media_url?: string;
  media_type?: 'image' | 'video' | '';
  created_at?: { toDate?: () => Date };
  likes?: string[];
  comments?: StatusComment[];
  views?: string[]; // Track unique viewers by user_id
  view_count?: number;
};

const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000;

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const canPostStatus = profile?.role === 'teacher' || profile?.role === 'admin';
  const isStudent = profile?.role === 'student';

  const [statusText, setStatusText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StatusItem[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState('');
  const [statusMedia, setStatusMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const q = query(collection(db, 'status_updates'), orderBy('created_at', 'desc'));
      unsub = onSnapshot(q, async (snap) => {
        try {
          const now = Date.now();
          const next: StatusItem[] = [];
          const expiredIds: string[] = [];
          snap.forEach((d) => {
            try {
              const data = d.data() as any;
              const createdAt = data?.created_at?.toDate ? data.created_at.toDate().getTime() : 0;
              if (!createdAt || now - createdAt > STATUS_EXPIRY_MS) {
                expiredIds.push(d.id);
                return;
              }
              next.push({
                id: d.id,
                user_id: String(data?.user_id || ''),
                user_name: String(data?.user_name || 'Teacher'),
                role: data?.role || 'teacher',
                text: String(data?.text || ''),
                media_url: typeof data?.media_url === 'string' ? data.media_url : '',
                media_type: data?.media_type === 'video' ? 'video' : data?.media_type === 'image' ? 'image' : '',
                created_at: data?.created_at || null,
                likes: Array.isArray(data?.likes) ? data.likes : [],
                comments: Array.isArray(data?.comments) ? data.comments : [],
                views: Array.isArray(data?.views) ? data.views : [],
                view_count: Array.isArray(data?.views) ? data.views.length : 0,
              });
            } catch (e) {
              console.log('[Status] Item parse ERROR:', e);
            }
          });
          setItems(Array.isArray(next) ? next : []);
          setLoading(false);

          if ((profile?.role === 'admin' || profile?.role === 'teacher') && expiredIds.length > 0) {
            await Promise.all(expiredIds.map((statusId) => deleteDoc(doc(db, 'status_updates', statusId)).catch((e) => console.log('[Status] Delete expired ERROR:', e))));
          }
        } catch (e) {
          console.log('[Status] onSnapshot inner ERROR:', e);
          setItems([]);
          setLoading(false);
        }
      }, (error) => {
        console.log('[Status] onSnapshot ERROR', error);
        setLoading(false);
      });
    } catch (e) {
      console.log('[Status] useEffect setup ERROR:', e);
      setLoading(false);
    }
    return () => { if (unsub) unsub(); };
  }, [profile?.role]);

  const postStatus = async () => {
    console.log('[Status] Post button clicked');
    if (!canPostStatus || !user?.uid || !profile) return;
    if (!statusText.trim() && !statusMedia?.uri) {
      Alert.alert('Missing content', 'Please add text, image, or video.');
      return;
    }
    setPosting(true);
    try {
      await addDoc(collection(db, 'status_updates'), {
        user_id: user.uid,
        user_name: profile.name || 'Teacher',
        role: profile.role === 'admin' ? 'admin' : 'teacher',
        text: statusText.trim(),
        media_url: statusMedia?.uri || '',
        media_type: statusMedia?.type || '',
        likes: [],
        comments: [],
        created_at: serverTimestamp(),
      });
      setStatusText('');
      setStatusMedia(null);
    } catch (error) {
      console.log('[Status] postStatus ERROR', error);
      Alert.alert('Post failed', 'Could not post status right now.');
    } finally {
      setPosting(false);
    }
  };

  const pickStatusMedia = async () => {
    try {
      console.log('[Status] Pick media button clicked');
      const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log('[Status] Existing media permission', existing?.status, existing?.granted);
      if (!existing.granted && !existing.canAskAgain) {
        Alert.alert('Permission blocked', 'Enable gallery permission from settings to upload status media.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
        ]);
        return;
      }
      const permission = existing.granted ? existing : await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Status] Requested media permission', permission?.status, permission?.granted);
      if (!permission.granted) {
        Alert.alert('Permission required', 'Gallery permission is required to upload status media.');
        return;
      }
      let result: ImagePicker.ImagePickerResult;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.7,
        });
      } catch (pickerError: any) {
        console.log('[Status] Native picker launch ERROR', pickerError);
        Alert.alert('Error', pickerError?.message || 'Unable to open gallery right now.');
        return;
      }
      console.log('[Status] Picker result', { canceled: result.canceled, assetsCount: result?.assets?.length || 0 });
      if (result.canceled) return;
      const asset = result?.assets?.[0];
      if (!asset?.uri) return;
      const mediaType = asset.type === 'video' ? 'video' : 'image';
      setStatusMedia({ uri: asset.uri, type: mediaType });
    } catch (error) {
      console.log('[Status] pickStatusMedia ERROR', error);
      Alert.alert('Error', 'Unable to open gallery right now.');
    }
  };

  const toggleLike = async (item: StatusItem) => {
    if (!isStudent || !user?.uid || !item?.id) return;
    setUpdatingId(item.id);
    try {
      const safeItemLikes = Array.isArray(item?.likes) ? item.likes : [];
      const liked = safeItemLikes.includes(user.uid);
      await updateDoc(doc(db, 'status_updates', item.id), {
        likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (e) {
      console.log('[Status] toggleLike ERROR:', e);
      Alert.alert('Update failed', 'Could not update like.');
    } finally {
      setUpdatingId('');
    }
  };

  const addComment = async (item: StatusItem) => {
    if (!isStudent || !user?.uid || !profile || !item?.id) return;
    const text = (commentInputs[item.id] || '').trim();
    if (!text) return;
    setUpdatingId(item.id);
    try {
      const comment: StatusComment = {
        id: `${user.uid}_${Date.now()}`,
        user_id: user.uid,
        user_name: profile?.name || 'Student',
        text,
        created_at_ms: Date.now(),
      };
      await updateDoc(doc(db, 'status_updates', item.id), {
        comments: arrayUnion(comment),
      });
      setCommentInputs((prev) => ({ ...prev, [item.id]: '' }));
    } catch (e) {
      console.log('[Status] addComment ERROR:', e);
      Alert.alert('Comment failed', 'Could not add comment.');
    } finally {
      setUpdatingId('');
    }
  };

  // Track view when status is displayed (for students)
  const trackView = async (item: StatusItem) => {
    if (!user?.uid || !item?.id || item?.user_id === user.uid) return; // Don't track own views
    try {
      const safeViews = Array.isArray(item?.views) ? item.views : [];
      const alreadyViewed = safeViews.includes(user.uid);
      if (alreadyViewed) return;
      
      await updateDoc(doc(db, 'status_updates', item.id), {
        views: arrayUnion(user.uid),
      });
    } catch (error) {
      console.log('[Status] trackView ERROR', error);
    }
  };

  // Track views when items change
  useEffect(() => {
    if (!user?.uid) return;
    const safeItems = Array.isArray(items) ? items : [];
    if (!safeItems.length) return;
    // Track view for all visible statuses
    safeItems.forEach((item) => {
      try {
        trackView(item);
      } catch (e) {
        console.log('[Status] trackView forEach ERROR:', e);
      }
    });
  }, [items, user?.uid]);

  const visibleItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Status</Text>
          <Text style={styles.subtitle}>Teacher updates disappear after 24 hours</Text>
        </View>
      </View>

      {canPostStatus ? (
        <View style={styles.composeCard}>
          <Text style={styles.composeTitle}>Post Status ({profile?.role === 'admin' ? 'Admin' : 'Teacher'})</Text>
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
              {statusMedia.type === 'image' ? (
                <Image source={{ uri: statusMedia.uri }} style={styles.previewImage} />
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
          <TouchableOpacity style={styles.primaryBtn} onPress={postStatus} disabled={posting}>
            {posting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Post Status</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardName}>{item.user_name}</Text>
              {item.text ? <Text style={styles.cardText}>{item.text}</Text> : null}
              {item.media_url ? (
                item.media_type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={16} color={COLORS.primary} />
                    <Text style={styles.cardMeta}>Video status</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.media_url }} style={styles.statusImage} />
                )
              ) : null}
              <Text style={styles.cardMeta}>
                {item.created_at?.toDate ? item.created_at.toDate().toLocaleString() : 'Just now'}
              </Text>
              <View style={styles.row}>
                <View style={styles.statRow}>
                  <Ionicons name="eye-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.cardMeta}>{item.view_count || 0} views</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="heart-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.cardMeta}>{(item.likes || []).length} likes</Text>
                </View>
                <View style={styles.statRow}>
                  <Ionicons name="chatbubble-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.cardMeta}>{(item.comments || []).length}</Text>
                </View>
              </View>

              {isStudent ? (
                <>
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => toggleLike(item)} disabled={updatingId === item.id}>
                      <Text style={styles.ghostBtnText}>{(item.likes || []).includes(user?.uid || '') ? 'Unlike' : 'Like'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.commentRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, minHeight: 42 }]}
                      value={commentInputs[item.id] || ''}
                      onChangeText={(text) => setCommentInputs((prev) => ({ ...prev, [item.id]: text }))}
                      placeholder="Add comment..."
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => addComment(item)} disabled={updatingId === item.id}>
                      <Text style={styles.primaryBtnText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {(Array.isArray(item?.comments) ? item.comments : []).slice(-3).map((comment) => (
                <Text key={comment?.id || Math.random().toString()} style={styles.commentText}>• {comment?.user_name || 'User'}: {comment?.text || ''}</Text>
              ))}
            </View>
          )}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>No active status updates.</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  composeCard: { margin: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card, gap: 8 },
  composeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 9, color: COLORS.textMain, backgroundColor: COLORS.surfaceAlt, minHeight: 70, textAlignVertical: 'top' },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 24 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.card, gap: 6 },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  cardText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  cardMeta: { fontSize: 11, color: COLORS.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: { borderRadius: RADIUS.md, backgroundColor: COLORS.primary, paddingVertical: 10, alignItems: 'center' },
  primaryBtnSmall: { borderRadius: RADIUS.md, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  ghostBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surfaceAlt },
  ghostBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  commentText: { fontSize: 12, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, fontSize: 13 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.surfaceAlt },
  previewVideo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  previewVideoText: { fontSize: 12, color: COLORS.textMain, fontWeight: '600' },
  clearMediaText: { fontSize: 12, fontWeight: '700', color: COLORS.error },
  statusImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: COLORS.surfaceAlt },
  videoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
