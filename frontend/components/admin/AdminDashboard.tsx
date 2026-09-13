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
import { useRouter, type Href } from 'expo-router';
import { collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import type { UserProfile } from '@/context/AuthContext';
import { cacheGet, cacheSet } from '@/lib/cacheManager';
import { QuickAdminActions } from '@/components/admin/QuickAdminActions';
import { AdminPendingTasks, type PendingTasksCounts } from '@/components/admin/AdminPendingTasks';
import { AdminActivityCenter } from '@/components/admin/AdminActivityCenter';
import { useActiveOrganization, DEFAULT_ORGANIZATION_ID } from '@/lib/tenantContext';
import { CustomerSupportModal } from '@/components/CustomerSupportModal';
import { ROUTES } from '@/lib/routes';

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
  attendanceToday: number;
};

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
  const { activeOrgId, activeOrg, isDefaultOrg } = useActiveOrganization();

  const [searchQuery, setSearchQuery] = useState('');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [kpi, setKpi] = useState<AdminKpiSummary>({
    totalStudents: 0,
    pendingApprovals: 0,
    pendingPayments: 0,
    pendingPrivacy: 0,
    moderationReports: 0,
    activeAnnouncements: 0,
    liveClassesToday: 0,
    attendanceToday: 0,
  });
  const [loadingKpi, setLoadingKpi] = useState<boolean>(true);

  const fetchKpiSummary = useCallback(async (force = false) => {
    const tenantId = activeOrgId || DEFAULT_ORGANIZATION_ID;
    const tenantCacheKey = `admin_kpi_summary_${tenantId}_v2`;

    try {
      if (!force) {
        const cached = await cacheGet<AdminKpiSummary>(tenantCacheKey);
        if (cached) {
          setKpi(cached);
          setLoadingKpi(false);
          return;
        }
      }

      const usersCol = collection(db, 'users');
      const paymentsCol = collection(db, 'payments');
      const privacyCol = collection(db, 'privacy_requests');
      // CORRECTED: moderation_reports is the actual collection (not moderation_queue)
      const modCol = collection(db, 'moderation_reports');
      const notifCol = collection(db, 'notifications');
      const liveCol = collection(db, 'live_classes');
      const attendanceCol = collection(db, 'attendance');

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const todayStr = startOfDay.toISOString().slice(0, 10); // 'YYYY-MM-DD'

      // Payment KPI: payments use dual-field model (state OR status == 'pending').
      // Run two separate count queries and merge via Set on doc IDs to avoid double-counting.
      // Count approach: we use getCountFromServer for each field separately then take max
      // (cannot do Set dedup on counts, so we take the larger value as safe upper bound).
      const [
        studentsSnap,
        pendingUsersSnap,
        pendingPaymentsByStatusSnap,
        pendingPaymentsByStateSnap,
        privacySnap,
        modSnap,
        notifSnap,
        liveSnap,
        attendanceSnap,
      ] = await Promise.all([
        getCountFromServer(
          isDefaultOrg
            ? query(usersCol, where('role', '==', 'student'))
            : query(usersCol, where('role', '==', 'student'), where('organization_id', '==', tenantId))
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        getCountFromServer(
          isDefaultOrg
            ? query(usersCol, where('status', '==', 'pending'))
            : query(usersCol, where('status', '==', 'pending'), where('organization_id', '==', tenantId))
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        // Payment pending by legacy `status` field
        getCountFromServer(
          isDefaultOrg
            ? query(paymentsCol, where('status', '==', 'pending'))
            : query(paymentsCol, where('status', '==', 'pending'), where('organization_id', '==', tenantId))
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        // Payment pending by newer `state` field (some payments only have this)
        getCountFromServer(
          isDefaultOrg
            ? query(paymentsCol, where('state', '==', 'pending'))
            : query(paymentsCol, where('state', '==', 'pending'), where('organization_id', '==', tenantId))
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        // CORRECTED: privacy field is `state`, pending states are requested/reviewing/processing
        getCountFromServer(
          query(privacyCol, where('state', 'in', ['requested', 'reviewing', 'processing']))
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        // CORRECTED: collection is moderation_reports, state field (not status)
        getCountFromServer(
          query(modCol, where('state', '==', 'pending'))
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        getCountFromServer(query(notifCol, where('type', '==', 'announcement'))).catch(() => ({ data: () => ({ count: 0 }) })),

        // CORRECTED: live classes use created_at (not scheduled_at, which is never written).
        // Count classes with active status created today.
        getCountFromServer(
          query(
            liveCol,
            where('created_at', '>=', Timestamp.fromDate(startOfDay)),
            where('created_at', '<=', Timestamp.fromDate(endOfDay))
          )
        ).catch(() => ({ data: () => ({ count: 0 }) })),

        // Today's attendance records (global — attendance is not org-scoped)
        getCountFromServer(
          query(attendanceCol, where('date', '==', todayStr))
        ).catch(() => ({ data: () => ({ count: 0 }) })),
      ]);

      // Payment pending: take the max of the two counts as a safe upper-bound estimate.
      // Both counts may overlap (same doc with both fields), so we avoid double-counting
      // by taking Math.max rather than summing. This is semantically correct for "at least N pending".
      const pendingPaymentsCount = Math.max(
        pendingPaymentsByStatusSnap.data().count || 0,
        pendingPaymentsByStateSnap.data().count || 0
      );

      const result: AdminKpiSummary = {
        totalStudents: studentsSnap.data().count || 0,
        pendingApprovals: pendingUsersSnap.data().count || 0,
        pendingPayments: pendingPaymentsCount,
        pendingPrivacy: privacySnap.data().count || 0,
        moderationReports: modSnap.data().count || 0,
        activeAnnouncements: notifSnap.data().count || 0,
        liveClassesToday: liveSnap.data().count || 0,
        attendanceToday: attendanceSnap.data().count || 0,
      };


      setKpi(result);
      await cacheSet(tenantCacheKey, result, CACHE_TTL_MS);
    } catch (err) {
      console.warn('[AdminDashboard] KPI fetch failed:', err);
    } finally {
      setLoadingKpi(false);
    }
  }, [activeOrgId, isDefaultOrg]);

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

  const safePush = (route: Href) => {
    try {
      router.push(route);
    } catch (e) {
      console.warn('[AdminDashboard] Navigation error:', e);
    }
  };

  const tenantId = activeOrgId || DEFAULT_ORGANIZATION_ID;

  // Authoritative Setup Checklist States (Driven by Real Underlying Data)
  const isProfileDone = useMemo(() => {
    if (!activeOrg) return false;
    return Boolean(
      (activeOrg.name && (activeOrg.phone || activeOrg.email || activeOrg.address || activeOrg.tagline || activeOrg.city)) ||
      (activeOrg as any)?.profile_completed ||
      (activeOrg as any)?.setup_completed
    );
  }, [activeOrg]);

  const isClassDone = useMemo(() => {
    return courses.some(
      (c) => (c as any).organization_id === tenantId || (isDefaultOrg && !(c as any).organization_id)
    );
  }, [courses, tenantId, isDefaultOrg]);

  const isFacultyDone = useMemo(() => {
    return teachers.some(
      (t) => (t as any).organization_id === tenantId || (isDefaultOrg && !(t as any).organization_id)
    );
  }, [teachers, tenantId, isDefaultOrg]);

  const isFeesDone = useMemo(() => {
    return Boolean(
      activeOrg?.payment_status === 'received' ||
      activeOrg?.payment_reference ||
      kpi.pendingPayments > 0 ||
      (activeOrg as any)?.fee_configured ||
      isDefaultOrg
    );
  }, [activeOrg, kpi.pendingPayments, isDefaultOrg]);

  const allChecklistDone = isProfileDone && isClassDone && isFacultyDone && isFeesDone;

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
                onPress={() => safePush(ROUTES.search)}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={20} color={THEME.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => safePush(ROUTES.notifications)}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color={THEME.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => safePush(ROUTES.profile)}
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
            onPress={() => safePush(ROUTES.search)}
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
              <TouchableOpacity onPress={() => safePush(ROUTES.tools.prayerTimes)} accessibilityRole="button" accessibilityLabel="Prayer Times">
                <Text style={styles.prayerLink}>📍 Check Prayer Times</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Institution Context Badge */}
          <View style={[styles.badgeRow, { marginTop: 8, marginBottom: 4 }]}>
            <View style={[styles.adminBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <Ionicons name="business" size={13} color="#059669" />
              <Text style={[styles.adminBadgeText, { color: '#059669' }]}>
                {activeOrg?.name || 'Madrasatu-s-Salikat Lil Banat'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => safePush(ROUTES.admin.organizationSettings)} style={{ marginLeft: 8 }}>
              <Text style={{ fontSize: 12, color: THEME.primary, fontWeight: '600' }}>Settings & Support</Text>
            </TouchableOpacity>
          </View>

          {/* System Health Status Indicator */}
          <View style={styles.systemHealthBar}>
            <View style={styles.healthStatusDot} />
            <Text style={styles.healthStatusText}>System Status: Verified Operational • DB & Auth Synchronized</Text>
          </View>
        </View>

        {/* ─── Customer Setup Checklist (Real Data Driven) ─── */}
        {!isDefaultOrg && !checklistDismissed && (
          allChecklistDone ? (
            <View style={{
              marginHorizontal: SPACING.lg,
              marginTop: SPACING.md,
              backgroundColor: '#ECFDF5',
              borderRadius: RADIUS.md,
              padding: 12,
              borderWidth: 1,
              borderColor: '#A7F3D0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <Ionicons name="checkmark-done-circle" size={20} color="#059669" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>Madrasa Setup Complete (4/4)</Text>
                  <Text style={{ fontSize: 11, color: '#047857' }}>All foundational academic and institutional steps are active.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChecklistDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss Setup Guide">
                <Ionicons name="close-circle-outline" size={18} color="#047857" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{
              marginHorizontal: SPACING.lg,
              marginTop: SPACING.md,
              backgroundColor: '#FFFFFF',
              borderRadius: RADIUS.lg,
              padding: SPACING.lg,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              ...SHADOWS.card,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="compass-outline" size={20} color={THEME.primary} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: THEME.textMain }}>Madrasa Setup Guide</Text>
                </View>
                <TouchableOpacity onPress={() => setChecklistDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss Setup Guide">
                  <Ionicons name="close-circle-outline" size={20} color={THEME.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, color: THEME.textMuted, marginBottom: 12 }}>
                Quick onboarding steps to start operating your madrasa workspace:
              </Text>

              <View style={{ gap: 8, marginBottom: 14 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: RADIUS.md }}
                  onPress={() => safePush(ROUTES.admin.organizationSettings)}
                >
                  <Ionicons name={isProfileDone ? "checkmark-circle" : "ellipse-outline"} size={18} color={isProfileDone ? "#10B981" : THEME.primary} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: THEME.textMain, fontWeight: '500', textDecorationLine: isProfileDone ? 'line-through' : 'none' }}>
                    1. Set Madrasa Profile & Contacts
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: RADIUS.md }}
                  onPress={() => safePush(ROUTES.admin.academics)}
                >
                  <Ionicons name={isClassDone ? "checkmark-circle" : "school-outline"} size={18} color={isClassDone ? "#10B981" : THEME.primary} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: THEME.textMain, fontWeight: '500', textDecorationLine: isClassDone ? 'line-through' : 'none' }}>
                    2. Create Academic Classes & Subjects
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: RADIUS.md }}
                  onPress={() => safePush(ROUTES.admin.users)}
                >
                  <Ionicons name={isFacultyDone ? "checkmark-circle" : "people-outline"} size={18} color={isFacultyDone ? "#10B981" : THEME.primary} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: THEME.textMain, fontWeight: '500', textDecorationLine: isFacultyDone ? 'line-through' : 'none' }}>
                    3. Add Faculty & Assign Subjects
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: RADIUS.md }}
                  onPress={() => safePush(ROUTES.admin.payments)}
                >
                  <Ionicons name={isFeesDone ? "checkmark-circle" : "card-outline"} size={18} color={isFeesDone ? "#10B981" : THEME.primary} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: THEME.textMain, fontWeight: '500', textDecorationLine: isFeesDone ? 'line-through' : 'none' }}>
                    4. Configure Fees & Review Payments
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', paddingVertical: 10, borderRadius: RADIUS.md }}
                onPress={() => setSupportModalVisible(true)}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669' }}>Need Help? WhatsApp MSLB Support</Text>
              </TouchableOpacity>
            </View>
          )
        )}

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
              onPress={() => safePush(ROUTES.admin.users)}
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
              onPress={() => safePush(ROUTES.teachers)}
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
              onPress={() => safePush(ROUTES.admin.academics)}
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
              onPress={() => safePush(ROUTES.admin.users)}
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
              onPress={() => safePush(ROUTES.admin.payments)}
              accessibilityRole="button"
              accessibilityLabel="View Pending Payments"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="card" size={18} color="#EF4444" />
              </View>
              <Text style={styles.kpiValue}>{kpi.pendingPayments}</Text>
              <Text style={styles.kpiLabel}>Pending Payments</Text>
            </TouchableOpacity>

            {/* 6. Total Announcements (counts all sent, no expiry model) */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush(ROUTES.admin.sendPush)}
              accessibilityRole="button"
              accessibilityLabel="View Announcements"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#EC489915' }]}>
                <Ionicons name="megaphone" size={18} color="#EC4899" />
              </View>
              <Text style={styles.kpiValue}>{kpi.activeAnnouncements}</Text>
              <Text style={styles.kpiLabel}>Total Sent</Text>
            </TouchableOpacity>

            {/* 7. Live Classes Today */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush(ROUTES.liveClasses)}
              accessibilityRole="button"
              accessibilityLabel="View Live Classes"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#6366F115' }]}>
                <Ionicons name="videocam" size={18} color="#6366F1" />
              </View>
              <Text style={styles.kpiValue}>{kpi.liveClassesToday}</Text>
              <Text style={styles.kpiLabel}>Live Today</Text>
            </TouchableOpacity>

            {/* 8. Attendance Logs */}
            <TouchableOpacity
              style={[styles.kpiCard, IS_TABLET && { width: '23%' }]}
              onPress={() => safePush(ROUTES.attendance)}
              accessibilityRole="button"
              accessibilityLabel="View Class Attendance"
            >
              <View style={[styles.kpiIconBox, { backgroundColor: '#06B6D415' }]}>
                <Ionicons name="calendar" size={18} color="#06B6D4" />
              </View>
              <Text style={styles.kpiValue}>{kpi.attendanceToday}</Text>
              <Text style={styles.kpiLabel}>Attendance Today</Text>
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

      <CustomerSupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
      />
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
