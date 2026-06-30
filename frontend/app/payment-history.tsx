import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

type PaymentStatus =
  | 'pending' | 'processing' | 'submitted' | 'succeeded'
  | 'failed' | 'rejected' | 'cancelled' | 'refunded' | 'disputed' | 'expired'
  | 'approved' | 'verified';

type PaymentType = 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar';

type PaymentRecord = {
  id: string;
  user_id: string;
  user_name?: string;
  amount: number;
  type: PaymentType;
  state?: PaymentStatus;
  status?: PaymentStatus;
  transaction_ref?: string;
  course_id?: string;
  created_at?: { toDate?: () => Date; toMillis?: () => number };
  provider?: string;
  reconciliation?: { finalized?: boolean };
  replay_detected?: boolean;
  operation_id?: string;
};

function resolveState(p: PaymentRecord): PaymentStatus {
  return p.state ?? p.status ?? 'pending';
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
  fees: 'Course Fee',
  sadqa: 'Sadaqah',
  zakat: 'Zakat',
  fitra: 'Fitra',
  langar: 'Langar',
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
  'all', 'pending', 'submitted', 'succeeded', 'failed', 'rejected', 'refunded',
];

const TYPE_FILTER_OPTIONS: ('all' | PaymentType)[] = [
  'all', 'fees', 'sadqa', 'zakat', 'fitra', 'langar',
];

// ─── Student Payment Card ────────────────────────────────────────────────────
function PaymentCard({ item }: { item: PaymentRecord }) {
  const st = resolveState(item);
  const sc = STATUS_COLORS[st] || STATUS_COLORS.pending;
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const dateStr = formatDate(item);
  const timeStr = formatTime(item);

  return (
    <View style={styles.card} testID={`payment-history-${item.id}`}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardType}>{typeLabel}</Text>
          <Text style={styles.cardDate}>{dateStr}{timeStr ? ` · ${timeStr}` : ''}</Text>
        </View>
        <View>
          <Text style={styles.cardAmount}>₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
          </View>
        </View>
      </View>
      {item.transaction_ref ? (
        <Text style={styles.txRef} numberOfLines={1}>Ref: {item.transaction_ref}</Text>
      ) : null}
      {item.id ? (
        <Text style={styles.txId} numberOfLines={1}>ID: {item.id}</Text>
      ) : null}
    </View>
  );
}

// ─── Admin Summary Bar ───────────────────────────────────────────────────────
function AdminSummary({ payments }: { payments: PaymentRecord[] }) {
  const stats = useMemo(() => {
    let totalRev = 0;
    let totalDonations = 0;
    let totalFees = 0;
    let failed = 0;
    const donationTypes = new Set(['sadqa', 'zakat', 'fitra', 'langar']);
    payments.forEach((p) => {
      const st = resolveState(p);
      const amt = Number(p.amount || 0);
      if (['succeeded', 'approved', 'verified'].includes(st)) {
        totalRev += amt;
        if (donationTypes.has(p.type)) totalDonations += amt;
        else if (p.type === 'fees') totalFees += amt;
      }
      if (['failed', 'rejected', 'cancelled', 'expired'].includes(st)) failed++;
    });
    return { totalRev, totalDonations, totalFees, failed };
  }, [payments]);

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Total Collected</Text>
        <Text style={styles.summaryValue}>₹{stats.totalRev.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Fees</Text>
        <Text style={[styles.summaryValue, { color: '#1565C0' }]}>₹{stats.totalFees.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Donations</Text>
        <Text style={[styles.summaryValue, { color: '#AD1457' }]}>₹{stats.totalDonations.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Failed</Text>
        <Text style={[styles.summaryValue, { color: COLORS.error }]}>{stats.failed}</Text>
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
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PaymentType>('all');

  const fetchPayments = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      let q;
      if (isAdmin) {
        // Admin: fetch all payments
        q = query(collection(db, 'payments'), orderBy('created_at', 'desc'), limit(500));
      } else {
        // Student: fetch own payments only
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
    const matchStatus = statusFilter === 'all' || st === statusFilter;
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    return matchStatus && matchType;
  }), [payments, statusFilter, typeFilter]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')} testID="payment-history-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>{isAdmin ? 'All Payments' : 'My Payment History'}</Text>
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

      {/* Admin summary bar */}
      {isAdmin && !loading && payments.length > 0 && <AdminSummary payments={payments} />}

      {/* Filters */}
      <View style={styles.filterContainer}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.filterLabel}>Type:</Text>
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.filterChip, typeFilter === opt && styles.filterChipActive]}
              onPress={() => setTypeFilter(opt)}
            >
              <Text style={[styles.filterChipText, typeFilter === opt && styles.filterChipTextActive]}>
                {opt === 'all' ? 'All' : TYPE_LABELS[opt] || opt}
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
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PaymentCard item={item} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="card-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No payments found</Text>
              <Text style={styles.emptyText}>
                {statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try changing filters above'
                  : 'Your payment history will appear here after your first transaction.'}
              </Text>
            </View>
          )}
        />
      )}
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
  refreshIconBtn: { padding: 8 },
  summaryBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  filterContainer: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterRow: { paddingHorizontal: SPACING.md, paddingVertical: 6, gap: 6, alignItems: 'center' },
  filterLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', marginRight: 2 },
  filterChip: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  filterChipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.primary },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  errorText: { color: COLORS.error, fontSize: 12, flex: 1 },
  retryText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 8 },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  list: { padding: SPACING.md, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl,
    padding: SPACING.md, ...SHADOWS.card, gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardType: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  cardDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '800', color: COLORS.primary, textAlign: 'right' },
  statusBadge: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  txRef: { fontSize: 12, color: COLORS.textMuted, fontFamily: 'monospace' },
  txId: { fontSize: 10, color: COLORS.border, fontFamily: 'monospace' },
});
