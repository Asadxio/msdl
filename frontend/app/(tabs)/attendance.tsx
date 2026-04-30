import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type AttendanceItem = {
  id: string;
  user_id: string;
  date: string;
  status: 'present' | 'absent';
  marked_by: string;
  created_at?: { toDate?: () => Date };
};

type AppUser = { id: string; name: string; email: string; role: string; status: string };

const today = () => new Date().toISOString().slice(0, 10);

function formatMarkedAt(value?: { toDate?: () => Date }): string {
  try {
    const dt = value?.toDate ? value.toDate() : null;
    if (!dt) return 'Time unavailable';
    return dt.toLocaleString();
  } catch {
    return 'Time unavailable';
  }
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const canMark = profile?.role === 'admin' || profile?.role === 'teacher';
  const [date, setDate] = useState(today());
  const [history, setHistory] = useState<AttendanceItem[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [savingUserId, setSavingUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [usersError, setUsersError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const q = canMark
        ? query(collection(db, 'attendance'), orderBy('created_at', 'desc'))
        : query(collection(db, 'attendance'), where('user_id', '==', user.uid), orderBy('created_at', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        try {
          const arr: AttendanceItem[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
          setHistory(Array.isArray(arr) ? arr : []);
          setLoading(false);
        } catch (e) {
          console.log('[Attendance] onSnapshot parse ERROR:', e);
          setHistory([]);
          setLoading(false);
        }
      }, (err) => {
        console.log('[Attendance] onSnapshot ERROR:', err);
        setLoading(false);
      });
      return unsub;
    } catch (e) {
      console.log('[Attendance] query setup ERROR:', e);
      setLoading(false);
      return () => {};
    }
  }, [canMark, user?.uid, reloadKey]);

  useEffect(() => {
    if (!canMark) return;
    const loadUsers = async () => {
      try {
        setUsersError('');
        const snap = await getDocs(collection(db, 'users'));
        const arr: AppUser[] = [];
        snap.forEach((d) => {
          try {
            const data = d.data() as any;
            if (data?.status !== 'approved' || data?.role === 'admin') return;
            arr.push({ 
              id: d.id, 
              name: String(data?.name || 'User'), 
              email: String(data?.email || ''), 
              role: String(data?.role || 'student'), 
              status: String(data?.status || '') 
            });
          } catch (e) {
            console.log('[Attendance] User parse ERROR:', e);
          }
        });
        setUsers(Array.isArray(arr) ? arr : []);
      } catch (e) {
        console.log('[Attendance] loadUsers ERROR:', e);
        setUsers([]);
        setUsersError('Unable to load users right now. Pull to refresh later.');
      }
    };
    loadUsers().catch((e) => console.log('[Attendance] loadUsers outer ERROR:', e));
  }, [canMark, reloadKey]);

  const markAttendance = async (targetUser: AppUser, status: 'present' | 'absent') => {
    if (!user?.uid) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
      return;
    }
    const docId = `${targetUser.id}_${date}`;
    setSavingUserId(targetUser.id);
    try {
      await setDoc(doc(db, 'attendance', docId), {
        user_id: targetUser.id,
        date,
        status,
        marked_by: profile?.role || 'teacher',
        created_at: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        title: 'Attendance Marked',
        message: `Attendance for ${date}: ${status}`,
        user_id: targetUser.id,
        created_at: serverTimestamp(),
      });
      setFeedback(`${targetUser.name}: ${status} saved`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark attendance.');
    } finally {
      setSavingUserId('');
    }
  };

  const attendancePercent = useMemo(() => {
    if (!history.length || canMark) return 0;
    const present = history.filter((h) => h.status === 'present').length;
    return Math.round((present / history.length) * 100);
  }, [history, canMark]);

  const attendanceByUser = useMemo(() => {
    const grouped: Record<string, { total: number; present: number; absent: number; latestAt?: { toDate?: () => Date } }> = {};
    const safeHistory = Array.isArray(history) ? history : [];
    safeHistory.forEach((item) => {
      try {
        if (!item?.user_id) return;
        if (!grouped[item.user_id]) {
          grouped[item.user_id] = { total: 0, present: 0, absent: 0, latestAt: item?.created_at };
        }
        grouped[item.user_id].total += 1;
        if (item?.status === 'present') grouped[item.user_id].present += 1;
        if (item?.status === 'absent') grouped[item.user_id].absent += 1;
        if (!grouped[item.user_id].latestAt && item?.created_at) grouped[item.user_id].latestAt = item.created_at;
      } catch (e) {
        console.log('[Attendance] attendanceByUser item ERROR:', e);
      }
    });
    return grouped;
  }, [history]);

  const recentAttendance = useMemo(() => {
    const safeHistory = Array.isArray(history) ? history : [];
    return safeHistory.slice(0, 80);
  }, [history]);
  
  const safeUsers = useMemo(() => Array.isArray(users) ? users : [], [users]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Attendance</Text>
            <Text style={styles.subtitle}>{canMark ? 'Mark + review attendance records' : `Your attendance (${attendancePercent}% present)`}</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => setReloadKey((v) => v + 1)}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
      {!!feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {canMark ? (
        <ScrollView style={styles.panel} contentContainerStyle={{ paddingBottom: 20 }}>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textMuted}
          />
          {safeUsers.map((item) => {
            const summary = attendanceByUser[item?.id] || { total: 0, present: 0, absent: 0 };
            return (
              <View style={styles.rowCard} key={item?.id || Math.random().toString()}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item?.name || 'User'}</Text>
                  <Text style={styles.meta}>{item?.email || ''}</Text>
                  <Text style={styles.summaryText}>
                    Total: {summary?.total || 0} • Present: {summary?.present || 0} • Absent: {summary?.absent || 0}
                  </Text>
                  <Text style={styles.timeText}>Last entry: {formatMarkedAt(summary?.latestAt)}</Text>
                </View>
                <TouchableOpacity style={styles.presentBtn} onPress={() => markAttendance(item, 'present')} disabled={savingUserId === item?.id}>
                  <Text style={styles.presentText}>{savingUserId === item?.id ? 'Saving...' : 'Present'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.absentBtn} onPress={() => markAttendance(item, 'absent')} disabled={savingUserId === item?.id}>
                  <Text style={styles.absentText}>{savingUserId === item?.id ? 'Saving...' : 'Absent'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {safeUsers.length === 0 ? <Text style={styles.empty}>No approved users found.</Text> : null}
          {!!usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
          <Text style={[styles.subtitle, { marginTop: 10 }]}>Recent attendance log</Text>
          {recentAttendance.map((item) => (
            <View key={item?.id || Math.random().toString()} style={styles.historyCard}>
              <Text style={styles.name}>{item?.date || 'N/A'} • {item?.status || 'unknown'}</Text>
              <Text style={styles.meta}>User: {safeUsers.find((u) => u?.id === item?.user_id)?.name || item?.user_id || 'Unknown'}</Text>
              <Text style={styles.timeText}>Marked: {formatMarkedAt(item?.created_at)}</Text>
            </View>
          ))}
          {recentAttendance.length === 0 ? <Text style={styles.empty}>No attendance records yet.</Text> : null}
        </ScrollView>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.md, gap: 8, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <Text style={styles.name}>{item.date}</Text>
              <Text style={[styles.meta, item.status === 'present' ? { color: '#166534' } : { color: COLORS.error }]}>{item.status}</Text>
              <Text style={styles.timeText}>Marked: {formatMarkedAt(item.created_at)}</Text>
            </View>
          )}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>No attendance records yet.</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.surfaceAlt },
  refreshText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  feedback: { fontSize: 12, color: '#166534', paddingHorizontal: SPACING.md, paddingVertical: 6, textAlign: 'left' },
  errorText: { fontSize: 12, color: COLORS.error, paddingHorizontal: 2, paddingTop: 2 },
  panel: { flex: 1, padding: SPACING.md, gap: 8 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textMain },
  rowCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 8, ...SHADOWS.card },
  historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm, ...SHADOWS.card },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },
  summaryText: { fontSize: 12, color: COLORS.primary, marginTop: 4, fontWeight: '600' },
  timeText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  presentBtn: { backgroundColor: '#DCFCE7', borderRadius: RADIUS.lg, paddingVertical: 8, paddingHorizontal: 10 },
  absentBtn: { backgroundColor: '#FEE2E2', borderRadius: RADIUS.lg, paddingVertical: 8, paddingHorizontal: 10 },
  presentText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  absentText: { color: COLORS.error, fontWeight: '700', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, textAlign: 'center' },
});
