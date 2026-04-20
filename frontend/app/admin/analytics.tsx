import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, getCountFromServer, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AdminAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ users: 0, activeUsers: 0, payments: 0, courses: 0, attendancePct: 0 });

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - 30);

      const [usersCount, paymentsCount, coursesCount, activeUsersSnap, attendanceSnap] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'payments')),
        getCountFromServer(collection(db, 'courses')),
        getDocs(query(collection(db, 'users'), where('last_login_at', '>=', threshold))),
        getDocs(collection(db, 'attendance')),
      ]);

      let present = 0;
      let total = 0;
      attendanceSnap.forEach((d) => {
        const item = d.data() as any;
        if (!item.status) return;
        total += 1;
        if (item.status === 'present') present += 1;
      });

      setMetrics({
        users: usersCount.data().count,
        activeUsers: activeUsersSnap.size,
        payments: paymentsCount.data().count,
        courses: coursesCount.data().count,
        attendancePct: total ? Math.round((present / total) * 100) : 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/');
      return;
    }
    if (isAdmin) loadAnalytics().catch(() => setLoading(false));
  }, [profile, isAdmin, router]);

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Analytics</Text>
        <TouchableOpacity onPress={loadAnalytics}><Ionicons name="refresh" size={20} color={COLORS.primary} /></TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <View style={styles.body}>
          <View style={styles.card}><Text style={styles.k}>Total Users</Text><Text style={styles.v}>{metrics.users}</Text></View>
          <View style={styles.card}><Text style={styles.k}>Active Users (30d)</Text><Text style={styles.v}>{metrics.activeUsers}</Text></View>
          <View style={styles.card}><Text style={styles.k}>Total Payments</Text><Text style={styles.v}>{metrics.payments}</Text></View>
          <View style={styles.card}><Text style={styles.k}>Total Courses</Text><Text style={styles.v}>{metrics.courses}</Text></View>
          <View style={styles.card}><Text style={styles.k}>Attendance %</Text><Text style={styles.v}>{metrics.attendancePct}%</Text></View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: SPACING.md, gap: 10 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  k: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  v: { color: COLORS.primary, fontSize: 28, fontWeight: '800', marginTop: 4 },
});
