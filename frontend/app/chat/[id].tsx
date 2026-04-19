import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc, arrayUnion, collection, doc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, updateDoc, where,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { sendPushToUserIds } from '@/lib/pushNotifications';

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
};

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

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCursor, setLastCursor] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const typingTimer = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'chats', id), (snap) => {
      if (!snap.exists()) {
        setChat(null);
        setLoading(false);
        return;
      }
      setChat({ id: snap.id, ...(snap.data() as any) });
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
      const latest = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MessageItem[];
      setMessages((prev) => {
        const seen = new Set(latest.map((m) => m.id));
        const older = prev.filter((m) => !seen.has(m.id));
        return [...latest, ...older];
      });
      setLastCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);

      if (user?.uid) {
        latest.forEach((m) => {
          if (m.sender_id !== user.uid && !m.read_by?.includes(user.uid)) {
            updateDoc(doc(db, 'messages', m.id), { read_by: arrayUnion(user.uid) }).catch(() => {});
          }
        });
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
      const older = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MessageItem[];
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const uniqueOlder = older.filter((m) => !existing.has(m.id));
        return [...prev, ...uniqueOlder];
      });
      setLastCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : lastCursor);
      setHasMore(snap.docs.length === PAGE_SIZE);

      if (user?.uid) {
        older.forEach((m) => {
          if (m.sender_id !== user.uid && !m.read_by?.includes(user.uid)) {
            updateDoc(doc(db, 'messages', m.id), { read_by: arrayUnion(user.uid) }).catch(() => {});
          }
        });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const canAccess = useMemo(() => {
    if (!user || !chat) return false;
    return chat.type === 'broadcast' || chat.participants.includes(user.uid);
  }, [chat, user]);

  const othersTyping = useMemo(() => {
    if (!chat?.typing || !user?.uid) return false;
    return Object.entries(chat.typing).some(([uid, val]) => uid !== user.uid && !!val);
  }, [chat?.typing, user?.uid]);

  const setTyping = (isTyping: boolean) => {
    if (!chat || !id || !user?.uid) return;
    updateDoc(doc(db, 'chats', id), { [`typing.${user.uid}`]: isTyping }).catch(() => {});
  };

  const onType = (value: string) => {
    setText(value);
    setTyping(!!value.trim());
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1500);
  };

  const send = async () => {
    if (!id || !user?.uid || sending) return;
    const msg = text.trim();
    if (!msg) return;

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
      setText('');
    } catch (error: any) {
      setSendError(error?.message || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

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

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>{title}</Text>
          {othersTyping ? <Text style={styles.typingText}>Typing...</Text> : null}
        </View>
      </View>

      <FlatList
        inverted
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={36} color={COLORS.border} />
            <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.uid;
          return (
            <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.otherWrap]}>
              <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble]}>
                {!mine && chat.type !== 'direct' ? <Text style={styles.sender}>{item.sender_name || 'User'}</Text> : null}
                <Text style={[styles.msgText, mine && { color: '#fff' }]}>{item.text}</Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{fmtTime(item)}</Text>
                  {mine ? <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{(item.read_by?.length || 1) > 1 ? 'Read' : 'Sent'}</Text> : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={onType}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.border}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  sender: { fontSize: 11, color: COLORS.secondary, fontWeight: '700', marginBottom: 4 },
  msgText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  metaRow: { marginTop: 4, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
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
});
