/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, AppState,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where,
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as ImageManipulator from 'expo-image-manipulator';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { dispatchNotification } from '@/lib/dispatchNotification';
import { EmptyState, FeedbackBanner, ScalePressable, SkeletonCard } from '@/components/ui';
import * as Network from 'expo-network';
import { completeItem, enqueue, lockReadyItems, nextBackoffMs, patchItem, type QueueItem } from '@/lib/chatReliability';
import { dedupeMessages, mergeServerAndLocal } from '@/lib/chatReconciliation';
import { logChatMetric } from '@/lib/chatTelemetry';
import { ReportReasonModal } from '@/components/ReportReasonModal';
import { submitUgcReport, type ReportReason } from '@/lib/ugcReports';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { canSendMessage, canDeleteMessageForEveryone, canAddReaction } from '@/lib/chatPermissions';

type ChatMeta = {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  name?: string;
  participants: string[];
  participant_names?: Record<string, string>;
  last_message?: string;
  typing?: Record<string, { is_typing: boolean; updated_at?: { toDate?: () => Date } }>;
  pinned_by?: string[];
  hidden_by?: string[];
  archived_by?: string[];
  muted_by?: string[];
  blocked_pairs?: string[];
  unread_counts?: Record<string, number>;
};

type MessageDeliveryStatus = 'pending' | 'uploading' | 'retrying' | 'failed' | 'sent' | 'delivered' | 'seen';

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
  is_deleted?: boolean;
  deleted_for?: string[];
  message_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
  media_url?: string;
  media_name?: string;
  reply_to?: string;
  reply_snippet?: string;
  media_size?: number;
  reactions?: Record<string, string>;
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
    last_message: typeof safe.last_message === 'string' ? safe.last_message : '',
    typing: safe.typing && typeof safe.typing === 'object' ? safe.typing : {},
    unread_counts: safe.unread_counts && typeof safe.unread_counts === 'object' ? safe.unread_counts : {},
    pinned_by: Array.isArray(safe.pinned_by) ? safe.pinned_by.filter((v: unknown) => typeof v === 'string') : [],
    hidden_by: Array.isArray(safe.hidden_by) ? safe.hidden_by.filter((v: unknown) => typeof v === 'string') : [],
    archived_by: Array.isArray(safe.archived_by) ? safe.archived_by.filter((v: unknown) => typeof v === 'string') : [],
    muted_by: Array.isArray(safe.muted_by) ? safe.muted_by.filter((v: unknown) => typeof v === 'string') : [],
    blocked_pairs: Array.isArray(safe.blocked_pairs) ? safe.blocked_pairs.filter((v: unknown) => typeof v === 'string') : [],
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
    deleted_for_everyone: !!safe.deleted_for_everyone || !!safe.is_deleted,
    is_deleted: !!safe.is_deleted || !!safe.deleted_for_everyone,
    deleted_for: Array.isArray(safe.deleted_for) ? safe.deleted_for.filter((v: unknown) => typeof v === 'string') : [],
    message_type: safe.message_type === 'image' || safe.message_type === 'video' || safe.message_type === 'audio' || safe.message_type === 'document' ? safe.message_type : 'text',
    media_url: typeof safe.media_url === 'string' ? safe.media_url : undefined,
    media_name: typeof safe.media_name === 'string' ? safe.media_name : undefined,
    media_size: typeof safe.media_size === 'number' ? safe.media_size : undefined,
    reply_to: typeof safe.reply_to === 'string' ? safe.reply_to : undefined,
    reply_snippet: typeof safe.reply_snippet === 'string' ? safe.reply_snippet : undefined,
    reactions: safe.reactions && typeof safe.reactions === 'object' ? safe.reactions : {},
    status: safe.status === 'pending' || safe.status === 'uploading' || safe.status === 'retrying' || safe.status === 'failed' || safe.status === 'delivered' || safe.status === 'seen' ? safe.status : 'sent',
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
  try {
    const dt = msg.created_at?.toDate ? msg.created_at.toDate() : null;
    if (dt && !isNaN(dt.getTime())) return dt.getTime();
  } catch {
    // ignore
  }
  if (typeof (msg as any).created_at_ms === 'number' && (msg as any).created_at_ms > 0) {
    return (msg as any).created_at_ms;
  }
  if (msg.localOnly || msg.status === 'pending' || !msg.created_at) {
    return Date.now();
  }
  return 0;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}


