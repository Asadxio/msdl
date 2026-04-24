import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  created_at?: { toDate?: () => Date };
  likes?: string[];
  comments?: StatusComment[];
};

const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000;

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';

  const [statusText, setStatusText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StatusItem[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'status_updates'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const now = Date.now();
      const next: StatusItem[] = [];
      const expiredIds: string[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const createdAt = data.created_at?.toDate ? data.created_at.toDate().getTime() : 0;
        if (!createdAt || now - createdAt > STATUS_EXPIRY_MS) {
          expiredIds.push(d.id);
          return;
        }
        next.push({
          id: d.id,
          user_id: data.user_id || '',
          user_name: data.user_name || 'Teacher',
          role: data.role || 'teacher',
          text: data.text || '',
          created_at: data.created_at || null,
          likes: Array.isArray(data.likes) ? data.likes : [],
          comments: Array.isArray(data.comments) ? data.comments : [],
        });
      });
      setItems(next);
      setLoading(false);

      if ((profile?.role === 'admin' || profile?.role === 'teacher') && expiredIds.length > 0) {
        await Promise.all(expiredIds.map((id) => deleteDoc(doc(db, 'status_updates', id)).catch(() => {})));
      }
    }, () => setLoading(false));
    return unsub;
  }, [profile?.role]);

  const postStatus = async () => {
    if (!isTeacher || !user?.uid || !profile) return;
    if (!statusText.trim()) {
      Alert.alert('Missing text', 'Please write a status update.');
      return;
    }
    setPosting(true);
    try {
      await addDoc(collection(db, 'status_updates'), {
        user_id: user.uid,
        user_name: profile.name || 'Teacher',
        role: 'teacher',
        text: statusText.trim(),
        likes: [],
        comments: [],
        created_at: serverTimestamp(),
      });
      setStatusText('');
    } catch {
      Alert.alert('Post failed', 'Could not post status right now.');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (item: StatusItem) => {
    if (!isStudent || !user?.uid) return;
    setUpdatingId(item.id);
    try {
      const liked = (item.likes || []).includes(user.uid);
      await updateDoc(doc(db, 'status_updates', item.id), {
        likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch {
      Alert.alert('Update failed', 'Could not update like.');
    } finally {
      setUpdatingId('');
    }
  };

  const addComment = async (item: StatusItem) => {
    if (!isStudent || !user?.uid || !profile) return;
    const text = (commentInputs[item.id] || '').trim();
    if (!text) return;
    setUpdatingId(item.id);
    try {
      const comment: StatusComment = {
        id: `${user.uid}_${Date.now()}`,
        user_id: user.uid,
        user_name: profile.name || 'Student',
        text,
        created_at_ms: Date.now(),
      };
      await updateDoc(doc(db, 'status_updates', item.id), {
        comments: arrayUnion(comment),
      });
      setCommentInputs((prev) => ({ ...prev, [item.id]: '' }));
    } catch {
      Alert.alert('Comment failed', 'Could not add comment.');
    } finally {
      setUpdatingId('');
    }
  };

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

      {isTeacher ? (
        <View style={styles.composeCard}>
          <Text style={styles.composeTitle}>Post Status (Teacher)</Text>
          <TextInput
            style={styles.input}
            value={statusText}
            onChangeText={setStatusText}
            placeholder="Share update with students..."
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
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
              <Text style={styles.cardText}>{item.text}</Text>
              <Text style={styles.cardMeta}>
                {item.created_at?.toDate ? item.created_at.toDate().toLocaleString() : 'Just now'}
              </Text>
              <View style={styles.row}>
                <Text style={styles.cardMeta}>Likes: {(item.likes || []).length}</Text>
                <Text style={styles.cardMeta}>Comments: {(item.comments || []).length}</Text>
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

              {(item.comments || []).slice(-3).map((comment) => (
                <Text key={comment.id} style={styles.commentText}>• {comment.user_name}: {comment.text}</Text>
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
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: { borderRadius: RADIUS.md, backgroundColor: COLORS.primary, paddingVertical: 10, alignItems: 'center' },
  primaryBtnSmall: { borderRadius: RADIUS.md, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  ghostBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surfaceAlt },
  ghostBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  commentText: { fontSize: 12, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, fontSize: 13 },
});
