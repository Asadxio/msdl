import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { collection, getDocs, query, where, orderBy, limit as limitQ, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RADIUS, SPACING, COLORS, SHADOWS } from '@/constants/theme';
import { dispatchNotification, type DispatchResult } from '@/lib/dispatchNotification';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';
import { withTimeout } from '@/lib/errors';
import * as Clipboard from 'expo-clipboard';
import {
  fetchCourseEnrolledContacts,
  buildCourseWhatsAppMessage,
  openWhatsAppBroadcast,
  openWhatsAppDirectStudent,
  type EnrolledStudentContact,
} from '@/lib/whatsappBatch';
import type { NotificationChannel } from '@/lib/notificationTypes';

type TargetMode = 'all' | 'class' | 'teachers' | 'custom';

type SearchUser = {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
};

type SentNotificationItem = {
  id: string;
  title: string;
  message: string;
  created_at_ms?: number;
  category?: string;
};

const QUICK_TEMPLATES = [
  {
    label: '⏰ 10-Min Class Reminder',
    title: '⏰ درس کا وقت قریب ہے (Class in 10 Mins)',
    body: '🌸 Sabaq Reminder: Aapki live dars class 10 minute me shuru hone wali hai. Baraye meherbani tayyar rahein!',
    channel: 'live_classes' as NotificationChannel,
  },
  {
    label: '🔴 Live Class Alert',
    title: '🔴 Live Class Starting Now',
    body: 'Your live interactive class session is now active. Please join the classroom on time.',
    channel: 'live_classes' as NotificationChannel,
  },
  {
    label: '🌸 Sabaq / Inactivity Nudge',
    title: '🌸 علم حاصل کرنا ہر مسلمان پر فرض ہے',
    body: 'السلام علیکم! کافی دن ہو گئے آپ نے سبق نہیں پڑھا۔ آئیے آج کا سبق اور دینی تعلیم مکمل کریں۔ (Continue your sacred learning journey today.)',
    channel: 'announcements' as NotificationChannel,
  },
  {
    label: '🎙️ Dars Recording',
    title: '🎙️ New Class Recording Available',
    body: 'The latest audio recording and Tajweed notes for your course have been published.',
    channel: 'announcements' as NotificationChannel,
  },
  {
    label: '🏆 Quiz & Sabaq Due',
    title: '🏆 Sabaq & Quiz Assessment Reminder',
    body: 'Please complete your pending Tajweed assessment before the deadline.',
    channel: 'announcements' as NotificationChannel,
  },
  {
    label: '📢 Madrasa Notice',
    title: '📢 Madrasa General Announcement',
    body: 'Important notice regarding upcoming classes, schedules, and Madrasa guidelines.',
    channel: 'announcements' as NotificationChannel,
  },
];


