import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { UserProfile } from '@/context/AuthContext';

type UserWithId = UserProfile & { id: string };

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const data: UserWithId[] = [];
      snap.forEach((d) => { data.push({ id: d.id, ...d.data() } as UserWithId); });
      setUsers(data.sort((a, b) => (a.status === 'pending' ? -1 : 1)));
    } catch { setUsers([]); }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateUser = async (uid: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      await fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update');
    }
  };

  const handleApprove = (u: UserWithId) => {
    Alert.alert('Approve User', `Approve ${u.name}?`, [
      { text: 'Cancel' },
      { text: 'Approve', onPress: () => updateUser(u.id, { status: 'approved' }) },
    ]);
  };

  const handleReject = (u: UserWithId) => {
    Alert.alert('Reject User', `Reject ${u.name}?`, [
      { text: 'Cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => updateUser(u.id, { status: 'pending' }) },
    ]);
  };

  const handleDeactivate = (u: UserWithId) => {
    Alert.alert('Deactivate User', `Deactivate ${u.name}? They will lose access.`, [
      { text: 'Cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => updateUser(u.id, { status: 'deactivated' as any }) },
    ]);
  };

  const handleReactivate = (u: UserWithId) => {
    Alert.alert('Reactivate User', `Reactivate ${u.name}?`, [
      { text: 'Cancel' },
      { text: 'Reactivate', onPress: () => updateUser(u.id, { status: 'pending' }) },
    ]);
  };

  const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin: { bg: '#FEF3C7', text: '#92400E' },
    teacher: { bg: '#E3F2FD', text: '#1565C0' },
    student: { bg: '#E8F5E9', text: '#2E7D32' },
  };

  const renderUser = ({ item }: { item: UserWithId }) => {
    const rc = ROLE_COLORS[item.role] || ROLE_COLORS.student;
    return (
      <View style={styles.userCard} testID={`user-card-${item.id}`}>
        <View style={styles.userTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: rc.bg }]}>
            <Text style={[styles.roleBadgeText, { color: rc.text }]}>{item.role}</Text>
          </View>
        </View>
        <View style={styles.userBottom}>
          <View style={[styles.statusBadge, item.status === 'approved' ? styles.approvedBadge : item.status === 'deactivated' ? styles.deactivatedBadge : styles.pendingBadge]}>
            <Text style={[styles.statusText, item.status === 'approved' ? styles.approvedText : item.status === 'deactivated' ? styles.deactivatedText : styles.pendingText]}>
              {item.status}
            </Text>
          </View>
          {item.status === 'pending' && item.role !== 'admin' && (
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)} testID={`approve-btn-${item.id}`}>
              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
          )}
          {item.status === 'approved' && item.role !== 'admin' && (
            <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
              <TouchableOpacity style={styles.deactivateBtn} onPress={() => handleDeactivate(item)} testID={`deactivate-btn-${item.id}`}>
                <Text style={styles.deactivateBtnText}>Deactivate</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.status === 'deactivated' && item.role !== 'admin' && (
            <TouchableOpacity style={styles.reactivateBtn} onPress={() => handleReactivate(item)} testID={`reactivate-btn-${item.id}`}>
              <Text style={styles.reactivateBtnText}>Reactivate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="admin-users-back-btn">
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Manage Users</Text>
        <TouchableOpacity onPress={fetchUsers} testID="refresh-users-btn">
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          testID="users-list"
          ListEmptyComponent={
            <View style={styles.center}><Text style={styles.emptyText}>No users found</Text></View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 30 },
  userCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  userTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  userEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  userBottom: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  approvedBadge: { backgroundColor: '#D1FAE5' },
  deactivatedBadge: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  pendingText: { color: '#92400E' },
  approvedText: { color: '#065F46' },
  deactivatedText: { color: COLORS.error },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg, marginLeft: 'auto' },
  approveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  rejectBtn: { borderWidth: 1, borderColor: COLORS.error, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.lg, marginLeft: 'auto' },
  rejectBtnText: { color: COLORS.error, fontSize: 13, fontWeight: '600' },
  deactivateBtn: { borderWidth: 1, borderColor: COLORS.error, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.lg },
  deactivateBtnText: { color: COLORS.error, fontSize: 12, fontWeight: '600' },
  reactivateBtn: { backgroundColor: '#E3F2FD', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg, marginLeft: 'auto' },
  reactivateBtnText: { color: '#1565C0', fontSize: 13, fontWeight: '700' },
});
