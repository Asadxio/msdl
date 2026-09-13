import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { ScreenRefreshControl , EmptyState, ScalePressable } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { endLiveClass, startLiveClass } from '@/lib/liveClasses';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useData } from '@/context/DataContext';
import { useActiveOrganization, DEFAULT_ORGANIZATION_ID } from '@/lib/tenantContext';

import { goBackOrReplace } from '@/lib/navigation';

type LiveClassItem = {
  id: string;
  title: string;
  teacher_name: string;
  status: 'scheduled' | 'live' | 'ended';
  class_time?: string;
  time?: string;
};

export default function LiveClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { courses } = useData();
  const { activeOrgId, isDefaultOrg } = useActiveOrganization();
  const isAdminOrTeacher = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'super_admin';
  const [classes, setClasses] = useState<LiveClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled'>('live');

  // ── Create Live Class modal state ──
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createCourseId, setCreateCourseId] = useState('');
  const [createMeetUrl, setCreateMeetUrl] = useState('');
  const [createPurdah, setCreatePurdah] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchClasses = () => {
    setLoading(true);
    // Tenant-scoped query:
    // - Custom tenants: filter by organization_id to show only their classes
    // - Default/legacy tenant: fetch all (preserves backward-compatible global behavior)
    const baseQ = (!isDefaultOrg && activeOrgId)
      ? query(collection(db, 'live_classes'), where('organization_id', '==', activeOrgId), orderBy('status', 'asc'))
      : query(collection(db, 'live_classes'), orderBy('status', 'asc'));

    const unsub = onSnapshot(
      baseQ,
      (snapshot) => {
        const items: LiveClassItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== 'ended') {
            items.push({
              id: docSnap.id,
              title: data.title || 'Untitled Class',
              teacher_name: data.teacher_name || 'Unknown Teacher',
              status: data.status || 'scheduled',
              class_time: data.class_time || data.time || 'TBD',
            });
          }
        });
        setClasses(items);
        setLoading(false);
      },
      (error) => {
        console.error('[LiveClassesScreen] Error fetching live classes:', error);
        setLoading(false);
      }
    );
    return unsub;
  };

  useEffect(() => {
    const unsub = fetchClasses();
    return () => unsub();
  // Re-subscribe when tenant context changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, isDefaultOrg]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    // Revalidation only - listeners are active
    await new Promise((r) => setTimeout(r, 500));
  });

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => c.status === activeTab);
  }, [classes, activeTab]);

  const joinLiveClass = (id: string) => {
    try {
      router.push({ pathname: '/live-class/[id]', params: { id } } as any);
    } catch (e) {
      console.log('[LiveClassesScreen] navigation to live class failed:', e);
    }
  };

  // ── Create Live Class handler ──
  const handleCreateLiveClass = async () => {
    if (!createTitle.trim()) {
      Alert.alert('Required', 'Please enter a class title.');
      return;
    }
    if (!createCourseId) {
      Alert.alert('Required', 'Please select a course.');
      return;
    }
    if (!createMeetUrl.trim()) {
      Alert.alert('Required', 'Please enter a valid Google Meet link.');
      return;
    }
    if (!profile) return;

    setCreating(true);
    try {
      const selectedCourse = courses.find((c) => c.id === createCourseId);
      await startLiveClass({
        courseId: createCourseId,
        title: createTitle.trim(),
        teacherId: profile.uid || '',
        teacherName: profile.name || 'Admin',
        meetUrl: createMeetUrl.trim(),
        profile,
        purdahModeEnabled: createPurdah,
        // organizationId is taken from the authenticated user's own org context — never from arbitrary user input
        organizationId: activeOrgId || DEFAULT_ORGANIZATION_ID,
      });
      setCreateTitle('');
      setCreateCourseId('');
      setCreateMeetUrl('');
      setCreatePurdah(true);
      setCreateModalVisible(false);
      Alert.alert('Live Class Started! 🔴', `"${createTitle.trim()}" is now live. Students have been notified.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not start live class. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderClassItem = ({ item }: { item: LiveClassItem }) => {
    const isLive = item.status === 'live';

    return (
      <ScalePressable
        style={[styles.classCard, isLive && styles.classCardActive]}
        onPress={() => isLive && joinLiveClass(item.id)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, isLive ? styles.badgeLive : styles.badgeScheduled]}>
            <Text style={[styles.badgeText, isLive ? styles.badgeTextLive : styles.badgeTextScheduled]}>
              {isLive ? '🔴 LIVE NOW' : '📅 SCHEDULED'}
            </Text>
          </View>
        </View>

        <Text style={styles.classTitle}>{item.title}</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={15} color={COLORS.textMuted} />
          <Text style={styles.infoText}>Teacher: {item.teacher_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={15} color={COLORS.textMuted} />
          <Text style={styles.infoText}>Time: {item.class_time}</Text>
        </View>

        {isLive ? (
          <TouchableOpacity style={styles.joinBtn} onPress={() => joinLiveClass(item.id)}>
            <Text style={styles.joinBtnText}>Join Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.upcomingBtn}>
            <Text style={styles.upcomingBtnText}>Scheduled</Text>
          </View>
        )}

        {isAdminOrTeacher && (
          <View style={styles.adminControlsRow}>
            {isLive && (
              <TouchableOpacity
                style={styles.adminEndBtn}
                onPress={() => {
                  Alert.alert(
                    'End Live Class',
                    `Are you sure you want to terminate "${item.title}" for all participants?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'End Session',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            if (profile) await endLiveClass(item.id, profile);
                          } catch (e: any) {
                            Alert.alert('Error', e?.message || 'Could not terminate session.');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="stop-circle-outline" size={16} color={COLORS.error} />
                <Text style={styles.adminEndBtnText}>End Session</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.adminMonitorBtn, !isLive && { flex: 1 }]}
              onPress={() => joinLiveClass(item.id)}
            >
              <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
              <Text style={styles.adminMonitorBtnText}>{isLive ? 'Monitor Feed' : 'Inspect Room'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScalePressable>
    );
  };

  // Filter courses to active org for the create dropdown
  const orgCourses = useMemo(() => {
    if (isDefaultOrg) return courses;
    return courses.filter((c) => !c.organization_id || c.organization_id === (activeOrgId || DEFAULT_ORGANIZATION_ID));
  }, [courses, isDefaultOrg, activeOrgId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/(tabs)')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Live Classes</Text>
        {/* ── Create button — only for admin/teacher ── */}
        {isAdminOrTeacher ? (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setCreateModalVisible(true)}
            accessibilityLabel="Start New Live Class"
            testID="create-live-class-btn"
          >
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'live' && styles.tabActive]}
          onPress={() => setActiveTab('live')}
        >
          <Text style={[styles.tabLabel, activeTab === 'live' && styles.tabLabelActive]}>Live Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scheduled' && styles.tabActive]}
          onPress={() => setActiveTab('scheduled')}
        >
          <Text style={[styles.tabLabel, activeTab === 'scheduled' && styles.tabLabelActive]}>Upcoming</Text>
        </TouchableOpacity>
      </View>

      {isAdminOrTeacher && (
        <View style={styles.adminBanner}>
          <View style={styles.adminBannerIcon}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.goldText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminBannerTitle}>Enterprise Host Mode</Text>
            <Text style={styles.adminBannerSub}>
              Monitoring {classes.filter((c) => c.status === 'live').length} active broadcast session(s)
            </Text>
          </View>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>{profile?.role?.toUpperCase()}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList removeClippedSubviews initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5}
          data={filteredClasses}
          keyExtractor={(item) => item.id}
          renderItem={renderClassItem}
          contentContainerStyle={styles.list}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="videocam-off-outline"
                title="No Live Classes"
                message={
                  activeTab === 'live'
                    ? 'Check back later for upcoming classes.'
                    : 'There are no upcoming scheduled classes.'
                }
              />
              {isAdminOrTeacher && (
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => setCreateModalVisible(true)}
                >
                  <Ionicons name="videocam-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.emptyCreateBtnText}>Start a New Live Class</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── Create Live Class Modal ── */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !creating && setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start Live Class</Text>
              <TouchableOpacity
                onPress={() => !creating && setCreateModalVisible(false)}
                disabled={creating}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={styles.fieldLabel}>Class Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Tajweed – Lesson 3"
                placeholderTextColor={COLORS.textMuted}
                value={createTitle}
                onChangeText={setCreateTitle}
                editable={!creating}
                testID="create-class-title-input"
              />

              {/* Course Picker (Alert-based for minimal surface area) */}
              <Text style={styles.fieldLabel}>Course *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  if (creating) return;
                  const options = orgCourses.map((c) => ({
                    text: c.name,
                    onPress: () => setCreateCourseId(c.id),
                  }));
                  if (!options.length) {
                    Alert.alert('No Courses', 'No courses are available for your organization.');
                    return;
                  }
                  Alert.alert(
                    'Select Course',
                    'Choose which course this live class is for:',
                    [...options, { text: 'Cancel', style: 'cancel' as const }]
                  );
                }}
                testID="create-class-course-picker"
              >
                <Text style={[styles.pickerText, !createCourseId && { color: COLORS.textMuted }]}>
                  {createCourseId
                    ? (orgCourses.find((c) => c.id === createCourseId)?.name || 'Selected')
                    : 'Tap to select course'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Meet URL */}
              <Text style={styles.fieldLabel}>Google Meet URL *</Text>
              <TextInput
                style={styles.input}
                placeholder="https://meet.google.com/abc-defg-hij"
                placeholderTextColor={COLORS.textMuted}
                value={createMeetUrl}
                onChangeText={setCreateMeetUrl}
                autoCapitalize="none"
                keyboardType="url"
                editable={!creating}
                testID="create-class-meet-url-input"
              />

              {/* Purdah Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Purdah Mode</Text>
                  <Text style={styles.fieldSub}>Students join in audio-only mode</Text>
                </View>
                <Switch
                  value={createPurdah}
                  onValueChange={setCreatePurdah}
                  disabled={creating}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.surface}
                  testID="create-class-purdah-toggle"
                />
              </View>

              <TouchableOpacity
                style={[styles.startBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateLiveClass}
                disabled={creating}
                testID="create-class-submit-btn"
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={styles.startBtnText}>Go Live Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.title, color: COLORS.primary },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: 40,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  classCardActive: {
    borderColor: 'rgba(6, 78, 59, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeLive: {
    backgroundColor: '#FDECEC',
  },
  badgeScheduled: {
    backgroundColor: COLORS.goldBg,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeTextLive: {
    color: COLORS.error,
  },
  badgeTextScheduled: {
    color: COLORS.goldText,
  },
  classTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textMain,
    marginBottom: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  upcomingBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  upcomingBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyCreateBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#FFE082',
    gap: 12,
    ...SHADOWS.card,
  },
  adminBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E65100',
  },
  adminBannerSub: {
    fontSize: 11,
    color: '#EF6C00',
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#FFE082',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E65100',
  },
  adminControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  adminEndBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FDECEC',
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FADBD8',
  },
  adminEndBtnText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
  adminMonitorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EEF6F2',
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D4E6DF',
  },
  adminMonitorBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  fieldSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textMain,
    backgroundColor: COLORS.background,
  },
  picker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
  },
  pickerText: {
    fontSize: 14,
    color: COLORS.textMain,
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    marginTop: SPACING.xl,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
