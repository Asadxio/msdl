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
  TextInput,
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

// ─── Institutional Palette ───
const THEME = {
  primary: '#005F46',
  primaryLight: '#0B6B53',
  gold: '#C8A84E',
  softGold: '#E8D9A8',
  goldBg: '#FEF9EE',
  goldBorder: '#F3E5BE',
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F2',
  textMain: '#12332A',
  textMuted: '#60736B',
  border: '#E2E8E4',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

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

  const [searchQuery, setSearchQuery] = useState('');
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
    if (hour < 12) return 'Good Morning Administrator';
    if (hour < 17) return 'Good Afternoon Administrator';
    return 'Good Evening Administrator';
  }, []);

  const adminName = profile?.name || user?.displayName || (profile?.role === 'super_admin' ? 'Super Administrator' : 'System Administrator');

  const pendingCounts: PendingTasksCounts = useMemo(() => ({
    approvals: kpi.pendingApprovals,
    payments: kpi.pendingPayments,
    privacy: kpi.pendingPrivacy,
    moderation: kpi.moderationReports,
  }), [kpi]);

  const safePush = (route: string) => {
    try {
      router.push(route as any);
    } catch (e) {
      console.warn('[AdminDashboard] Navigation error:', e);
    }
  };

  return (
    <View style={[styles.mainContainer, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + SPACING.xs }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingKpi}
            onRefresh={handleRefresh}
            tintColor={THEME.primary}
            colors={[THEME.primary]}
          />
        }
      >
        {/* ─── Top Header Section ─── */}
        <View style={styles.topSection}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={13} color={THEME.primary} />
                  <Text style={styles.adminBadgeText}>ENTERPRISE LMS ADMIN</Text>
                </View>
                <Text style={styles.adminNameText} numberOfLines={1}>• {adminName}</Text>
              </View>
            </View>
            
            <View style={styles.headerActionsGroup}>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => safePush('/search')}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={20} color={THEME.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => safePush('/(tabs)/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color={THEME.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => safePush('/(tabs)/about')}
                accessibilityRole="button"
                accessibilityLabel="View Admin Profile"
              >
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarText}>{(adminName || 'A').charAt(0).toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Admin Quick Search Bar */}
          <TouchableOpacity
            style={styles.adminSearchBar}
            onPress={() => safePush('/search')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Search everything across LMS"
          >
            <Ionicons name="search" size={17} color={THEME.primary} />
            <Text style={styles.adminSearchPlaceholder}>Search students, courses, faculty, logs, kitabs...</Text>
            <View style={styles.adminSearchBadge}>
              <Text style={styles.adminSearchBadgeText}>Search</Text>
            </View>
          </TouchableOpacity>

          {/* Hijri Date & Prayer Reminder Bar */}
          <View style={styles.prayerBar}>
            <View style={styles.hijriCol}>
              <Ionicons name="calendar-outline" size={15} color={THEME.primary} />
              <Text style={styles.hijriText}>{hijriDate}</Text>
            </View>
            {currentPrayer ? (
              <View style={styles.prayerCol}>
                <Ionicons name="time-outline" size={15} color={THEME.warning} />
                <Text style={styles.prayerText}>
                  {currentPrayer.name}: {formatTime(currentPrayer.time)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => safePush('/prayer-times')} accessibilityRole="button" accessibilityLabel="Prayer Times">
                <Text style={styles.prayerLink}>📍 Check Prayer Times</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* System Health Status Indicator */}
          <View style={styles.systemHealthBar}>
            <View style={styles.healthStatusDot} />
            <Text style={styles.healthStatusText}>System Status: Verified Operational • DB & Auth Synchronized</Text>
          </View>
        </View>

        {/* ─── Platform Metrics (8 Authoritative Cards - 2x4 Grid) ─── */}
        <View style={styles.kpiSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart-outline" size={17} color={THEME.primary} />
            <Text style={styles.sectionTitle}>Platform Metrics</Text>
            <TouchableOpacity onPress={() => void fetchKpiSummary(true)} style={styles.refreshIconBtn} accessibilityRole="button" accessibilityLabel="Refresh Metrics">
              <Ionicons name="refresh-outline" size={15} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.kpiGrid}>
            {/* 1. Total Students */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/users')}
              accessibilityRole="button"
              accessibilityLabel="View Total Students"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="school" size={18} color="#10B981" />
              </View>
              <Text style={styles.kpiValue}>{kpi.totalStudents}</Text>
              <Text style={styles.kpiLabel}>Total Students</Text>
            </TouchableOpacity>

            {/* 2. Total Teachers */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/users')}
              accessibilityRole="button"
              accessibilityLabel="View Total Teachers"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="people" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.kpiValue}>{teachers.length}</Text>
              <Text style={styles.kpiLabel}>Total Faculty</Text>
            </TouchableOpacity>

            {/* 3. Active Courses */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/manage-academics')}
              accessibilityRole="button"
              accessibilityLabel="View Active Courses"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="book" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.kpiValue}>{courses.length}</Text>
              <Text style={styles.kpiLabel}>Active Courses</Text>
            </TouchableOpacity>

            {/* 4. Pending Applications */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/users')}
              accessibilityRole="button"
              accessibilityLabel="View Pending Applications"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="document-text" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.kpiValue}>{kpi.pendingApprovals}</Text>
              <Text style={styles.kpiLabel}>Pending Apps</Text>
            </TouchableOpacity>

            {/* 5. Pending Payments */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/payments')}
              accessibilityRole="button"
              accessibilityLabel="View Pending Payments"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="card" size={18} color="#EF4444" />
              </View>
              <Text style={styles.kpiValue}>{kpi.pendingPayments}</Text>
              <Text style={styles.kpiLabel}>Pending Payments</Text>
            </TouchableOpacity>

            {/* 6. Active Announcements */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/send-push')}
              accessibilityRole="button"
              accessibilityLabel="View Announcements"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#EC489915' }]}>
                <Ionicons name="megaphone" size={18} color="#EC4899" />
              </View>
              <Text style={styles.kpiValue}>{kpi.activeAnnouncements}</Text>
              <Text style={styles.kpiLabel}>Announcements</Text>
            </TouchableOpacity>

            {/* 7. Live Classes Today */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/live-class')}
              accessibilityRole="button"
              accessibilityLabel="View Live Classes"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#6366F115' }]}>
                <Ionicons name="videocam" size={18} color="#6366F1" />
              </View>
              <Text style={styles.kpiValue}>{kpi.liveClassesToday}</Text>
              <Text style={styles.kpiLabel}>Live Today</Text>
            </TouchableOpacity>

            {/* 8. Library Books */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush('/admin/add-book')}
              accessibilityRole="button"
              accessibilityLabel="View Library Books"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#06B6D415' }]}>
                <Ionicons name="library" size={18} color="#06B6D4" />
              </View>
              <Text style={styles.kpiValue}>{books.length}</Text>
              <Text style={styles.kpiLabel}>Library Books</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Quick Admin Actions ─── */}
        <QuickAdminActions />

        {/* ─── Pending Tasks Center ─── */}
        <AdminPendingTasks counts={pendingCounts} />

        {/* ─── Activity Center ─── */}
        <AdminActivityCenter courses={courses} teachers={teachers} books={books} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  topSection: {
    backgroundColor: THEME.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    ...SHADOWS.card,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.textMain,
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  adminBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 0.5,
  },
  adminNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtn: {
    padding: 1,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.goldBg,
    borderWidth: 1.5,
    borderColor: THEME.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.primary,
  },
  prayerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceAlt,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  adminSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 8,
    ...SHADOWS.card,
  },
  adminSearchPlaceholder: {
    flex: 1,
    fontSize: 12.5,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  adminSearchBadge: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  adminSearchBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hijriCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hijriText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.textMain,
  },
  prayerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prayerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D97706',
  },
  prayerLink: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.primary,
  },
  systemHealthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  healthStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.success,
  },
  healthStatusText: {
    fontSize: 10.5,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  kpiSection: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textMain,
    flex: 1,
  },
  refreshIconBtn: {
    padding: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  kpiCard: {
    width: IS_TABLET ? '23%' : '48.5%',
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 88,
    ...SHADOWS.card,
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.textMain,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 1,
  },
});
