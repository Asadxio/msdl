import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import type { UserProfile } from '@/context/AuthContext';
import { cacheGet, cacheSet } from '@/lib/cacheManager';
import { QuickAdminActions } from '@/components/admin/QuickAdminActions';
import { AdminPendingTasks, type PendingTasksCounts } from '@/components/admin/AdminPendingTasks';
import { AdminActivityCenter } from '@/components/admin/AdminActivityCenter';

type PrayerItem = {
  name: string;
  time: Date;
};

type Props = {
  profile: UserProfile | null;
  user: { uid?: string; email?: string | null; displayName?: string | null } | null;
  hijriDate?: string;
  currentPrayer?: PrayerItem | null;
  nextPrayer?: PrayerItem | null;
  formatTime?: (d: Date) => string;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
};

type AdminKpiSummary = {
  totalStudents: number;
  pendingApprovals: number;
  pendingPayments: number;
  pendingPrivacy: number;
  moderationReports: number;
  activeAnnouncements: number;
  liveClassesToday: number;
};

const CACHE_KEY = 'admin_kpi_summary_v1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const { width } = Dimensions.get('window');
const IS_TABLET = width > 768;

export const AdminDashboard = React.memo(function AdminDashboard({
  profile,
  user,
  hijriDate = 'Islamic Calendar',
  currentPrayer,
  nextPrayer,
  formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  onRefresh,
  refreshing = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { courses, teachers, books } = useData();

  const [kpi, setKpi] = useState<AdminKpiSummary>({
    totalStudents: 0,
    pendingApprovals: 0,
    pendingPayments: 0,
    pendingPrivacy: 0,
    moderationReports: 0,
    activeAnnouncements: 0,
    liveClassesToday: 0,
  });
  const [loadingKpi, setLoadingKpi] = useState<boolean>(true);

  const fetchKpiSummary = useCallback(async (force = false) => {
    try {
      if (!force) {
        const cached = await cacheGet<AdminKpiSummary>(CACHE_KEY);
        if (cached) {
          setKpi(cached);
          setLoadingKpi(false);
          return;
        }
      }

      const usersCol = collection(db, 'users');
      const paymentsCol = collection(db, 'payments');
      const privacyCol = collection(db, 'privacy_requests');
      const modCol = collection(db, 'moderation_queue');
      const notifCol = collection(db, 'notifications');
      const liveCol = collection(db, 'live_classes');

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const [
        studentsSnap,
        pendingUsersSnap,
        pendingPaymentsSnap,
        privacySnap,
        modSnap,
        notifSnap,
        liveSnap,
      ] = await Promise.all([
        getCountFromServer(query(usersCol, where('role', '==', 'student'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getCountFromServer(query(usersCol, where('status', '==', 'pending'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getCountFromServer(query(paymentsCol, where('status', '==', 'pending'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getCountFromServer(query(privacyCol, where('status', '==', 'open'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getCountFromServer(query(modCol, where('status', '==', 'pending'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getCountFromServer(query(notifCol, where('type', '==', 'announcement'))).catch(() => ({ data: () => ({ count: 0 }) })),
        getCountFromServer(
          query(
            liveCol,
            where('scheduled_at', '>=', Timestamp.fromDate(startOfDay)),
            where('scheduled_at', '<=', Timestamp.fromDate(endOfDay))
          )
        ).catch(() => ({ data: () => ({ count: 0 }) })),
      ]);

      const result: AdminKpiSummary = {
        totalStudents: studentsSnap.data().count || 0,
        pendingApprovals: pendingUsersSnap.data().count || 0,
        pendingPayments: pendingPaymentsSnap.data().count || 0,
        pendingPrivacy: privacySnap.data().count || 0,
        moderationReports: modSnap.data().count || 0,
        activeAnnouncements: notifSnap.data().count || 0,
        liveClassesToday: liveSnap.data().count || 0,
      };

      setKpi(result);
      await cacheSet(CACHE_KEY, result, CACHE_TTL_MS);
    } catch (err) {
      console.warn('[AdminDashboard] KPI fetch failed:', err);
    } finally {
      setLoadingKpi(false);
    }
  }, []);

  useEffect(() => {
    void fetchKpiSummary(false);
  }, [fetchKpiSummary]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
    await fetchKpiSummary(true);
  }, [onRefresh, fetchKpiSummary]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning Admin';
    if (hour < 17) return 'Good Afternoon Admin';
    return 'Good Evening Admin';
  }, []);

  const adminName = profile?.name || user?.displayName || profile?.role?.toUpperCase() || 'Administrator';

  const pendingCounts: PendingTasksCounts = useMemo(() => ({
    approvals: kpi.pendingApprovals,
    payments: kpi.pendingPayments,
    privacy: kpi.pendingPrivacy,
    moderation: kpi.moderationReports,
  }), [kpi]);

  return (
    <View style={[styles.mainContainer, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + SPACING.sm }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingKpi}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Top Greeting Section */}
        <View style={styles.topSection}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                  <Text style={styles.adminBadgeText}>ENTERPRISE LMS ADMIN</Text>
                </View>
                <Text style={styles.adminNameText} numberOfLines={1}>{adminName}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/(tabs)/about' as any)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="View Admin Profile"
            >
              <Ionicons name="person-circle" size={40} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Hijri Date & Prayer Reminder Bar */}
          <View style={styles.prayerBar}>
            <View style={styles.hijriCol}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.hijriText}>{hijriDate}</Text>
            </View>
            {currentPrayer ? (
              <View style={styles.prayerCol}>
                <Ionicons name="time-outline" size={16} color="#F59E0B" />
                <Text style={styles.prayerText}>
                  {currentPrayer.name}: {formatTime(currentPrayer.time)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => router.push('/prayer-times' as any)}>
                <Text style={styles.prayerLink}>📍 Check Prayer Schedule</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* KPI Cards Grid */}
        <View style={styles.kpiSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Platform Metrics</Text>
          </View>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="school" size={20} color="#10B981" />
              </View>
              <Text style={styles.kpiValue}>{kpi.totalStudents}</Text>
              <Text style={styles.kpiLabel}>Total Students</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="people" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.kpiValue}>{teachers.length}</Text>
              <Text style={styles.kpiLabel}>Total Teachers</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="book" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.kpiValue}>{courses.length}</Text>
              <Text style={styles.kpiLabel}>Active Courses</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="document-text" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.kpiValue}>{kpi.pendingApprovals}</Text>
              <Text style={styles.kpiLabel}>Pending Apps</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="card" size={20} color="#EF4444" />
              </View>
              <Text style={styles.kpiValue}>{kpi.pendingPayments}</Text>
              <Text style={styles.kpiLabel}>Pending Payments</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#EC489915' }]}>
                <Ionicons name="megaphone" size={20} color="#EC4899" />
              </View>
              <Text style={styles.kpiValue}>{kpi.activeAnnouncements}</Text>
              <Text style={styles.kpiLabel}>Announcements</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#6366F115' }]}>
                <Ionicons name="videocam" size={20} color="#6366F1" />
              </View>
              <Text style={styles.kpiValue}>{kpi.liveClassesToday}</Text>
              <Text style={styles.kpiLabel}>Live Today</Text>
            </View>

            <View style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#06B6D415' }]}>
                <Ionicons name="library" size={20} color="#06B6D4" />
              </View>
              <Text style={styles.kpiValue}>{books.length}</Text>
              <Text style={styles.kpiLabel}>Library Books</Text>
            </View>
          </View>
        </View>

        {/* Phase 2: Quick Admin Actions */}
        <QuickAdminActions />

        {/* Phase 3: Pending Tasks Center */}
        <AdminPendingTasks counts={pendingCounts} />

        {/* Phase 4: Activity Center */}
        <AdminActivityCenter courses={courses} teachers={teachers} books={books} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  topSection: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 6,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.5,
  },
  adminNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  profileBtn: {
    padding: 2,
  },
  prayerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hijriCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hijriText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  prayerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prayerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  prayerLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  kpiSection: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  kpiCard: {
    width: IS_TABLET ? '23%' : '48%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  kpiIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
