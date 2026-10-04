import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { IslamicReceiptModal } from '@/components/IslamicReceiptModal';
import type { FeeReceiptData } from '@/lib/receiptGenerator';

type PaymentStatus =
  | 'pending' | 'processing' | 'submitted' | 'succeeded'
  | 'failed' | 'rejected' | 'cancelled' | 'refunded' | 'disputed' | 'expired'
  | 'approved' | 'verified';

type PaymentDomain = 'academic_fee' | 'donation';

type PaymentRecord = {
  id: string;
  user_id: string;
  user_name?: string;
  amount: number;
  payment_domain?: PaymentDomain;
  payment_type?: string;
  type?: string;
  state?: PaymentStatus;
  status?: PaymentStatus;
  provider_order_id?: string;
  provider_payment_id?: string;
  transaction_ref?: string;
  course_id?: string;
  course_name?: string;
  created_at?: { toDate?: () => Date; toMillis?: () => number };
  provider?: string;
  refund_id?: string;
};

function resolveState(p: PaymentRecord): PaymentStatus {
  return p.state ?? p.status ?? 'pending';
}

function resolveDomain(p: PaymentRecord): PaymentDomain {
  if (p.payment_domain === 'donation' || p.payment_domain === 'academic_fee') {
    return p.payment_domain;
  }
  const typeStr = String(p.payment_type || p.type || '').toLowerCase();
  const donationTypes = ['sadqa', 'sadqah', 'zakat', 'fitra', 'fitrah', 'langar', 'donation_other'];
  return donationTypes.includes(typeStr) ? 'donation' : 'academic_fee';
}

function formatDate(item: PaymentRecord): string {
  try {
    const dt = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!dt) return 'Unknown date';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Unknown date';
  }
}

