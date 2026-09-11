import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { isFounderEmail } from '@/lib/founderPolicy';
import { Organization, setActiveOrganizationId } from '@/lib/tenantContext';

export default function SuperAdminOrganizationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const isSuperAdmin = profile?.role === 'super_admin' || isFounderEmail(user?.email || '');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'suspended' | 'archived'>('all');

  // Status Action Modal State
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState<boolean>(false);
  const [actionReason, setActionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Manual Payment & Quota Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentStatusChoice, setPaymentStatusChoice] = useState<'received' | 'waived' | 'not_required'>('received');
  const [editStudentLimit, setEditStudentLimit] = useState<string>('200');
  const [editTeacherLimit, setEditTeacherLimit] = useState<string>('20');
  const [editPlanId, setEditPlanId] = useState<string>('starter');
  const [paymentActionLoading, setPaymentActionLoading] = useState<boolean>(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const orgsSnap = await getDocs(query(collection(db, 'organizations'), orderBy('created_at', 'desc')));
      const list: Organization[] = [];
      orgsSnap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Organization);
      });
      setOrganizations(list);
    } catch (err: any) {
      console.error('[OrganizationsScreen] Fetch failed:', err);
      Alert.alert('Load Failed', 'Could not load institutions list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      Alert.alert('Access Denied', 'Only Platform Super Admins can manage institutions.');
      router.replace('/more');
      return;
    }
    fetchOrganizations();
  }, [isSuperAdmin, fetchOrganizations, router]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrganizations();
  };

  const handleUpdateStatus = async (newStatus: 'active' | 'suspended' | 'archived') => {
    if (!selectedOrg) return;

    try {
      setActionLoading(true);
      const updateCall = httpsCallable(functions, 'updateOrganizationStatus');
      await updateCall({
        organization_id: selectedOrg.id,
        status: newStatus,
        reason: actionReason.trim() || undefined,
      });

      Alert.alert('Status Updated', `Organization '${selectedOrg.name}' is now ${newStatus}.`);
      setActionModalVisible(false);
      setSelectedOrg(null);
      setActionReason('');
      await fetchOrganizations();
    } catch (err: any) {
      console.error('[OrganizationsScreen] Update status failed:', err);
      Alert.alert('Action Failed', err?.message || 'Could not update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPaymentModal = (org: Organization) => {
    setSelectedOrg(org);
    setPaymentReference(org.payment_reference || '');
    setPaymentStatusChoice((org.payment_status as any) || 'received');
    setEditStudentLimit(String(org.student_limit || 200));
    setEditTeacherLimit(String(org.teacher_limit || 20));
    setEditPlanId(org.plan_id || 'starter');
    setPaymentModalVisible(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedOrg) return;
    if (!paymentReference.trim()) {
      Alert.alert('Missing Reference', 'Please enter a manual payment reference (e.g. NEFT-8849201, Cheque-1022, Cash-45).');
      return;
    }

    try {
      setPaymentActionLoading(true);
      const recordCall = httpsCallable(functions, 'recordManualPayment');
      await recordCall({
        organization_id: selectedOrg.id,
        payment_reference: paymentReference.trim(),
        payment_status: paymentStatusChoice,
        plan_id: editPlanId.trim(),
        student_limit: parseInt(editStudentLimit, 10) || 200,
        teacher_limit: parseInt(editTeacherLimit, 10) || 20,
        activate_now: true,
      });

      Alert.alert('Payment Recorded', `'${selectedOrg.name}' payment recorded and institution activated.`);
      setPaymentModalVisible(false);
      setSelectedOrg(null);
      await fetchOrganizations();
    } catch (err: any) {
      console.error('[OrganizationsScreen] Record payment failed:', err);
      Alert.alert('Failed', err?.message || 'Could not record payment.');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  const handleSwitchTenant = async (org: Organization) => {
    await setActiveOrganizationId(org.id);
    Alert.alert(
      'Active Tenant Switched',
      `You are now viewing the workspace for '${org.name}' (${org.id}).`,
      [
        {
          text: 'Open Manage Academics',
          onPress: () => router.push('/admin/manage-academics'),
        },
      ]
    );
  };

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      (org.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (org.slug || '').toLowerCase().includes(search.toLowerCase()) ||
      (org.city || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Madrasa Organizations</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, slug, or city..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Chips */}
        <View style={styles.chipsRow}>
          {(['all', 'active', 'trial', 'suspended', 'archived'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading Madrasas...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrgs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Institutions Found</Text>
              <Text style={styles.emptySubtitle}>No organizations match the current filter criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSuspended = item.status === 'suspended';
            const isArchived = item.status === 'archived';
            return (
              <View style={styles.orgCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orgName}>{item.name}</Text>
                    <Text style={styles.orgSlug}>
                      ID: {item.id} • {item.city || 'India'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isSuspended
                        ? styles.statusSuspended
                        : isArchived
                        ? styles.statusArchived
                        : styles.statusActive,
                    ]}
                  >
                    <Text style={styles.statusText}>{item.status?.toUpperCase() || 'ACTIVE'}</Text>
                  </View>
                </View>

                {/* Metrics */}
                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.metricText}>Limit: {item.student_limit || 200} Students</Text>
                  </View>
                  <View style={styles.metric}>
                    <Ionicons name="card-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.metricText}>Plan: {item.plan_id || 'Starter'}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Ionicons name="receipt-outline" size={14} color={item.payment_status === 'received' ? '#059669' : '#D97706'} />
                    <Text style={[styles.metricText, { color: item.payment_status === 'received' ? '#059669' : '#D97706', fontWeight: '700' }]}>
                      {(item.payment_status || (item.status === 'active' ? 'received' : 'pending')).toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.switchTenantBtn}
                    onPress={() => handleSwitchTenant(item)}
                  >
                    <Ionicons name="enter-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.switchTenantText}>Switch</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.manageStatusBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                    onPress={() => handleOpenPaymentModal(item)}
                  >
                    <Ionicons name="card-outline" size={16} color="#059669" />
                    <Text style={[styles.manageStatusText, { color: '#059669' }]}>Payment</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.manageStatusBtn}
                    onPress={() => {
                      setSelectedOrg(item);
                      setActionModalVisible(true);
                    }}
                  >
                    <Ionicons name="settings-outline" size={16} color={COLORS.textMain} />
                    <Text style={styles.manageStatusText}>Status</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Action Modal */}
      <Modal visible={actionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Organization Governance</Text>
            <Text style={styles.modalOrgName}>{selectedOrg?.name}</Text>
            <Text style={styles.modalSubtitle}>Change organization operational status:</Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for status change (optional)..."
              placeholderTextColor="#9CA3AF"
              value={actionReason}
              onChangeText={setActionReason}
            />

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#10B981' }]}
                onPress={() => handleUpdateStatus('active')}
                disabled={actionLoading}
              >
                <Text style={styles.modalActionBtnText}>Reactivate / Set Active</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#F59E0B' }]}
                onPress={() => handleUpdateStatus('suspended')}
                disabled={actionLoading}
              >
                <Text style={styles.modalActionBtnText}>Suspend Access</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => handleUpdateStatus('archived')}
                disabled={actionLoading}
              >
                <Text style={styles.modalActionBtnText}>Archive Madrasa</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setActionModalVisible(false);
                setSelectedOrg(null);
                setActionReason('');
              }}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Payment & Quota Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Offline Payment & Quotas</Text>
            <Text style={styles.modalOrgName}>{selectedOrg?.name}</Text>
            <Text style={styles.modalSubtitle}>Super Admin Manual Activation (NO online SaaS billing)</Text>

            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Payment Reference / Receipt *</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. NEFT-8849201, Cheque-1022, Cash-45"
              placeholderTextColor="#9CA3AF"
              value={paymentReference}
              onChangeText={setPaymentReference}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Student Limit</Text>
                <TextInput
                  style={styles.reasonInput}
                  keyboardType="numeric"
                  value={editStudentLimit}
                  onChangeText={setEditStudentLimit}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Plan ID</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={editPlanId}
                  onChangeText={setEditPlanId}
                  placeholder="starter / growth"
                />
              </View>
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#10B981' }]}
                onPress={handleRecordPayment}
                disabled={paymentActionLoading}
              >
                {paymentActionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalActionBtnText}>Confirm Payment & Activate</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setPaymentModalVisible(false);
                setSelectedOrg(null);
              }}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  refreshBtn: {
    padding: 6,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textMain,
    marginLeft: 8,
  },
  chipsRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: SPACING.lg,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  orgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  orgSlug: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusSuspended: {
    backgroundColor: '#FEF3C7',
  },
  statusArchived: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  metricsRow: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metricText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  switchTenantBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    marginRight: 8,
  },
  switchTenantText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  manageStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  manageStatusText: {
    color: COLORS.textMain,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalOrgName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  reasonInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActionButtons: {
    marginBottom: 10,
  },
  modalActionBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 4,
  },
});
