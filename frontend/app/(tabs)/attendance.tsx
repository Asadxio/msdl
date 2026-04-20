import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert,
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

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const canMark = profile?.role === 'admin' || profile?.role === 'teacher';
  const [date, setDate] = useState(today());
  const [history, setHistory] = useState<AttendanceItem[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [savingUserId, setSavingUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const q = canMark
      ? query(collection(db, 'attendance'), orderBy('created_at', 'desc'))
      : query(collection(db, 'attendance'), where('user_id', '==', user.uid), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: AttendanceItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setHistory(arr);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [canMark, user?.uid]);

  useEffect(() => {
    if (!canMark) return;
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const arr: AppUser[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data.status !== 'approved' || data.role === 'admin') return;
        arr.push({ id: d.id, name: data.name || 'User', email: data.email || '', role: data.role || 'student', status: data.status });
      });
      setUsers(arr);
    };
    loadUsers().catch(() => {});
  }, [canMark]);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.subtitle}>{canMark ? 'Mark daily attendance' : `Your attendance (${attendancePercent}% present)`}</Text>
      </View>

      {canMark ? (
        <View style={styles.panel}>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.border}
          />
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.email}</Text>
                </View>
                <TouchableOpacity style={styles.presentBtn} onPress={() => markAttendance(item, 'present')} disabled={savingUserId === item.id}>
                  <Text style={styles.presentText}>Present</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.absentBtn} onPress={() => markAttendance(item, 'absent')} disabled={savingUserId === item.id}>
                  <Text style={styles.absentText}>Absent</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No approved users found.</Text>}
          />
        </View>
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
  panel: { flex: 1, padding: SPACING.md, gap: 8 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textMain },
  rowCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 8, ...SHADOWS.card },
  historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm, ...SHADOWS.card },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },
  presentBtn: { backgroundColor: '#DCFCE7', borderRadius: RADIUS.lg, paddingVertical: 8, paddingHorizontal: 10 },
  absentBtn: { backgroundColor: '#FEE2E2', borderRadius: RADIUS.lg, paddingVertical: 8, paddingHorizontal: 10 },
  presentText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  absentText: { color: COLORS.error, fontWeight: '700', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, textAlign: 'center' },
});
