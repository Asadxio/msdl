import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, AppState,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { dispatchNotification } from '@/lib/dispatchNotification';
import { EmptyState, ScalePressable, SkeletonCard } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Network from 'expo-network';
import { uploadUriFile } from '@/lib/storage';
import { completeItem, enqueue, lockReadyItems, nextBackoffMs, patchItem, type QueueItem } from '@/lib/chatReliability';
import { dedupeMessages, mergeServerAndLocal } from '@/lib/chatReconciliation';
import { logChatMetric } from '@/lib/chatTelemetry';
import { ReportReasonModal } from '@/components/ReportReasonModal';
import { submitUgcReport, type ReportReason } from '@/lib/ugcReports';

type ChatMeta = {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  name?: string;
  participants: string[];
  participant_names?: Record<string, string>;
  typing?: Record<string, { is_typing: boolean; updated_at?: { toDate?: () => Date } }>;
  muted_by?: string[];
  blocked_pairs?: string[];
  unread_counts?: Record<string, number>;
};

type MessageDeliveryStatus = 'pending' | 'uploading' | 'retrying' | 'failed' | 'sent' | 'seen';

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
  message_type?: 'text' | 'image' | 'video' | 'audio';
  media_url?: string;
  media_name?: string;
  media_size?: number;
  status?: MessageDeliveryStatus;
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
    message_type: safe.message_type === 'image' || safe.message_type === 'video' || safe.message_type === 'audio' ? safe.message_type : 'text',
    media_url: typeof safe.media_url === 'string' ? safe.media_url : undefined,
    media_name: typeof safe.media_name === 'string' ? safe.media_name : undefined,
    media_size: typeof safe.media_size === 'number' ? safe.media_size : undefined,
    status: safe.status === 'pending' || safe.status === 'uploading' || safe.status === 'retrying' || safe.status === 'failed' || safe.status === 'seen' ? safe.status : 'sent',
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
  onReport,
}: {
  item: MessageItem;
  mine: boolean;
  showSender: boolean;
  seenByOthers: boolean;
  onReport: () => void;
}) {
  return (
    <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.otherWrap]}>
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble, item.failed && styles.failedBubble]}>
        {showSender ? <Text style={styles.sender}>{item.sender_name || 'User'}</Text> : null}
        <Text style={[styles.msgText, mine && { color: '#fff' }]}>{item.text}</Text>
        {item.message_type === 'image' && item.media_url ? <Image source={{ uri: item.media_url }} style={styles.msgImage} /> : null}
        {item.message_type && item.message_type !== 'text' && item.message_type !== 'image' ? <Text style={[styles.attachmentText, mine && { color: 'rgba(255,255,255,0.88)' }]}>{item.message_type.toUpperCase()} attachment {item.media_name ? `• ${item.media_name}` : ''}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{fmtTime(item)}</Text>
          <TouchableOpacity onPress={onReport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Report message">
            <Ionicons name="flag-outline" size={13} color={mine ? 'rgba(255,255,255,0.85)' : COLORS.textMuted} />
          </TouchableOpacity>
          {mine ? (
            <Ionicons
              name={item.failed ? 'alert-circle' : (seenByOthers ? 'checkmark-done' : 'checkmark')}
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

  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCursor, setLastCursor] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [reportTarget, setReportTarget] = useState<MessageItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<MessageItem>>(null);
  const chatUnsubRef = useRef<(() => void) | null>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);
  const flushingRef = useRef(false);
  const onlineRef = useRef(true);
  const lastFlushAtRef = useRef(0);
  const lastSnapshotWasCacheRef = useRef(false);
  const lastAckedRef = useRef<string>('');

  useEffect(() => {
    if (!id) return;
    chatUnsubRef.current?.();
    try {
      const unsub = onSnapshot(
        doc(db, 'chats', id),
        (snap) => {
          if (!snap.exists()) {
            setChat(null);
            setLoading(false);
            return;
          }
          setChat(normalizeChatMeta(snap.id, snap.data()));
          setLoading(false);
        },
        (error) => {
          console.log('[ChatDetail] chat listener ERROR', error);
          setChat(null);
          setLoading(false);
          setSendError('Could not load chat. Please try again.');
        },
      );
      chatUnsubRef.current = unsub;
    } catch (error) {
      console.log('[ChatDetail] chat listener setup ERROR', error);
      setChat(null);
      setLoading(false);
      setSendError('Could not load chat. Please try again.');
    }
    return () => {
      chatUnsubRef.current?.();
      chatUnsubRef.current = null;
    };
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

    messagesUnsubRef.current?.();
    try {
      const unsub = onSnapshot(
        initialQ,
        async (snap) => {
          const latest = snap.docs.map((d) => normalizeMessage(d.id, d.data()));
          setMessages((prev) => dedupeMessages(mergeServerAndLocal(latest, prev)) as MessageItem[]);
          setLastCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
          setHasMore(snap.docs.length === PAGE_SIZE);

          if (user?.uid) {
            const unread = latest.filter((m) => m.sender_id !== user.uid && !m.read_by?.includes(user.uid));
            if (unread.length > 0) {
              const newest = unread[0].id;
              if (lastAckedRef.current !== newest) {
                lastAckedRef.current = newest;
                await Promise.all(unread.slice(0, 10).map(async (m) => {
                  await updateDoc(doc(db, 'messages', m.id), { read_by: arrayUnion(user.uid), status: 'seen', seen_at: serverTimestamp() }).catch(() => {});
                }));
                logChatMetric({ name: 'delivery_seen_written', chat_id: id, value: unread.slice(0, 10).length, ts: Date.now() });
              }
            }
          }
          if (lastSnapshotWasCacheRef.current && !snap.metadata.fromCache) {
            void refreshMessages();
          }
          lastSnapshotWasCacheRef.current = snap.metadata.fromCache;
        },
        (error) => {
          console.log('[ChatDetail] messages listener ERROR', error);
          setSendError('Could not load messages. Please try again.');
        },
      );
      messagesUnsubRef.current = unsub;
    } catch (error) {
      console.log('[ChatDetail] messages listener setup ERROR', error);
      setSendError('Could not load messages. Please try again.');
    }

    return () => {
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
    };
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
    } catch (error) {
      console.log('[ChatDetail] loadMore ERROR', error);
      setSendError('Could not load older messages. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const chatParticipants = useMemo(() => (
    Array.isArray(chat?.participants) ? chat.participants.filter((uid) => typeof uid === 'string') : []
  ), [chat?.participants]);

  const canAccess = useMemo(() => {
    if (!user || !chat) return false;
    return chat.type === 'broadcast' || chatParticipants.includes(user.uid);
  }, [chat, chatParticipants, user]);

  const canSendMessages = useMemo(() => {
    if (!user?.uid || !chat) return false;
    if (chat.type === 'broadcast') return isAdmin;
    if (chat.type === 'direct') {
      const other = chatParticipants.find((p) => p !== user.uid) || '';
      const pairA = `${user.uid}:${other}`;
      const pairB = `${other}:${user.uid}`;
      if ((chat.blocked_pairs || []).includes(pairA) || (chat.blocked_pairs || []).includes(pairB)) return false;
    }
    return chatParticipants.includes(user.uid);
  }, [chat, chatParticipants, isAdmin, user?.uid]);

  const othersTyping = useMemo(() => {
    if (!chat?.typing || !user?.uid) return false;
    const now = Date.now();
    return Object.entries(chat.typing).some(([uid, val]) => {
      const typingVal = val as any;
      const lastMs = typingVal?.updated_at?.toDate ? typingVal.updated_at.toDate().getTime() : 0;
      return uid !== user.uid && typingVal?.is_typing === true && now - lastMs < 12000;
    });
  }, [chat?.typing, user?.uid]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!chat || !id || !user?.uid || !canSendMessages) return;
    updateDoc(doc(db, 'chats', id), { [`typing.${user.uid}`]: { is_typing: isTyping, updated_at: serverTimestamp() } }).catch(() => {});
  }, [canSendMessages, chat, id, user?.uid]);

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
    if (!canSendMessages) {
      setSendError('You do not have permission to send messages in this chat.');
      return;
    }

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
      const outboxItem: QueueItem = {
        id: `${id}_${clientId}`,
        chat_id: id,
        created_at_ms: Date.now(),
        status: 'pending',
        retry_count: 0,
        next_retry_at_ms: Date.now(),
        message_type: 'text',
        text: msg,
        sender_id: user.uid,
        sender_name: profile?.name || user.email || 'User',
        read_by: [user.uid],
        push_dedupe_id: `chat:${id}:${clientId}`,
      };
      await enqueue(id, outboxItem);
      await setDoc(doc(db, 'messages', `${id}_${clientId}`), {
        chat_id: id,
        text: msg,
        sender_id: user.uid,
        sender_name: profile?.name || user.email || 'User',
        created_at: serverTimestamp(),
        read_by: [user.uid],
        client_id: clientId,
        deleted_for: [],
        deleted_for_everyone: false,
        message_type: 'text',
        media_url: '',
        media_name: '',
        media_size: 0,
      });
      const participants = chatParticipants;
      const unreadUpdates: Record<string, any> = { [`unread_counts.${user.uid}`]: 0 };
      participants.forEach((uid) => {
        if (uid !== user.uid) unreadUpdates[`unread_counts.${uid}`] = increment(1);
      });

      await updateDoc(doc(db, 'chats', id), {
        last_message: msg,
        updated_at: serverTimestamp(),
        [`typing.${user.uid}`]: { is_typing: false, updated_at: serverTimestamp() },
        ...unreadUpdates,
      });
      const recipientIds = participants.filter((uid) => uid !== user.uid);
      if (recipientIds.length > 0) {
        const pushDedupeId = `chat:${id}:${clientId}`;
        await dispatchNotification({
          channel: 'chat',
          event: 'chat_message',
          title: profile?.name || 'New message',
          body: msg,
          recipientIds,
          data: { chat_id: id },
          dedupeId: pushDedupeId,
        }).catch(() => {});
      }
    } catch (error: unknown) {
      setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, failed: true, localOnly: false } : m)));
      setSendError(error instanceof Error ? error.message : 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [canSendMessages, chatParticipants, id, profile?.name, sending, setTyping, text, user?.email, user?.uid]);


  const sendMedia = useCallback(async (kind: 'image' | 'video' | 'audio') => {
    if (!id || !user?.uid || sending) return;
    try {
      let fileUri = '';
      let fileName = '';
      let fileSize = 0;
      let contentType = 'application/octet-stream';
      if (kind === 'image' || kind === 'video') {
        const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos, quality: 0.7 });
        if (pick.canceled || !pick.assets?.[0]?.uri) return;
        const a = pick.assets[0];
        fileUri = a.uri; fileName = a.fileName || `${kind}_${Date.now()}`; fileSize = Number(a.fileSize || 0);
        contentType = kind === 'image' ? 'image/jpeg' : 'video/mp4';
      } else {
        const pick = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true, multiple: false });
        if (pick.canceled || !pick.assets?.[0]?.uri) return;
        const a = pick.assets[0];
        fileUri = a.uri; fileName = a.name || `audio_${Date.now()}`; fileSize = Number(a.size || 0);
        contentType = a.mimeType || 'audio/mpeg';
      }
      const maxBytes = kind === 'video' ? 30 * 1024 * 1024 : 10 * 1024 * 1024;
      if (fileSize > maxBytes) { setSendError(`Selected ${kind} is too large.`); return; }
      const ext = kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'mp3';
      const clientId = `${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await enqueue(id, {
        id: `${id}_${clientId}`,
        chat_id: id,
        created_at_ms: Date.now(),
        status: 'pending',
        retry_count: 0,
        next_retry_at_ms: Date.now(),
        message_type: kind,
        text: kind === 'audio' ? 'Audio message' : '',
        sender_id: user.uid,
        sender_name: profile?.name || user.email || 'User',
        read_by: [user.uid],
        media_local_uri: fileUri,
        media_name: fileName,
        media_size: fileSize,
        content_type: contentType,
        ext,
        push_dedupe_id: `chat:${id}:${clientId}`,
      });
      const mediaUrl = await uploadUriFile({ uri: fileUri, path: `chat_media/${id}/${user.uid}/${Date.now()}.${ext}`, contentType });
      await patchItem(id, `${id}_${clientId}`, { status: 'uploading', media_url: mediaUrl });
      await setDoc(doc(db, 'messages', `${id}_${clientId}`), {
        chat_id: id, text: kind === 'audio' ? 'Audio message' : '', sender_id: user.uid, sender_name: profile?.name || user.email || 'User',
        created_at: serverTimestamp(), read_by: [user.uid], client_id: clientId, deleted_for: [], deleted_for_everyone: false,
        message_type: kind, media_url: mediaUrl, media_name: fileName, media_size: fileSize,
      });
      await updateDoc(doc(db, 'chats', id), { last_message: kind.toUpperCase(), updated_at: serverTimestamp() });
    } catch (error: any) { setSendError(error?.message || 'Media send failed.'); }
  }, [id, profile?.name, sending, user?.email, user?.uid]);

  const flushOutbox = useCallback(async () => {
    if (!id || !user?.uid || flushingRef.current || !onlineRef.current) return;
    const now = Date.now();
    if (now - lastFlushAtRef.current < 1500) return;
    lastFlushAtRef.current = now;
    const started = Date.now();
    flushingRef.current = true;
    try {
      const ready = await lockReadyItems(id, Date.now());
      logChatMetric({ name: 'queue_size', chat_id: id, value: ready.length, ts: Date.now() });
      logChatMetric({ name: 'flush_started', chat_id: id, value: ready.length, ts: Date.now() });
      for (const item of ready) {
        try {
          if (item.message_type !== 'text' && !item.media_url && item.media_local_uri) {
            await patchItem(id, item.id, { status: 'uploading' });
            const mediaUrl = await uploadUriFile({ uri: item.media_local_uri, path: `chat_media/${id}/${user.uid}/${Date.now()}.${item.ext || 'bin'}`, contentType: item.content_type || 'application/octet-stream' });
            await patchItem(id, item.id, { media_url: mediaUrl });
            item.media_url = mediaUrl;
          }
          await setDoc(doc(db, 'messages', item.id), {
            chat_id: id, text: item.text, sender_id: item.sender_id, sender_name: item.sender_name, created_at: serverTimestamp(),
            read_by: item.read_by, client_id: item.id.replace(`${id}_`, ''), deleted_for: [], deleted_for_everyone: false,
            message_type: item.message_type, media_url: item.media_url || '', media_name: item.media_name || '', media_size: item.media_size || 0,
            status: 'sent', sent_at: serverTimestamp(), retry_count: item.retry_count, failed_reason: '', push_dedupe_id: item.push_dedupe_id,
          }, { merge: true });
          await completeItem(id, item.id);
        } catch (e: any) {
          const retryCount = (item.retry_count || 0) + 1;
          const terminal = retryCount >= 5;
          if (item.message_type !== 'text') {
            logChatMetric({ name: 'upload_failed', chat_id: id, ts: Date.now(), meta: { type: item.message_type, retry_count: retryCount } });
          }
          if (terminal) {
            logChatMetric({ name: 'retry_exhausted', chat_id: id, ts: Date.now(), meta: { message_id: item.id, retry_count: retryCount } });
          }
          await patchItem(id, item.id, {
            retry_count: retryCount,
            status: terminal ? 'failed' : 'retrying',
            failed_reason: e?.message || 'flush_failed',
            next_retry_at_ms: Date.now() + (terminal ? 0 : nextBackoffMs(retryCount)),
            locked_until_ms: 0,
          });
        }
      }
      logChatMetric({ name: 'flush_finished', chat_id: id, duration_ms: Date.now() - started, ts: Date.now() });
    } catch (error: any) {
      logChatMetric({ name: 'flush_error', chat_id: id, ts: Date.now(), meta: { message: error?.message || 'unknown' } });
    } finally {
      flushingRef.current = false;
    }
  }, [id, user?.uid]);

  useEffect(() => {
    if (!id) return;
    let netTimer: ReturnType<typeof setInterval> | null = null;
    const timer = setInterval(() => { void flushOutbox(); }, 4000);
    const hydrateNet = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const nextOnline = !!state.isConnected && state.isInternetReachable !== false;
        const wasOnline = onlineRef.current;
        onlineRef.current = nextOnline;
        if (!wasOnline && nextOnline) void flushOutbox();
      } catch {
        onlineRef.current = true;
      }
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void hydrateNet();
        void flushOutbox();
      }
    });
    netTimer = setInterval(() => { void hydrateNet(); }, 5000);
    void hydrateNet();
    void flushOutbox();
    return () => {
      clearInterval(timer);
      if (netTimer) clearInterval(netTimer);
      sub.remove();
    };
  }, [flushOutbox, id]);

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
      { text: 'Report message', onPress: () => setReportTarget(item) },
      ...(canUnsend ? [{ text: 'Unsend for everyone', style: 'destructive' as const, onPress: () => { void unsendForEveryone(item); } }] : []),
    ]);
  }, [deleteForMe, unsendForEveryone, user?.uid]);

  const submitMessageReport = useCallback(async (reason: ReportReason) => {
    if (!user?.uid || !reportTarget) return;
    const target = reportTarget;
    setReportTarget(null);
    try {
      await submitUgcReport({
        reportedBy: user.uid,
        targetType: 'chat_message',
        targetId: target.id,
        reason,
        accusedUserId: target.sender_id,
        metadata: { chat_id: id || '', message_type: target.message_type || 'text' },
      });
      Alert.alert('Report submitted', 'Thank you. An admin will review this message.');
    } catch {
      setSendError('Could not report message.');
    }
  }, [id, reportTarget, user?.uid]);

  const toggleMuteChat = useCallback(async () => {
    if (!id || !user?.uid || !chat) return;
    const muted = (chat.muted_by || []).includes(user.uid);
    await updateDoc(doc(db, 'chats', id), { muted_by: muted ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  }, [chat, id, user?.uid]);

  const blockOtherUser = useCallback(async () => {
    if (!id || !user?.uid || !chat || chat.type !== 'direct') return;
    const other = chatParticipants.find((p) => p !== user.uid);
    if (!other) return;
    await updateDoc(doc(db, 'chats', id), {
      blocked_pairs: arrayUnion(`${user.uid}:${other}`),
      hidden_by: arrayUnion(user.uid),
    });
    setSendError('User blocked. Messaging disabled for this chat.');
  }, [chat, chatParticipants, id, user?.uid]);

  useEffect(() => {
    if (!id || !user?.uid || !chat || (chat.type === 'broadcast' && !isAdmin)) return;
    updateDoc(doc(db, 'chats', id), { [`unread_counts.${user.uid}`]: 0 }).catch(() => {});
  }, [chat, id, isAdmin, user?.uid]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (id && user?.uid && canSendMessages) {
      updateDoc(doc(db, 'chats', id), { [`typing.${user.uid}`]: { is_typing: false, updated_at: serverTimestamp() } }).catch(() => {});
    }
  }, [canSendMessages, id, user?.uid]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages.length]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.deleted_for?.includes(user?.uid || '')),
    [messages, user?.uid],
  );
  const keyExtractor = useCallback((item: MessageItem) => item.id, []);
  const listFooter = useMemo(() => (loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} /> : null), [loadingMore]);
  const listEmpty = useMemo(() => (
    <EmptyState icon="chatbubble-ellipses-outline" message="No messages yet. Start the conversation." />
  ), []);

  const renderMessage = useCallback(({ item }: { item: MessageItem }) => {
    const mine = item.sender_id === user?.uid;
    const otherParticipantCount = Math.max(chatParticipants.length - 1, 1);
    const seenByOthers = (item.read_by?.length || 1) > 1 || (item.read_by?.length || 0) >= otherParticipantCount + 1;
    return (
      <TouchableOpacity activeOpacity={0.8} onLongPress={() => openMessageActions(item)}>
        <MessageBubble
          item={{ ...item, text: item.deleted_for_everyone ? 'This message was unsent.' : item.text }}
          mine={mine}
          showSender={!mine && chat?.type !== 'direct'}
          seenByOthers={seenByOthers}
          onReport={() => setReportTarget(item)}
        />
      </TouchableOpacity>
    );
  }, [chat?.type, chatParticipants.length, openMessageActions, user?.uid]);

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
        <ScalePressable style={styles.backBtn} onPress={refreshMessages} disabled={refreshing}>
          {refreshing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
        </ScalePressable>
        <ScalePressable style={styles.backBtn} onPress={() => { void toggleMuteChat(); }}>
          <Ionicons name={(chat.muted_by || []).includes(user?.uid || '') ? 'notifications-off-outline' : 'notifications-outline'} size={18} color={COLORS.primary} />
        </ScalePressable>
        {chat.type === 'direct' ? (
          <ScalePressable style={styles.backBtn} onPress={() => { void blockOtherUser(); }}>
            <Ionicons name="ban-outline" size={18} color="#B3261E" />
          </ScalePressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        inverted
        data={visibleMessages}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={40}
        windowSize={6}
        removeClippedSubviews
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        renderItem={renderMessage}
      />

      <ReportReasonModal
        visible={!!reportTarget}
        title="Report message"
        onClose={() => setReportTarget(null)}
        onSelectReason={(reason) => { void submitMessageReport(reason); }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, !canSendMessages && styles.inputDisabled]}
            value={text}
            onChangeText={onType}
            placeholder={canSendMessages ? 'Type a message...' : 'Only admins can send broadcast messages'}
            placeholderTextColor={COLORS.textMuted}
            editable={canSendMessages}
            multiline
          />
          <ScalePressable style={styles.mediaBtn} onPress={() => { void sendMedia('image'); }}><Ionicons name="image-outline" size={18} color={COLORS.primary} /></ScalePressable>
          <ScalePressable style={styles.mediaBtn} onPress={() => { void sendMedia('video'); }}><Ionicons name="videocam-outline" size={18} color={COLORS.primary} /></ScalePressable>
          <ScalePressable style={styles.mediaBtn} onPress={() => { void sendMedia('audio'); }}><Ionicons name="mic-outline" size={18} color={COLORS.primary} /></ScalePressable>
          <ScalePressable style={[styles.sendBtn, (!text.trim() || sending || !canSendMessages) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending || !canSendMessages}>
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
  inputDisabled: { opacity: 0.7 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  mediaBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  msgImage: { width: 180, height: 180, borderRadius: 10, marginTop: 6 },
  attachmentText: { marginTop: 4, fontSize: 12, color: COLORS.textMuted },
});
