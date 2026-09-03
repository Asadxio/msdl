import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, TextInput, Alert, ScrollView, Image, TouchableOpacity, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
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
import { canInitiateDirectChat, canCreateGroup, canCreateBroadcast } from '@/lib/chatPermissions';

type AppUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
  status: string;
  photo_url?: string;
  avatar?: string;
  student_id?: string;
  is_online?: boolean;
  last_seen?: any;
};

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
  archived_by?: string[];
  muted_by?: string[];
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
    archived_by: Array.isArray(safe.archived_by) ? safe.archived_by.filter((v: unknown) => typeof v === 'string') : [],
    muted_by: Array.isArray(safe.muted_by) ? safe.muted_by.filter((v: unknown) => typeof v === 'string') : [],
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

type FilterTab = 'all' | 'unread' | 'direct' | 'groups' | 'broadcasts' | 'pinned' | 'archived' | 'teachers' | 'students' | 'support';

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
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showUsers, setShowUsers] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [previewUser, setPreviewUser] = useState<AppUser | null>(null);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
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
          const data = d.data() as Partial<AppUser> & { is_active?: boolean; student_id?: string; email?: string };
          if (data.status !== 'approved' || data.is_active === false) return;
          list.push({
            id: d.id,
            name: data.name || 'User',
            email: data.email || '',
            role: data.role || 'student',
            status: data.status,
            photo_url: data.photo_url || '',
            avatar: data.avatar || 'person',
            student_id: data.student_id || '',
          });
        });
        setUsers(list);
      } catch (err: unknown) {
        logFirestoreFailure({ collection: 'public_profiles', operation: 'get', query: 'where searchable == true' }, err);
        console.warn('[Chats] Non-fatal loadUsers error:', err);
      }
    };
    loadUsers().catch(() => {});
  }, [profile?.status, user?.uid]);

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

  const toggleArchiveChat = useCallback(async (chatItem: ChatItem) => {
    if (!user?.uid) return;
    try {
      const isArchived = (Array.isArray(chatItem.archived_by) ? chatItem.archived_by : []).includes(user.uid);
      await updateDoc(doc(db, 'chats', chatItem.id), {
        archived_by: isArchived ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
      setFeedback({ type: 'success', text: isArchived ? 'Chat unarchived' : 'Chat archived' });
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'chats', operation: 'update', query: `doc chats/${chatItem.id} toggle archived_by` }, error);
      Alert.alert('Action failed', error instanceof Error ? error.message : 'Could not archive chat.');
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

  const openDirectChat = useCallback((target: AppUser) => {
    if (!user?.uid) return;
    setShowUsers(false);
    setPreviewUser(null);
    const existing = chats.find((c) => c.type === 'direct' && c.participants.length === 2 && c.participants.includes(target.id) && c.participants.includes(user.uid));
    if (existing) {
      safePush(`/chat/${existing.id}`);
      return;
    }
    const deterministicChatId = `direct_${[user.uid, target.id].sort().join('_')}`;
    safePush(`/chat/${deterministicChatId}`);
  }, [chats, safePush, user?.uid]);

  const directoryUsers = useMemo(() => {
    return safeUsers.filter((u) => {
      if (u.id === user?.uid) return false;
      if (!contactSearch.trim()) return true;
      const q = contactSearch.trim().toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q) ||
        (u.student_id || '').toLowerCase().includes(q)
      );
    });
  }, [contactSearch, safeUsers, user?.uid]);

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

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const filteredChats = safeChats
    .filter((c) => !(Array.isArray(c.hidden_by) ? c.hidden_by : []).includes(user?.uid || ''))
    .filter((c) => {
      const isArchived = (Array.isArray(c.archived_by) ? c.archived_by : []).includes(user?.uid || '');
      if (activeTab === 'archived') return isArchived;
      if (isArchived) return false;

      if (!debouncedSearch) return true;
      const titleMatch = chatTitle(c, usersMap, user?.uid || '').toLowerCase().includes(debouncedSearch);
      const msgMatch = (c.last_message || '').toLowerCase().includes(debouncedSearch);
      return titleMatch || msgMatch;
    })
    .filter((c) => {
      const isArchived = (Array.isArray(c.archived_by) ? c.archived_by : []).includes(user?.uid || '');
      if (activeTab === 'all') return !isArchived;
      if (activeTab === 'archived') return isArchived;
      if (activeTab === 'unread') return (c.unread_counts?.[user?.uid || ''] || 0) > 0;
      if (activeTab === 'pinned') return (Array.isArray(c.pinned_by) ? c.pinned_by : []).includes(user?.uid || '');
      if (activeTab === 'direct') return c.type === 'direct';
      if (activeTab === 'groups') return c.type === 'group';
      if (activeTab === 'broadcasts') return c.type === 'broadcast';
      if (activeTab === 'teachers') {
        const otherIds = c.participants.filter((p) => p !== user?.uid);
        return otherIds.some((id) => userById[id]?.role === 'teacher');
      }
      if (activeTab === 'students') {
        const otherIds = c.participants.filter((p) => p !== user?.uid);
        return otherIds.some((id) => userById[id]?.role === 'student' || !userById[id]?.role);
      }
      if (activeTab === 'support') {
        return c.name?.toLowerCase().includes('support') || c.last_message?.toLowerCase().includes('support');
      }
      return true;
    })
    .sort((a, b) => {
      const aPinned = (Array.isArray(a.pinned_by) ? a.pinned_by : []).includes(user?.uid || '');
      const bPinned = (Array.isArray(b.pinned_by) ? b.pinned_by : []).includes(user?.uid || '');
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return (b.updated_at?.seconds || 0) - (a.updated_at?.seconds || 0);
    });

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

      <View style={styles.filterTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsScroll}>
          {([
            'all', 'unread', 'direct', 'groups', 'broadcasts', 'pinned', 'archived',
            ...(isAdmin || isTeacher ? ['teachers', 'students', 'support'] : []),
          ] as FilterTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const labels: Record<FilterTab, string> = {
              all: 'All',
              unread: 'Unread',
              direct: 'Direct',
              groups: 'Groups',
              broadcasts: 'Broadcasts',
              pinned: 'Pinned',
              archived: 'Archived',
              teachers: 'Teachers',
              students: 'Student Requests',
              support: 'Support',
            };
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterTabChip, isActive && styles.filterTabChipActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {labels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* WhatsApp-Style Contact Directory Modal */}
      <Modal
        visible={showUsers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUsers(false)}
      >
        <View style={[styles.directoryContainer, { paddingTop: insets.top + SPACING.sm }]}>
          <View style={styles.directoryHeader}>
            <ScalePressable style={styles.directoryBackBtn} onPress={() => setShowUsers(false)}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
            </ScalePressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.directoryTitle}>Select Contact</Text>
              <Text style={styles.directorySubtitle}>{directoryUsers.length} contacts</Text>
            </View>
          </View>

          <View style={styles.directorySearchWrap}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.directorySearchInput}
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder="Search name, role, or ID..."
              placeholderTextColor={COLORS.textMuted}
              autoCorrect={false}
            />
            {contactSearch ? (
              <TouchableOpacity onPress={() => setContactSearch('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={directoryUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.directoryList}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            ListEmptyComponent={
              <View style={styles.emptyDirectory}>
                <Ionicons name="person-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyDirectoryText}>No contacts found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const roleUpper = (item.role || 'student').toUpperCase();
              return (
                <TouchableOpacity
                  style={styles.contactRow}
                  activeOpacity={0.7}
                  onPress={() => openDirectChat(item)}
                >
                  <TouchableOpacity
                    style={styles.contactAvatarWrap}
                    onPress={() => setPreviewUser(item)}
                  >
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.contactAvatar} />
                    ) : (
                      <View style={[
                        styles.contactAvatarFallback,
                        item.role === 'teacher' && styles.contactAvatarTeacher,
                        item.role === 'admin' && styles.contactAvatarAdmin,
                      ]}>
                        <Ionicons
                          name={item.role === 'admin' ? 'shield-checkmark' : item.role === 'teacher' ? 'school' : 'person'}
                          size={20}
                          color={item.role === 'admin' ? '#92400E' : item.role === 'teacher' ? '#6D28D9' : COLORS.primary}
                        />
                      </View>
                    )}
                    {item.is_online ? <View style={styles.contactOnlineBadge} /> : null}
                  </TouchableOpacity>

                  <View style={styles.contactInfo}>
                    <View style={styles.contactNameRow}>
                      <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                      <View style={[
                        styles.contactRoleBadge,
                        item.role === 'teacher' && styles.contactRoleBadgeTeacher,
                        item.role === 'admin' && styles.contactRoleBadgeAdmin,
                      ]}>
                        <Text style={[
                          styles.contactRoleText,
                          item.role === 'teacher' && styles.contactRoleTextTeacher,
                          item.role === 'admin' && styles.contactRoleTextAdmin,
                        ]}>
                          {roleUpper}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={styles.contactSubtitle}>
                        {item.status === 'approved' || item.status === 'active' ? 'Active MSLB Member' : 'Member'}
                      </Text>
                      {item.student_id ? (
                        <Text style={styles.contactStudentId}>• ID: {item.student_id}</Text>
                      ) : null}
                    </View>
                  </View>

                  <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* Profile Preview Modal */}
      <Modal
        visible={!!previewUser}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUser(null)}
      >
        <View style={styles.previewBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPreviewUser(null)}
          />
          <View style={styles.previewCard}>
            {previewUser?.photo_url ? (
              <Image source={{ uri: previewUser.photo_url }} style={styles.previewPhoto} />
            ) : (
              <View style={styles.previewPhotoFallback}>
                <Ionicons name="person" size={48} color={COLORS.primary} />
              </View>
            )}
            <Text style={styles.previewName}>{previewUser?.name}</Text>
            <View style={[
              styles.contactRoleBadge,
              previewUser?.role === 'teacher' && styles.contactRoleBadgeTeacher,
              previewUser?.role === 'admin' && styles.contactRoleBadgeAdmin,
              { marginTop: 4, paddingHorizontal: 10, paddingVertical: 3 }
            ]}>
              <Text style={[
                styles.contactRoleText,
                previewUser?.role === 'teacher' && styles.contactRoleTextTeacher,
                previewUser?.role === 'admin' && styles.contactRoleTextAdmin,
                { fontSize: 11 }
              ]}>
                {(previewUser?.role || 'student').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.previewStatusText}>Institutional Member</Text>

            <View style={styles.previewActionRow}>
              <TouchableOpacity
                style={styles.previewMessageBtn}
                activeOpacity={0.7}
                onPress={() => previewUser && openDirectChat(previewUser)}
              >
                <Ionicons name="chatbubble" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.previewMessageBtnText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                activeOpacity={0.7}
                onPress={() => setPreviewUser(null)}
              >
                <Text style={styles.previewCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            const isArchived = (Array.isArray(item.archived_by) ? item.archived_by : []).includes(user?.uid || '');
            const selectedNow = selectedChatIds.includes(item.id);
            const unreadCount = item.unread_counts?.[user?.uid || ''] || 0;
            const isOutgoing = item.last_sender_id === user?.uid;

            return (
              <ScalePressable
                style={[styles.chatCard, selectedNow && styles.chatCardSelected]}
                onPress={() => safePush(`/chat/${item.id}`)}
                onLongPress={() => toggleChatSelection(item.id)}
              >
                {avatarUser?.photo_url ? (
                  <Image source={{ uri: avatarUser.photo_url }} style={styles.chatAvatar} />
                ) : (
                  <View style={[styles.chatAvatarFallback, item.type === 'broadcast' && { backgroundColor: '#FEF3C7' }, item.type === 'group' && { backgroundColor: '#E0E7FF' }]}>
                    <Ionicons
                      name={item.type === 'broadcast' ? 'megaphone' : item.type === 'group' ? 'people' : 'person'}
                      size={20}
                      color={item.type === 'broadcast' ? COLORS.secondary : item.type === 'group' ? COLORS.primary : COLORS.goldText}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.chatTitleRow}>
                    <Text style={[styles.chatName, unreadCount > 0 && styles.chatNameUnread]} numberOfLines={1}>
                      {chatTitle(item, usersMap, user?.uid || '')}
                    </Text>
                    <View style={styles.chatMetaTop}>
                      {pinned ? <Ionicons name="pin" size={12} color={COLORS.primary} style={{ marginRight: 2 }} /> : null}
                      <Text style={[styles.chatType, item.type === 'broadcast' && { color: '#92400E', backgroundColor: '#FEF3C7' }, item.type === 'group' && { color: '#3730A3', backgroundColor: '#E0E7FF' }]}>
                        {item.type}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.previewRow}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                      {isOutgoing && (
                        <Ionicons
                          name="checkmark-done"
                          size={14}
                          color={COLORS.primary}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text style={[styles.chatPreview, unreadCount > 0 && styles.chatPreviewUnread]} numberOfLines={1}>
                        {item.last_message ? item.last_message : 'No messages yet'}
                      </Text>
                    </View>
                    <View style={styles.metaRight}>
                      <Text style={styles.chatTime}>{fmtChatTime(item.updated_at)}</Text>
                      {unreadCount > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={styles.chatActions}>
                  <TouchableOpacity onPress={() => setReportChat(item)} style={styles.actionBtn} accessibilityLabel="Report chat">
                    <Ionicons name="flag-outline" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => togglePinChat(item)} style={styles.actionBtn} accessibilityLabel="Pin chat">
                    <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={16} color={pinned ? COLORS.primary : COLORS.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleArchiveChat(item)} style={styles.actionBtn} accessibilityLabel="Archive chat">
                    <Ionicons name={isArchived ? 'file-tray-full' : 'file-tray-outline'} size={16} color={isArchived ? COLORS.primary : COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </ScalePressable>
            );
          }}
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
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: SPACING.md },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
  },
  toolBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
  searchWrap: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  filterTabsContainer: { paddingBottom: SPACING.sm },
  filterTabsScroll: { paddingHorizontal: SPACING.md, gap: 8 },
  filterTabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterTabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTabText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  filterTabTextActive: { color: '#FFF' },
  errorText: { color: '#B3261E', fontSize: 12, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  panel: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
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
  userChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  userChipText: { color: COLORS.textMain, fontSize: 12, fontWeight: '600' },
  userChipTextActive: { color: COLORS.primary },
  createBtn: { marginTop: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700' },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 24 },
  loadingList: { padding: SPACING.md, gap: SPACING.sm },
  chatCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card, flexDirection: 'row', gap: 10 },
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
  directoryContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  directoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  directoryBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  directoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  directorySubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  directorySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  directorySearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textMain,
    padding: 0,
  },
  directoryList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  emptyDirectory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyDirectoryText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactAvatarWrap: {
    position: 'relative',
  },
  contactOnlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  contactStudentId: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  contactAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarTeacher: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  contactAvatarAdmin: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    flexShrink: 1,
  },
  contactRoleBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactRoleBadgeTeacher: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  contactRoleBadgeAdmin: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  contactRoleText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  contactRoleTextTeacher: {
    color: '#6D28D9',
  },
  contactRoleTextAdmin: {
    color: '#92400E',
  },
  contactSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  previewCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  previewPhoto: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: SPACING.md,
  },
  previewPhotoFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewName: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textMain,
    textAlign: 'center',
  },
  previewStatusText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  previewActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  previewMessageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
  },
  previewMessageBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  previewCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseBtnText: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
});