function formatTime(item: PaymentRecord): string {
  try {
    const dt = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!dt) return '';
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const TYPE_LABELS: Record<string, string> = {
  fees: 'Course Tuition Fee',
  course_fee: 'Course Tuition Fee',
  admission: 'Madrasa Admission Fee',
  admission_fee: 'Madrasa Admission Fee',
  academic_other: 'Other Academic Fee',
  sadqa: 'Sadqah-e-Jariyah',
  sadqah: 'Sadqah-e-Jariyah',
  zakat: 'Zakat Fund',
  fitra: 'Sadaqat-ul-Fitr',
  fitrah: 'Sadaqat-ul-Fitr',
  langar: 'Talibat Langar & Food',
  donation_other: 'General Donation',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  succeeded: { bg: '#DCFCE7', text: '#166534', label: 'Succeeded' },
  approved:  { bg: '#DCFCE7', text: '#166534', label: 'Approved' },
  verified:  { bg: '#DCFCE7', text: '#166534', label: 'Verified' },
  pending:   { bg: '#FEF3C7', text: '#92400E', label: 'Pending' },
  processing:{ bg: '#FEF3C7', text: '#92400E', label: 'Processing' },
  submitted: { bg: '#E3F2FD', text: '#1565C0', label: 'Submitted' },
  failed:    { bg: '#FEE2E2', text: COLORS.error, label: 'Failed' },
  rejected:  { bg: '#FEE2E2', text: COLORS.error, label: 'Rejected' },
  cancelled: { bg: '#F5F5F5', text: '#6B7280', label: 'Cancelled' },
  refunded:  { bg: '#F3E5F5', text: '#7B1FA2', label: 'Refunded' },
  disputed:  { bg: '#FFF3E0', text: '#E65100', label: 'Disputed' },
  expired:   { bg: '#F5F5F5', text: '#6B7280', label: 'Expired' },
};

const STATUS_FILTER_OPTIONS: ('all' | PaymentStatus)[] = [
  'all', 'succeeded', 'pending', 'submitted', 'refunded', 'failed',
];

// ─── Payment Record Card ─────────────────────────────────────────────────────
function PaymentCard({ item, onOpenReceipt }: { item: PaymentRecord; onOpenReceipt: (item: PaymentRecord) => void }) {
  const st = resolveState(item);
  const sc = STATUS_COLORS[st] || STATUS_COLORS.pending;
  const domain = resolveDomain(item);
  const isDonation = domain === 'donation';
  const typeKey = String(item.payment_type || item.type || '').toLowerCase();
  const typeLabel = TYPE_LABELS[typeKey] || (isDonation ? 'Donation' : 'Course Fee');
  const dateStr = formatDate(item);
  const timeStr = formatTime(item);
  const displayAmt = item.amount ? (item.amount > 10000 ? item.amount / 100 : item.amount) : 0;

  return (
    <View style={styles.card} testID={`payment-history-${item.id}`}>
      {/* Top classification tag */}
      <View style={styles.cardDomainRow}>
        <View style={[styles.domainBadge, isDonation ? styles.domainBadgeDonation : styles.domainBadgeAcademic]}>
          <Ionicons
            name={isDonation ? 'heart' : 'school'}
            size={12}
            color={isDonation ? '#B45309' : '#047857'}
          />
          <Text style={[styles.domainBadgeText, isDonation ? styles.domainBadgeTextDonation : styles.domainBadgeTextAcademic]}>
            {isDonation ? 'ISLAMIC FUND / DONATION' : 'ACADEMIC FEE'}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
        </View>
      </View>

      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardType}>{typeLabel}</Text>
          {item.course_name ? (
            <Text style={styles.cardCourse}>Course: {item.course_name}</Text>
          ) : null}
          <Text style={styles.cardDate}>{dateStr}{timeStr ? ` · ${timeStr}` : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardAmount}>₹{Number(displayAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={{ flex: 1 }}>
          {item.provider_payment_id ? (
            <Text style={styles.txRef} numberOfLines={1}>Pay ID: {item.provider_payment_id}</Text>
          ) : item.transaction_ref ? (
            <Text style={styles.txRef} numberOfLines={1}>Ref: {item.transaction_ref}</Text>
          ) : (
            <Text style={styles.txId} numberOfLines={1}>ID: {item.id}</Text>
          )}
        </View>

        {st === 'succeeded' || st === 'approved' || st === 'verified' ? (
          <TouchableOpacity
            style={styles.viewReceiptBtn}
            onPress={() => onOpenReceipt(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={14} color={COLORS.primary} />
            <Text style={styles.viewReceiptBtnText}>View Receipt</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Financial Summary Bar ───────────────────────────────────────────────────
function FinancialSummaryBar({ payments }: { payments: PaymentRecord[] }) {
  const stats = useMemo(() => {
    let totalRev = 0;
    let totalDonations = 0;
    let totalFees = 0;
    payments.forEach((p) => {
      const st = resolveState(p);
      const rawAmt = Number(p.amount || 0);
      const amt = rawAmt > 10000 ? rawAmt / 100 : rawAmt;
      const domain = resolveDomain(p);
      if (['succeeded', 'approved', 'verified'].includes(st)) {
        totalRev += amt;
        if (domain === 'donation') totalDonations += amt;
        else totalFees += amt;
      }
    });
    return { totalRev, totalDonations, totalFees };
  }, [payments]);

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Total Paid</Text>
        <Text style={styles.summaryValue}>₹{stats.totalRev.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Academic Fees</Text>
        <Text style={[styles.summaryValue, { color: '#047857' }]}>₹{stats.totalFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Donations / Zakat</Text>
        <Text style={[styles.summaryValue, { color: '#B45309' }]}>₹{stats.totalDonations.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PaymentHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = hasPermission(profile, 'admin.payments.review');

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState('');
  const [domainFilter, setDomainFilter] = useState<'all' | 'academic_fee' | 'donation'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, 'payments'), orderBy('created_at', 'desc'), limit(500));
      } else {
        q = query(
          collection(db, 'payments'),
          where('user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(100),
        );
      }
      const snap = await getDocs(q);
      const arr: PaymentRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<PaymentRecord, 'id'>;
        arr.push({ id: d.id, ...data });
      });
      setPayments(arr);
    } catch (err: unknown) {
      logFirestoreFailure({
        collection: 'payments',
        operation: 'get',
        query: isAdmin ? 'all payments admin' : `payments where user_id == ${user.uid}`,
        role: profile?.role,
        status: profile?.status,
      }, err);
      setError('Could not load payment history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isAdmin, profile?.role, profile?.status]);

  useEffect(() => {
    fetchPayments().catch(() => {});
  }, [fetchPayments]);

  const filtered = useMemo(() => payments.filter((p) => {
    const st = resolveState(p);
    const domain = resolveDomain(p);
    const matchStatus = statusFilter === 'all' || st === statusFilter;
    const matchDomain = domainFilter === 'all' || domain === domainFilter;
    return matchStatus && matchDomain;
  }), [payments, statusFilter, domainFilter]);

  const handleOpenReceipt = (item: PaymentRecord) => {
    const isDonation = resolveDomain(item) === 'donation';
    const dateStr = item.created_at?.toDate ? item.created_at.toDate().toLocaleDateString('en-IN') : 'Today';
    const rawAmt = Number(item.amount || 0);
    const displayAmt = rawAmt > 10000 ? rawAmt / 100 : rawAmt;

    const rData: FeeReceiptData = {
      receiptId: item.id,
      studentName: item.user_name || profile?.name || user?.displayName || 'Student / Donor',
      studentEmail: profile?.email || user?.email || undefined,
      courseName: item.course_name,
      amount: displayAmt,
      category: item.payment_type || item.type || (isDonation ? 'sadqah' : 'course_fee'),
      paymentDomain: isDonation ? 'donation' : 'academic_fee',
      paymentMethod: item.provider ? 'Razorpay Online' : 'Standard Payment',
      transactionId: item.provider_payment_id || item.provider_order_id || item.transaction_ref,
      issueDateGregorian: dateStr,
      status: (item.state || item.status || 'succeeded').toUpperCase(),
    };
    setSelectedReceipt(rData);
    setReceiptModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')} testID="payment-history-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>{isAdmin ? 'All Payments & Funds' : 'My Payment History'}</Text>
          {!loading && (
            <Text style={styles.topBarSub}>{filtered.length} records</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => { void fetchPayments(); }} disabled={loading} style={styles.refreshIconBtn}>
          {loading
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="refresh" size={20} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      {/* Summary Bar */}
      {!loading && payments.length > 0 && <FinancialSummaryBar payments={payments} />}

      {/* Domain Tabs & Status Filters */}
      <View style={styles.filterContainer}>
        {/* Domain Selection Tabs */}
        <View style={styles.domainTabsRow}>
          {[
            { key: 'all', label: 'All Payments' },
            { key: 'academic_fee', label: 'Academic Fees' },
            { key: 'donation', label: 'Donations & Zakat' },
          ].map((d) => (
            <TouchableOpacity
              key={d.key}
              style={[styles.domainTabChip, domainFilter === d.key && styles.domainTabChipActive]}
              onPress={() => setDomainFilter(d.key as any)}
            >
              <Text style={[styles.domainTabChipText, domainFilter === d.key && styles.domainTabChipTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status Scroll Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.filterLabel}>Status:</Text>
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.filterChip, statusFilter === opt && styles.filterChipActive]}
              onPress={() => setStatusFilter(opt)}
            >
              <Text style={[styles.filterChipText, statusFilter === opt && styles.filterChipTextActive]}>
                {opt === 'all' ? 'All' : STATUS_COLORS[opt]?.label || opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { void fetchPayments(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PaymentCard item={item} onOpenReceipt={handleOpenReceipt} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="card-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No payment records found</Text>
              <Text style={styles.emptyText}>
                {domainFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try changing the filters above'
                  : 'Your payment history will appear here after your first transaction.'}
              </Text>
            </View>
          )}
        />
      )}

      {/* Islamic Receipt Modal */}
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  topBarSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  refreshIconBtn: { padding: SPACING.sm },
  summaryBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  filterContainer: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 6 },
  domainTabsRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: 6, marginBottom: 6 },
  domainTabChip: {
    flex: 1, paddingVertical: 7, borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  domainTabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  domainTabChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  domainTabChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  filterRow: { paddingHorizontal: SPACING.md, paddingVertical: 4, gap: 6, alignItems: 'center' },
  filterLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', marginRight: 2 },
  filterChip: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  filterChipText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  errorText: { color: COLORS.error, fontSize: 12, flex: 1 },
  retryText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 8 },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  list: { padding: SPACING.md, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, ...SHADOWS.card, gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardDomainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  domainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  domainBadgeAcademic: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  domainBadgeDonation: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  domainBadgeText: { fontSize: 10, fontWeight: '800' },
  domainBadgeTextAcademic: { color: '#047857' },
  domainBadgeTextDonation: { color: '#B45309' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardType: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  cardCourse: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cardAmount: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6,
  },
  txRef: { fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace' },
  txId: { fontSize: 10, color: COLORS.border, fontFamily: 'monospace' },
  viewReceiptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  viewReceiptBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});