function VoiceNotePlayer({
  mediaUrl,
  durationSec,
  mine,
  isUploading,
  playThroughEarpiece,
}: {
  mediaUrl?: string;
  durationSec?: number;
  mine: boolean;
  isUploading?: boolean;
  playThroughEarpiece?: boolean;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState((durationSec || 0) * 1000);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const togglePlayback = async () => {
    if (!mediaUrl || isUploading) return;

    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync().catch(() => {});
        setIsPlaying(false);
      } else {
        await sound.playAsync().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    try {
      setIsLoading(true);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: !!playThroughEarpiece,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: mediaUrl },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) {
            if (status.error) {
              setIsPlaying(false);
              setIsLoading(false);
            }
            return;
          }
          setPositionMs(status.positionMillis || 0);
          if (status.durationMillis) {
            setDurationMs(status.durationMillis);
          }
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionMs(0);
          }
        }
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch {
      Alert.alert('Playback Error', 'Could not play voice note.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = async (ratio: number) => {
    if (!sound || !durationMs) return;
    const seekTo = Math.max(0, Math.min(durationMs, durationMs * ratio));
    await sound.setPositionAsync(seekTo).catch(() => {});
    setPositionMs(seekTo);
  };

  const formatSec = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100)) : 0;

  return (
    <View style={[styles.voiceNoteWrap, mine && styles.voiceNoteWrapMine]}>
      <TouchableOpacity
        style={[styles.voicePlayBtn, mine && styles.voicePlayBtnMine]}
        onPress={togglePlayback}
        activeOpacity={0.7}
        disabled={isUploading || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={mine ? '#fff' : COLORS.primary} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={mine ? '#fff' : COLORS.primary}
          />
        )}
      </TouchableOpacity>

      <View style={styles.voiceProgressWrap}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.voiceBarTrack}
          onPress={(e) => {
            const width = 140;
            const x = Math.max(0, Math.min(width, e.nativeEvent.locationX));
            handleSeek(x / width);
          }}
        >
          <View
            style={[
              styles.voiceBarFill,
              mine && styles.voiceBarFillMine,
              { width: `${progressPercent}%` },
            ]}
          />
        </TouchableOpacity>

        <View style={styles.voiceTimeRow}>
          <Text style={[styles.voiceTimeText, mine && { color: 'rgba(255,255,255,0.85)' }]}>
            {isPlaying || positionMs > 0 ? formatSec(positionMs) : (durationMs > 0 ? formatSec(durationMs) : '0:00')}
          </Text>
          <Ionicons
            name="mic"
            size={12}
            color={mine ? 'rgba(255,255,255,0.7)' : COLORS.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

const MessageBubble = React.memo(function MessageBubble({
  item,
  mine,
  showSender,
  seenByOthers,
  playThroughEarpiece,
  onReactionPress,
  onReplySnippetPress,
  onImagePress,
  onRetry,
  onReport,
  onDelete,
}: {
  item: MessageItem;
  mine: boolean;
  showSender: boolean;
  seenByOthers: boolean;
  playThroughEarpiece?: boolean;
  onReactionPress?: (emoji: string) => void;
  onReplySnippetPress?: (replyToId?: string) => void;
  onImagePress?: (imageUrl: string) => void;
  onRetry?: () => void;
  onReport: () => void;
  onDelete?: () => void;
}) {
  // Aggregate reaction emojis and counts
  const reactionCounts = useMemo(() => {
    if (!item.reactions || typeof item.reactions !== 'object') return [];
    const counts: Record<string, number> = {};
    Object.values(item.reactions).forEach((emoji) => {
      if (typeof emoji === 'string') {
        counts[emoji] = (counts[emoji] || 0) + 1;
      }
    });
    return Object.entries(counts);
  }, [item.reactions]);

  const isUploading = item.status === 'uploading';
  const isFailed = item.failed || item.status === 'failed';

  const tickIcon = useMemo(() => {
    if (isFailed) return 'alert-circle';
    if (isUploading || item.localOnly || item.status === 'pending') return 'time-outline';
    if (seenByOthers || item.status === 'seen' || item.status === 'delivered') return 'checkmark-done';
    return 'checkmark';
  }, [isFailed, isUploading, item.localOnly, item.status, seenByOthers]);

  const isSeen = seenByOthers || item.status === 'seen';

  return (
    <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.otherWrap]}>
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble, isFailed && styles.failedBubble]}>
        {showSender ? <Text style={styles.sender}>{item.sender_name || 'User'}</Text> : null}
        
        {/* Quoted reply snippet */}
        {item.reply_snippet ? (
          <TouchableOpacity
            style={[styles.bubbleReply, mine && { backgroundColor: 'rgba(255,255,255,0.18)', borderLeftColor: '#fff' }]}
            onPress={() => onReplySnippetPress?.(item.reply_to)}
            activeOpacity={0.7}
          >
            <Text style={[styles.bubbleReplyText, mine && { color: 'rgba(255,255,255,0.95)' }]} numberOfLines={1}>
              ↩ {item.reply_snippet}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Text message */}
        {item.text ? (
          <Text style={[styles.msgText, mine && { color: '#fff' }, item.is_deleted && styles.deletedMsgText]}>
            {item.text}
          </Text>
        ) : null}

        {/* Image Attachment with WhatsApp-style aspect ratio & upload indicator */}
        {item.message_type === 'image' && item.media_url ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!isUploading && item.media_url) {
                onImagePress?.(item.media_url);
              }
            }}
            style={styles.imageContainer}
          >
            <Image source={{ uri: item.media_url }} style={styles.msgImage} resizeMode="cover" />
            {isUploading && (
              <View style={styles.imageUploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.imageUploadingText}>Uploading...</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}

                {/* Voice Note / Audio Player */}
        {item.message_type === 'audio' && item.media_url ? (
          <VoiceNotePlayer
            mediaUrl={item.media_url}
            durationSec={item.media_size}
            mine={mine}
            isUploading={isUploading}
            playThroughEarpiece={playThroughEarpiece}
          />
        ) : null}

        {/* Document Attachment Card */}
        {item.message_type === 'document' && item.media_url ? (
          <View style={[styles.documentCard, mine && styles.documentCardMine]}>
            <View style={[styles.documentIconWrap, mine && styles.documentIconWrapMine]}>
              <Ionicons name="document-text" size={24} color={mine ? '#fff' : COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.documentName, mine && { color: '#fff' }]} numberOfLines={1}>
                {item.media_name || 'Document'}
              </Text>
              <Text style={[styles.documentSize, mine && { color: 'rgba(255,255,255,0.8)' }]}>
                {isUploading ? 'Uploading...' : (formatFileSize(item.media_size) || 'Attachment')}
              </Text>
            </View>
            {isUploading ? (
              <ActivityIndicator size="small" color={mine ? '#fff' : COLORS.primary} />
            ) : (
              <Ionicons name="download-outline" size={18} color={mine ? '#fff' : COLORS.textMuted} />
            )}
          </View>
        ) : null}

        {/* Failed state with Retry CTA */}
        {isFailed && (
          <TouchableOpacity
            style={styles.retryRow}
            onPress={() => onRetry?.()}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-circle" size={16} color={mine ? '#FDE047' : '#B3261E'} />
            <Text style={[styles.retryText, mine && { color: '#FDE047' }]}>Failed. Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Meta row: Time + Actions + Ticks */}
        <View style={styles.metaRow}>
          <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.85)' }]}>{fmtTime(item)}</Text>
          {mine ? (
            <Ionicons
              name={tickIcon}
              size={13}
              color={isFailed ? '#F87171' : isSeen ? '#38BDF8' : 'rgba(255,255,255,0.85)'}
            />
          ) : null}
        </View>
      </View>

      {/* Reaction Pills beneath Bubble */}
      {reactionCounts.length > 0 && (
        <View style={[styles.reactionsRow, mine ? styles.reactionsRowMine : styles.reactionsRowOther]}>
          {reactionCounts.map(([emoji, count]) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionPill}
              onPress={() => onReactionPress?.(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});


function formatLastSeen(timestamp: any) {
  if (!timestamp) return 'Offline';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 2) return 'Just now';
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (isToday) {
    return 'Last seen today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return 'Last seen yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  return 'Last seen ' + date.toLocaleDateString();
}

function formatDateSeparator(date?: Date | null): string {
  if (!date) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
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
  const [isSendingText, setIsSendingText] = useState(false);
  const [sendError, setSendError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [playThroughEarpiece, setPlayThroughEarpiece] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [reportTarget, setReportTarget] = useState<MessageItem | null>(null);
  const [replyTarget, setReplyTarget] = useState<MessageItem | null>(null);
  const [actionTarget, setActionTarget] = useState<MessageItem | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [targetPresence, setTargetPresence] = useState<{ is_online: boolean; last_seen?: any } | null>(null);
  const [targetProfile, setTargetProfile] = useState<{ name: string; avatar: string; photo_url?: string; role?: string } | null>(null);
  const [chatNotFound, setChatNotFound] = useState(false);
  const [chatDocExists, setChatDocExists] = useState<boolean>(!id?.startsWith('direct_'));
  const chatDocExistsRef = useRef<boolean>(!id?.startsWith('direct_'));

  useEffect(() => {
    chatDocExistsRef.current = chatDocExists;
  }, [chatDocExists]);

  // Deterministic direct chat participant resolution
  const isDirectId = typeof id === 'string' && id.startsWith('direct_');
  const directTargetId = useMemo(() => {
    if (!isDirectId || !user?.uid || typeof id !== 'string') return undefined;
    const raw = id.startsWith('direct_') ? id.slice(7) : id;
    if (raw.startsWith(user.uid + '_')) {
      return raw.slice(user.uid.length + 1);
    }
    if (raw.endsWith('_' + user.uid)) {
      return raw.slice(0, -(user.uid.length + 1));
    }
    const parts = raw.split('_').filter(Boolean);
    if (parts.includes(user.uid)) {
      return parts.find((p) => p !== user.uid);
    }
    return parts.length === 2 ? (parts[0] === user.uid ? parts[1] : parts[0]) : undefined;
  }, [id, isDirectId, user?.uid]);

  const isDirectParticipant = useMemo(() => {
    if (!isDirectId || !user?.uid) return false;
    return !!directTargetId;
  }, [directTargetId, isDirectId, user?.uid]);

  const directParticipants = useMemo(() => {
    if (!user?.uid || !directTargetId) return [];
    return [user.uid, directTargetId].sort();
  }, [directTargetId, user?.uid]);

  const targetId = chat?.type === 'direct' ? chat?.participants.find((p) => p !== user?.uid) : directTargetId;
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
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // Load target public profile
  useEffect(() => {
    const otherId = targetId || directTargetId;
    if (!otherId) return;
    let active = true;
    getDoc(doc(db, 'public_profiles', otherId))
      .then((snap) => {
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data();
          setTargetProfile({
            name: data.name || 'User',
            avatar: data.avatar || 'person',
            photo_url: data.photo_url || '',
            role: data.role || 'student',
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [directTargetId, targetId]);

  // Target Presence listener
  useEffect(() => {
    const otherId = targetId || directTargetId;
    if (!otherId) return;
    const unsub = onSnapshot(doc(db, 'presence', otherId), (snap) => {
      if (snap.exists()) setTargetPresence(snap.data() as any);
    });
    return () => unsub();
  }, [directTargetId, targetId]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setSendError('');
    setChatNotFound(false);
    chatUnsubRef.current?.();
    try {
      const unsub = onSnapshot(
        doc(db, 'chats', id),
        (snap) => {
          if (!snap.exists()) {
            setChatDocExists(false);
            if (isDirectParticipant && directTargetId && user?.uid) {
              const syntheticChat: ChatMeta = {
                id,
                type: 'direct',
                name: targetProfile?.name || 'Direct Chat',
                participants: directParticipants,
                participant_names: {
                  [user.uid]: profile?.name || 'You',
                  [directTargetId]: targetProfile?.name || 'User',
                },
                last_message: '',
                unread_counts: { [user.uid]: 0, [directTargetId]: 0 },
                pinned_by: [],
                hidden_by: [],
                archived_by: [],
                muted_by: [],
                blocked_pairs: [],
              };
              setChat(syntheticChat);
              setLoading(false);
              setChatNotFound(false);
            } else {
              setChat(null);
              setLoading(false);
              setChatNotFound(true);
            }
            return;
          }
          setChatDocExists(true);
          setChat(normalizeChatMeta(snap.id, snap.data()));
          setLoading(false);
          setChatNotFound(false);
        },
        (error) => {
          logFirestoreFailure({ collection: 'chats', operation: 'listen', query: `doc chats/${id}` }, error);
          console.log('[ChatDetail] chat listener ERROR', error);
          if (isDirectParticipant && directTargetId && user?.uid) {
            setChatDocExists(false);
            const syntheticChat: ChatMeta = {
              id,
              type: 'direct',
              name: targetProfile?.name || 'Direct Chat',
              participants: directParticipants,
              participant_names: {
                [user.uid]: profile?.name || 'You',
                [directTargetId]: targetProfile?.name || 'User',
              },
              last_message: '',
              unread_counts: {},
              pinned_by: [],
              hidden_by: [],
              archived_by: [],
              muted_by: [],
              blocked_pairs: [],
            };
            setChat(syntheticChat);
            setLoading(false);
            setChatNotFound(false);
          } else {
            setChat(null);
            setLoading(false);
            setSendError('Could not load chat. Please try again.');
          }
        },
      );
      chatUnsubRef.current = unsub;
    } catch (error) {
      logFirestoreFailure({ collection: 'chats', operation: 'listen', query: `doc chats/${id} setup` }, error);
      console.log('[ChatDetail] chat listener setup ERROR', error);
      setChat(null);
      setLoading(false);
      setSendError('Could not load chat. Please try again.');
    }
    return () => {
      chatUnsubRef.current?.();
      chatUnsubRef.current = null;
    };
  }, [directParticipants, directTargetId, id, isDirectParticipant, profile?.name, targetProfile?.name, user?.uid]);

  useEffect(() => {
    if (!id) return;
    if (isDirectId && !chatDocExists) {
      setMessages((prev) => prev.filter((m) => m.localOnly));
      setLastCursor(null);
      setHasMore(false);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.localOnly));
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
          logFirestoreFailure({ collection: 'messages', operation: 'listen', query: `where chat_id == ${id} orderBy created_at desc limit ${PAGE_SIZE}` }, error);
          console.log('[ChatDetail] messages listener ERROR', error);
          if (!isDirectParticipant) {
            setSendError('Could not load messages. Please try again.');
          }
        },
      );
      messagesUnsubRef.current = unsub;
    } catch (error) {
      logFirestoreFailure({ collection: 'messages', operation: 'listen', query: `where chat_id == ${id} orderBy created_at desc limit ${PAGE_SIZE} setup` }, error);
      console.log('[ChatDetail] messages listener setup ERROR', error);
      if (!isDirectParticipant) {
        setSendError('Could not load messages. Please try again.');
      }
    }

    return () => {
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
    };
  }, [chatDocExists, id, isDirectId, isDirectParticipant, user?.uid]);

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
      logFirestoreFailure({ collection: 'messages', operation: 'get', query: `where chat_id == ${id} orderBy created_at desc startAfter cursor limit ${PAGE_SIZE}` }, error);
      console.log('[ChatDetail] loadMore ERROR', error);
      setSendError('Could not load older messages. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const chatParticipants = useMemo(() => {
    if (Array.isArray(chat?.participants) && chat.participants.length > 0) {
      return chat.participants.filter((uid) => typeof uid === 'string');
    }
    if (isDirectParticipant) return directParticipants;
    return [];
  }, [chat?.participants, directParticipants, isDirectParticipant]);

  const canAccess = useMemo(() => {
    if (!user?.uid) return false;
    if (isDirectParticipant) return true;
    if (!chat) return false;
    return chat.type === 'broadcast' || chatParticipants.includes(user.uid);
  }, [chat, chatParticipants, isDirectParticipant, user?.uid]);

  const isComposerBlocked = useMemo(() => {
    if (!user?.uid) return true;
    if (chat?.type === 'broadcast') return !isAdmin;
    const other = directTargetId || (chat?.type === 'direct' ? chat?.participants?.find((p) => p !== user.uid) : '');
    if (other && ((chat?.blocked_pairs || []).includes(`${user.uid}:${other}`) || (chat?.blocked_pairs || []).includes(`${other}:${user.uid}`))) {
      return true;
    }
    return false;
  }, [chat?.blocked_pairs, chat?.participants, chat?.type, directTargetId, isAdmin, user?.uid]);

  const canSendMessages = !isComposerBlocked;
  const canSend = text.trim().length > 0 && canSendMessages;

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
    if (!id || !user?.uid || !canSendMessages) return;
    updateDoc(doc(db, 'chats', id), { [`typing.${user.uid}`]: { is_typing: isTyping, updated_at: serverTimestamp() } }).catch(() => {});
  }, [canSendMessages, id, user?.uid]);

  const onType = useCallback((value: string) => {
    setText(value);
    setTyping(!!value.trim());
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1500);
  }, [setTyping]);

  const ensureParentChatDoc = useCallback(async () => {
    if (!id || !user?.uid) return;
    if (chatDocExistsRef.current) return;
    const chatDocRef = doc(db, 'chats', id);
    const chatDocSnap = await getDoc(chatDocRef).catch(() => null);
    if (!chatDocSnap || !chatDocSnap.exists()) {
      const participants = chatParticipants.length > 0 ? chatParticipants : (directParticipants.length > 0 ? directParticipants : [user.uid]);
      const participant_names: Record<string, string> = {
        [user.uid]: profile?.name || user.email || 'You',
      };
      if (directTargetId) {
        participant_names[directTargetId] = targetProfile?.name || 'User';
      }
      await setDoc(chatDocRef, {
        type: chat?.type || (isDirectId ? 'direct' : 'group'),
        name: chat?.name || '',
        participants,
        participant_names,
        last_message: '',
        last_sender_id: user.uid,
        created_by: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        typing: {},
        unread_counts: { [user.uid]: 0, ...(directTargetId ? { [directTargetId]: 0 } : {}) },
        pinned_by: [],
        hidden_by: [],
        archived_by: [],
        muted_by: [],
        blocked_pairs: [],
      }, { merge: true });
      chatDocExistsRef.current = true;
      setChatDocExists(true);
    } else {
      chatDocExistsRef.current = true;
      setChatDocExists(true);
    }
  }, [chat?.name, chat?.type, chatParticipants, directParticipants, directTargetId, id, isDirectId, profile?.name, targetProfile?.name, user?.email, user?.uid]);

  const send = useCallback(async () => {
    if (!id || !user?.uid) return;
    const msg = text.trim();
    if (!msg) return;
    if (chat?.type === 'broadcast' && !isAdmin) {
      setSendError('Only administrators can send messages in broadcast channels.');
      return;
    }

    const clientId = `${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const msgId = `${id}_${clientId}`;
    const optimisticMessage: MessageItem = {
      id: msgId,
      text: msg,
      sender_id: user.uid,
      sender_name: profile?.name || user.email || 'User',
      created_at: { toDate: () => new Date() },
      read_by: [user.uid],
      client_id: clientId,
      localOnly: true,
      status: 'pending',
      ...(replyTarget ? { reply_to: replyTarget.id, reply_snippet: replyTarget.text } : {}),
    };

    // 1. Instant UI update (<15ms): immediate optimistic bubble
    setMessages((prev) => [optimisticMessage, ...prev]);
    // 2. Immediate composer clear (<15ms)
    setText('');
    const curReply = replyTarget;
    setReplyTarget(null);
    setSendError('');
    // 3. Keep composer active and unlock immediately for next message (<15ms)
    setIsSendingText(false);

    // 4. Background write pipeline (non-blocking)
    void (async () => {
      try {
        await ensureParentChatDoc();

        const outboxItem: QueueItem = {
          id: msgId,
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
        await enqueue(id, outboxItem).catch(() => {});

        await setDoc(doc(db, 'messages', msgId), {
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
          status: 'sent',
          reactions: {},
          ...(curReply ? { reply_to: curReply.id, reply_snippet: curReply.text } : {}),
        });

        await completeItem(id, outboxItem.id).catch(() => {});

        // Mark optimistic message as sent locally
        setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, status: 'sent', localOnly: false } : m)));

        // Update parent chat metadata in background
        const chatDocRef = doc(db, 'chats', id);
        const participants = chatParticipants.length > 0 ? chatParticipants : (directParticipants.length > 0 ? directParticipants : [user.uid]);
        const unreadUpdates: Record<string, any> = { [`unread_counts.${user.uid}`]: 0 };
        participants.forEach((uid) => {
          if (uid !== user.uid) unreadUpdates[`unread_counts.${uid}`] = increment(1);
        });

        await updateDoc(chatDocRef, {
          last_message: msg,
          last_sender_id: user.uid,
          updated_at: serverTimestamp(),
          [`typing.${user.uid}`]: { is_typing: false, updated_at: serverTimestamp() },
          ...unreadUpdates,
        }).catch(() => {});

        // Fire-and-forget notification dispatch
        const recipientIds = participants.filter((uid) => uid !== user.uid);
        if (recipientIds.length > 0) {
          const pushDedupeId = `chat:${id}:${clientId}`;
          void dispatchNotification({
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
        logFirestoreFailure({ collection: 'messages', operation: 'set', query: `doc messages/${msgId} send text` }, error);
        // Only mark THIS individual message as failed — never remove bubble, never block future messages
        setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, failed: true, status: 'failed', localOnly: false } : m)));
        setSendError("Message couldn't be sent. Tap Retry.");
      }
    })();
  }, [chat?.type, chatParticipants, directParticipants, ensureParentChatDoc, id, isAdmin, profile?.name, replyTarget, text, user?.email, user?.uid]);

  const uploadAndSendMessage = async (
    localUri: string,
    type: 'image' | 'document' | 'audio',
    fileName: string,
    fileSize: number,
    mimeType?: string,
  ) => {
    if (!id || !user?.uid) return;
    if (fileSize > 20 * 1024 * 1024) {
      setSendError('File is too large. Maximum size is 20 MB.');
      return;
    }

    const clientId = `${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMediaMessage: MessageItem = {
      id: `${id}_${clientId}`,
      text: '',
      sender_id: user.uid,
      sender_name: profile?.name || user.email || 'User',
      created_at: { toDate: () => new Date() },
      read_by: [user.uid],
      client_id: clientId,
      localOnly: true,
      message_type: type,
      media_url: localUri,
      media_name: fileName,
      media_size: fileSize,
      status: 'uploading',
      ...(replyTarget ? { reply_to: replyTarget.id, reply_snippet: replyTarget.text || replyTarget.media_name } : {}),
    };

    // Instant local preview in message list
    setMessages((prev) => [optimisticMediaMessage, ...prev]);
    const curReply = replyTarget;
    setReplyTarget(null);
    setSendError('');
    setUploadingMedia(true);

    // Background upload pipeline (independent of text input)
    (async () => {
      try {
        // 1. MUST ensure parent chat doc exists BEFORE Storage upload to satisfy Storage rules!
        await ensureParentChatDoc();

        // 2. Fetch blob & prepare storage path
        const resp = await fetch(localUri);
        const blob = await resp.blob();
        const cleanName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60);
        const storagePath = `chat_media/${id}/${user.uid}/${Date.now()}_${cleanName}`;
        const storageRefObj = storageRef(getStorage(), storagePath);
        const resolvedContentType = mimeType || (type === 'image' ? 'image/jpeg' : 'application/pdf');

        // 3. Upload to Storage
        await uploadBytes(storageRefObj, blob, { contentType: resolvedContentType });
        const downloadUrl = await getDownloadURL(storageRefObj);

        // 4. Outbox enqueue & Firestore message write
        const outboxItem: QueueItem = {
          id: `${id}_${clientId}`,
          chat_id: id,
          created_at_ms: Date.now(),
          status: 'pending',
          retry_count: 0,
          next_retry_at_ms: Date.now(),
          message_type: type,
          media_url: downloadUrl,
          media_name: fileName,
          media_size: fileSize,
          text: '',
          sender_id: user.uid,
          sender_name: profile?.name || user.email || 'User',
          read_by: [user.uid],
          push_dedupe_id: `chat:${id}:${clientId}`,
        };
        await enqueue(id, outboxItem);

        await setDoc(doc(db, 'messages', `${id}_${clientId}`), {
          chat_id: id,
          text: '',
          sender_id: user.uid,
          sender_name: profile?.name || user.email || 'User',
          created_at: serverTimestamp(),
          read_by: [user.uid],
          client_id: clientId,
          deleted_for: [],
          deleted_for_everyone: false,
          is_deleted: false,
          message_type: type,
          media_url: downloadUrl,
          media_name: fileName,
          media_size: fileSize,
          mime_type: resolvedContentType,
          status: 'sent',
          reactions: {},
          ...(curReply ? { reply_to: curReply.id, reply_snippet: curReply.text || curReply.media_name || '' } : {}),
        });

        await completeItem(id, outboxItem.id).catch(() => {});

        // 5. Update parent chat doc
        const chatDocRef = doc(db, 'chats', id);
        const participants = chatParticipants.length > 0 ? chatParticipants : (directParticipants.length > 0 ? directParticipants : [user.uid]);
        const unreadUpdates: Record<string, any> = { [`unread_counts.${user.uid}`]: 0 };
        participants.forEach((uid) => {
          if (uid !== user.uid) unreadUpdates[`unread_counts.${uid}`] = increment(1);
        });

        await updateDoc(chatDocRef, {
          last_message: type === 'image' ? '📷 Photo' : type === 'audio' ? '🎤 Voice Note' : `📄 ${fileName}`,
          last_sender_id: user.uid,
          updated_at: serverTimestamp(),
          ...unreadUpdates,
        }).catch(() => {});

        // 6. Update local message to sent
        setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, media_url: downloadUrl, status: 'sent', localOnly: false } : m)));
      } catch (err: unknown) {
        logFirestoreFailure({ collection: 'messages', operation: 'set', query: `upload ${type} chat media` }, err);
        setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, failed: true, status: 'failed', localOnly: false } : m)));
        setSendError(type === 'image' ? "Photo couldn't be uploaded. Check your connection and retry." : "Document couldn't be uploaded. Tap to retry.");
      } finally {
        setUploadingMedia(false);
      }
    })();
  };

  const retryMessage = useCallback(async (msgItem: MessageItem) => {
    if (!id || !user?.uid) return;
    if (msgItem.message_type === 'image' || msgItem.message_type === 'document' || msgItem.message_type === 'audio') {
      if (msgItem.media_url) {
        await uploadAndSendMessage(msgItem.media_url, msgItem.message_type, msgItem.media_name || 'file', msgItem.media_size || 0);
      }
    } else if (msgItem.text) {
      setText(msgItem.text);
      setMessages((prev) => prev.filter((m) => m.id !== msgItem.id));
    }
  }, [id, uploadAndSendMessage, user?.uid]);

  const pickImage = async () => {
    setShowAttachments(false);
    if (!id || !user?.uid || !canSendMessages) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photos access to share images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      // Optimize image dimensions & compression before upload
      let uploadUri = asset.uri;
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadUri = manipResult.uri;
      } catch {
        uploadUri = asset.uri;
      }

      await uploadAndSendMessage(uploadUri, 'image', asset.fileName || 'image.jpg', asset.fileSize || 0, 'image/jpeg');
    } catch {
      setSendError('Could not attach photo.');
    }
  };

    const pickAudio = async () => {
    setShowAttachments(false);
    if (!id || !user?.uid || !canSendMessages) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      await uploadAndSendMessage(asset.uri, 'audio', asset.name || 'voice_note.m4a', asset.size || 0, asset.mimeType || 'audio/m4a');
    } catch {
      setSendError('Could not attach voice note / audio.');
    }
  };

  const pickDocument = async () => {
    setShowAttachments(false);
    if (!id || !user?.uid || !canSendMessages) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      await uploadAndSendMessage(asset.uri, 'document', asset.name, asset.size || 0, asset.mimeType);
    } catch {
      setSendError('Could not attach document.');
    }
  };

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
    if (!id || manualRefreshing) return;
    
    setManualRefreshing(true);
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
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'chats/messages', operation: 'get', query: `doc chats/${id} + messages where chat_id == ${id}` }, error);
      setSendError('Could not refresh chat. Please try again.');
    } finally {
      setManualRefreshing(false);
    }
  }, [id, manualRefreshing]);

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
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'messages', operation: 'update', query: `doc messages/${message.id} delete_for me` }, error);
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
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'messages', operation: 'update', query: `doc messages/${message.id} unsend for everyone` }, error);
      setSendError('Could not unsend message. Please try again.');
    }
  }, [user?.uid]);

  const toggleReaction = useCallback(async (message: MessageItem, emoji: string) => {
    if (!user?.uid || !id) return;
    const currentReaction = message.reactions?.[user.uid];
    try {
      if (currentReaction === emoji) {
        await updateDoc(doc(db, 'messages', message.id), {
          [`reactions.${user.uid}`]: deleteField(),
        });
      } else {
        await updateDoc(doc(db, 'messages', message.id), {
          [`reactions.${user.uid}`]: emoji,
        });
      }
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'messages', operation: 'update', query: `doc messages/${message.id} reaction ${emoji}` }, err);
    }
  }, [id, user?.uid]);

  const openMessageActions = useCallback((item: MessageItem) => {
    setActionTarget(item);
  }, []);

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
    const currentUnread = chat.unread_counts?.[user.uid] || 0;
    if (currentUnread > 0) {
      updateDoc(doc(db, 'chats', id), { [`unread_counts.${user.uid}`]: 0 }).catch(() => {});
    }
  }, [chat?.unread_counts, id, isAdmin, user?.uid]);

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
    <View style={styles.emptyWrap}>
      <EmptyState icon="chatbubble-ellipses-outline" message="No messages yet. Start the conversation." />
    </View>
  ), []);

  const copyMessageText = useCallback(async (msg: MessageItem) => {
    if (!msg.text) return;
    try {
      await Clipboard.setStringAsync(msg.text);
      setFeedback({ type: 'success', text: 'Message copied to clipboard' });
    } catch {
      setFeedback({ type: 'error', text: 'Failed to copy message' });
    }
  }, []);

  const scrollToQuotedMessage = useCallback((replyToId?: string) => {
    if (!replyToId) {
      setFeedback({ type: 'error', text: 'Original message unavailable' });
      return;
    }
    const index = visibleMessages.findIndex((m) => m.id === replyToId || m.client_id === replyToId);
    if (index !== -1 && listRef.current) {
      try {
        listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } catch {
        // FlatList scroll fallback
      }
    } else {
      setFeedback({ type: 'error', text: 'Original message unavailable' });
    }
  }, [visibleMessages]);

  const renderMessage = useCallback(({ item, index }: { item: MessageItem; index: number }) => {
    const mine = item.sender_id === user?.uid;
    const otherParticipantCount = Math.max(chatParticipants.length - 1, 1);
    const seenByOthers = (item.read_by?.length || 1) > 1 || (item.read_by?.length || 0) >= otherParticipantCount + 1;

    // Date separator logic for inverted list (index + 1 is the older item)
    const msgDate = item.created_at?.toDate ? item.created_at.toDate() : null;
    const olderMsg = visibleMessages[index + 1];
    const olderDate = olderMsg?.created_at?.toDate ? olderMsg.created_at.toDate() : null;
    const isNewDay = !olderDate || (msgDate && msgDate.toDateString() !== olderDate.toDateString());

    return (
      <View>
        {isNewDay && msgDate && (
          <View style={styles.dateSeparatorWrap}>
            <View style={styles.dateSeparatorPill}>
              <Text style={styles.dateSeparatorText}>{formatDateSeparator(msgDate)}</Text>
            </View>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.85} onLongPress={() => openMessageActions(item)}>
          <MessageBubble
            item={{ ...item, text: item.deleted_for_everyone ? 'This message was deleted.' : item.text }}
            mine={mine}
            showSender={!mine && chat?.type !== 'direct'}
            seenByOthers={seenByOthers}
            playThroughEarpiece={playThroughEarpiece}
            onReactionPress={(emoji) => toggleReaction(item, emoji)}
            onReplySnippetPress={(replyToId) => scrollToQuotedMessage(replyToId)}
            onImagePress={(imgUrl) => setPreviewImageUrl(imgUrl)}
            onRetry={() => void retryMessage(item)}
            onReport={() => setReportTarget(item)}
            onDelete={() => openMessageActions(item)}
          />
        </TouchableOpacity>
      </View>
    );
  }, [chat?.type, chatParticipants.length, openMessageActions, retryMessage, scrollToQuotedMessage, toggleReaction, user?.uid, visibleMessages]);

  if (loading) {
    return (
      <View style={[styles.skeletonWrap, { paddingTop: insets.top + SPACING.md }]}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </View>
    );
  }

  if (!user?.uid) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.blockedTitle}>Authentication Required</Text>
        <Text style={styles.blockedText}>Please sign in to access messages.</Text>
        <TouchableOpacity onPress={() => goBackOrReplace(router, '/(tabs)/chats')} style={styles.backPlainBtn}>
          <Text style={styles.backPlainText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="shield-outline" size={48} color="#B3261E" style={{ marginBottom: SPACING.md }} />
        <Text style={styles.blockedTitle}>Access Restricted</Text>
        <Text style={styles.blockedText}>You do not have permission to view this conversation.</Text>
        <TouchableOpacity onPress={() => goBackOrReplace(router, '/(tabs)/chats')} style={styles.backPlainBtn}>
          <Text style={styles.backPlainText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (chatNotFound && !isDirectParticipant) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textMuted} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.blockedTitle}>Chat Unavailable</Text>
        <Text style={styles.blockedText}>This conversation does not exist or has been removed.</Text>
        <TouchableOpacity onPress={() => goBackOrReplace(router, '/(tabs)/chats')} style={styles.backPlainBtn}>
          <Text style={styles.backPlainText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const otherUid = chatParticipants.find((p) => p !== user?.uid) || directTargetId;
  const otherName = otherUid ? (chat?.participant_names?.[otherUid] || targetProfile?.name || 'Direct Chat') : 'Direct Chat';
  const title = chat?.type === 'group' ? (chat.name || 'Group Chat') : chat?.type === 'broadcast' ? (chat?.name || 'Announcements') : otherName;
  const otherRole = targetProfile?.role;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <ScalePressable style={styles.backBtn} onPress={() => goBackOrReplace(router, '/(tabs)/chats')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </ScalePressable>
        
        {chat?.type === 'direct' && otherUid && (
          <View style={styles.headerAvatarWrap}>
            {targetProfile?.photo_url ? (
              <Image source={{ uri: targetProfile.photo_url }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Ionicons name="person" size={16} color={COLORS.primary} />
              </View>
            )}
            {targetPresence?.is_online ? <View style={styles.headerOnlineBadge} /> : null}
          </View>
        )}

        <View style={{ flex: 1, marginLeft: chat?.type === 'direct' ? 4 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
            {chat?.type === 'direct' && otherRole ? (
              <View style={[
                styles.headerRoleBadge,
                otherRole === 'teacher' && styles.headerRoleTeacher,
                otherRole === 'admin' && styles.headerRoleAdmin,
              ]}>
                <Text style={[
                  styles.headerRoleText,
                  otherRole === 'teacher' && styles.headerRoleTextTeacher,
                  otherRole === 'admin' && styles.headerRoleTextAdmin,
                ]}>
                  {otherRole.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          {targetPresence ? (
            <Text style={[styles.presenceText, targetPresence.is_online && styles.presenceOnline]}>
              {targetPresence.is_online ? '● Online' : formatLastSeen(targetPresence.last_seen)}
            </Text>
          ) : null}
          {othersTyping ? <Text style={styles.typingText}>Typing...</Text> : null}
        </View>

        <ScalePressable style={styles.backBtn} onPress={refreshMessages} disabled={manualRefreshing}>
          {manualRefreshing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
        </ScalePressable>
        <ScalePressable
          style={[styles.backBtn, playThroughEarpiece && { backgroundColor: '#FEF3C7' }]}
          onPress={() => {
            const next = !playThroughEarpiece;
            setPlayThroughEarpiece(next);
            Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
              playThroughEarpieceAndroid: next,
            }).catch(() => {});
            setFeedback({ type: 'success', text: next ? 'Audio: Earpiece mode (Private)' : 'Audio: Speaker mode (Loud)' });
          }}
          accessibilityLabel="Toggle speaker or earpiece mode"
        >
          <Ionicons
            name={playThroughEarpiece ? 'headset' : 'volume-high-outline'}
            size={18}
            color={playThroughEarpiece ? '#D97706' : COLORS.primary}
          />
        </ScalePressable>
                <ScalePressable style={styles.backBtn} onPress={() => { void toggleMuteChat(); }}>
          <Ionicons name={(chat?.muted_by || []).includes(user?.uid || '') ? 'notifications-off-outline' : 'notifications-outline'} size={18} color={COLORS.primary} />
        </ScalePressable>
        {chat?.type === 'direct' ? (
          <ScalePressable style={styles.backBtn} onPress={() => { void blockOtherUser(); }}>
            <Ionicons name="ban-outline" size={18} color="#B3261E" />
          </ScalePressable>
        ) : null}
      </View>

      {feedback && (
        <View style={styles.feedbackWrap}>
          <FeedbackBanner type={feedback.type} message={feedback.text} />
        </View>
      )}

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

      {/* Message Action & Reactions Sheet Modal */}
      <Modal
        visible={!!actionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActionTarget(null)}
        >
          <View style={styles.actionSheetContainer}>
            {/* Quick Reactions Bar */}
            <View style={styles.reactionsBar}>
              {['🤲', '🌸', '❤️', 'جزاک اللہ', 'ماشاء اللہ'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => {
                    if (actionTarget) {
                      void toggleReaction(actionTarget, emoji);
                      setActionTarget(null);
                    }
                  }}
                >
                  <Text style={styles.reactionBtnEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions List */}
            <View style={styles.actionOptionsList}>
              <TouchableOpacity
                style={styles.actionOptionRow}
                onPress={() => {
                  if (actionTarget) setReplyTarget(actionTarget);
                  setActionTarget(null);
                }}
              >
                <Ionicons name="arrow-undo-outline" size={20} color={COLORS.textMain} />
                <Text style={styles.actionOptionText}>Reply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionOptionRow}
                onPress={() => {
                  if (actionTarget) void deleteForMe(actionTarget);
                  setActionTarget(null);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.textMain} />
                <Text style={styles.actionOptionText}>Delete for me</Text>
              </TouchableOpacity>

              {actionTarget && !!actionTarget.text && !actionTarget.is_deleted && (
                <TouchableOpacity
                  style={styles.actionOptionRow}
                  onPress={() => {
                    const target = actionTarget;
                    setActionTarget(null);
                    void copyMessageText(target);
                  }}
                >
                  <Ionicons name="copy-outline" size={20} color={COLORS.textMain} />
                  <Text style={styles.actionOptionText}>Copy text</Text>
                </TouchableOpacity>
              )}

              {actionTarget && (actionTarget.sender_id === user?.uid || isAdmin) && !actionTarget.localOnly && (
                <TouchableOpacity
                  style={styles.actionOptionRow}
                  onPress={() => {
                    if (actionTarget) void unsendForEveryone(actionTarget);
                    setActionTarget(null);
                  }}
                >
                  <Ionicons name="trash-bin-outline" size={20} color="#B3261E" />
                  <Text style={[styles.actionOptionText, { color: '#B3261E' }]}>Delete for everyone</Text>
                </TouchableOpacity>
              )}

              {actionTarget && actionTarget.sender_id !== user?.uid && (
                <TouchableOpacity
                  style={styles.actionOptionRow}
                  onPress={() => {
                    const target = actionTarget;
                    setActionTarget(null);
                    setReportTarget(target);
                  }}
                >
                  <Ionicons name="flag-outline" size={20} color="#B3261E" />
                  <Text style={[styles.actionOptionText, { color: '#B3261E' }]}>Report message</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Attachment Drawer Modal */}
      <Modal
        visible={showAttachments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachments(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAttachments(false)}
        >
          <View style={styles.attachmentDrawer}>
            <Text style={styles.attachmentDrawerTitle}>Share Content</Text>
            <View style={styles.attachmentOptionsRow}>
              <TouchableOpacity style={styles.attachmentOptionBtn} onPress={pickImage}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="images" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.attachmentOptionLabel}>Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOptionBtn} onPress={pickDocument}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="document-text" size={24} color="#D97706" />
                </View>
                <Text style={styles.attachmentOptionLabel}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-screen Image Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.previewModalBackdrop}>
          <TouchableOpacity
            style={styles.previewModalCloseBtn}
            onPress={() => setPreviewImageUrl(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.previewModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Composer Area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Reply Quote Banner */}
        {replyTarget && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerBar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBannerSender}>Replying to {replyTarget.sender_name || 'User'}</Text>
              <Text style={styles.replyBannerSnippet} numberOfLines={1}>
                {replyTarget.text || replyTarget.media_name || 'Attachment'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTarget(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        
        <View style={styles.inputRow}>
          {canSendMessages && (
            <TouchableOpacity
              style={styles.attachBtn}
              activeOpacity={0.7}
              onPress={() => setShowAttachments(true)}
              disabled={uploadingMedia}
              accessibilityLabel="Attach media or document"
            >
              <Ionicons name="add" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          <TextInput
            style={[styles.input, isComposerBlocked && styles.inputDisabled]}
            value={text}
            onChangeText={onType}
            placeholder={isComposerBlocked ? 'Only admins can send broadcast messages' : 'Type a message...'}
            placeholderTextColor={COLORS.textMuted}
            editable={!isComposerBlocked}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, !canSend && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={() => { void send(); }}
            disabled={!canSend}
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
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
  emptyWrap: { alignItems: 'center', justifyContent: 'center' },
  backPlainBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  backPlainText: { color: COLORS.textMain, fontWeight: '600' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  typingText: { fontSize: 12, color: COLORS.secondary, marginTop: 1 },
  list: { padding: SPACING.md, gap: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, gap: 8 },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  bubbleWrap: { width: '100%', marginBottom: 4 },
  mineWrap: { alignItems: 'flex-end' },
  otherWrap: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  mineBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  failedBubble: { borderColor: '#FCA5A5', borderWidth: 1 },
  sender: { fontSize: 11, color: COLORS.secondary, fontWeight: '700', marginBottom: 4 },
  msgText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  deletedMsgText: { fontStyle: 'italic', opacity: 0.8 },
  metaRow: { marginTop: 4, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', alignItems: 'center' },
  time: { fontSize: 10, color: COLORS.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  attachBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  sendError: {
    color: '#B3261E',
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    fontSize: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.textMain,
    fontSize: 14,
    maxHeight: 100,
  },
  inputDisabled: { opacity: 0.7 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  imageContainer: {
    position: 'relative',
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  msgImage: {
    width: 240,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  imageUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
  },
  imageUploadingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: 11,
    color: '#B3261E',
    fontWeight: '600',
  },
  previewModalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalImage: {
    width: '100%',
    height: '80%',
  },
  documentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, marginTop: 4, borderWidth: 1, borderColor: COLORS.border },
  documentCardMine: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  documentIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center' },
  documentIconWrapMine: { backgroundColor: 'rgba(255,255,255,0.25)' },
  documentName: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  documentSize: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  presenceText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  replyBannerBar: { width: 4, height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  replyBannerSender: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  replyBannerSnippet: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  bubbleReply: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 6,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  bubbleReplyText: {
    fontSize: 12,
    color: '#4B5563',
  },
  reactionsRow: { flexDirection: 'row', gap: 4, marginTop: 2, paddingHorizontal: 4 },
  reactionsRowMine: { justifyContent: 'flex-end' },
  reactionsRowOther: { justifyContent: 'flex-start' },
  reactionPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, ...SHADOWS.card },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheetContainer: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xl, gap: SPACING.md },
  reactionsBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.surfaceAlt, paddingVertical: 10, paddingHorizontal: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  reactionBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reactionBtnEmoji: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  actionOptionsList: { gap: 6 },
  actionOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  actionOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  attachmentDrawer: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xl },
  attachmentDrawerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: SPACING.md },
  attachmentOptionsRow: { flexDirection: 'row', gap: SPACING.lg },
  attachmentOptionBtn: { alignItems: 'center', gap: 8 },
  attachmentOptionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  attachmentOptionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMain },
  dateSeparatorWrap: { alignItems: 'center', marginVertical: SPACING.sm },
  dateSeparatorPill: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: 4 },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6,
  },
  headerAvatarWrap: {
    position: 'relative',
    marginRight: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  headerRoleBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRoleTeacher: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  headerRoleAdmin: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  headerRoleText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  headerRoleTextTeacher: {
    color: '#6D28D9',
  },
  headerRoleTextAdmin: {
    color: '#92400E',
  },
  presenceOnline: {
    color: '#059669',
    fontWeight: '600',
  },
  voiceNoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    marginTop: 4,
    minWidth: 200,
  },
  voiceNoteWrapMine: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  voicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  voicePlayBtnMine: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  voiceProgressWrap: {
    flex: 1,
    gap: 4,
  },
  voiceBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    width: '100%',
  },
  voiceBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  voiceBarFillMine: {
    backgroundColor: '#fff',
  },
  voiceTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voiceTimeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});

