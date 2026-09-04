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
import { adminPaymentAction, adminRefundPayment } from '@/lib/paymentAdminFunctions';
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { IslamicReceiptModal } from '@/components/IslamicReceiptModal';
import { shareReceiptToWhatsApp, type FeeReceiptData } from '@/lib/receiptGenerator';
import { doc, getDoc } from 'firebase/firestore';

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'rejected' | 'cancelled' | 'refunded' | 'disputed' | 'expired' | 'approved' | 'verified' | 'submitted';

type PaymentItem = {
  id: string;
  user_id: string;
  user_name?: string;
  amount: number;
  state?: PaymentStatus;
  status?: PaymentStatus;
  provider?: 'razorpay';
  provider_order_id?: string;
  provider_payment_id?: string;
  course_id?: string;
  payment_type?: string;
  type?: 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar';
  refund_id?: string;
  refund_reason?: string;
  created_at?: { toDate?: () => Date };
  finalized_at?: { toDate?: () => Date };
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
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  const loadPayments = useCallback(async (direction: 'reset' | 'next' | 'prev' = 'reset') => {
    if (!isAdmin || fetching) return;
    setFetching(true);
    if (direction === 'reset') {
      setPayments((curr) => {
        if (curr.length === 0) setLoading(true);
        return curr;
      });
    }
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
  }, [cursor, fetching, isAdmin, statusFilter, profile?.role, profile?.status]);

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
  }, [isAdmin, statusFilter]);

  const handleRefund = async (payment: PaymentItem) => {
    if (!adminNote || adminNote.trim().length < 4) {
      Alert.alert('Reason Required', 'Please enter an admin reason/note (at least 4 characters) before issuing a refund.');
      return;
    }

    Alert.alert(
      'Issue Real Razorpay Refund',
      `Are you sure you want to refund ₹${(Number(payment.amount || 0)).toFixed(2)} to ${payment.user_id} via Razorpay API?\n\nReason: "${adminNote.trim()}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue Refund',
          style: 'destructive',
          onPress: async () => {
            setUpdatingId(payment.id);
            try {
              const res = await adminRefundPayment({
                paymentId: payment.id,
                reason: adminNote.trim(),
              });
              Alert.alert('Refund Completed', `Refund ID: ${res.refundId}\nPayment has been refunded.`);
              setAdminNote('');
              await loadPayments('reset');
            } catch (err: any) {
              Alert.alert('Refund Failed', err?.message || 'Could not process refund via Razorpay.');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const handleLegacyReject = async (paymentId: string) => {
    setUpdatingId(paymentId);
    try {
      await adminPaymentAction({
        paymentId,
        action: 'reject',
        note: adminNote || 'admin_rejected',
      });
      Alert.alert('Payment Rejected', 'Payment state updated to rejected.');
      await loadPayments('reset');
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Failed to reject payment.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprovePayment = async (payment: PaymentItem) => {
    setUpdatingId(payment.id);
    try {
      await adminPaymentAction({
        paymentId: payment.id,
        action: 'approve',
        note: adminNote || 'admin_approved',
      });

      // Fetch user contact info for WhatsApp receipt
      let parentPhone = '';
      try {
        const uSnap = await getDoc(doc(db, 'users', payment.user_id));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          parentPhone = String(uData.guardian_phone || uData.parent_phone || uData.whatsapp || uData.phone || '').trim();
        }
      } catch {}

      const receiptData: FeeReceiptData = {
        receiptId: `MSLB-REC-${payment.id.slice(-6).toUpperCase()}`,
        studentName: payment.user_name || 'طالبہ',
        studentId: payment.user_id,
        courseName: payment.course_id,
        amount: Number(payment.amount || 0),
        category: payment.payment_type || payment.type || 'fees',
        paymentMethod: payment.provider ? 'آن لائن / تصدیق شدہ' : 'فیس رسید',
        transactionId: payment.provider_payment_id || payment.id,
        issueDateGregorian: formatDate(payment) || new Date().toLocaleDateString(),
        status: 'منظور شدہ (Approved & Verified)',
      };

      Alert.alert(
        'Payment Approved! ✅',
        `فیس کامیابی سے منظور ہو گئی۔ کیا آپ والدین کو WhatsApp پر باضابطہ رسید بھیجنا چاہتے ہیں؟`,
        [
          { text: 'بعد میں (Later)', style: 'cancel' },
          {
            text: 'WhatsApp رسید بھیجیں',
            onPress: () => {
              void shareReceiptToWhatsApp(receiptData, parentPhone);
            },
          },
        ]
      );

      await loadPayments('reset');
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Failed to approve payment.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendWhatsAppReceipt = async (payment: PaymentItem) => {
    let parentPhone = '';
    try {
      const uSnap = await getDoc(doc(db, 'users', payment.user_id));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        parentPhone = String(uData.guardian_phone || uData.parent_phone || uData.whatsapp || uData.phone || '').trim();
      }
    } catch {}

    const receiptData: FeeReceiptData = {
      receiptId: `MSLB-REC-${payment.id.slice(-6).toUpperCase()}`,
      studentName: payment.user_name || 'طالبہ',
      studentId: payment.user_id,
      courseName: payment.course_id,
      amount: Number(payment.amount || 0),
      category: payment.payment_type || payment.type || 'fees',
      paymentMethod: payment.provider ? 'آن لائن / تصدیق شدہ' : 'فیس رسید',
      transactionId: payment.provider_payment_id || payment.id,
      issueDateGregorian: formatDate(payment) || new Date().toLocaleDateString(),
      status: 'منظور شدہ (Approved & Verified)',
    };

    await shareReceiptToWhatsApp(receiptData, parentPhone);
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
        <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'all' ? 'succeeded' : 'all')}>
          <Ionicons name="funnel" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TextInput
          style={styles.noteInput}
          placeholder="Admin reason note (required for refunds)"
          value={adminNote}
          onChangeText={setAdminNote}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <>
          <Text style={{ paddingHorizontal: 16, color: COLORS.textMuted, fontSize: 12 }}>Filter: {statusFilter.toUpperCase()}</Text>
          <FlatList
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            data={payments}
            refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const state = paymentState(item);
              const isSucceeded = state === 'succeeded';
              const isRefunded = state === 'refunded';
              const isPending = ['pending', 'processing', 'submitted'].includes(state);

              return (
                <View style={styles.card} testID={`payment-${item.id}`}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.name}>{item.user_name || item.user_id}</Text>
                    <View style={[styles.badge, isSucceeded ? styles.badgeSuccess : isRefunded ? styles.badgeRefunded : styles.badgePending]}>
                      <Text style={[styles.badgeText, isSucceeded ? styles.badgeTextSuccess : isRefunded ? styles.badgeTextRefunded : styles.badgeTextPending]}>
                        {state.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.amount}>₹{Number(item.amount || 0).toFixed(2)}</Text>
                  <Text style={styles.meta}>Type: {(item.payment_type || item.type || 'fees').toUpperCase()}</Text>
                  {item.course_id ? <Text style={styles.meta}>Course: {item.course_id}</Text> : null}
                  {item.provider_order_id ? <Text style={styles.meta}>Order ID: {item.provider_order_id}</Text> : null}
                  {item.provider_payment_id ? <Text style={styles.meta}>Payment ID: {item.provider_payment_id}</Text> : null}
                  {item.refund_id ? <Text style={styles.meta}>Refund ID: {item.refund_id}</Text> : null}
                  <Text style={styles.time}>Created: {formatDate(item)}</Text>

                  {/* Actions based on payment state */}
                  <View style={styles.actions}>
                    {/* View Official Receipt */}
                    <TouchableOpacity
                      style={styles.receiptBtn}
                      onPress={() => {
                        setSelectedReceipt({
                          receiptId: `MSLB-REC-${item.id.slice(-6).toUpperCase()}`,
                          studentName: item.user_name || 'Student / Donor',
                          studentId: item.user_id,
                          courseName: item.course_id,
                          amount: Number(item.amount || 0),
                          category: item.payment_type || item.type || 'fees',
                          paymentMethod: item.provider ? 'Razorpay Online' : 'Direct Payment',
                          transactionId: item.provider_payment_id || item.id,
                          issueDateGregorian: formatDate(item) || new Date().toLocaleDateString(),
                          status: isSucceeded ? 'Verified & Paid' : isRefunded ? 'Refunded' : 'Pending',
                        });
                        setReceiptModalVisible(true);
                      }}
                    >
                      <Ionicons name="receipt-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.receiptBtnText}>Official Receipt</Text>
                    </TouchableOpacity>

                    {/* WhatsApp Fee Receipt Quick Button */}
                    <TouchableOpacity
                      style={styles.whatsappReceiptBtn}
                      onPress={() => handleSendWhatsAppReceipt(item)}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#059669" />
                      <Text style={styles.whatsappReceiptBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    {isPending ? (
                      <>
                        <TouchableOpacity
                          style={[styles.approveBtn, updatingId === item.id && styles.disabledBtn]}
                          onPress={() => handleApprovePayment(item)}
                          disabled={updatingId === item.id}
                        >
                          {updatingId === item.id ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={styles.approveBtnText}>Approve</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rejectBtn, updatingId === item.id && styles.disabledBtn]}
                          onPress={() => handleLegacyReject(item.id)}
                          disabled={updatingId === item.id}
                        >
                          <Text style={styles.rejectText}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    ) : isSucceeded && item.provider_payment_id ? (
                      <TouchableOpacity
                        style={[styles.refundBtn, updatingId === item.id && styles.disabledBtn]}
                        onPress={() => handleRefund(item)}
                        disabled={updatingId === item.id}
                      >
                        {updatingId === item.id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={styles.refundText}>Issue Refund</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={(
              <View style={styles.center}>
                <Ionicons name="card-outline" size={42} color={COLORS.border} />
                <Text style={styles.empty}>No payment records</Text>
              </View>
            )}
          />
        </>
      )}

      {/* Islamic Fee Receipt Modal */}
      <IslamicReceiptModal
        visible={receiptModalVisible}
        receipt={selectedReceipt}
        onClose={() => {
          setReceiptModalVisible(false);
          setSelectedReceipt(null);
        }}
      />
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
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  errorText: { color: COLORS.error, fontSize: 12, paddingHorizontal: SPACING.md, paddingTop: 8 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 32 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  amount: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginVertical: 4 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeSuccess: { backgroundColor: '#D1FAE5' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeRefunded: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextSuccess: { color: '#065F46' },
  badgeTextPending: { color: '#92400E' },
  badgeTextRefunded: { color: '#991B1B' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  receiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#C6E8D4',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    gap: 4,
  },
  receiptBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  refundBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  refundText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  whatsappReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  whatsappReceiptBtnText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 12,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  rejectText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13 },
  disabledBtn: { opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, fontSize: 14, marginTop: 8 },
  noteInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface, color: COLORS.textMain, fontSize: 13 },
});

