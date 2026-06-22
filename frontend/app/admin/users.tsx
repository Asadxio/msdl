import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, ScrollView, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { collection, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { UserProfile, useAuth } from '@/context/AuthContext';
import { createAdminLog } from '@/lib/adminLogs';
import { hasPermission } from '@/lib/rbac';
import { bulkUpdateUserStatus, updateUserRoleSecure } from '@/lib/adminOps';
import { APP_ROLES, canAssignRole, normalizeRole, type AppRole } from '@/lib/roles';
import { ADMIN_DEFAULT_PAGE_SIZE, fetchCursorPage } from '@/lib/adminPagination';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

type UserWithId = UserProfile & { id: string };

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = hasPermission(profile, 'admin.users.manage');
  const canBulk = hasPermission(profile, 'admin.users.bulk');
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserWithId['status']>('all');
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = async (direction: 'next' | 'prev' | 'reset' = 'reset') => {
    if (fetching) return;
    setFetching(true);
    if (direction === 'reset') setLoading(true);
    try {
      const extra: any[] = [];
      if (roleFilter !== 'all') extra.push(where('role', '==', roleFilter));
      if (statusFilter !== 'all') extra.push(where('status', '==', statusFilter));
      const page = await fetchCursorPage<UserWithId>({
        ref: collection(db, 'users'),
        orderField: 'created_at',
        orderDirection: 'desc',
        pageSize: ADMIN_DEFAULT_PAGE_SIZE,
        cursor: direction === 'reset' ? null : cursor,
        direction: direction === 'reset' ? 'next' : direction,
        extra,
      });
      setUsers(page.items.map((u) => ({ ...u, role: normalizeRole((u as any).role, 'admin.users.list') })) as UserWithId[]);
      setCursor(direction === 'prev' ? page.prevCursor : page.nextCursor);
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'users', operation: 'get', query: `role == ${roleFilter}; status == ${statusFilter}; orderBy created_at desc limit ${ADMIN_DEFAULT_PAGE_SIZE}`, role: profile?.role, status: profile?.status }, error);
      setUsers([]);
    }
    setLoading(false);
    setFetching(false);
  };

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/unauthorized?required=admin');
      return;
    }
    if (isAdmin) fetchUsers();
  }, [profile, isAdmin, router, roleFilter, statusFilter]);

  const updateUser = async (uid: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      await createAdminLog(profile, {
        action: 'user_update',
        performed_by: profile?.email || profile?.name || 'admin',
        target_id: uid,
        details: JSON.stringify(updates),
      }).catch(() => {});
      await fetchUsers();
    } catch (err: any) {
      logFirestoreFailure({ collection: 'users', operation: 'update', path: `users/${uid}`, query: 'update user fields', role: profile?.role, status: profile?.status }, err);
      Alert.alert('Error', err?.message || 'Failed to update');
    }
  };
  const toggleSelected = (uid: string) => setSelectedIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  const runBulkStatus = async (status: 'approved' | 'rejected' | 'deactivated' | 'pending') => {
    if (!canBulk || selectedIds.length === 0) return;
    const result = await bulkUpdateUserStatus({
      profile,
      performedBy: profile?.email || profile?.name || 'admin',
      userIds: selectedIds,
      status,
    }).catch(() => ({ updated: 0 }));
    setSelectedIds([]);
    Alert.alert('Bulk Update', `Updated ${result.updated} users`);
    await fetchUsers();
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
      { text: 'Reject', style: 'destructive', onPress: () => updateUser(u.id, { status: 'rejected' as any }) },
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

  const handleDelete = (u: UserWithId) => {
    Alert.alert('User Safety Action', `Choose how to remove ${u.name}.`, [
      { text: 'Cancel' },
      {
        text: 'Soft Delete',
        onPress: () => updateUser(u.id, { status: 'deactivated' as any }),
      },
      {
        text: 'Permanent Delete',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Confirm Permanent Delete',
          `This will permanently remove ${u.name}'s Firestore profile. This cannot be undone.`,
          [
            { text: 'Cancel' },
            {
              text: 'Delete Forever',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteDoc(doc(db, 'users', u.id));
                  await fetchUsers();
                } catch (err: any) {
                  logFirestoreFailure({ collection: 'users', operation: 'delete', path: `users/${u.id}`, query: 'permanently delete user', role: profile?.role, status: profile?.status }, err);
                  Alert.alert('Error', err?.message || 'Failed to delete user');
                }
              },
            },
          ],
        ),
      },
    ]);
  };

  const handleToggleRole = (u: UserWithId) => {
    const actorRole = normalizeRole(profile?.role, 'admin.users.actor');
    const currentRole = normalizeRole(u.role, 'admin.users.current');
    const candidateRoles: AppRole[] = APP_ROLES.filter((role) => role !== currentRole && canAssignRole(actorRole, role));
    if (!candidateRoles.length) {
      Alert.alert('Not Allowed', "You cannot change this user's role.");
      return;
    }
    const nextRole = candidateRoles.includes('teacher') ? 'teacher' : candidateRoles[0];
    Alert.alert('Change Role', `Change ${u.name} from ${currentRole} to ${nextRole}?`, [
      { text: 'Cancel' },
      {
        text: 'Update',
        onPress: async () => {
          try {
            await updateUserRoleSecure({
              actorProfile: profile,
              actorId: profile?.email || profile?.name || 'admin',
              targetUserId: u.id,
              previousRole: u.role,
              nextRole,
            });
            await createAdminLog(profile, { action: 'user_role_update', performed_by: profile?.email || profile?.name || 'admin', target_id: u.id, details: `${currentRole}->${nextRole}` }).catch(() => {});
            await fetchUsers();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to update role');
          }
        },
      },
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
      {canBulk ? (
          <TouchableOpacity style={{ position: 'absolute', right: 8, top: 8 }} onPress={() => toggleSelected(item.id)}>
            <Ionicons name={selectedIds.includes(item.id) ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.userTop}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name={(item.avatar as any) || 'person'} size={18} color={COLORS.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: rc.bg }]}>
            <Text style={[styles.roleBadgeText, { color: rc.text }]}>{item.role}</Text>
          </View>
        </View>
        <View style={styles.userBottom}>
          <View style={[
            styles.statusBadge,
            item.status === 'approved'
              ? styles.approvedBadge
              : item.status === 'deactivated' || item.status === 'rejected'
                ? styles.deactivatedBadge
                : styles.pendingBadge,
          ]}>
            <Text style={[
              styles.statusText,
              item.status === 'approved'
                ? styles.approvedText
                : item.status === 'deactivated' || item.status === 'rejected'
                  ? styles.deactivatedText
                  : styles.pendingText,
            ]}>
              {item.status}
            </Text>
          </View>
          {item.role !== 'admin' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
              {item.status === 'pending' && (
                <>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)} testID={`approve-btn-${item.id}`}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)} testID={`reject-btn-${item.id}`}>
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
              {item.status === 'approved' && (
                <TouchableOpacity style={styles.deactivateBtn} onPress={() => handleDeactivate(item)} testID={`deactivate-btn-${item.id}`}>
                  <Text style={styles.deactivateBtnText}>Deactivate</Text>
                </TouchableOpacity>
              )}
              {(item.status === 'deactivated' || item.status === 'rejected') && (
                <TouchableOpacity style={styles.reactivateBtn} onPress={() => handleReactivate(item)} testID={`reactivate-btn-${item.id}`}>
                  <Text style={styles.reactivateBtnText}>Set Pending</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.roleBtn} onPress={() => handleToggleRole(item)} testID={`toggle-role-btn-${item.id}`}>
                <Text style={styles.roleBtnText}>
                  {item.role === 'student' ? 'Make Teacher' : 'Make Student'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} testID={`delete-user-btn-${item.id}`}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    );
  };

  if (profile && !isAdmin) return null;
  const filteredUsers = users.filter((item) => (
    !debouncedSearch
      || item.name.toLowerCase().includes(debouncedSearch)
      || item.email.toLowerCase().includes(debouncedSearch)
  ));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')} testID="admin-users-back-btn">
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Manage Users</Text>
        <TouchableOpacity onPress={() => { void fetchUsers(); }} testID="refresh-users-btn">
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {canBulk ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8, paddingBottom: 8 }}>
          <TouchableOpacity style={styles.approveBtn} onPress={() => runBulkStatus('approved')}><Text style={styles.approveBtnText}>Bulk Approve ({selectedIds.length})</Text></TouchableOpacity>
          <TouchableOpacity style={styles.deactivateBtn} onPress={() => runBulkStatus('deactivated')}><Text style={styles.deactivateBtnText}>Bulk Deactivate</Text></TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => runBulkStatus('rejected')}><Text style={styles.rejectBtnText}>Bulk Reject</Text></TouchableOpacity>
        </ScrollView>
      ) : null}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          ListHeaderComponent={(
            <View style={{ gap: 8, marginBottom: 10 }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name or email"
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity 
                  style={[styles.roleBtn, { flex: 1, alignItems: 'center' }]} 
                  onPress={() => {
                    const roles: ('all' | AppRole)[] = ['all', 'student', 'teacher', 'admin'];
                    const nextIndex = (roles.indexOf(roleFilter) + 1) % roles.length;
                    setRoleFilter(roles[nextIndex]);
                  }}
                  testID="role-filter-btn"
                >
                  <Text style={styles.roleBtnText}>Role: {roleFilter}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleBtn, { flex: 1, alignItems: 'center' }]} 
                  onPress={() => {
                    const statuses: ('all' | UserWithId['status'])[] = ['all', 'pending', 'approved', 'deactivated', 'rejected'];
                    const nextIndex = (statuses.indexOf(statusFilter) + 1) % statuses.length;
                    setStatusFilter(statuses[nextIndex]);
                  }}
                  testID="status-filter-btn"
                >
                  <Text style={styles.roleBtnText}>Status: {statusFilter}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          data={filteredUsers}
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
  userTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  searchInput: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, color: COLORS.textMain,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  userEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  userBottom: { gap: SPACING.sm },
  actionRow: { gap: 8, paddingRight: 8 },
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
  roleBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg },
  roleBtnText: { color: '#3730A3', fontSize: 13, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEF2F2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.error },
  deleteBtnText: { color: COLORS.error, fontSize: 13, fontWeight: '700' },
});
