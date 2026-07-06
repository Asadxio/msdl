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
} from 'react-native';
import { ScreenRefreshControl , EmptyState, ScalePressable } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { endLiveClass } from '@/lib/liveClasses';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { db } from '@/lib/firebase';

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
  const isAdminOrTeacher = profile?.role === 'admin' || profile?.role === 'teacher';
  const [classes, setClasses] = useState<LiveClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled'>('live');

  const fetchClasses = () => {
    setLoading(true);
    const q = query(collection(db, 'live_classes'), orderBy('status', 'asc'));
    const unsub = onSnapshot(
      q,
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
  }, []);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/(tabs)')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Live Classes</Text>
        <View style={{ width: 36 }} />
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
        <FlatList
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
            </View>
          }
        />
      )}
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
});
