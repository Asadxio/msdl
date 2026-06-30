import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, TextInput, Alert, ScrollView, Image, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, FeedbackBanner, ScalePressable, SkeletonCard, ScreenRefreshControl } from '@/components/ui';
import { stableQueryKey, subscribeDeduped } from '@/lib/queryPerformance';
import { ReportReasonModal } from '@/components/ReportReasonModal';
import { submitUgcReport, type ReportReason } from '@/lib/ugcReports';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type AppUser = { id: string; name: string; email?: string; role: string; status: string; photo_url?: string; avatar?: string };

function recordOfStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function recordOfNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
}

type ChatItem = {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  name?: string;
  participants: string[];
  participant_names?: Record<string, string>;
  last_message?: string;
  last_sender_id?: string;
  updated_at?: { toDate?: () => Date; seconds?: number } | null;
  unread_counts?: Record<string, number>;
  pinned_by?: string[];
  hidden_by?: string[];
};

function normalizeChatItem(id: string, raw: unknown): ChatItem {
  const safe: Record<string, unknown> = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id,
    type: safe.type === 'group' || safe.type === 'broadcast' ? safe.type : 'direct',
    name: typeof safe.name === 'string' ? safe.name : '',
    participants: Array.isArray(safe.participants) ? safe.participants.filter((p: unknown) => typeof p === 'string') : [],
    participant_names: recordOfStrings(safe.participant_names),
    last_message: typeof safe.last_message === 'string' ? safe.last_message : '',
    last_sender_id: typeof safe.last_sender_id === 'string' ? safe.last_sender_id : undefined,
    updated_at: safe.updated_at || null,
    unread_counts: recordOfNumbers(safe.unread_counts),
    pinned_by: Array.isArray(safe.pinned_by) ? safe.pinned_by.filter((v: unknown) => typeof v === 'string') : [],
    hidden_by: Array.isArray(safe.hidden_by) ? safe.hidden_by.filter((v: unknown) => typeof v === 'string') : [],
  };
}

function chatTitle(chat: ChatItem, usersMap: Record<string, string>, myUid: string): string {
  if (chat.type === 'broadcast') return chat.name || 'Broadcast';
  if (chat.type === 'group') return chat.name || 'Group Chat';
  const safeParticipants = Array.isArray(chat.participants) ? chat.participants : [];
  const other = safeParticipants.find((p) => p !== myUid);
  if (!other) return 'Direct Chat';
  return chat.participant_names?.[other] || usersMap[other] || 'Direct Chat';
}

