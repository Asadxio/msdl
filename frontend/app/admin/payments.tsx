import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { collection, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';
import { createAdminLog } from '@/lib/adminLogs';
import { ADMIN_DEFAULT_PAGE_SIZE, fetchCursorPage } from '@/lib/adminPagination';
import { actionNonce, apiUrl } from '@/lib/api';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'rejected' | 'cancelled' | 'refunded' | 'disputed' | 'expired' | 'approved' | 'verified' | 'submitted';

type PaymentItem = {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  state?: PaymentStatus;
  status?: PaymentStatus;
  provider?: 'razorpay';
  type?: 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar';
  created_at?: { toDate?: () => Date };
};

function paymentState(payment: Pick<PaymentItem, 'state' | 'status'>): PaymentStatus {
  return payment.state ?? payment.status ?? 'pending';
}

function formatDate(item: PaymentItem) {
  try {
    const dt = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!dt) return '';
    return dt.toLocaleString();
  } catch {
    return '';
  }
}

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isAdmin = hasPermission(profile, 'admin.payments.review');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [cursor, setCursor] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [fetching, setFetching] = useState(false);

  const loadPayments = useCallback(async (direction: 'reset' | 'next' | 'prev' = 'reset') => {
    if (!isAdmin || fetching) return;
    setFetching(true);
    if (direction === 'reset') setLoading(true);
    try {
      if (statusFilter !== 'all') {
        const [statePage, statusPage] = await Promise.all([
          fetchCursorPage<PaymentItem>({ ref: collection(db, 'payments'), orderField: 'created_at', pageSize: ADMIN_DEFAULT_PAGE_SIZE, extra: [where('state', '==', statusFilter)] }),
          fetchCursorPage<PaymentItem>({ ref: collection(db, 'payments'), orderField: 'created_at', pageSize: ADMIN_DEFAULT_PAGE_SIZE, extra: [where('status', '==', statusFilter)] }),
        ]);
        const merged = new Map<string, PaymentItem>();
        [...statePage.items, ...statusPage.items].forEach((item: any) => merged.set(item.id, { ...item, status: paymentState(item) }));
        setPayments([...merged.values()].sort((a, b) => Number(b.created_at?.toDate?.() || 0) - Number(a.created_at?.toDate?.() || 0)).slice(0, ADMIN_DEFAULT_PAGE_SIZE));
        setCursor(null);
      } else {
        const page = await fetchCursorPage<PaymentItem>({ ref: collection(db, 'payments'), orderField: 'created_at', pageSize: ADMIN_DEFAULT_PAGE_SIZE, cursor: direction === 'reset' ? null : cursor, direction: direction === 'reset' ? 'next' : direction });
        setPayments(page.items.map((item: any) => ({ ...item, status: paymentState(item) })) as PaymentItem[]);
        setCursor(direction === 'prev' ? page.prevCursor : page.nextCursor);
      }
      setError('');
    } catch (err) {
      logFirestoreFailure({ collection: 'payments', operation: 'get', query: statusFilter !== 'all' ? `state/status == ${statusFilter} orderBy created_at desc limit ${ADMIN_DEFAULT_PAGE_SIZE}` : `orderBy created_at desc limit ${ADMIN_DEFAULT_PAGE_SIZE}`, role: profile?.role, status: profile?.status }, err);
      console.log('[AdminPayments] load payments failed', err);
      setError('Could not load payments. Please refresh and try again.');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [cursor, fetching, isAdmin, statusFilter]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await loadPayments('reset');
  });

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/unauthorized?required=admin');
      return;
    }
    if (!isAdmin) return;
    loadPayments('reset');
    return () => {};
  }, [profile, isAdmin, router, statusFilter]);

  const setStatus = async (id: string, status: 'succeeded' | 'rejected' | 'refunded' | 'disputed') => {
    const currentUser = auth.currentUser;
    const currentPayment = payments.find((payment) => payment.id === id);
    if (!id || !currentPayment) {
      Alert.alert('Update Failed', 'Payment document was not found in the current list. Refresh and try again.');
      return;
    }
    if (!['pending', 'submitted', 'verified', 'processing'].includes(paymentState(currentPayment))) {
      Alert.alert('Already Finalized', `Payment ${id} is already ${paymentState(currentPayment)}.`);
      return;
    }
    setUpdatingId(id);
    try {
      const token = await currentUser?.getIdToken();
      const requestBody = { payment_id: id, next_state: status, note: adminNote || `admin_${status}`, evidence: { panel: 'admin_payments', previous_status: paymentState(currentPayment) } };
      console.log('[AdminPayments] updating payment status', { payment_id: id, uid: currentUser?.uid || '', admin_role: profile?.role || '', next_state: status });
      const res = await fetch(apiUrl('/payments/admin/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '', 'x-action-nonce': actionNonce('payment_admin') },
        body: JSON.stringify(requestBody),
      });
      const responseText = await res.text();
      let responseJson: any = null;
      try { responseJson = responseText ? JSON.parse(responseText) : null; } catch {}
      console.log('[AdminPayments] payment status response', { payment_id: id, uid: currentUser?.uid || '', admin_role: profile?.role || '', http_status: res.status, ok: res.ok, response: responseJson || responseText });
      if (!res.ok) {
        const detail = String(responseJson?.detail || responseText || `HTTP ${res.status}`);
        if (res.status === 403 || detail.toLowerCase().includes('permission')) {
          console.log('[AdminPayments] permission denied updating payment', { payment_id: id, uid: currentUser?.uid || '', admin_role: profile?.role || '', detail });
        }
        throw new Error(detail);
      }
      setPayments((prev) => prev.map((payment) => (payment.id === id ? { ...payment, status } : payment)));
      await createAdminLog(profile, {
        action: `payment_${status}`,
        performed_by: profile?.email || profile?.name || 'admin',
        target_id: id,
      }).catch(() => {});
      await loadPayments('reset');
      Alert.alert('Payment Updated', `Payment marked ${status}.`);
    } catch (err: any) {
      console.log('[AdminPayments] update payment status failed', { payment_id: id, uid: currentUser?.uid || '', admin_role: profile?.role || '', error: err });
      const reason = String(err?.message || err || 'Could not update payment status. Please try again.');
      Alert.alert('Update Failed', __DEV__ ? reason : 'Could not update payment status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmStatusChange = (id: string, status: 'succeeded' | 'rejected' | 'refunded' | 'disputed') => {
    const label = status === 'succeeded' ? 'Mark Succeeded' : status === 'rejected' ? 'Reject' : status === 'refunded' ? 'Mark Refunded' : 'Mark Disputed';
    Alert.alert(`${label} Payment`, `Are you sure you want to ${label.toLowerCase()} this payment?`, [
      { text: 'Cancel' },
      { text: label, style: status === 'rejected' || status === 'disputed' ? 'destructive' : 'default', onPress: () => setStatus(id, status) },
    ]);
  };

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')} testID="payments-back-btn">
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Manage Payments</Text>
        <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'all' ? 'pending' : 'all')}>
          <Ionicons name="funnel" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TextInput style={styles.noteInput} placeholder="Admin reason / evidence note" value={adminNote} onChangeText={setAdminNote} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <>
        <Text style={{ paddingHorizontal: 16, color: COLORS.textMuted }}>Filter status: {statusFilter}</Text>
        <FlatList
          data={payments}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`payment-${item.id}`}>
              <Text style={styles.name}>{item.user_name}</Text>
              <Text style={styles.meta}>User ID: {item.user_id}</Text>
              <Text style={styles.meta}>Amount: ₹{Number(item.amount || 0).toFixed(2)}</Text>
              <Text style={styles.meta}>Type: {item.type || 'fees'}</Text>
              <Text style={styles.meta}>Provider: {item.provider || 'razorpay'}</Text>
              <Text style={styles.meta}>Status: {paymentState(item)}</Text>
              <Text style={styles.time}>{formatDate(item)}</Text>
              <Text style={styles.meta}>Reconciliation: {(item as any).reconciliation?.finalized ? 'finalized' : ((item as any).reconciliation ? 'pending' : 'n/a')}</Text>
              <Text style={styles.meta}>Replay detected: {(item as any).replay_detected ? 'yes' : 'no'}</Text>

              {(['submitted', 'pending', 'verified', 'processing'] as PaymentStatus[]).includes(paymentState(item)) && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.verifyBtn, updatingId === item.id && styles.disabledBtn]} onPress={() => confirmStatusChange(item.id, 'succeeded')} disabled={updatingId === item.id}>
                    {updatingId === item.id ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.verifyText}>Succeed</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectBtn, updatingId === item.id && styles.disabledBtn]} onPress={() => confirmStatusChange(item.id, 'rejected')} disabled={updatingId === item.id}>
                    {updatingId === item.id ? <ActivityIndicator size="small" color={COLORS.error} /> : <Text style={styles.rejectText}>Reject</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="card-outline" size={42} color={COLORS.border} />
              <Text style={styles.empty}>No payments yet</Text>
            </View>
          )}
        />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },
  errorText: { color: COLORS.error, fontSize: 12, paddingHorizontal: SPACING.md, paddingTop: 8 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 24 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  meta: { fontSize: 13, color: COLORS.textMuted, marginTop: 3, textTransform: 'capitalize' },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  verifyBtn: { flex: 1, backgroundColor: '#DCFCE7', borderRadius: RADIUS.xxl, paddingVertical: 10, alignItems: 'center' },
  verifyText: { color: '#166534', fontWeight: '700' },
  rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: RADIUS.xxl, paddingVertical: 10, alignItems: 'center' },
  disabledBtn: { opacity: 0.7 },
  rejectText: { color: COLORS.error, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, fontSize: 14 },
  noteInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: COLORS.surface, color: COLORS.textMain },
});
