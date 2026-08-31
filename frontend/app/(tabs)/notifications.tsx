/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { stableQueryKey, subscribeDeduped } from '@/lib/queryPerformance';
import {
  View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  arrayUnion, collection, doc, limit, orderBy, query, updateDoc, where,
  deleteDoc,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { AppRole } from '@/lib/roles';
import { createNotificationAsAdmin } from '@/lib/notifications';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { FeedbackBanner, ScalePressable, SkeletonCard } from '@/components/ui';
import { registerPerformanceSurface, scheduleLowPriorityTask, throttleRealtimeUpdates, trackPerformanceMetric } from '@/lib/performanceEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Swipeable } from 'react-native-gesture-handler';
import { registerDevicePushToken, requestNotificationPermission } from '@/lib/pushNotifications';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  user_id: string;
  category?: 'announcement' | 'notification' | 'class_reminder';
  sound?: 'default';
  read?: Record<string, boolean>;
  target_user_ids?: string[];
  target_roles?: AppRole[];
  created_at?: { toDate?: () => Date };
  hidden_by?: string[];
};

const getCategoryInfo = (item: NotificationItem) => {
  const titleLower = item.title.toLowerCase();
  if (titleLower.includes('security') || titleLower.includes('alert')) return { color: COLORS.error, icon: 'shield-alert' };
  if (titleLower.includes('payment') || titleLower.includes('fee')) return { color: COLORS.error, icon: 'card' };
  if (titleLower.includes('certificate')) return { color: COLORS.success, icon: 'ribbon' };
  if (titleLower.includes('course completed') || titleLower.includes('passed')) return { color: COLORS.success, icon: 'checkmark-circle' };
  if (item.category === 'announcement' || titleLower.includes('announcement')) return { color: COLORS.primary, icon: 'megaphone' };
  if (titleLower.includes('quiz')) return { color: '#F59E0B', icon: 'help-circle' };
  if (item.category === 'class_reminder' || titleLower.includes('live') || titleLower.includes('class')) return { color: '#F59E0B', icon: 'videocam' };
  if (titleLower.includes('prayer') || titleLower.includes('salah')) return { color: '#F59E0B', icon: 'time' };
  if (titleLower.includes('library') || titleLower.includes('book')) return { color: '#8B5CF6', icon: 'library' };
  return { color: COLORS.primary, icon: 'notifications' };
};

