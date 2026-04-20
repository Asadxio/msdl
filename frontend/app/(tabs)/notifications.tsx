import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where,
  deleteDoc,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { createNotificationAsAdmin } from '@/lib/notifications';
import { FeedbackBanner, ScalePressable, SkeletonCard } from '@/components/ui';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  user_id: string;
  category?: 'announcement' | 'notification' | 'class_reminder';
  read?: Record<string, boolean>;
  created_at?: { toDate?: () => Date };
};

function formatDate(item: NotificationItem): string {
  try {
    const dt = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!dt) return 'Just now';
    return dt.toLocaleString();
  } catch {
    return 'Just now';
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('all');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [editingMessage, setEditingMessage] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [composerError, setComposerError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [focusedField, setFocusedField] = useState<'title' | 'message' | 'recipient' | null>(null);
  const [focusedEditField, setFocusedEditField] = useState<'editTitle' | 'editMessage' | null>(null);

  const isAnnouncement = (item: NotificationItem): boolean => (
    item.category === 'announcement' || item.title.toLowerCase().includes('announcement')
  );

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('user_id', 'in', [user.uid, 'all']),
      orderBy('created_at', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(q, (snap) => {
      const next: NotificationItem[] = [];
      snap.forEach((d) => next.push({ id: d.id, ...(d.data() as any) }));
      setItems(next);
      setLoading(false);
    }, (err) => {
      setLoadError(err?.message || 'Failed to load notifications.');
      setLoading(false);
    });
    return unsub;
  }, [user, user?.uid, reloadKey]);

  const markAsRead = async (item: NotificationItem) => {
    if (!user?.uid) return;
    if (item.read?.[user.uid]) return;
    try {
      await updateDoc(doc(db, 'notifications', item.id), {
        [`read.${user.uid}`]: true,
      });
    } catch {
      // no-op
    }
  };

  const unreadCount = user?.uid
    ? items.filter((item) => !item.read?.[user.uid]).length
    : 0;
  const skeletonRows = useMemo(() => Array.from({ length: 5 }), []);

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      setComposerError('Title and message are required.');
      return;
    }
    setComposerError('');
    setSending(true);
    try {
      const ok = await createNotificationAsAdmin(profile, {
        title,
        message,
        user_id: userId.trim() || 'all',
      });
      if (!ok) {
        Alert.alert('Unauthorized', 'Only admin can create notifications.');
      } else {
        setTitle('');
        setMessage('');
        setUserId('all');
        setFeedback({ type: 'success', text: 'Notification sent successfully.' });
        Alert.alert('Success', 'Notification sent.');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to send notification.' });
      Alert.alert('Error', err?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const startEditAnnouncement = (item: NotificationItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingMessage(item.message);
    setShowEditModal(true);
  };

  const saveAnnouncementEdit = async () => {
    if (!isAdmin || !editingId || !editingTitle.trim() || !editingMessage.trim()) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'notifications', editingId), {
        title: editingTitle.trim(),
        message: editingMessage.trim(),
        category: 'announcement',
      });
      Alert.alert('Updated', 'Announcement was updated successfully.');
      setEditingId('');
      setEditingTitle('');
      setEditingMessage('');
      setShowEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update announcement.');
    } finally {
      setUpdating(false);
    }
  };

  const deleteAnnouncement = (item: NotificationItem) => {
    Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'notifications', item.id));
            if (editingId === item.id) {
              setEditingId('');
              setEditingTitle('');
              setEditingMessage('');
              setShowEditModal(false);
            }
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete announcement.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.headerSubtitle}>Latest updates and class reminders</Text>
      </View>
      {feedback ? (
        <View style={styles.feedbackWrap}>
          <FeedbackBanner type={feedback.type} message={feedback.text} />
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => setReloadKey((v) => v + 1)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isAdmin && (
        <View style={styles.composerCard}>
          <Text style={styles.composerTitle}>Admin: Post Notification</Text>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={[styles.input, focusedField === 'title' && styles.inputFocused]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title (e.g. New Class Scheduled)"
            placeholderTextColor={COLORS.textMuted}
            onFocus={() => setFocusedField('title')}
            onBlur={() => setFocusedField(null)}
          />
          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.messageInput, focusedField === 'message' && styles.inputFocused]}
            value={message}
            onChangeText={setMessage}
            placeholder="Message"
            placeholderTextColor={COLORS.textMuted}
            multiline
            onFocus={() => setFocusedField('message')}
            onBlur={() => setFocusedField(null)}
          />
          <Text style={styles.inputLabel}>Recipient (user id or &quot;all&quot;)</Text>
          <TextInput
            style={[styles.input, focusedField === 'recipient' && styles.inputFocused]}
            value={userId}
            onChangeText={setUserId}
            placeholder='Recipient user ID or "all"'
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            onFocus={() => setFocusedField('recipient')}
            onBlur={() => setFocusedField(null)}
          />
          {composerError ? <Text style={styles.inputError}>{composerError}</Text> : null}
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => {
                setTitle('New Announcement');
                setMessage('A new announcement has been posted. Please check the app for details.');
                setUserId('all');
              }}
            >
              <Text style={styles.quickBtnText}>Announcement</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => {
                setTitle('Class Reminder');
                setMessage('Your class starts in 10 minutes. Please join on time.');
                setUserId('all');
              }}
            >
              <Text style={styles.quickBtnText}>10-min Reminder</Text>
            </TouchableOpacity>
          </View>
            <ScalePressable
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={sendNotification}
              disabled={sending || !title.trim() || !message.trim()}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
            </ScalePressable>

        </View>
      )}

      {loading ? (
        <View style={styles.loadingList}>
          {skeletonRows.map((_, idx) => <SkeletonCard key={`notification-skeleton-${idx}`} lines={3} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={10}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={44} color={COLORS.border} />
              <Text style={styles.emptyText}>No notifications yet. You’re all caught up.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ScalePressable
              style={[styles.card, !item.read?.[user?.uid || ''] && styles.cardUnread]}
              testID={`notification-${item.id}`}
              onPress={() => markAsRead(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.badgesRow}>
                  {!item.read?.[user?.uid || ''] ? <View style={styles.newDot} /> : null}
                  {item.user_id === 'all' ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>Broadcast</Text></View>
                  ) : (
                    <View style={styles.badge}><Text style={styles.badgeText}>Private</Text></View>
                  )}
                </View>
              </View>
              <Text style={styles.cardMsg}>{item.message}</Text>
              <Text style={styles.cardTime}>{formatDate(item)}</Text>
              {isAdmin && isAnnouncement(item) ? (
                <View style={styles.adminActions}>
                  <TouchableOpacity onPress={() => startEditAnnouncement(item)}>
                    <Text style={styles.editActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteAnnouncement(item)}>
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScalePressable>
          )}
        />
      )}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Announcement</Text>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={[styles.input, focusedEditField === 'editTitle' && styles.inputFocused]}
              value={editingTitle}
              onChangeText={setEditingTitle}
              placeholder="Announcement title"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedEditField('editTitle')}
              onBlur={() => setFocusedEditField(null)}
            />
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput, focusedEditField === 'editMessage' && styles.inputFocused]}
              value={editingMessage}
              onChangeText={setEditingMessage}
              placeholder="Announcement message"
              placeholderTextColor={COLORS.textMuted}
              multiline
              onFocus={() => setFocusedEditField('editMessage')}
              onBlur={() => setFocusedEditField(null)}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingId('');
                }}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, styles.editSaveBtn, updating && { opacity: 0.6 }]}
                onPress={saveAnnouncementEdit}
                disabled={updating || !editingTitle.trim() || !editingMessage.trim()}
              >
                {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  errorBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#F2B8B5',
    backgroundColor: '#FDECEC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: '#B3261E', fontSize: 12, flex: 1 },
  retryText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  composerCard: {
    margin: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface, ...SHADOWS.card, gap: 8,
  },
  composerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surfaceAlt, color: COLORS.textMain,
  },
  inputFocused: { borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  inputError: { color: COLORS.error, fontSize: 12, fontWeight: '600', marginTop: -2 },
  messageInput: { minHeight: 72, textAlignVertical: 'top' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { flexGrow: 1, minWidth: 140, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center' },
  quickBtnText: { color: COLORS.textMain, fontSize: 12, fontWeight: '600' },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  editActions: { flexDirection: 'row', gap: 10 },
  editCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  editCancelText: { color: COLORS.textMuted, fontWeight: '700' },
  editSaveBtn: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
    gap: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 24 },
  loadingList: { padding: SPACING.md, gap: SPACING.sm },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  cardUnread: { borderWidth: 1, borderColor: COLORS.secondary },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.goldBg },
  badgeText: { color: COLORS.goldText, fontSize: 10, fontWeight: '700' },
  cardMsg: { fontSize: 14, color: COLORS.textMuted, marginTop: 8, lineHeight: 20 },
  cardTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 8 },
  adminActions: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  editActionText: { color: COLORS.primary, fontWeight: '700' },
  deleteActionText: { color: COLORS.error, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 8 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
