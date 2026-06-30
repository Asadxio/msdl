import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, getCountFromServer, getDocs, query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

type AnalyticsMetrics = {
  // Users
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalUsers: number;
  activeUsers30d: number;
  // Academics
  totalCourses: number;
  activeCourses: number;
  quizAttempts: number;
  attendancePct: number;
  presentCount: number;
  absentCount: number;
  // Live Classes
  classesHosted: number;
  
  
  // Payments
  totalRevenue: number;
  totalDonations: number;
  totalFees: number;
  failedPayments: number;
  monthlyRevenue: number;
  pendingPayments: number;
};

const EMPTY_METRICS: AnalyticsMetrics = {
  totalStudents: 0, totalTeachers: 0, totalAdmins: 0, totalUsers: 0, activeUsers30d: 0,
  totalCourses: 0, activeCourses: 0, quizAttempts: 0, attendancePct: 0, presentCount: 0, absentCount: 0,
  classesHosted: 0,  
  totalRevenue: 0, totalDonations: 0, totalFees: 0, failedPayments: 0, monthlyRevenue: 0, pendingPayments: 0,
};

function MetricCard({ icon, label, value, sub, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color ? `${color}20` : COLORS.surfaceAlt }]}>
        <Ionicons name={icon} size={20} color={color || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
        {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function AdminAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(EMPTY_METRICS);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgoTs = Timestamp.fromDate(thirtyDaysAgo);
      const startOfMonthTs = Timestamp.fromDate(startOfMonth);

      // Parallel fetches — users by role
      const [
        studentsCount, teachersCount, adminsCount, activeUsersSnap,
        allCoursesCount, activeCoursesCount,
        quizResultsCount,
        attendanceSnap,
        liveClassesSnap,
        allPaymentsSnap,
      ] = await Promise.all([
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'))),
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'teacher'))),
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'admin'))),
        getDocs(query(collection(db, 'users'), where('last_login_at', '>=', thirtyDaysAgoTs))),
        getCountFromServer(collection(db, 'courses')),
        getCountFromServer(query(collection(db, 'courses'), where('status', '==', 'active'))),
        getCountFromServer(collection(db, 'quiz_results')),
        getDocs(query(collection(db, 'attendance'), limit(2000))),
        getDocs(query(collection(db, 'live_classes'), orderBy('started_at', 'desc'), limit(200))),
        getDocs(query(collection(db, 'payments'), limit(2000))),
      ]);

      // Attendance calculations
      let presentCount = 0;
      let absentCount = 0;
      attendanceSnap.forEach((d) => {
        const item = d.data() as { status?: string };
        if (item.status === 'present') presentCount++;
        else if (item.status === 'absent') absentCount++;
      });
      const totalAttendance = presentCount + absentCount;
      const attendancePct = totalAttendance ? Math.round((presentCount / totalAttendance) * 100) : 0;

      // Live class calculations
      let classesHosted = 0;
      liveClassesSnap.forEach((d) => {
        const data = d.data() as { ended_at?: unknown };
        if (data.ended_at) {
          classesHosted++;
        }
      });
      

      // Payment calculations
      let totalRevenue = 0;
      let totalDonations = 0;
      let totalFees = 0;
      let failedPayments = 0;
      let monthlyRevenue = 0;
      let pendingPayments = 0;
      const donationTypes = new Set(['sadqa', 'zakat', 'fitra', 'langar']);

      allPaymentsSnap.forEach((d) => {
        const p = d.data() as {
          amount?: number; type?: string; state?: string; status?: string;
          created_at?: { toMillis?: () => number };
        };
        const amt = Number(p.amount || 0);
        const state = String(p.state ?? p.status ?? '');
        const pType = String(p.type || 'fees');
        const isSucceeded = ['succeeded', 'approved', 'verified'].includes(state);
        const isFailed = ['failed', 'rejected', 'cancelled', 'expired'].includes(state);
        const isPending = ['pending', 'processing', 'submitted'].includes(state);

        if (isSucceeded) {
          totalRevenue += amt;
          if (donationTypes.has(pType)) totalDonations += amt;
          else if (pType === 'fees') totalFees += amt;
          // Monthly
          const createdMs = p.created_at?.toMillis ? p.created_at.toMillis() : 0;
          if (createdMs >= startOfMonthTs.toMillis()) monthlyRevenue += amt;
        }
        if (isFailed) failedPayments++;
        if (isPending) pendingPayments++;
      });

      setMetrics({
        totalStudents: studentsCount.data().count,
        totalTeachers: teachersCount.data().count,
        totalAdmins: adminsCount.data().count,
        totalUsers: studentsCount.data().count + teachersCount.data().count + adminsCount.data().count,
        activeUsers30d: activeUsersSnap.size,
        totalCourses: allCoursesCount.data().count,
        activeCourses: activeCoursesCount.data().count,
        quizAttempts: quizResultsCount.data().count,
        attendancePct,
        presentCount,
        absentCount,
        classesHosted,
        
        
        totalRevenue,
        totalDonations,
        totalFees,
        failedPayments,
        monthlyRevenue,
        pendingPayments,
      });
      setLastRefreshed(new Date());
    } catch (error: unknown) {
      logFirestoreFailure({
        collection: 'users/courses/attendance/live_class_sessions/payments/quiz_results',
        operation: 'count',
        query: 'admin analytics full load',
        role: profile?.role,
        status: profile?.status,
      }, error);
      setError('Some analytics failed to load. Showing partial data.');
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await loadAnalytics();
  });

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/unauthorized?required=admin');
      return;
    }
    if (isAdmin) loadAnalytics().catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isAdmin]);

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')} testID="analytics-back-btn">
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>Analytics Dashboard</Text>
          {lastRefreshed ? (
            <Text style={styles.lastRefreshed}>
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => { void loadAnalytics(); }}
          style={styles.refreshBtn}
          testID="analytics-refresh-btn"
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="refresh" size={20} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color="#B45309" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !lastRefreshed ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : (
        <ScrollView 
        contentContainerStyle={styles.body} 
        showsVerticalScrollIndicator={false}
        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

          {/* USERS */}
          <SectionHeader title="Users" icon="people-outline" />
          <View style={styles.row}>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="school-outline" size={18} color="#1565C0" />
              <Text style={styles.metricLabel}>Students</Text>
              <Text style={[styles.metricValue, { color: '#1565C0' }]}>{metrics.totalStudents}</Text>
            </View>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="person-circle-outline" size={18} color="#7B1FA2" />
              <Text style={styles.metricLabel}>Teachers</Text>
              <Text style={[styles.metricValue, { color: '#7B1FA2' }]}>{metrics.totalTeachers}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="shield-outline" size={18} color="#E65100" />
              <Text style={styles.metricLabel}>Admins</Text>
              <Text style={[styles.metricValue, { color: '#E65100' }]}>{metrics.totalAdmins}</Text>
            </View>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="pulse-outline" size={18} color={COLORS.primary} />
              <Text style={styles.metricLabel}>Active (30d)</Text>
              <Text style={[styles.metricValue, { color: COLORS.primary }]}>{metrics.activeUsers30d}</Text>
            </View>
          </View>

          {/* ACADEMICS */}
          <SectionHeader title="Academics" icon="book-outline" />
          <MetricCard
            icon="layers-outline"
            label="Total Courses"
            value={metrics.totalCourses}
            sub={`${metrics.activeCourses} active`}
            color="#2E7D32"
          />
          <MetricCard
            icon="help-circle-outline"
            label="Quiz Attempts"
            value={metrics.quizAttempts}
            color="#AD1457"
          />
          <MetricCard
            icon="checkmark-circle-outline"
            label="Attendance Rate"
            value={`${metrics.attendancePct}%`}
            sub={`${metrics.presentCount} present · ${metrics.absentCount} absent`}
            color={metrics.attendancePct >= 75 ? '#2E7D32' : metrics.attendancePct >= 50 ? '#E65100' : COLORS.error}
          />

          {/* LIVE CLASSES */}
          <SectionHeader title="Live Classes" icon="videocam-outline" />
          <View style={styles.row}>
            <View style={[styles.metricCard, styles.halfCard, { width: '100%' }]}>
              <Ionicons name="radio-outline" size={18} color="#1565C0" />
              <Text style={styles.metricLabel}>Classes Hosted</Text>
              <Text style={[styles.metricValue, { color: '#1565C0' }]}>{metrics.classesHosted}</Text>
            </View>
          </View>

          {/* PAYMENTS */}
          <SectionHeader title="Payments" icon="card-outline" />
          <MetricCard
            icon="cash-outline"
            label="Total Revenue"
            value={`₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
            sub={`₹${metrics.monthlyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })} this month`}
            color="#2E7D32"
          />
          <View style={styles.row}>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="school-outline" size={18} color="#1565C0" />
              <Text style={styles.metricLabel}>Fees Collected</Text>
              <Text style={[styles.metricValue, { color: '#1565C0', fontSize: 16 }]}>
                ₹{metrics.totalFees.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="heart-outline" size={18} color="#AD1457" />
              <Text style={styles.metricLabel}>Donations</Text>
              <Text style={[styles.metricValue, { color: '#AD1457', fontSize: 16 }]}>
                ₹{metrics.totalDonations.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="time-outline" size={18} color="#E65100" />
              <Text style={styles.metricLabel}>Pending</Text>
              <Text style={[styles.metricValue, { color: '#E65100' }]}>{metrics.pendingPayments}</Text>
            </View>
            <View style={[styles.metricCard, styles.halfCard]}>
              <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
              <Text style={styles.metricLabel}>Failed</Text>
              <Text style={[styles.metricValue, { color: COLORS.error }]}>{metrics.failedPayments}</Text>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt,
  },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },
  lastRefreshed: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  refreshBtn: { padding: SPACING.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  errorText: { color: '#92400E', fontSize: 12, flex: 1 },
  body: { padding: SPACING.md, gap: 10 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 2, marginTop: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 10 },
  halfCard: { flex: 1, gap: 4 },
  metricCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl,
    padding: SPACING.md, ...SHADOWS.card, gap: 6,
  },
  metricIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  metricLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  metricValue: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  metricSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