function formatRelativeTime(item: NotificationItem): string {
  try {
    const dt = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!dt) return 'Just now';
    const now = new Date();
    const diffMs = now.getTime() - dt.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Just now';
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
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
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [readSegment, setReadSegment] = useState<'All' | 'Unread' | 'Read'>('All');
  useEffect(() => {
    AsyncStorage.getItem('pinned_notifications').then(res => {
      if (res) setPinnedIds(JSON.parse(res));
    }).catch(() => {});
  }, []);

  const togglePin = async (id: string) => {
    const next = pinnedIds.includes(id) ? pinnedIds.filter(pid => pid !== id) : [...pinnedIds, id];
    setPinnedIds(next);
    await AsyncStorage.setItem('pinned_notifications', JSON.stringify(next)).catch(() => {});
  };

  const perfRef = useRef(registerPerformanceSurface({ surface: 'notifications_screen', cleanupIntervalMs: 120000, lowEndSafe: true }));

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    setReloadKey((v) => v + 1);
    await new Promise(r => setTimeout(r, 600));
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.uid) return;
    setLoadError('');
    setLoading(true);
    const notificationQueries = [
      {
        key: 'direct_or_all',
        description: `notifications where user_id in [${user.uid}, all] orderBy created_at desc limit 50`,
        ref: query(collection(db, 'notifications'), where('user_id', 'in', [user.uid, 'all']), orderBy('created_at', 'desc'), limit(50)),
      },
      ...(profile?.role ? [{
        key: 'role_targeted_role',
        description: `notifications where user_id == role_targeted and target_roles array-contains ${profile.role} orderBy created_at desc limit 50`,
        ref: query(collection(db, 'notifications'), where('user_id', '==', 'role_targeted'), where('target_roles', 'array-contains', profile.role), orderBy('created_at', 'desc'), limit(50)),
      }] : []),
      {
        key: 'role_targeted_user',
        description: `notifications where user_id == role_targeted and target_user_ids array-contains ${user.uid} orderBy created_at desc limit 50`,
        ref: query(collection(db, 'notifications'), where('user_id', '==', 'role_targeted'), where('target_user_ids', 'array-contains', user.uid), orderBy('created_at', 'desc'), limit(50)),
      },
    ];
    const byId = new Map<string, NotificationItem>();
    const publish = () => {
      const next = Array.from(byId.values())
        .filter((item) => !(Array.isArray(item.hidden_by) && item.hidden_by.includes(user.uid)))
        .sort((a, b) => Number(b.created_at?.toDate?.()?.getTime?.() || 0) - Number(a.created_at?.toDate?.()?.getTime?.() || 0))
        .slice(0, 50);
      throttleRealtimeUpdates<NotificationItem[]>('notifications_stream', [next], (batches) => {
        const latest = batches[batches.length - 1];
        setItems(Array.isArray(latest) ? latest : next);
      }, 180);
      setLoading(false);
      perfRef.current.touch();
    };
    const unsubs = notificationQueries.map((entry) => {
      const lkey = stableQueryKey(['notifications', entry.key, user.uid, profile?.role || '']);
      return subscribeDeduped(lkey, entry.ref as any, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') byId.delete(change.doc.id);
          else byId.set(change.doc.id, { id: change.doc.id, ...(change.doc.data() as any) });
        });
        publish();
      }, (err: unknown) => {
        logFirestoreFailure({ collection: 'notifications', operation: 'listen', query: entry.description }, err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load notifications.');
        setLoading(false);
      });
    });
    const cancelMetric = scheduleLowPriorityTask(() => trackPerformanceMetric('notifications_loaded', items.length, { role: profile?.role || 'unknown' }));
    return () => {
      cancelMetric();
      unsubs.forEach((unsub) => unsub());
    };
  }, [profile?.role, user?.uid, reloadKey]);

  const markAsRead = async (item: NotificationItem) => {
    if (!user?.uid) return;
    if (item.read?.[user.uid]) return;
    try {
      await updateDoc(doc(db, 'notifications', item.id), {
        [`read.${user.uid}`]: true,
      });
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'notifications', operation: 'update', query: `doc notifications/${item.id} mark read` }, err);
    }
  };

  const markAsUnread = async (item: NotificationItem) => {
    if (!user?.uid) return;
    if (!item.read?.[user.uid]) return;
    try {
      await updateDoc(doc(db, 'notifications', item.id), {
        [`read.${user.uid}`]: false,
      });
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'notifications', operation: 'update', query: `doc notifications/${item.id} mark unread` }, err);
    }
  };

  const handlePressNotificationItem = (item: NotificationItem) => {
    if (user?.uid && !item.read?.[user.uid]) {
      void markAsRead(item);
    }
    const route = (item as any).route;
    if (route && typeof route === 'string') {
      router.push(route as any);
      return;
    }
    const titleLower = item.title.toLowerCase();
    const msgLower = (item.message || '').toLowerCase();
    if (titleLower.includes('live') || titleLower.includes('class') || msgLower.includes('live class')) {
      router.push('/live-class' as any);
    } else if (titleLower.includes('recording') || titleLower.includes('audio') || titleLower.includes('dars')) {
      router.push('/recordings' as any);
    } else if (titleLower.includes('quiz') || titleLower.includes('sabaq') || titleLower.includes('assessment')) {
      router.push('/(tabs)/quiz' as any);
    } else if (titleLower.includes('library') || titleLower.includes('book') || titleLower.includes('pdf')) {
      router.push('/(tabs)/library' as any);
    } else if (titleLower.includes('course') || titleLower.includes('syllabus')) {
      router.push('/(tabs)/courses' as any);
    }
  };

  const unreadCount = user?.uid
    ? items.filter((item) => !item.read?.[user.uid]).length
    : 0;
  const skeletonRows = useMemo(() => Array.from({ length: 5 }), []);

  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = item.title.toLowerCase().includes(q) || item.message.toLowerCase().includes(q);
      
      const isUnread = !item.read?.[user?.uid || ''];
      const matchesSegment = readSegment === 'All' 
        ? true 
        : readSegment === 'Unread' ? isUnread : !isUnread;

      let matchesCategory = true;
      if (activeCategory !== 'All') {
        const cat = item.category || 'general';
        const titleLower = item.title.toLowerCase();
        if (activeCategory === 'Announcements') matchesCategory = cat === 'announcement' || titleLower.includes('announcement');
        else if (activeCategory === 'Courses') matchesCategory = titleLower.includes('course');
        else if (activeCategory === 'Quiz') matchesCategory = titleLower.includes('quiz');
        else if (activeCategory === 'Payments') matchesCategory = titleLower.includes('payment') || titleLower.includes('fee');
        else if (activeCategory === 'Live Classes') matchesCategory = cat === 'class_reminder' || titleLower.includes('live') || titleLower.includes('class');
        else if (activeCategory === 'Library') matchesCategory = titleLower.includes('library') || titleLower.includes('book');
        else if (activeCategory === 'General') matchesCategory = cat === 'notification' && !titleLower.includes('payment') && !titleLower.includes('course');
      }

      return matchesSearch && matchesSegment && matchesCategory;
    });

    result.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0; // The items are already time-sorted from the firestore stream
    });

    return result;
  }, [items, searchQuery, activeCategory, readSegment, pinnedIds, user?.uid]);

  const markAllAsRead = async () => {
    if (!user?.uid) return;
    const unread = items.filter(item => !item.read?.[user.uid]);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map(item => updateDoc(doc(db, 'notifications', item.id), {
        [`read.${user.uid}`]: true,
      })));
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'notifications', operation: 'update', query: `batch mark read` }, err);
    }
  };
  useEffect(() => {
    if (!user?.uid) return;
    const setup = async () => {
      const permission = await requestNotificationPermission();
      if (permission.granted) await registerDevicePushToken(user.uid);
    };
    setup().catch(() => {});
  }, [user?.uid]);


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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send notification.';
      setFeedback({ type: 'error', text: message });
      Alert.alert('Error', message);
    } finally {
      setSending(false);
    }
  };

  const startEditNotification = (item: NotificationItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingMessage(item.message);
    setShowEditModal(true);
  };

  const saveNotificationEdit = async () => {
    if (!isAdmin || !editingId || !editingTitle.trim() || !editingMessage.trim()) return;
    setUpdating(true);
    try {
      const lowerTitle = editingTitle.trim().toLowerCase();
      const category = lowerTitle.includes('announcement')
        ? 'announcement'
        : (lowerTitle.includes('class reminder') || lowerTitle.includes('reminder') ? 'class_reminder' : 'notification');
      await updateDoc(doc(db, 'notifications', editingId), {
        title: editingTitle.trim(),
        message: editingMessage.trim(),
        category,
        sound: 'default',
      });
      Alert.alert('Updated', 'Notification was updated successfully.');
      setEditingId('');
      setEditingTitle('');
      setEditingMessage('');
      setShowEditModal(false);
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'notifications', operation: 'update', query: `doc notifications/${editingId} edit notification` }, err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update notification.');
    } finally {
      setUpdating(false);
    }
  };

  const deleteNotification = (item: NotificationItem) => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in again to update notifications.');
      return;
    }
    Alert.alert('Delete Notification', isAdmin ? 'Delete this notification for everyone?' : 'Remove this notification from your list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isAdmin) {
              await deleteDoc(doc(db, 'notifications', item.id));
            } else {
              await updateDoc(doc(db, 'notifications', item.id), { hidden_by: arrayUnion(user?.uid || '') });
            }
            if (editingId === item.id) {
              setEditingId('');
              setEditingTitle('');
              setEditingMessage('');
              setShowEditModal(false);
            }
            setItems((prev) => prev.filter((entry) => entry.id !== item.id));
            setFeedback({ type: 'success', text: isAdmin ? 'Notification deleted successfully.' : 'Notification removed from your list.' });
          } catch (err: unknown) {
            logFirestoreFailure({ collection: 'notifications', operation: isAdmin ? 'delete' : 'update', query: `doc notifications/${item.id} delete/hide notification` }, err);
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete notification.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.headerSubtitle}>Latest updates and class reminders</Text>
        
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search title or message..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.segmentWrap}>
          {['All', 'Unread', 'Read'].map((segment) => (
            <TouchableOpacity
              key={segment}
              style={[styles.segmentBtn, readSegment === segment && styles.segmentBtnActive]}
              onPress={() => setReadSegment(segment as any)}
            >
              <Text style={[styles.segmentBtnText, readSegment === segment && styles.segmentBtnTextActive]}>
                {segment}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.categoriesRow}>
          <FlatList removeClippedSubviews initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['All', 'Announcements', 'Courses', 'Quiz', 'Payments', 'Live Classes', 'Library', 'General']}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.categoryChip, activeCategory === item && styles.categoryChipActive]}
                onPress={() => setActiveCategory(item)}
              >
                <Text style={[styles.categoryChipText, activeCategory === item && styles.categoryChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
      {feedback ? (
        <View style={styles.feedbackWrap}>
          <FeedbackBanner type={feedback.type} message={feedback.text} />
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading notifications" onPress={() => setReloadKey((v) => v + 1)}>
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
              {sending ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.sendBtnText}>Send</Text>}
            </ScalePressable>

        </View>
      )}

      {loading ? (
        <View style={styles.loadingList}>
          {skeletonRows.map((_, idx) => <SkeletonCard key={`notification-skeleton-${idx}`} lines={3} />)}
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          initialNumToRender={10}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
          
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptyText}>You&apos;re all caught up! Important updates, payments, and class reminders will appear here.</Text>
              <TouchableOpacity style={styles.emptyRefreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={16} color={COLORS.primary} />
                <Text style={styles.emptyRefreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => {
            const isUnread = !item.read?.[user?.uid || ''];
            const isPinned = pinnedIds.includes(item.id);
            const catInfo = getCategoryInfo(item);
            
            const renderRightActions = () => (
              <TouchableOpacity
                style={styles.swipeActionRight}
                onPress={() => isUnread ? markAsRead(item) : markAsUnread(item)}
              >
                <Ionicons name={isUnread ? 'checkmark-done' : 'mail-unread'} size={24} color="#fff" />
                <Text style={styles.swipeActionText}>{isUnread ? 'Mark Read' : 'Mark Unread'}</Text>
              </TouchableOpacity>
            );

            const renderLeftActions = () => (
              <TouchableOpacity style={styles.swipeActionLeft} onPress={() => deleteNotification(item)}>
                <Ionicons name="trash" size={24} color="#fff" />
                <Text style={styles.swipeActionText}>Delete</Text>
              </TouchableOpacity>
            );

            return (
              <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
                <ScalePressable
                  style={[
                    styles.card,
                    isUnread && styles.cardUnread,
                    isPinned && styles.cardPinned,
                  ]}
                  testID={`notification-${item.id}`}
                  onPress={() => handlePressNotificationItem(item)}
                  onLongPress={() => togglePin(item.id)}
                >
                  {isUnread && <View style={[styles.unreadLeftBar, { backgroundColor: catInfo.color }]} />}
                  <View style={styles.cardTop}>
                    <View style={[styles.cardIconCircle, { backgroundColor: catInfo.color + '15' }]}>
                      <Ionicons name={catInfo.icon as any} size={16} color={catInfo.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>{item.title}</Text>
                    </View>
                    <View style={styles.badgesRow}>
                      {isPinned && <Ionicons name="star" size={14} color="#F59E0B" />}
                      {item.user_id === 'all' ? (
                        <View style={styles.badge}><Text style={styles.badgeText}>Broadcast</Text></View>
                      ) : (
                        <View style={styles.badge}><Text style={styles.badgeText}>Private</Text></View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.cardMsg}>{item.message}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardTime}>{formatRelativeTime(item)}</Text>
                    {!isUnread && <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />}
                  </View>
                  <View style={styles.adminActions}>
                    {isAdmin ? (
                      <TouchableOpacity onPress={() => startEditNotification(item)} style={{ padding: 4 }}>
                        <Text style={styles.editActionText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </ScalePressable>
              </Swipeable>
            );
          }}
        />
      )}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Notification</Text>
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
                onPress={saveNotificationEdit}
                disabled={updating || !editingTitle.trim() || !editingMessage.trim()}
              >
                {updating ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.sendBtnText}>Update</Text>}
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: { width: 32, height: 32, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  markAllReadText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 44, marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: COLORS.textMain },
  categoriesRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  categoryChipTextActive: { color: '#fff' },
  segmentWrap: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: RADIUS.full, padding: 4, marginTop: SPACING.md },
  segmentBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: RADIUS.full },
  segmentBtnActive: { backgroundColor: COLORS.surface, ...SHADOWS.card },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  segmentBtnTextActive: { color: COLORS.primary },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  errorBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: '#F2B8B5',
    backgroundColor: '#FDECEC',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: '#B3261E', fontSize: 12, flex: 1 },
  retryText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  composerCard: {
    margin: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.surface, ...SHADOWS.card, gap: 8,
  },
  composerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
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
  inputFocused: { borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  inputError: { color: COLORS.error, fontSize: 12, fontWeight: '600', marginTop: -2 },
  messageInput: { minHeight: 72, textAlignVertical: 'top' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { flexGrow: 1, minWidth: 140, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xxl, paddingVertical: 10, alignItems: 'center' },
  quickBtnText: { color: COLORS.textMain, fontSize: 12, fontWeight: '600' },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.xxl, paddingVertical: SPACING.md, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  editActions: { flexDirection: 'row', gap: 10 },
  editCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
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
    borderRadius: RADIUS.xxl,
    padding: SPACING.md,
    ...SHADOWS.card,
    gap: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 24 },
  loadingList: { padding: SPACING.md, gap: SPACING.sm },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card, overflow: 'hidden' },
  cardUnread: { backgroundColor: '#F0FDF4' }, // Light emerald background for unread
  cardPinned: { borderColor: '#F59E0B', borderWidth: 1, elevation: 4 }, // Gold border + elevated
  unreadLeftBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: RADIUS.xl, borderBottomLeftRadius: RADIUS.xl },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
  cardTitleUnread: { fontWeight: '800', color: '#1F2937' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.goldBg },
  badgeText: { color: COLORS.goldText, fontSize: 10, fontWeight: '700' },
  cardMsg: { fontSize: 14, color: COLORS.textMuted, marginTop: 12, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  cardTime: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  adminActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  editActionText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  deleteActionText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  emptyRefreshText: { color: COLORS.primary, fontWeight: '700' },
  swipeActionRight: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: RADIUS.xl, marginLeft: 8 },
  swipeActionLeft: { backgroundColor: COLORS.error, justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: RADIUS.xl, marginRight: 8 },
  swipeActionText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
