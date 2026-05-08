import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

type AttendanceItem = {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  date: string;
  status: 'present' | 'absent';
  marked_by: string;
  marked_by_uid?: string;
  marked_by_name?: string;
  created_at?: { toDate?: () => Date };
  marked_at?: { toDate?: () => Date };
};

type AppUser = { id: string; name: string; email: string; role: string; status: string };

const today = () => new Date().toISOString().slice(0, 10);

function getMillis(value?: { toDate?: () => Date }): number {
  try {
    return value?.toDate ? value.toDate().getTime() : 0;
  } catch {
    return 0;
  }
}

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
    const q = canMark
      ? query(collection(db, 'attendance'))
      : query(collection(db, 'attendance'), where('user_id', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const arr: AttendanceItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => {
        const bTime = getMillis(b.marked_at || b.created_at);
        const aTime = getMillis(a.marked_at || a.created_at);
        if (bTime !== aTime) return bTime - aTime;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
      setHistory(arr);
      setLoading(false);
    }, (error) => {
      console.log('[Attendance] history listener ERROR', error);
      setLoading(false);
    });
    return unsub;
  }, [canMark, user?.uid, reloadKey]);

  useEffect(() => {
    if (!canMark) {
      setUsers([]);
      return;
    }
    setUsersError('');
    const usersQ = query(collection(db, 'users'), where('status', '==', 'approved'), where('role', '==', 'student'));
    const unsub = onSnapshot(usersQ, (snap) => {
      const arr: AppUser[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        arr.push({ id: d.id, name: data.name || 'Student', email: data.email || '', role: data.role || 'student', status: data.status });
      });
      arr.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(arr);
    }, (error) => {
      console.log('[Attendance] users listener ERROR', error);
      setUsers([]);
      setUsersError('Unable to load students right now. Pull to refresh later.');
    });
    return unsub;
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
      const attendanceRef = doc(db, 'attendance', docId);
      const existing = await getDoc(attendanceRef);
      const nextRecord: Record<string, any> = {
        user_id: targetUser.id,
        user_name: targetUser.name,
        user_email: targetUser.email,
        date,
        status,
        marked_by: profile?.role || 'teacher',
        marked_by_uid: user.uid,
        marked_by_name: profile?.name || user.email || 'Teacher',
        marked_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };
      if (!existing.exists()) {
        nextRecord.created_at = serverTimestamp();
      }
      await setDoc(attendanceRef, nextRecord, { merge: true });
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
    history.forEach((item) => {
      if (!item.user_id) return;
      if (!grouped[item.user_id]) {
        grouped[item.user_id] = { total: 0, present: 0, absent: 0, latestAt: item.marked_at || item.created_at };
      }
      grouped[item.user_id].total += 1;
      if (item.status === 'present') grouped[item.user_id].present += 1;
      if (item.status === 'absent') grouped[item.user_id].absent += 1;
      if (!grouped[item.user_id].latestAt && (item.marked_at || item.created_at)) grouped[item.user_id].latestAt = item.marked_at || item.created_at;
    });
    return grouped;
  }, [history]);

  const recentAttendance = useMemo(() => history.slice(0, 80), [history]);

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
          {users.map((item) => {
            const summary = attendanceByUser[item.id] || { total: 0, present: 0, absent: 0 };
            return (
              <View style={styles.rowCard} key={item.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.email}</Text>
                  <Text style={styles.summaryText}>
                    Total: {summary.total} • Present: {summary.present} • Absent: {summary.absent}
                  </Text>
                  <Text style={styles.timeText}>Last synced: {formatMarkedAt(summary.latestAt)}</Text>
                </View>
                <TouchableOpacity style={styles.presentBtn} onPress={() => markAttendance(item, 'present')} disabled={savingUserId === item.id}>
                  <Text style={styles.presentText}>{savingUserId === item.id ? 'Saving...' : 'Present'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.absentBtn} onPress={() => markAttendance(item, 'absent')} disabled={savingUserId === item.id}>
                  <Text style={styles.absentText}>{savingUserId === item.id ? 'Saving...' : 'Absent'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {users.length === 0 ? <Text style={styles.empty}>No approved students found.</Text> : null}
          {!!usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
          <Text style={[styles.subtitle, { marginTop: 10 }]}>Recent attendance log</Text>
          {recentAttendance.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <Text style={styles.name}>{item.date} • {item.status}</Text>
              <Text style={styles.meta}>Student: {users.find((u) => u.id === item.user_id)?.name || item.user_name || item.user_id}</Text>
              <Text style={styles.timeText}>Marked: {formatMarkedAt(item.marked_at || item.created_at)}</Text>
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
              <Text style={styles.timeText}>Marked: {formatMarkedAt(item.marked_at || item.created_at)}</Text>
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
