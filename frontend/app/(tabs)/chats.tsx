import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc, collection, getDocs, onSnapshot, orderBy, query, serverTimestamp, where,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type AppUser = { id: string; name: string; role: string; status: string };
type ChatItem = {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  name?: string;
  participants: string[];
  participant_names?: Record<string, string>;
  last_message?: string;
  updated_at?: any;
  unread_counts?: Record<string, number>;
};

function chatTitle(chat: ChatItem, usersMap: Record<string, string>, myUid: string): string {
  if (chat.type === 'broadcast') return chat.name || 'Broadcast';
  if (chat.type === 'group') return chat.name || 'Group Chat';
  const other = chat.participants.find((p) => p !== myUid);
  if (!other) return 'Direct Chat';
  return chat.participant_names?.[other] || usersMap[other] || 'Direct Chat';
}

function fmtChatTime(value: any): string {
  try {
    const dt = value?.toDate ? value.toDate() : null;
    if (!dt) return '';
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creatingDirectFor, setCreatingDirectFor] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [openingBroadcast, setOpeningBroadcast] = useState(false);
  const usersMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users]);

  useEffect(() => {
    if (!user) return;

    const participantsQ = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('updated_at', 'desc'));
    const broadcastQ = query(collection(db, 'chats'), where('type', '==', 'broadcast'), orderBy('updated_at', 'desc'));

    const unsubA = onSnapshot(participantsQ, (snap) => {
      const arr: ChatItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setChats((prev) => {
        const b = prev.filter((c) => c.type === 'broadcast');
        const merged = [...arr, ...b.filter((bc) => !arr.some((x) => x.id === bc.id))];
        return merged.sort((x, y) => (y.updated_at?.seconds || 0) - (x.updated_at?.seconds || 0));
      });
      setLoading(false);
      setError('');
    }, (err) => {
      setLoading(false);
      setError(err?.message || 'Failed to load chats.');
    });

    const unsubB = onSnapshot(broadcastQ, (snap) => {
      const arr: ChatItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setChats((prev) => {
        const normal = prev.filter((c) => c.type !== 'broadcast');
        const merged = [...normal, ...arr.filter((x) => !normal.some((n) => n.id === x.id))];
        return merged.sort((x, y) => (y.updated_at?.seconds || 0) - (x.updated_at?.seconds || 0));
      });
    }, () => {});

    return () => {
      unsubA();
      unsubB();
    };
  }, [user, user?.uid]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: AppUser[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data.status !== 'approved') return;
          list.push({ id: d.id, name: data.name || 'User', role: data.role || 'student', status: data.status });
        });
        setUsers(list);
      } catch {
        setError('Could not load users list.');
      }
    };
    loadUsers().catch(() => {});
  }, []);

  const getOrCreateDirectChat = async (target: AppUser) => {
    if (!user) return;
    const existing = chats.find((c) => c.type === 'direct' && c.participants.length === 2 && c.participants.includes(target.id) && c.participants.includes(user.uid));
    if (existing) {
      router.push(`/chat/${existing.id}`);
      return;
    }

    setCreatingDirectFor(target.id);
    try {
      const payload = {
        type: 'direct',
        name: '',
        participants: [user.uid, target.id],
        participant_names: {
          [user.uid]: profile?.name || user.email || 'You',
          [target.id]: target.name,
        },
        last_message: '',
        created_by: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        typing: {},
        unread_counts: {
          [user.uid]: 0,
          [target.id]: 0,
        },
      };
      const ref = await addDoc(collection(db, 'chats'), payload);
      setShowUsers(false);
      router.push(`/chat/${ref.id}`);
    } catch (e: any) {
      Alert.alert('Could not start chat', e?.message || 'Please try again.');
    } finally {
      setCreatingDirectFor(null);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 200)));
  };

  const createGroup = async () => {
    if (!user || !isAdmin) return;
    const cleanedName = groupName.trim();
    if (!cleanedName) {
      Alert.alert('Missing', 'Group name is required.');
      return;
    }
    const participants = Array.from(new Set([user.uid, ...selected]));
    if (participants.length < 2) {
      Alert.alert('Select users', 'Add at least one participant.');
      return;
    }
    if (participants.length > 200) {
      Alert.alert('Limit exceeded', 'Maximum 200 users allowed in one group.');
      return;
    }

    const participant_names: Record<string, string> = {};
    const unread_counts: Record<string, number> = {};
    participants.forEach((uid) => {
      participant_names[uid] = usersMap[uid] || (uid === user.uid ? (profile?.name || 'Admin') : 'User');
      unread_counts[uid] = 0;
    });

    setCreatingGroup(true);
    try {
      const ref = await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: cleanedName,
        participants,
        participant_names,
        created_by: user.uid,
        last_message: '',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        typing: {},
        unread_counts,
      });
      setShowGroupCreator(false);
      setGroupName('');
      setSelected([]);
      router.push(`/chat/${ref.id}`);
    } catch (e: any) {
      Alert.alert('Could not create group', e?.message || 'Please try again.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const openBroadcastChat = async () => {
    if (!user || !isAdmin) return;
    const existing = chats.find((c) => c.type === 'broadcast');
    if (existing) {
      router.push(`/chat/${existing.id}`);
      return;
    }
    setOpeningBroadcast(true);
    try {
      const ref = await addDoc(collection(db, 'chats'), {
        type: 'broadcast',
        name: 'Announcements',
        participants: [],
        participant_names: {},
        created_by: user.uid,
        last_message: '',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        typing: {},
        unread_counts: { [user.uid]: 0 },
      });
      router.push(`/chat/${ref.id}`);
    } catch (e: any) {
      Alert.alert('Could not open broadcast', e?.message || 'Please try again.');
    } finally {
      setOpeningBroadcast(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.subtitle}>1-to-1, groups, and broadcast</Text>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowUsers((v) => !v)}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
          <Text style={styles.toolBtnText}>New Chat</Text>
        </TouchableOpacity>
        {isAdmin && (
          <>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setShowGroupCreator((v) => !v)}>
              <Ionicons name="people-outline" size={16} color={COLORS.primary} />
              <Text style={styles.toolBtnText}>Create Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={openBroadcastChat}>
              <Ionicons name="megaphone-outline" size={16} color={COLORS.primary} />
              <Text style={styles.toolBtnText}>{openingBroadcast ? 'Opening...' : 'Broadcast'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showUsers && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Start direct chat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {users.filter((u) => u.id !== user?.uid).map((u) => (
              <TouchableOpacity key={u.id} style={styles.userChip} onPress={() => getOrCreateDirectChat(u)}>
                <Text style={styles.userChipText}>
                  {creatingDirectFor === u.id ? 'Starting...' : u.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showGroupCreator && isAdmin && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Create group (max 200 users)</Text>
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor={COLORS.border}
          />
          <View style={styles.groupUsers}>
            {users.filter((u) => u.id !== user?.uid).map((u) => {
              const active = selected.includes(u.id);
              return (
                <TouchableOpacity key={u.id} style={[styles.userChip, active && styles.userChipActive]} onPress={() => toggleParticipant(u.id)}>
                  <Text style={[styles.userChipText, active && styles.userChipTextActive]}>{u.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={[styles.createBtn, creatingGroup && { opacity: 0.7 }]} onPress={createGroup} disabled={creatingGroup}>
            {creatingGroup ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Create Group ({selected.length + 1})</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatCard} onPress={() => router.push(`/chat/${item.id}`)}>
              <View style={styles.chatTitleRow}>
                <Text style={styles.chatName}>{chatTitle(item, usersMap, user?.uid || '')}</Text>
                <Text style={styles.chatType}>{item.type}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.chatPreview} numberOfLines={1}>{item.last_message || 'No messages yet'}</Text>
                <View style={styles.metaRight}>
                  <Text style={styles.chatTime}>{fmtChatTime(item.updated_at)}</Text>
                  {(item.unread_counts?.[user?.uid || ''] || 0) > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread_counts?.[user?.uid || '']}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={42} color={COLORS.border} />
              <Text style={styles.emptyText}>No chats yet. Start one from “New Chat”.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: SPACING.md },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
  },
  toolBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
  errorText: { color: '#B3261E', fontSize: 12, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  panel: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, ...SHADOWS.card },
  panelTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surfaceAlt, color: COLORS.textMain },
  groupUsers: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  userChipActive: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },
  userChipText: { color: COLORS.textMain, fontSize: 12, fontWeight: '600' },
  userChipTextActive: { color: COLORS.primary },
  createBtn: { marginTop: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700' },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 24 },
  chatCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  chatTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  chatName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  chatType: { fontSize: 10, color: COLORS.goldText, backgroundColor: COLORS.goldBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, textTransform: 'uppercase' },
  previewRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  chatPreview: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  metaRight: { alignItems: 'flex-end', gap: 4 },
  chatTime: { fontSize: 11, color: COLORS.textMuted },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
});