function fmtChatTime(value: unknown): string {
  try {
    const safe = value as { toDate?: () => Date } | null;
    const dt = safe?.toDate ? safe.toDate() : null;
    if (!dt) return '';
    const now = Date.now();
    const diff = now - dt.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday';
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function ChatsScreen() {
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await refreshChats();
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTeacher = profile?.role === 'teacher';

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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [reportChat, setReportChat] = useState<ChatItem | null>(null);

  const submitChatReport = useCallback(async (reason: ReportReason) => {
    if (!user?.uid || !reportChat) return;
    const target = reportChat;
    setReportChat(null);
    try {
      const otherId = target.participants.find((p) => p !== user.uid) || '';
      await submitUgcReport({
        reportedBy: user.uid,
        targetType: 'chat_thread',
        targetId: target.id,
        reason,
        accusedUserId: otherId,
        metadata: { chat_type: target.type, last_message: target.last_message || '' },
      });
      setFeedback({ type: 'success', text: 'Report submitted. An admin will review this chat.' });
    } catch {
      setFeedback({ type: 'error', text: 'Could not submit report. Please try again.' });
    }
  }, [reportChat, user?.uid]);

  const safeUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);
  const safeChats = useMemo(() => (Array.isArray(chats) ? chats : []), [chats]);
  const usersMap = useMemo(() => Object.fromEntries(safeUsers.map((u) => [u.id, u.name])), [safeUsers]);
  const safePush = useCallback((path: string) => {
    try {
      if (!path) return;
      router.push(path as never);
    } catch {
      // no-op
    }
  }, [router]);


  const refreshChats = useCallback(async () => {
    if (!user?.uid) return;
    setError('');
    try {
      const participantsQ = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('updated_at', 'desc'));
      const broadcastQ = query(collection(db, 'chats'), where('type', '==', 'broadcast'), orderBy('updated_at', 'desc'));
      const [participantSnap, broadcastSnap] = await Promise.all([getDocs(participantsQ), getDocs(broadcastQ)]);
      const directAndGroups: ChatItem[] = [];
      participantSnap.forEach((d) => directAndGroups.push(normalizeChatItem(d.id, d.data())));
      const broadcasts: ChatItem[] = [];
      broadcastSnap.forEach((d) => broadcasts.push(normalizeChatItem(d.id, d.data())));
      const merged = [...directAndGroups, ...broadcasts.filter((bc) => !directAndGroups.some((x) => x.id === bc.id))];
      setChats(merged.sort((x, y) => (y.updated_at?.seconds || 0) - (x.updated_at?.seconds || 0)));
      setLoading(false);
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'chats', operation: 'get', query: `participants array-contains ${user.uid} + broadcasts type == broadcast orderBy updated_at desc` }, err);
      const message = err instanceof Error ? err.message : 'Failed to refresh chats.';
      setError(message);
    }
  }, [user?.uid]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!user) return;

    const participantsQ = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('updated_at', 'desc'));
    const broadcastQ = query(collection(db, 'chats'), where('type', '==', 'broadcast'), orderBy('updated_at', 'desc'));

    const unsubA = subscribeDeduped(stableQueryKey(['chats_participants', user.uid]), participantsQ as any, (snap) => {
      const arr: ChatItem[] = [];
      snap.forEach((d) => arr.push(normalizeChatItem(d.id, d.data())));
      setChats((prev) => {
        const b = prev.filter((c) => c.type === 'broadcast');
        const merged = [...arr, ...b.filter((bc) => !arr.some((x) => x.id === bc.id))];
        return merged.sort((x, y) => (y.updated_at?.seconds || 0) - (x.updated_at?.seconds || 0));
      });
      setLoading(false);
      setError('');
    }, (err: unknown) => {
      logFirestoreFailure({ collection: 'chats', operation: 'listen', query: `where participants array-contains ${user.uid} orderBy updated_at desc` }, err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to load chats.');
    });

    const unsubB = subscribeDeduped(stableQueryKey(['chats_broadcast', user.uid]), broadcastQ as any, (snap) => {
      const arr: ChatItem[] = [];
      snap.forEach((d) => arr.push(normalizeChatItem(d.id, d.data())));
      setChats((prev) => {
        const normal = prev.filter((c) => c.type !== 'broadcast');
        const merged = [...normal, ...arr.filter((x) => !normal.some((n) => n.id === x.id))];
        return merged.sort((x, y) => (y.updated_at?.seconds || 0) - (x.updated_at?.seconds || 0));
      });
    }, (err) => {
      logFirestoreFailure({ collection: 'chats', operation: 'listen', query: 'where type == broadcast orderBy updated_at desc' }, err);
      console.log('[Chats] broadcast listener ERROR', err);
    });

    return () => {
      unsubA();
      unsubB();
    };
  }, [user, user?.uid]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'public_profiles'), where('searchable', '==', true)));
        const list: AppUser[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<AppUser> & { is_active?: boolean };
          if (data.status !== 'approved' || data.is_active === false) return;
          list.push({
            id: d.id, name: data.name || 'User', email: '', role: data.role || 'student', status: data.status,
            photo_url: data.photo_url || '', avatar: data.avatar || 'person',
          });
        });
        setUsers(list);
      } catch (err: unknown) {
        logFirestoreFailure({ collection: 'public_profiles', operation: 'get', query: 'where searchable == true' }, err);
        setError('Could not load users list.');
      }
    };
    loadUsers().catch(() => {});
  }, []);

  const toggleChatSelection = useCallback((chatId: string) => {
    setSelectedChatIds((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]));
  }, []);

  const togglePinChat = useCallback(async (chatItem: ChatItem) => {
    if (!user?.uid) return;
    try {
      console.log('[Chats] Pin chat clicked', { chatId: chatItem.id });
      const pinned = (Array.isArray(chatItem.pinned_by) ? chatItem.pinned_by : []).includes(user.uid);
      await updateDoc(doc(db, 'chats', chatItem.id), {
        pinned_by: pinned ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'chats', operation: 'update', query: `doc chats/${chatItem.id} toggle pinned_by` }, error);
      console.log('[Chats] togglePinChat ERROR', error);
      Alert.alert('Action failed', error instanceof Error ? error.message : 'Could not update pin status.');
    }
  }, [user?.uid]);

  const deleteSelectedChats = useCallback(async () => {
    if (!user?.uid || selectedChatIds.length === 0 || bulkUpdating) return;
    console.log('[Chats] Delete selected clicked', { count: selectedChatIds.length });
    Alert.alert('Delete selected chats', `Delete ${selectedChatIds.length} selected chat(s) from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const run = async () => {
            setBulkUpdating(true);
            try {
              const selectedChats = safeChats.filter((chatItem) => selectedChatIds.includes(chatItem.id));
              await Promise.all(selectedChats.map(async (chatItem) => {
                const updatePayload: Record<string, any> = { hidden_by: arrayUnion(user.uid) };
                if (chatItem.type !== 'broadcast') {
                  updatePayload[`unread_counts.${user.uid}`] = 0;
                }
                await updateDoc(doc(db, 'chats', chatItem.id), updatePayload);
              }));
              setSelectedChatIds([]);
              setFeedback({ type: 'success', text: 'Selected chats deleted from your list.' });
            } catch (error: unknown) {
              logFirestoreFailure({ collection: 'chats', operation: 'update', query: `hide ${selectedChatIds.length} selected chat docs` }, error);
              console.log('[Chats] deleteSelectedChats ERROR', error);
              Alert.alert('Delete failed', error instanceof Error ? error.message : 'Could not delete selected chats.');
            } finally {
              setBulkUpdating(false);
            }
          };
          run().catch(() => {});
        },
      },
    ]);
  }, [bulkUpdating, safeChats, selectedChatIds, user?.uid]);

  const getOrCreateDirectChat = async (target: AppUser) => {
    if (!user) return;
    const existing = chats.find((c) => c.type === 'direct' && c.participants.length === 2 && c.participants.includes(target.id) && c.participants.includes(user.uid));
    if (existing) {
      safePush(`/chat/${existing.id}`);
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
      safePush(`/chat/${ref.id}`);
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'chats', operation: 'add', query: 'create direct chat' }, error);
      const message = error instanceof Error ? error.message : 'Please try again.';
      setFeedback({ type: 'error', text: message });
      Alert.alert('Could not start chat', message);
    } finally {
      setCreatingDirectFor(null);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 200)));
  };

  const createGroup = async () => {
    if (!user || (!isAdmin && !isTeacher)) return;
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
      safePush(`/chat/${ref.id}`);
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'chats', operation: 'add', query: 'create group chat' }, error);
      const message = error instanceof Error ? error.message : 'Please try again.';
      setFeedback({ type: 'error', text: message });
      Alert.alert('Could not create group', message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const openBroadcastChat = async () => {
    if (!user || !isAdmin) return;
    const existing = chats.find((c) => c.type === 'broadcast');
    if (existing) {
      safePush(`/chat/${existing.id}`);
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
      safePush(`/chat/${ref.id}`);
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'chats', operation: 'add', query: 'create broadcast chat' }, error);
      const message = error instanceof Error ? error.message : 'Please try again.';
      setFeedback({ type: 'error', text: message });
      Alert.alert('Could not open broadcast', message);
    } finally {
      setOpeningBroadcast(false);
    }
  };

  const filteredUsers = safeUsers.filter((u) => (
    u.id !== user?.uid && (
      !debouncedSearch
      || u.name.toLowerCase().includes(debouncedSearch)
      || (u.role || '').toLowerCase().includes(debouncedSearch)
    )
  ));

  const filteredChats = safeChats
    .filter((c) => !(Array.isArray(c.hidden_by) ? c.hidden_by : []).includes(user?.uid || ''))
    .filter((c) => (
    !debouncedSearch || chatTitle(c, usersMap, user?.uid || '').toLowerCase().includes(debouncedSearch)
    ))
    .sort((a, b) => {
      const aPinned = (Array.isArray(a.pinned_by) ? a.pinned_by : []).includes(user?.uid || '');
      const bPinned = (Array.isArray(b.pinned_by) ? b.pinned_by : []).includes(user?.uid || '');
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return (b.updated_at?.seconds || 0) - (a.updated_at?.seconds || 0);
    });

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>Chats</Text>
            <Text style={styles.subtitle}>1-to-1, groups, and broadcast</Text>
          </View>
        </View>
      </View>
      {feedback ? (
        <View style={styles.feedbackWrap}>
          <FeedbackBanner type={feedback.type} message={feedback.text} />
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <ScalePressable style={styles.toolBtn} onPress={() => setShowUsers((v) => !v)}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
          <Text style={styles.toolBtnText}>New Chat</Text>
        </ScalePressable>
        {(isAdmin || isTeacher) && (
          <ScalePressable style={styles.toolBtn} onPress={() => setShowGroupCreator((v) => !v)}>
            <Ionicons name="people-outline" size={16} color={COLORS.primary} />
            <Text style={styles.toolBtnText}>Create Group</Text>
          </ScalePressable>
        )}
        {isAdmin && (
          <>
            <ScalePressable style={styles.toolBtn} onPress={openBroadcastChat}>
              <Ionicons name="megaphone-outline" size={16} color={COLORS.primary} />
              <Text style={styles.toolBtnText}>{openingBroadcast ? 'Opening...' : 'Broadcast'}</Text>
            </ScalePressable>
            <ScalePressable style={styles.toolBtn} onPress={deleteSelectedChats} disabled={selectedChatIds.length === 0 || bulkUpdating}>
              <Ionicons name="trash-outline" size={16} color={selectedChatIds.length === 0 ? COLORS.textMuted : COLORS.error} />
              <Text style={[styles.toolBtnText, selectedChatIds.length === 0 && { color: COLORS.textMuted }]}>
                {bulkUpdating ? 'Deleting...' : `Delete Selected (${selectedChatIds.length})`}
              </Text>
            </ScalePressable>
          </>
        )}
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search chats or users"
          placeholderTextColor={COLORS.textMuted}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showUsers && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Start direct chat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filteredUsers.map((u) => (
              <ScalePressable key={u.id} style={styles.userChip} onPress={() => getOrCreateDirectChat(u)}>
                <Text style={styles.userChipText}>
                  {creatingDirectFor === u.id ? 'Starting...' : u.name}
                </Text>
              </ScalePressable>
            ))}
          </ScrollView>
        </View>
      )}

      {showGroupCreator && (isAdmin || isTeacher) && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Create group (max 200 users)</Text>
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor={COLORS.textMuted}
          />
          <View style={styles.groupUsers}>
            {filteredUsers.map((u) => {
              const active = selected.includes(u.id);
              return (
                <ScalePressable key={u.id} style={[styles.userChip, active && styles.userChipActive]} onPress={() => toggleParticipant(u.id)}>
                  <Text style={[styles.userChipText, active && styles.userChipTextActive]}>{u.name}</Text>
                </ScalePressable>
              );
            })}
          </View>
          <ScalePressable style={[styles.createBtn, creatingGroup && { opacity: 0.7 }]} onPress={createGroup} disabled={creatingGroup}>
            {creatingGroup ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.createBtnText}>Create Group ({selected.length + 1})</Text>
            )}
          </ScalePressable>
        </View>
      )}

      <ReportReasonModal
        visible={!!reportChat}
        title="Report chat"
        onClose={() => setReportChat(null)}
        onSelectReason={(reason) => { void submitChatReport(reason); }}
      />

      {loading ? (
        <View style={styles.loadingList}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
          renderItem={({ item }) => {
            const otherId = (Array.isArray(item.participants) ? item.participants : []).find((p) => p !== user?.uid);
            const avatarUser = otherId ? userById[otherId] : undefined;
            const pinned = (Array.isArray(item.pinned_by) ? item.pinned_by : []).includes(user?.uid || '');
            const selectedNow = selectedChatIds.includes(item.id);
            return (
            <ScalePressable
              style={[styles.chatCard, selectedNow && styles.chatCardSelected]}
              onPress={() => safePush(`/chat/${item.id}`)}
              onLongPress={() => toggleChatSelection(item.id)}
            >
              {avatarUser?.photo_url ? (
                <Image source={{ uri: avatarUser.photo_url }} style={styles.chatAvatar} />
              ) : (
                <View style={styles.chatAvatarFallback}>
                  <Text style={styles.chatAvatarInitial}>
                    {(chatTitle(item, usersMap, user?.uid || '').charAt(0) || 'C').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
              <View style={styles.chatTitleRow}>
                <Text style={[styles.chatName, (item.unread_counts?.[user?.uid || ''] || 0) > 0 && styles.chatNameUnread]}>{chatTitle(item, usersMap, user?.uid || '')}</Text>
                <View style={styles.chatMetaTop}>
                  {pinned ? <Ionicons name="pin" size={12} color={COLORS.primary} /> : null}
                  <Text style={styles.chatType}>{item.type}</Text>
                </View>
              </View>
              <View style={styles.previewRow}>
                <Text style={[styles.chatPreview, (item.unread_counts?.[user?.uid || ''] || 0) > 0 && styles.chatPreviewUnread]} numberOfLines={1}>
                  {item.last_message ? (item.last_sender_id === user?.uid ? `You: ${item.last_message}` : item.last_message) : 'No messages yet'}
                </Text>
                <View style={styles.metaRight}>
                  <Text style={styles.chatTime}>{fmtChatTime(item.updated_at)}</Text>
                  {(item.unread_counts?.[user?.uid || ''] || 0) > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread_counts?.[user?.uid || '']}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              </View>
              <View style={styles.chatActions}>
                <TouchableOpacity onPress={() => setReportChat(item)} style={styles.actionBtn} accessibilityLabel="Report chat">
                  <Ionicons name="flag-outline" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => togglePinChat(item)} style={styles.actionBtn}>
                  <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleChatSelection(item.id)} style={styles.actionBtn}>
                  <Ionicons name={selectedNow ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={selectedNow ? COLORS.primary : COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </ScalePressable>
          )}}
          ListEmptyComponent={(
            <EmptyState icon="chatbubbles-outline" title="No Conversations Yet" message="Start chatting with teachers and classmates." />
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
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: SPACING.md },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
  },
  toolBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
  searchWrap: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  errorText: { color: '#B3261E', fontSize: 12, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  panel: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, ...SHADOWS.card },
  panelTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
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
  groupUsers: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  userChipActive: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },
  userChipText: { color: COLORS.textMain, fontSize: 12, fontWeight: '600' },
  userChipTextActive: { color: COLORS.primary },
  createBtn: { marginTop: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700' },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 24 },
  loadingList: { padding: SPACING.md, gap: SPACING.sm },
  chatCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card, flexDirection: 'row', gap: 10 },
  chatAvatar: { width: 44, height: 44, borderRadius: 22, marginTop: 2 },
  chatAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  chatAvatarInitial: { fontSize: 17, fontWeight: '800', color: COLORS.goldText },
  chatTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  chatMetaTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  chatNameUnread: { fontWeight: '900' },
  chatType: { fontSize: 10, color: COLORS.goldText, backgroundColor: COLORS.goldBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, textTransform: 'uppercase' },
  previewRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  chatPreview: { flex: 1, fontSize: 13, color: COLORS.textMuted, textAlign: 'left' },
  chatPreviewUnread: { color: COLORS.textMain, fontWeight: '600' },
  metaRight: { alignItems: 'flex-end', gap: 4 },
  chatTime: { fontSize: 11, color: COLORS.textMuted },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chatActions: { justifyContent: 'space-between', alignItems: 'center', paddingLeft: 2 },
  actionBtn: { padding: 4 },
  chatCardSelected: { borderWidth: 1, borderColor: COLORS.primary },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
