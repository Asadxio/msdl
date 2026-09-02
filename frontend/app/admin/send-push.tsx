import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
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
import { dispatchNotification } from '@/lib/dispatchNotification';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';

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
    label: '🔴 Live Class Alert',
    title: '🔴 Live Class Starting Now',
    body: 'Your live interactive class session is now active. Please join the classroom on time.',
  },
  {
    label: '🎙️ Dars Recording',
    title: '🎙️ New Class Recording Available',
    body: 'The latest audio recording and Tajweed notes for your course have been published.',
  },
  {
    label: '🏆 Quiz & Sabaq Due',
    title: '🏆 Sabaq & Quiz Assessment Reminder',
    body: 'Please complete your pending Tajweed assessment before the deadline.',
  },
  {
    label: '📢 Madrasa Notice',
    title: '📢 Madrasa General Announcement',
    body: 'Important notice regarding upcoming classes and Madrasa schedules.',
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
  
  // Custom user selection
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userIdsText, setUserIdsText] = useState('');

  // Modals & Action states
  const [previewVisible, setPreviewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // History state
  const [history, setHistory] = useState<SentNotificationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
        if (data.category === 'announcement' || data.channel === 'admin' || !data.category) {
          rows.push({
            id: docSnap.id,
            title: String(data.title || 'Notification'),
            message: String(data.message || data.body || ''),
            created_at_ms: data.created_at_ms || (data.created_at?.toMillis ? data.created_at.toMillis() : Date.now()),
            category: data.category,
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

  // Calculate targeted users count description
  const targetDescription = useMemo(() => {
    switch (targetMode) {
      case 'all':
        return 'Broadcast to ALL registered students and users across the platform.';
      case 'class': {
        const c = courses.find((item) => item.id === selectedCourseId);
        return c ? `Targeting students enrolled in: "${c.name}"` : 'Please select an active course/class.';
      }
      case 'teachers':
        return `Targeting all registered faculty and teachers (${teachers.length} teachers found).`;
      case 'custom': {
        const customCount = selectedIds.length || userIdsText.split(/[,\n\s]+/).filter(Boolean).length;
        return `Targeting ${customCount} individually selected user(s).`;
      }
    }
  }, [targetMode, selectedCourseId, courses, teachers, selectedIds.length, userIdsText]);

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
      Alert.alert('No Users Selected', 'Please select users or paste user IDs.');
      return;
    }
    setConfirmVisible(true);
  };

  // Actual dispatch logic
  const handleConfirmSend = async () => {
    setConfirmVisible(false);
    setSending(true);
    setStatusMessage(null);

    try {
      let targetUserIds: string[] = [];
      let isSendToAll = false;

      if (targetMode === 'all') {
        isSendToAll = true;
      } else if (targetMode === 'class' && selectedCourseId) {
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

      // Build recipient list — for send_to_all, fetch all approved user IDs
      let finalRecipientIds = targetUserIds;
      if (isSendToAll) {
        try {
          const allUsersQ = query(collection(db, 'users'), where('status', '==', 'approved'));
          const allUsersDocs = await getDocs(allUsersQ);
          finalRecipientIds = allUsersDocs.docs.map((d) => d.id).filter(Boolean);
        } catch {
          // fallback: empty means dispatchNotification handles all
          finalRecipientIds = [];
        }
      }

      await dispatchNotification({
        channel: 'announcements',
        event: 'announcement_posted',
        title: title.trim(),
        body: body.trim(),
        recipientIds: finalRecipientIds,
        sendToAll: isSendToAll,
        dedupeId: dedupe,
      });

      setStatusMessage({ text: '✅ Notification dispatched successfully to target audience!', isError: false });
      setTitle('');
      setBody('');
      setSelectedIds([]);
      setUserIdsText('');
      await fetchHistory();
    } catch (err: any) {
      console.warn('[AdminSendPush] Dispatch failed:', err);
      setStatusMessage({ text: `❌ Dispatch failed: ${err?.message || 'Unknown error'}`, isError: true });
    } finally {
      setSending(false);
    }
  };

  if (profile && !isAdmin) return null;

  return (
    <View style={[styles.mainContainer, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + SPACING.sm }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enterprise Broadcasts</Text>
        <TouchableOpacity style={styles.previewIconBtn} onPress={() => setPreviewVisible(true)}>
          <Ionicons name="eye-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Recipient Targeting Chips */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Target Audience</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'all' && styles.targetChipActive]}
              onPress={() => setTargetMode('all')}
            >
              <Ionicons name="globe-outline" size={16} color={targetMode === 'all' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'all' && styles.targetChipTextActive]}>All Students</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'class' && styles.targetChipActive]}
              onPress={() => setTargetMode('class')}
            >
              <Ionicons name="school-outline" size={16} color={targetMode === 'class' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'class' && styles.targetChipTextActive]}>Specific Class</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'teachers' && styles.targetChipActive]}
              onPress={() => setTargetMode('teachers')}
            >
              <Ionicons name="people-outline" size={16} color={targetMode === 'teachers' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'teachers' && styles.targetChipTextActive]}>Teachers Only</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetChip, targetMode === 'custom' && styles.targetChipActive]}
              onPress={() => setTargetMode('custom')}
            >
              <Ionicons name="person-add-outline" size={16} color={targetMode === 'custom' ? '#FFF' : COLORS.textMuted} />
              <Text style={[styles.targetChipText, targetMode === 'custom' && styles.targetChipTextActive]}>Custom Users</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.targetInfoBox}>
            <Ionicons name="information-circle" size={18} color={COLORS.primary} />
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
                placeholder="Type at least 2 characters..."
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

        {/* Quick Templates Section */}
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
                }}
              >
                <Text style={styles.templateChipText}>{tmpl.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Compose Notification */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Compose Message</Text>
            <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.previewBtnSmall}>
              <Ionicons name="eye" size={14} color={COLORS.primary} />
              <Text style={styles.previewBtnText}>Live Preview</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Notification Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholder="e.g., Ramadan Special Lecture Tomorrow!"
            placeholderTextColor={COLORS.textMuted}
            maxLength={60}
          />
          <Text style={styles.charCount}>{title.length}/60</Text>

          <Text style={styles.inputLabel}>Message Body</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
            placeholder="Write clear, inspiring instructions or announcements..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={240}
          />
          <Text style={styles.charCount}>{body.length}/240</Text>
        </View>

        {/* Status Feedback */}
        {statusMessage && (
          <View style={[styles.statusBanner, statusMessage.isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, statusMessage.isError ? styles.statusErrorText : styles.statusSuccessText]}>
              {statusMessage.text}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => setPreviewVisible(true)}
            disabled={sending}
          >
            <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} />
            <Text style={styles.btnSecondaryText}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleInitiateSend}
            disabled={sending || !title.trim() || !body.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFF" />
                <Text style={styles.btnPrimaryText}>Dispatch Broadcast</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sent Notification History */}
        <View style={[styles.sectionCard, { marginTop: SPACING.xl }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Recent Broadcasts</Text>
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
              This is how your broadcast will appear on students&apos; mobile lockscreens:
            </Text>

            {/* Simulated Banner */}
            <View style={styles.pushBannerCard}>
              <View style={styles.pushBannerTopRow}>
                <View style={styles.pushAppIcon}>
                  <Text style={styles.pushAppIconText}>M</Text>
                </View>
                <Text style={styles.pushAppName}>MSDL LMS</Text>
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
              <Ionicons name="alert-circle" size={40} color="#F59E0B" />
            </View>
            <Text style={styles.confirmTitle}>Confirm Broadcast</Text>
            <Text style={styles.confirmSubtitle}>
              You are about to dispatch this push notification to {targetMode.toUpperCase()} audience.
            </Text>

            <View style={styles.confirmDetailsBox}>
              <Text style={styles.confirmDetailRow}>
                <Text style={{ fontWeight: '700' }}>Target: </Text>
                {targetMode === 'all' ? 'All Registered Users' : targetMode === 'teachers' ? 'All Faculty / Teachers' : targetMode === 'class' ? 'Specific Class Students' : 'Custom Selected Users'}
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
                <Text style={styles.confirmProceedText}>Confirm & Send</Text>
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
  previewIconBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xxl * 2,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
    gap: 8,
    paddingVertical: 4,
  },
  courseChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  courseChipSelected: {
    backgroundColor: '#3B82F615',
    borderColor: '#3B82F6',
  },
  courseChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  courseChipTextSelected: {
    color: '#2563EB',
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
    marginTop: 10,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
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
    fontSize: 13,
    fontWeight: '600',
  },
  statusSuccessText: {
    color: '#065F46',
  },
  statusErrorText: {
    color: '#991B1B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  btnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.card,
  },
  btnPrimaryText: {
    fontSize: 15,
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
    fontWeight: '700',
    color: COLORS.text,
  },
  historyBody: {
    fontSize: 13,
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
    borderRadius: RADIUS.lg,
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
    fontSize: 18,
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
    ...SHADOWS.card,
  },
  pushBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pushAppIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushAppIconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  pushAppName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    flex: 1,
  },
  pushAppTime: {
    fontSize: 11,
    color: '#64748B',
  },
  pushBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  pushBannerBody: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmModalBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  confirmIconWrap: {
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
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
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  confirmProceedBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmProceedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
