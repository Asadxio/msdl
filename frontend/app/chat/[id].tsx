import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, arrayUnion, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, updateDoc, where,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { CallParticipant, isPlatformSupported } from '@/lib/agora';
import { sendPushToUserIds } from '@/lib/pushNotifications';
import { EmptyState, ScalePressable, SkeletonCard } from '@/components/ui';

type ChatMeta = {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  name?: string;
  participants: string[];
  participant_names?: Record<string, string>;
  typing?: Record<string, boolean>;
  unread_counts?: Record<string, number>;
};

type MessageItem = {
  id: string;
  text: string;
  sender_id: string;
  sender_name?: string;
  created_at?: { toDate?: () => Date };
  read_by?: string[];
  client_id?: string;
  localOnly?: boolean;
  failed?: boolean;
  deleted_for_everyone?: boolean;
  deleted_for?: string[];
};

function normalizeChatMeta(id: string, raw: any): ChatMeta {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    id,
    type: safe.type === 'group' || safe.type === 'broadcast' ? safe.type : 'direct',
    name: typeof safe.name === 'string' ? safe.name : '',
    participants: Array.isArray(safe.participants) ? safe.participants.filter((p: unknown) => typeof p === 'string') : [],
    participant_names: safe.participant_names && typeof safe.participant_names === 'object' ? safe.participant_names : {},
    typing: safe.typing && typeof safe.typing === 'object' ? safe.typing : {},
    unread_counts: safe.unread_counts && typeof safe.unread_counts === 'object' ? safe.unread_counts : {},
  };
}

function normalizeMessage(id: string, raw: any): MessageItem {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    id,
    text: typeof safe.text === 'string' ? safe.text : '',
    sender_id: typeof safe.sender_id === 'string' ? safe.sender_id : '',
    sender_name: typeof safe.sender_name === 'string' ? safe.sender_name : 'User',
    created_at: safe.created_at || null,
    read_by: Array.isArray(safe.read_by) ? safe.read_by.filter((v: unknown) => typeof v === 'string') : [],
    client_id: typeof safe.client_id === 'string' ? safe.client_id : undefined,
    localOnly: !!safe.localOnly,
    failed: !!safe.failed,
    deleted_for_everyone: !!safe.deleted_for_everyone,
    deleted_for: Array.isArray(safe.deleted_for) ? safe.deleted_for.filter((v: unknown) => typeof v === 'string') : [],
  };
}

const PAGE_SIZE = 20;