export default function AdminSendPushScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = hasPermission(profile, 'admin.notifications.send');
  const { courses, teachers } = useData();

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/unauthorized?required=admin');
    }
  }, [profile, isAdmin, router]);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [channel, setChannel] = useState<NotificationChannel>('announcements');
  const [highPriority, setHighPriority] = useState(true);

  // System stats
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);
  const [totalDevicesCount, setTotalDevicesCount] = useState<number | null>(null);

  // Custom user selection
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userIdsText, setUserIdsText] = useState('');

  // Modals & Action states
  const [previewVisible, setPreviewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [batchContacts, setBatchContacts] = useState<EnrolledStudentContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [customDarsLink, setCustomDarsLink] = useState('');
  const [customDarsTime, setCustomDarsTime] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // History state
  const [history, setHistory] = useState<SentNotificationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        const uSnap = await getDocs(query(collection(db, 'users'), limitQ(300)));
        setTotalUsersCount(uSnap.size);
        let tokens = 0;
        uSnap.forEach((d) => {
          const dt = d.data();
          if (Array.isArray(dt.expo_push_tokens) && dt.expo_push_tokens.length > 0) {
            tokens += dt.expo_push_tokens.length;
          }
        });
        setTotalDevicesCount(tokens);
      } catch {
        // non-fatal
      }
    };
    void loadStats();
  }, []);

  const selectedUsers = useMemo(() => {
    return searchResults.filter((item) => selectedIds.includes(item.id));
  }, [searchResults, selectedIds]);

  // Load notification history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const notifCol = collection(db, 'notifications');
      const q = query(notifCol, orderBy('created_at', 'desc'), limitQ(15));
      const snap = await getDocs(q);
      const rows: SentNotificationItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.channel === 'announcements' || data.channel === 'live_classes' || data.user_id === 'all' || !data.category) {
          rows.push({
            id: docSnap.id,
            title: String(data.title || 'Notification'),
            message: String(data.message || data.body || ''),
            created_at_ms: data.created_at_ms || (data.created_at?.toMillis ? data.created_at.toMillis() : Date.now()),
            category: data.category || data.channel,
          });
        }
      });
      setHistory(rows.slice(0, 10));
    } catch (err) {
      console.warn('[AdminSendPush] Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // User search effect
  useEffect(() => {
    let mounted = true;
    const runSearch = async () => {
      try {
        const q = String(search || '').trim();
        if (!q || q.length < 2) {
          if (mounted) setSearchResults([]);
          return;
        }
        const prefix = q;
        const end = `${prefix}\uf8ff`;
        const col = collection(db, 'users');
        const nameQuery = query(col, where('displayName', '>=', prefix), where('displayName', '<=', end), orderBy('displayName'), limitQ(20));
        let snaps = await getDocs(nameQuery);
        const rows: SearchUser[] = [];
        if (!snaps.empty) {
          snaps.forEach((d) => {
            const data = d.data() as any;
            rows.push({ id: d.id, name: data.displayName || data.name || d.id, email: data.email, photoURL: data.photoURL || data.avatarURL });
          });
        } else {
          const emailQuery = query(col, where('email', '>=', prefix), where('email', '<=', end), orderBy('email'), limitQ(20));
          snaps = await getDocs(emailQuery);
          snaps.forEach((d) => {
            const data = d.data() as any;
            rows.push({ id: d.id, name: data.displayName || data.name || d.id, email: data.email, photoURL: data.photoURL || data.avatarURL });
          });
        }
        if (mounted) setSearchResults(rows);
      } catch (err) {
        console.warn('[AdminSendPush] user search failed:', err);
        if (mounted) setSearchResults([]);
      }
    };
    void runSearch();
    return () => { mounted = false; };
  }, [search]);

  // Target audience description
  const targetDescription = useMemo(() => {
    switch (targetMode) {
      case 'all': {
        const uText = totalUsersCount !== null ? `(${totalUsersCount} students & users)` : '';
        const dText = totalDevicesCount !== null && totalDevicesCount > 0 ? ` • ${totalDevicesCount} phone(s) connected` : '';
        return `Universal Broadcast: Will deliver to ALL registered accounts ${uText}${dText}.`;
      }
      case 'class': {
        const c = courses.find((item) => item.id === selectedCourseId);
        return c ? `Targeting students enrolled in: "${c.name}"` : 'Please select an active course/class below.';
      }
      case 'teachers':
        return `Targeting all registered faculty and teachers (${teachers.length} teachers registered).`;
      case 'custom': {
        const customCount = selectedIds.length || userIdsText.split(/[,\n\s]+/).filter(Boolean).length;
        return `Targeting ${customCount} individually selected user(s).`;
      }
    }
  }, [targetMode, selectedCourseId, courses, teachers, selectedIds.length, userIdsText, totalUsersCount, totalDevicesCount]);

  // Handle open WhatsApp batch modal
  const handleOpenWhatsAppModal = async () => {
    const activeCourse = courses.find((c) => c.id === selectedCourseId);
    setCopiedNotice(false);
    setWhatsappModalVisible(true);

    if (selectedCourseId) {
      setLoadingContacts(true);
      try {
        const contacts = await fetchCourseEnrolledContacts(selectedCourseId);
        setBatchContacts(contacts);
      } catch (err) {
        console.warn('[AdminSendPush] Failed to load contacts:', err);
      } finally {
        setLoadingContacts(false);
      }
    } else {
      setBatchContacts([]);
    }
  };

  const getComputedWhatsAppNotice = () => {
    const activeCourse = courses.find((c) => c.id === selectedCourseId);
    return buildCourseWhatsAppMessage({
      courseName: activeCourse?.name || title.trim() || 'تمام کورسز',
      teacherName: profile?.name || 'استادہ',
      meetUrl: customDarsLink.trim(),
      classTime: customDarsTime.trim(),
      customNote: body.trim() || undefined,
    });
  };

  const handleCopyWhatsAppNotice = async () => {
    const text = getComputedWhatsAppNotice();
    await Clipboard.setStringAsync(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  const handleTriggerWhatsAppBroadcast = async () => {
    const text = getComputedWhatsAppNotice();
    await openWhatsAppBroadcast(text);
  };

  // Handle prepare broadcast
  const handleInitiateSend = () => {
    setStatusMessage(null);
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a notification title.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Missing Message', 'Please enter a notification message body.');
      return;
    }
    if (targetMode === 'class' && !selectedCourseId) {
      Alert.alert('No Class Selected', 'Please select a course to target.');
      return;
    }
    if (targetMode === 'custom' && selectedIds.length === 0 && !userIdsText.trim()) {
      Alert.alert('No Users Selected', 'Please select users from search or paste user IDs.');
      return;
    }
    setConfirmVisible(true);
  };

  // Dispatch broadcast
  const handleConfirmSend = async () => {
    setConfirmVisible(false);
    setSending(true);
    setStatusMessage(null);

    try {
      let targetUserIds: string[] = [];
      const isSendToAll = targetMode === 'all';

      if (targetMode === 'class' && selectedCourseId) {
        const enrolledQ = query(
          collection(db, 'enrollments'),
          where('course_id', '==', selectedCourseId),
          where('status', '==', 'active')
        );
        const enrolledDocs = await getDocs(enrolledQ);
        targetUserIds = enrolledDocs.docs.map((d) => d.data().user_id).filter(Boolean);
      } else if (targetMode === 'teachers') {
        const teacherUidsFromData = teachers.map((t) => t.id).filter(Boolean);
        if (teacherUidsFromData.length > 0) {
          targetUserIds = teacherUidsFromData;
        } else {
          const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
          const teacherDocs = await getDocs(teachersQ);
          targetUserIds = teacherDocs.docs.map((d) => d.id);
        }
      } else if (targetMode === 'custom') {
        const pastedIds = userIdsText.split(/[,\n\s]+/).filter(Boolean);
        targetUserIds = Array.from(new Set([...selectedIds, ...pastedIds]));
      }

      const dedupe = `admin:${Date.now()}`;

      const res = await withTimeout(
        dispatchNotification({
          channel: channel,
          event: channel === 'live_classes' ? 'live_class_started' : 'announcement_posted',
          title: title.trim(),
          body: body.trim(),
          recipientIds: targetUserIds,
          sendToAll: isSendToAll,
          dedupeId: dedupe,
        }),
        30000
      );

      setDispatchResult(res);
      setSuccessModalVisible(true);

      // Build detailed result message
      const parts: string[] = [];
      if (res.pushCount > 0) parts.push(`✅ Sent: ${res.pushCount} device(s)`);
      if (res.providerErrors > 0) parts.push(`❌ Failed: ${res.providerErrors}`);
      if (res.skipped > 0) parts.push(`⏭ Skipped (preference): ${res.skipped}`);
      if (res.noToken > 0) parts.push(`📵 No token: ${res.noToken}`);
      if (res.pushCount === 0 && res.providerErrors === 0 && res.skipped === 0) {
        parts.push('In-app feed updated (0 push-registered phones found)');
      }
      const resultText = parts.length > 0 ? parts.join(' | ') : '✅ Broadcast dispatched';
      setStatusMessage({ text: resultText, isError: res.pushCount === 0 && res.providerErrors > 0 });

      setTitle('');
      setBody('');
      setSelectedIds([]);
      setUserIdsText('');
      void fetchHistory();

    } catch (err: any) {
      console.warn('[AdminSendPush] Dispatch failed:', err);
      const isTimeout = String(err?.message || '').toLowerCase().includes('timed out');
      if (isTimeout) {
        setStatusMessage({
          text: '⚠️ Broadcast is processing in background. Push delivery will complete shortly.',
          isError: false,
        });
        Alert.alert(
          'Broadcast Submitted',
          'Your broadcast was queued successfully. Hardware push delivery to devices is completing in the background.'
        );
        void fetchHistory();
      } else {
        setStatusMessage({ text: `❌ Dispatch failed: ${err?.message || 'Unknown error'}`, isError: true });
        Alert.alert('Dispatch Error', err?.message || 'Failed to send broadcast.');
      }
    } finally {
      setSending(false);
    }
  };

  const isFormValid = Boolean(
    title.trim() &&
    body.trim() &&
    (targetMode !== 'class' || selectedCourseId) &&
    (targetMode !== 'custom' || selectedIds.length > 0 || userIdsText.trim().length > 0)
  );

  return (
    <View style={styles.mainContainer}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/(tabs)/profile')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Enterprise Broadcasts</Text>
          <Text style={styles.headerSubtitle}>Instant Push Notifications & Madrasa Alerts</Text>
        </View>
        <TouchableOpacity style={styles.previewIconBtn} onPress={() => setPreviewVisible(true)}>
          <Ionicons name="eye-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Message Banner */}
        {statusMessage && (
          <View style={[styles.statusBanner, statusMessage.isError ? styles.statusError : styles.statusSuccess]}>
            <Ionicons
              name={statusMessage.isError ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color={statusMessage.isError ? '#991B1B' : '#065F46'}
            />
            <Text style={[styles.statusText, statusMessage.isError ? styles.statusErrorText : styles.statusSuccessText]}>
              {statusMessage.text}
            </Text>
          </View>
        )}

        {/* 1. Target Audience */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>1. Target Audience</Text>
            {totalUsersCount !== null && (
              <View style={styles.statsBadge}>
                <Ionicons name="people" size={12} color="#065F46" />
                <Text style={styles.statsBadgeText}>{totalUsersCount} Total Users</Text>
              </View>
            )}
          </View>

          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'all' && styles.targetChipActive]}
              onPress={() => setTargetMode('all')}
            >
              <Ionicons name="globe-outline" size={16} color={targetMode === 'all' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'all' && styles.targetChipTextActive]}>
                All Students & Staff
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'class' && styles.targetChipActive]}
              onPress={() => setTargetMode('class')}
            >
              <Ionicons name="school-outline" size={16} color={targetMode === 'class' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'class' && styles.targetChipTextActive]}>
                Specific Class
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'teachers' && styles.targetChipActive]}
              onPress={() => setTargetMode('teachers')}
            >
              <Ionicons name="people-outline" size={16} color={targetMode === 'teachers' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'teachers' && styles.targetChipTextActive]}>
                Teachers Only
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'custom' && styles.targetChipActive]}
              onPress={() => setTargetMode('custom')}
            >
              <Ionicons name="person-add-outline" size={16} color={targetMode === 'custom' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'custom' && styles.targetChipTextActive]}>
                Custom Users
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.targetInfoBox}>
            <Ionicons name="information-circle" size={18} color="#047857" />
            <Text style={styles.targetInfoText}>{targetDescription}</Text>
          </View>

          {/* Specific Course Picker */}
          {targetMode === 'class' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Select Course / Class:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseScroll}>
                {courses.map((course) => {
                  const isSelected = selectedCourseId === course.id;
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[styles.courseChip, isSelected && styles.courseChipSelected]}
                      onPress={() => setSelectedCourseId(course.id)}
                    >
                      <Text style={[styles.courseChipText, isSelected && styles.courseChipTextSelected]}>
                        {course.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Custom User Search */}
          {targetMode === 'custom' && (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Search User Name or Email:</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                style={styles.input}
                placeholder="Type student name or email..."
                placeholderTextColor={COLORS.textMuted}
              />
              {searchResults.length > 0 && (
                <View style={styles.searchResultsBox}>
                  {searchResults.map((item) => {
                    const selected = selectedIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.searchItem}
                        onPress={() => {
                          setSelectedIds((prev) =>
                            selected ? prev.filter((p) => p !== item.id) : [...prev, item.id]
                          );
                        }}
                      >
                        <View style={styles.searchAvatar}>
                          <Text style={styles.searchAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchName}>{item.name}</Text>
                          {!!item.email && <Text style={styles.searchEmail}>{item.email}</Text>}
                        </View>
                        <Ionicons
                          name={selected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={selected ? '#10B981' : COLORS.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {selectedUsers.length > 0 && (
                <View style={styles.selectedChipsBox}>
                  {selectedUsers.map((u) => (
                    <View key={u.id} style={styles.userChip}>
                      <Text style={styles.userChipText}>{u.name}</Text>
                      <TouchableOpacity onPress={() => setSelectedIds((prev) => prev.filter((p) => p !== u.id))}>
                        <Ionicons name="close-circle" size={16} color="#065F46" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.subLabel, { marginTop: 12 }]}>Or Paste User IDs (comma separated):</Text>
              <TextInput
                value={userIdsText}
                onChangeText={setUserIdsText}
                style={[styles.input, { height: 70 }]}
                multiline
                placeholder="uid_123, uid_456..."
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          )}
        </View>

        {/* 2. Quick Preset Templates */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Quick Preset Templates</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templateScroll}
          >
            {QUICK_TEMPLATES.map((tmpl) => (
              <TouchableOpacity
                key={tmpl.label}
                style={styles.templateChip}
                onPress={() => {
                  setTitle(tmpl.title);
                  setBody(tmpl.body);
                  setChannel(tmpl.channel);
                }}
              >
                <Text style={styles.templateChipText}>{tmpl.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 3. Compose Message */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Compose Message</Text>
            <TouchableOpacity style={styles.previewBtnSmall} onPress={() => setPreviewVisible(true)}>
              <Ionicons name="eye" size={14} color="#2563EB" />
              <Text style={styles.previewBtnText}>Live Preview</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Notification Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={60}
            style={styles.input}
            placeholder="e.g., 🔴 Live Class Starting Now"
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={styles.charCount}>{title.length}/60</Text>

          <Text style={styles.inputLabel}>Message Body</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={240}
            style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
            multiline
            placeholder="Your live interactive class session is now active. Please join the classroom on time."
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={styles.charCount}>{body.length}/240</Text>

          {/* Alert Options */}
          <View style={styles.priorityBox}>
            <TouchableOpacity
              style={styles.priorityRow}
              onPress={() => setHighPriority(!highPriority)}
            >
              <Ionicons
                name={highPriority ? 'checkbox' : 'square-outline'}
                size={22}
                color={highPriority ? COLORS.primary : COLORS.textMuted}
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.priorityTitle}>High Priority Broadcast</Text>
                <Text style={styles.prioritySub}>Plays sound & displays immediate heads-up banner on devices</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Sent Notification History */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>4. Recent Broadcasts</Text>
            <TouchableOpacity onPress={fetchHistory} disabled={loadingHistory}>
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyHistoryText}>No previous broadcast notifications found.</Text>
          ) : (
            history.map((item) => {
              const dateStr = item.created_at_ms
                ? new Date(item.created_at_ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Recent';
              return (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyIconBox}>
                    <Ionicons name="megaphone" size={16} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historyBody} numberOfLines={2}>{item.message}</Text>
                    <Text style={styles.historyDate}>{dateStr}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Sticky Bottom Bar */}
      <View style={[styles.bottomStickyBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => setPreviewVisible(true)}
          disabled={sending}
        >
          <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} />
          <Text style={styles.btnSecondaryText}>Preview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnWhatsApp}
          onPress={handleOpenWhatsAppModal}
          disabled={sending}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
          <Text style={styles.btnWhatsAppText}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPrimary, (!isFormValid || sending) && styles.btnPrimaryDisabled]}
          onPress={handleInitiateSend}
          disabled={sending || !isFormValid}
        >
          {sending ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.btnPrimaryText}>Dispatching...</Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="megaphone" size={18} color="#FFF" />
              <Text style={styles.btnPrimaryText}>Send Broadcast</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Live Preview Modal */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalBox}>
            <View style={styles.previewModalHeader}>
              <Text style={styles.previewModalTitle}>Lockscreen Push Preview</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.previewHelpText}>
              This is how your broadcast will appear on students' mobile lockscreens:
            </Text>

            <View style={styles.pushBannerCard}>
              <View style={styles.pushBannerTopRow}>
                <View style={styles.pushAppIcon}>
                  <Text style={styles.pushAppIconText}>M</Text>
                </View>
                <Text style={styles.pushAppName}>Madrasatu-s-Salikat</Text>
                <Text style={styles.pushAppTime}>now</Text>
              </View>
              <Text style={styles.pushBannerTitle}>{title.trim() || 'Notification Title'}</Text>
              <Text style={styles.pushBannerBody}>
                {body.trim() || 'Message body preview will appear right here when you type.'}
              </Text>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreviewVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={confirmVisible} transparent animationType="slide" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalBox}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="megaphone" size={38} color={COLORS.primary} />
            </View>
            <Text style={styles.confirmTitle}>Confirm Push Broadcast</Text>
            <Text style={styles.confirmSubtitle}>
              You are about to alert {targetMode === 'all' ? 'ALL students and devices' : targetMode.toUpperCase()} immediately.
            </Text>

            <View style={styles.confirmDetailsBox}>
              <Text style={styles.confirmDetailRow}>
                <Text style={{ fontWeight: '700' }}>Target: </Text>
                {targetMode === 'all' ? 'All Registered Users & Phones' : targetMode === 'teachers' ? 'All Faculty / Teachers' : targetMode === 'class' ? 'Specific Class Students' : 'Custom Selected Users'}
              </Text>
              <Text style={styles.confirmDetailRow}>
                <Text style={{ fontWeight: '700' }}>Title: </Text>
                {title}
              </Text>
              <Text style={[styles.confirmDetailRow, { marginTop: 4 }]}>
                <Text style={{ fontWeight: '700' }}>Message: </Text>
                {body}
              </Text>
            </View>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmProceedBtn} onPress={handleConfirmSend}>
                <Text style={styles.confirmProceedText}>Confirm & Send Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalBox}>
            {dispatchResult && dispatchResult.pushCount === 0 && dispatchResult.providerErrors > 0 ? (
              <>
                <View style={[styles.confirmIconWrap, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="alert-circle" size={44} color="#EF4444" />
                </View>
                <Text style={styles.confirmTitle}>Push Delivery Issue</Text>
                <Text style={styles.confirmSubtitle}>
                  In-app feed was published, but lockscreen push delivery failed for all devices.
                </Text>
              </>
            ) : dispatchResult && dispatchResult.providerErrors > 0 ? (
              <>
                <View style={[styles.confirmIconWrap, { backgroundColor: '#F59E0B20' }]}>
                  <Ionicons name="warning" size={44} color="#F59E0B" />
                </View>
                <Text style={styles.confirmTitle}>Broadcast Partially Delivered</Text>
                <Text style={styles.confirmSubtitle}>
                  Notification sent to active devices, but some devices encountered delivery errors.
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.confirmIconWrap, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                </View>
                <Text style={styles.confirmTitle}>Broadcast Dispatched!</Text>
                <Text style={styles.confirmSubtitle}>
                  Your notification has been broadcast successfully across the Madrasa.
                </Text>
              </>
            )}

            <View style={styles.confirmDetailsBox}>
              <Text style={styles.confirmDetailRow}>
                <Text style={{ fontWeight: '700' }}>📋 Madrasa Feed: </Text>
                Active for all users
              </Text>
              <Text style={styles.confirmDetailRow}>
                <Text style={{ fontWeight: '700' }}>📱 Push Dispatches: </Text>
                {dispatchResult?.pushCount || 0} device(s) alerted directly
              </Text>
              {dispatchResult && dispatchResult.providerErrors > 0 && (
                <Text style={[styles.confirmDetailRow, { color: '#DC2626', marginTop: 4 }]}>
                  <Text style={{ fontWeight: '700' }}>⚠️ Push Errors: </Text>
                  {dispatchResult.providerErrors} device(s) failed delivery
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.confirmProceedBtn, { width: '100%', marginTop: 16 }]}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.confirmProceedText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Batch Messaging Modal */}
      <Modal visible={whatsappModalVisible} transparent animationType="slide" onRequestClose={() => setWhatsappModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalBox, { maxHeight: '88%' }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#25D36620' }]}>
              <Ionicons name="logo-whatsapp" size={38} color="#25D366" />
            </View>
            <Text style={styles.confirmTitle}>WhatsApp Batch Notice</Text>
            <Text style={styles.confirmSubtitle}>
              {selectedCourseId
                ? `Course Batch: "${courses.find((c) => c.id === selectedCourseId)?.name || 'Selected Class'}"`
                : 'Share general Madrasa dars link & notice via WhatsApp'}
            </Text>

            <ScrollView style={{ width: '100%', maxHeight: 320, marginVertical: SPACING.sm }} showsVerticalScrollIndicator={false}>
              {/* Optional live class / meet link input */}
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>🔗 Live Class / Meet Link (Optional)</Text>
              <TextInput
                value={customDarsLink}
                onChangeText={setCustomDarsLink}
                style={[styles.input, { height: 42, marginBottom: 8 }]}
                placeholder="https://meet.google.com/abc-defg-hij"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />

              {/* Optional Class Time */}
              <Text style={styles.inputLabel}>⏰ Dars Time (e.g. 5:00 PM / بعد نماز عصر)</Text>
              <TextInput
                value={customDarsTime}
                onChangeText={setCustomDarsTime}
                style={[styles.input, { height: 42, marginBottom: 8 }]}
                placeholder="Today at 5:00 PM"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Message Preview Box */}
              <Text style={[styles.inputLabel, { marginTop: 6 }]}>Message Preview for WhatsApp:</Text>
              <View style={styles.waPreviewBox}>
                <Text style={styles.waPreviewText}>{getComputedWhatsAppNotice()}</Text>
              </View>

              {/* Enrolled Students Summary */}
              {selectedCourseId && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.inputLabel, { marginBottom: 6 }]}>
                    👥 Enrolled Students ({loadingContacts ? 'Loading...' : `${batchContacts.length} total`}):
                  </Text>
                  {loadingContacts ? (
                    <ActivityIndicator size="small" color="#25D366" style={{ marginVertical: 8 }} />
                  ) : batchContacts.length === 0 ? (
                    <Text style={styles.emptyHistoryText}>No students actively enrolled in this course yet.</Text>
                  ) : (
                    batchContacts.map((contact) => (
                      <View key={contact.uid} style={styles.contactItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.contactName}>{contact.name}</Text>
                          <Text style={styles.contactDetail}>
                            {contact.phone || contact.guardianPhone || contact.email}
                          </Text>
                        </View>
                        {(contact.phone || contact.guardianPhone) && (
                          <TouchableOpacity
                            style={styles.directWaBtn}
                            onPress={() => {
                              const p = contact.phone || contact.guardianPhone || '';
                              void openWhatsAppDirectStudent(p, getComputedWhatsAppNotice());
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={16} color="#FFF" />
                            <Text style={styles.directWaBtnText}>Chat</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            {/* Actions: Broadcast to Group / Copy Message */}
            <View style={{ width: '100%', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={styles.waBroadcastBtn} onPress={handleTriggerWhatsAppBroadcast}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                <Text style={styles.waBroadcastBtnText}>Open in WhatsApp / Share to Group</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.waCopyBtn} onPress={handleCopyWhatsAppNotice}>
                <Ionicons name={copiedNotice ? "checkmark-circle" : "copy-outline"} size={18} color={COLORS.primary} />
                <Text style={styles.waCopyBtnText}>
                  {copiedNotice ? 'Copied to Clipboard!' : 'Copy Formatted Notice'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setWhatsappModalVisible(false)}>
                <Text style={styles.confirmCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  previewIconBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#0FA95815',
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B98115',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  targetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  targetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  targetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  targetChipTextActive: {
    color: '#FFF',
  },
  targetInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B98110',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  targetInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
  },
  subSection: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  courseScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  courseChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  courseChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  courseChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  courseChipTextSelected: {
    color: '#FFF',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  priorityBox: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  prioritySub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchResultsBox: {
    maxHeight: 180,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: 8,
    overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  searchAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAvatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  searchName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  searchEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  selectedChipsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B98115',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  userChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  templateScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  templateChip: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#C6E8D4',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  previewBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: '#3B82F615',
  },
  previewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  statusSuccess: {
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusError: {
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  statusSuccessText: {
    color: '#065F46',
  },
  statusErrorText: {
    color: '#991B1B',
  },
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    flexDirection: 'row',
    gap: SPACING.sm,
    ...SHADOWS.card,
    elevation: 8,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  btnPrimary: {
    flex: 2.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.card,
  },
  btnPrimaryDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyHistoryText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: '#3B82F615',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyBody: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  previewModalBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  previewModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewHelpText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  pushBannerCard: {
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  pushBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pushAppIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  pushAppIconText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 11,
  },
  pushAppName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  pushAppTime: {
    fontSize: 11,
    color: '#64748B',
  },
  pushBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pushBannerBody: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  modalCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmModalBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0FA95820',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  confirmDetailsBox: {
    width: '100%',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  confirmDetailRow: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmProceedBtn: {
    flex: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  confirmProceedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  btnWhatsApp: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: '#25D366',
    ...SHADOWS.card,
  },
  btnWhatsAppText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  waPreviewBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 8,
  },
  waPreviewText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#166534',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  contactItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  contactDetail: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  directWaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  directWaBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  waBroadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    ...SHADOWS.card,
  },
  waBroadcastBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  waCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  waCopyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