function fmtTime(msg: MessageItem) {
  try {
    const dt = msg.created_at?.toDate ? msg.created_at.toDate() : null;
    if (!dt) return '';
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function toMillis(msg: MessageItem): number {
  const dt = msg.created_at?.toDate ? msg.created_at.toDate() : null;
  return dt ? dt.getTime() : 0;
}

const MessageBubble = React.memo(function MessageBubble({
  item,
  mine,
  showSender,
  seenByOthers,
}: {
  item: MessageItem;
  mine: boolean;
  showSender: boolean;
  seenByOthers: boolean;
}) {
  return (
    <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.otherWrap]}>
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble, item.failed && styles.failedBubble]}>
        {showSender ? <Text style={styles.sender}>{item.sender_name || 'User'}</Text> : null}
        <Text style={[styles.msgText, mine && { color: '#fff' }]}>{item.text}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{fmtTime(item)}</Text>
          {mine ? (
            <Ionicons
              name={seenByOthers ? 'checkmark-done' : 'checkmark'}
              size={13}
              color="rgba(255,255,255,0.85)"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
});

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { initiateCall, isInCall, isSocketConnected } = useCall();

  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCursor, setLastCursor] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const typingTimer = useRef<any>(null);
  const listRef = useRef<FlatList<MessageItem>>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'chats', id), (snap) => {
      if (!snap.exists()) {
        setChat(null);
        setLoading(false);
        return;
      }
      setChat(normalizeChatMeta(snap.id, snap.data()));
      setLoading(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setMessages([]);
    setLastCursor(null);
    setHasMore(true);

    const initialQ = query(
      collection(db, 'messages'),
      where('chat_id', '==', id),
      orderBy('created_at', 'desc'),
      limit(PAGE_SIZE),
    );
    const unsub = onSnapshot(initialQ, (snap) => {
      const latest = snap.docs.map((d) => normalizeMessage(d.id, d.data()));
      setMessages((prev) => {
        const confirmedClientIds = new Set(latest.map((m) => m.client_id).filter(Boolean));
        const seen = new Set(latest.map((m) => m.id));
        const older = prev.filter((m) => !seen.has(m.id) && !m.localOnly);
        const pending = prev.filter((m) => m.localOnly && !confirmedClientIds.has(m.client_id));
        return [...latest, ...older, ...pending].sort((a, b) => toMillis(b) - toMillis(a));
      });
      setLastCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);

      if (user?.uid) {
        const firstUnread = latest.find((m) => m.sender_id !== user.uid && !m.read_by?.includes(user.uid));
        if (firstUnread) {
          updateDoc(doc(db, 'messages', firstUnread.id), { read_by: arrayUnion(user.uid) }).catch(() => {});
        }
      }
    });
    return unsub;
  }, [id, user?.uid]);

  const loadMore = async () => {
    if (!id || !lastCursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const olderQ = query(
        collection(db, 'messages'),
        where('chat_id', '==', id),
        orderBy('created_at', 'desc'),
        startAfter(lastCursor),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(olderQ);
      const older = snap.docs.map((d) => normalizeMessage(d.id, d.data()));
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const uniqueOlder = older.filter((m) => !existing.has(m.id));
        return [...prev, ...uniqueOlder];
      });
      setLastCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : lastCursor);
      setHasMore(snap.docs.length === PAGE_SIZE);

      if (user?.uid) {
        const firstUnread = older.find((m) => m.sender_id !== user.uid && !m.read_by?.includes(user.uid));
        if (firstUnread) {
          updateDoc(doc(db, 'messages', firstUnread.id), { read_by: arrayUnion(user.uid) }).catch(() => {});
        }
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const canAccess = useMemo(() => {
    if (!user || !chat) return false;
    const participants = Array.isArray(chat.participants) ? chat.participants : [];
    return chat.type === 'broadcast' || participants.includes(user.uid);
  }, [chat, user]);

  const othersTyping = useMemo(() => {
    if (!chat?.typing || !user?.uid) return false;
    return Object.entries(chat.typing).some(([uid, val]) => uid !== user.uid && !!val);
  }, [chat?.typing, user?.uid]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!chat || !id || !user?.uid) return;
    updateDoc(doc(db, 'chats', id), { [`typing.${user.uid}`]: isTyping }).catch(() => {});
  }, [chat, id, user?.uid]);

  const onType = useCallback((value: string) => {
    setText(value);
    setTyping(!!value.trim());
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1500);
  }, [setTyping]);

  const send = useCallback(async () => {
    if (!id || !user?.uid || sending) return;
    const msg = text.trim();
    if (!msg) return;

    const clientId = `${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage: MessageItem = {
      id: `temp-${clientId}`,
      text: msg,
      sender_id: user.uid,
      sender_name: profile?.name || user.email || 'User',
      created_at: { toDate: () => new Date() },
      read_by: [user.uid],
      client_id: clientId,
      localOnly: true,
    };

    setMessages((prev) => [optimisticMessage, ...prev]);
    setText('');
    setTyping(false);
    setSending(true);
    setSendError('');
    try {
      await addDoc(collection(db, 'messages'), {
        chat_id: id,
        text: msg,
        sender_id: user.uid,
        sender_name: profile?.name || user.email || 'User',
        created_at: serverTimestamp(),
        read_by: [user.uid],
        client_id: clientId,
        deleted_for: [],
        deleted_for_everyone: false,
      });
      const unreadUpdates: Record<string, any> = { [`unread_counts.${user.uid}`]: 0 };
      (chat?.participants || []).forEach((uid) => {
        if (uid !== user.uid) unreadUpdates[`unread_counts.${uid}`] = increment(1);
      });

      await updateDoc(doc(db, 'chats', id), {
        last_message: msg,
        updated_at: serverTimestamp(),
        [`typing.${user.uid}`]: false,
        ...unreadUpdates,
      });
      const recipientIds = (chat?.participants || []).filter((uid) => uid !== user.uid);
      if (recipientIds.length > 0) {
        await sendPushToUserIds(recipientIds, {
          title: profile?.name || 'New message',
          body: msg,
          data: { type: 'chat', chat_id: id },
        }).catch(() => {});
      }
    } catch (error: any) {
      setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, failed: true, localOnly: false } : m)));
      setSendError(error?.message || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [chat?.participants, id, profile?.name, sending, setTyping, text, user?.email, user?.uid]);

  const refreshMessages = useCallback(async () => {
    if (!id || refreshing) return;
    setRefreshing(true);
    try {
      const [chatSnap, messageSnap] = await Promise.all([
        getDoc(doc(db, 'chats', id)),
        getDocs(query(
          collection(db, 'messages'),
          where('chat_id', '==', id),
          orderBy('created_at', 'desc'),
          limit(PAGE_SIZE),
        )),
      ]);
      if (chatSnap.exists()) {
        setChat(normalizeChatMeta(chatSnap.id, chatSnap.data()));
      }
      const latest = messageSnap.docs.map((d) => normalizeMessage(d.id, d.data()));
      setMessages((prev) => {
        const confirmedClientIds = new Set(latest.map((m) => m.client_id).filter(Boolean));
        const pending = prev.filter((m) => m.localOnly && !confirmedClientIds.has(m.client_id));
        return [...latest, ...pending].sort((a, b) => toMillis(b) - toMillis(a));
      });
      setLastCursor(messageSnap.docs.length ? messageSnap.docs[messageSnap.docs.length - 1] : null);
      setHasMore(messageSnap.docs.length === PAGE_SIZE);
    } catch {
      setSendError('Could not refresh chat. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [id, refreshing]);

  const deleteForMe = useCallback(async (message: MessageItem) => {
    if (!user?.uid) return;
    if (message.localOnly) {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      return;
    }
    try {
      await updateDoc(doc(db, 'messages', message.id), {
        deleted_for: arrayUnion(user.uid),
      });
    } catch {
      setSendError('Could not delete message. Please try again.');
    }
  }, [user?.uid]);

  const unsendForEveryone = useCallback(async (message: MessageItem) => {
    if (!user?.uid || message.sender_id !== user.uid) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), {
        text: 'This message was unsent.',
        deleted_for_everyone: true,
        unsent_by: user.uid,
        unsent_at: serverTimestamp(),
      });
    } catch {
      setSendError('Could not unsend message. Please try again.');
    }
  }, [user?.uid]);

  const openMessageActions = useCallback((item: MessageItem) => {
    const canUnsend = item.sender_id === user?.uid && !item.localOnly;
    Alert.alert('Message options', 'Choose an action for this message.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete for me', onPress: () => { void deleteForMe(item); } },
      ...(canUnsend ? [{ text: 'Unsend for everyone', style: 'destructive' as const, onPress: () => { void unsendForEveryone(item); } }] : []),
    ]);
  }, [deleteForMe, unsendForEveryone, user?.uid]);

  useEffect(() => {
    if (!id || !user?.uid || !chat) return;
    updateDoc(doc(db, 'chats', id), { [`unread_counts.${user.uid}`]: 0 }).catch(() => {});
  }, [chat, id, user?.uid]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (id && user?.uid) {
      updateDoc(doc(db, 'chats', id), { [`typing.${user.uid}`]: false }).catch(() => {});
    }
  }, [id, user?.uid]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages.length]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.deleted_for?.includes(user?.uid || '')),
    [messages, user?.uid],
  );

  const renderMessage = useCallback(({ item }: { item: MessageItem }) => {
    const mine = item.sender_id === user?.uid;
    const otherParticipantCount = Math.max((chat?.participants?.length || 1) - 1, 1);
    const seenByOthers = (item.read_by?.length || 1) > 1 || (item.read_by?.length || 0) >= otherParticipantCount + 1;
    return (
      <TouchableOpacity activeOpacity={0.8} onLongPress={() => openMessageActions(item)}>
        <MessageBubble
          item={{ ...item, text: item.deleted_for_everyone ? 'This message was unsent.' : item.text }}
          mine={mine}
          showSender={!mine && chat?.type !== 'direct'}
          seenByOthers={seenByOthers}
        />
      </TouchableOpacity>
    );
  }, [chat?.participants?.length, chat?.type, openMessageActions, user?.uid]);

  if (loading) {
    return (
      <View style={[styles.skeletonWrap, { paddingTop: insets.top + SPACING.md }]}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </View>
    );
  }

  if (!chat || !canAccess) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.blockedText}>You don&apos;t have access to this chat.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backPlainBtn}>
          <Text style={styles.backPlainText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const title = chat.type === 'group' ? (chat.name || 'Group Chat') : chat.type === 'broadcast' ? 'Broadcast' : 'Direct Chat';
  
  // Get the other participant for direct chats (for 1-to-1 calls)
  const otherParticipant: CallParticipant | null = useMemo(() => {
    if (chat?.type !== 'direct' || !user?.uid) return null;
    const otherId = chat.participants.find((p) => p !== user.uid);
    if (!otherId) return null;
    return {
      id: otherId,
      name: chat.participant_names?.[otherId] || 'User',
    };
  }, [chat, user?.uid]);

  const handleVoiceCall = useCallback(async () => {
    if (!otherParticipant) {
      Alert.alert('Error', 'Cannot initiate call');
      return;
    }
    if (!isPlatformSupported()) {
      Alert.alert('Not Supported', 'Voice calls are only available on mobile devices');
      return;
    }
    if (!isSocketConnected) {
      Alert.alert('Connection Error', 'Not connected to server. Please try again.');
      return;
    }
    await initiateCall(otherParticipant, 'voice');
  }, [otherParticipant, initiateCall, isSocketConnected]);

  const handleVideoCall = useCallback(async () => {
    if (!otherParticipant) {
      Alert.alert('Error', 'Cannot initiate call');
      return;
    }
    if (!isPlatformSupported()) {
      Alert.alert('Not Supported', 'Video calls are only available on mobile devices');
      return;
    }
    if (!isSocketConnected) {
      Alert.alert('Connection Error', 'Not connected to server. Please try again.');
      return;
    }
    await initiateCall(otherParticipant, 'video');
  }, [otherParticipant, initiateCall, isSocketConnected]);

  const showCallButtons = chat?.type === 'direct' && otherParticipant && !isInCall;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <ScalePressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </ScalePressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>{title}</Text>
          {othersTyping ? <Text style={styles.typingText}>Typing...</Text> : null}
        </View>
        {/* Call buttons for direct chats */}
        {showCallButtons && (
          <>
            <ScalePressable style={styles.callBtn} onPress={handleVoiceCall}>
              <Ionicons name="call" size={20} color={COLORS.primary} />
            </ScalePressable>
            <ScalePressable style={styles.callBtn} onPress={handleVideoCall}>
              <Ionicons name="videocam" size={20} color={COLORS.primary} />
            </ScalePressable>
          </>
        )}
        <ScalePressable style={styles.backBtn} onPress={refreshMessages} disabled={refreshing}>
          {refreshing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
        </ScalePressable>
      </View>

      <FlatList
        ref={listRef}
        inverted
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={8}
        removeClippedSubviews
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        ListEmptyComponent={(
          <EmptyState icon="chatbubble-ellipses-outline" message="No messages yet. Start the conversation." />
        )}
        renderItem={renderMessage}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={onType}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <ScalePressable style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </ScalePressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonWrap: { flex: 1, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  blockedText: { fontSize: 15, color: COLORS.textMuted, marginBottom: 10 },
  backPlainBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  backPlainText: { color: COLORS.textMain, fontWeight: '600' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  typingText: { fontSize: 12, color: COLORS.secondary, marginTop: 1 },
  list: { padding: SPACING.md, gap: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, gap: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  bubbleWrap: { width: '100%' },
  mineWrap: { alignItems: 'flex-end' },
  otherWrap: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mineBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  failedBubble: { borderColor: '#FCA5A5', borderWidth: 1 },
  sender: { fontSize: 11, color: COLORS.secondary, fontWeight: '700', marginBottom: 4 },
  msgText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  metaRow: { marginTop: 4, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', alignItems: 'center' },
  time: { fontSize: 10, color: COLORS.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  sendError: {
    color: '#B3261E',
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    fontSize: 12,
  },
  input: {
    flex: 1, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surfaceAlt, color: COLORS.textMain,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  callBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt, marginRight: 8 },
});
