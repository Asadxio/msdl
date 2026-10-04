import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput,
  Share, Linking, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { collection, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';
import { isFounderEmail } from '@/lib/founderPolicy';
import { createAdminLog } from '@/lib/adminLogs';
import { ADMIN_DEFAULT_PAGE_SIZE, fetchCursorPage } from '@/lib/adminPagination';
import { logFirestoreFailure } from '@/lib/firestoreDebug';
import { adminPaymentAction, adminRefundPayment } from '@/lib/paymentAdminFunctions';
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { IslamicReceiptModal } from '@/components/IslamicReceiptModal';
import { shareReceiptToWhatsApp, type FeeReceiptData } from '@/lib/receiptGenerator';
import { useActiveOrganization } from '@/lib/tenantContext';

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'rejected' | 'cancelled' | 'refunded' | 'disputed' | 'expired' | 'approved' | 'verified' | 'submitted';
type PaymentDomain = 'academic_fee' | 'donation';

type PaymentItem = {
  id: string;
  user_id: string;
  user_name?: string;
  amount: number;
  payment_domain?: PaymentDomain;
  state?: PaymentStatus;
  status?: PaymentStatus;
  provider?: 'razorpay' | string;
  provider_order_id?: string;
  provider_payment_id?: string;
  course_id?: string;
  course_name?: string;
  payment_type?: string;
  type?: string;
  refund_id?: string;
  refund_reason?: string;
  created_at?: { toDate?: () => Date };
  finalized_at?: { toDate?: () => Date };
  due_date?: string;
  due_date_set_by?: string;
};

function paymentState(payment: Pick<PaymentItem, 'state' | 'status'>): PaymentStatus {
  return payment.state ?? payment.status ?? 'pending';
}

function resolveDomain(item: PaymentItem): PaymentDomain {
  if (item.payment_domain === 'donation' || item.payment_domain === 'academic_fee') {
    return item.payment_domain;
  }
  const typeStr = String(item.payment_type || item.type || '').toLowerCase();
  const donationTypes = ['sadqa', 'sadqah', 'zakat', 'fitra', 'fitrah', 'langar', 'donation_other'];
  return donationTypes.includes(typeStr) ? 'donation' : 'academic_fee';
}

function formatDate(item: PaymentItem) {
  try {
    const dt = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!dt) return '';
    return dt.toLocaleString('en-IN');
  } catch {
    return '';
  }
}

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const isFounder = isFounderEmail(profile?.email || user?.email);
  const isAdmin = isFounder || hasPermission(profile, 'admin.payments.review') || profile?.role === 'super_admin' || profile?.role === 'admin';
  const { activeOrgId, isDefaultOrg } = useActiveOrganization();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Domain & Status Filters
  const [domainFilter, setDomainFilter] = useState<'all' | 'academic_fee' | 'donation'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [cursor, setCursor] = useState<any>(null);
  const [fetching, setFetching] = useState(false);

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  // Bulk WhatsApp Reminder
  const [bulkReminderLoading, setBulkReminderLoading] = useState(false);

  // Due Date Input State
  const [dueDateInputId, setDueDateInputId] = useState<string | null>(null);
  const [dueDateText, setDueDateText] = useState('');

  const loadPayments = useCallback(async (direction: 'reset' | 'next' | 'prev' = 'reset') => {
    if (!isAdmin || fetching) return;
    setFetching(true);
    if (direction === 'reset') {
      setPayments((curr) => (curr.length === 0 ? [] : curr));
      setLoading(true);
    }
    try {
      const tenantExtra: any[] = [];
      if (!isDefaultOrg && activeOrgId) {
        tenantExtra.push(where('organization_id', '==', activeOrgId));
      }

      if (statusFilter !== 'all') {
        const [statePage, statusPage] = await Promise.all([
          fetchCursorPage<PaymentItem>({ ref: collection(db, 'payments'), orderField: 'created_at', pageSize: ADMIN_DEFAULT_PAGE_SIZE, extra: [...tenantExtra, where('state', '==', statusFilter)] }),
          fetchCursorPage<PaymentItem>({ ref: collection(db, 'payments'), orderField: 'created_at', pageSize: ADMIN_DEFAULT_PAGE_SIZE, extra: [...tenantExtra, where('status', '==', statusFilter)] }),
        ]);
        const merged = new Map<string, PaymentItem>();
        [...statePage.items, ...statusPage.items].forEach((item: any) => merged.set(item.id, { ...item, status: paymentState(item) }));
        setPayments([...merged.values()].sort((a, b) => Number(b.created_at?.toDate?.() || 0) - Number(a.created_at?.toDate?.() || 0)).slice(0, ADMIN_DEFAULT_PAGE_SIZE));
        setCursor(null);
      } else {
        const page = await fetchCursorPage<PaymentItem>({ ref: collection(db, 'payments'), orderField: 'created_at', pageSize: ADMIN_DEFAULT_PAGE_SIZE, cursor: direction === 'reset' ? null : cursor, direction: direction === 'reset' ? 'next' : direction, extra: tenantExtra });
        setPayments(page.items.map((item: any) => ({ ...item, status: paymentState(item) })) as PaymentItem[]);
        setCursor(direction === 'prev' ? page.prevCursor : page.nextCursor);
      }
      setError('');
    } catch (err) {
      logFirestoreFailure({ collection: 'payments', operation: 'get', query: 'loadPayments', role: profile?.role, status: profile?.status }, err);
      setError('Could not load payments. Please refresh and try again.');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [cursor, fetching, isAdmin, statusFilter, profile?.role, profile?.status, activeOrgId, isDefaultOrg]);

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

  // Financial Accounting Analytics
  const accounting = useMemo(() => {
    let academicFees = 0;
    let admissionFees = 0;
    let tuitionFees = 0;
    let academicCount = 0;

    let donationsTotal = 0;
    let zakatTotal = 0;
    let sadqahTotal = 0;
    let fitrahTotal = 0;
    let langarTotal = 0;
    let otherDonationTotal = 0;
    let donationCount = 0;

    let refundedTotal = 0;

    payments.forEach((p) => {
      const state = paymentState(p);
      const isSucceeded = ['succeeded', 'approved', 'verified'].includes(state);
      const isRefund = state === 'refunded';
      const rawAmt = Number(p.amount || 0);
      const amt = rawAmt > 10000 ? rawAmt / 100 : rawAmt;
      const domain = resolveDomain(p);
      const typeStr = String(p.payment_type || p.type || '').toLowerCase();

      if (isRefund) {
        refundedTotal += amt;
      }

      if (isSucceeded) {
        if (domain === 'academic_fee') {
          academicFees += amt;
          academicCount++;
          if (typeStr.includes('admission')) {
            admissionFees += amt;
          } else {
            tuitionFees += amt;
          }
        } else {
          donationsTotal += amt;
          donationCount++;
          if (typeStr.includes('zakat')) zakatTotal += amt;
          else if (typeStr.includes('sadq')) sadqahTotal += amt;
          else if (typeStr.includes('fitr')) fitrahTotal += amt;
          else if (typeStr.includes('langar')) langarTotal += amt;
          else otherDonationTotal += amt;
        }
      }
    });

    return {
      combinedTotal: academicFees + donationsTotal,
      academicFees,
      admissionFees,
      tuitionFees,
      academicCount,
      donationsTotal,
      zakatTotal,
      sadqahTotal,
      fitrahTotal,
      langarTotal,
      otherDonationTotal,
      donationCount,
      refundedTotal,
    };
  }, [payments]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      const domain = resolveDomain(item);
      const matchDomain = domainFilter === 'all' || domain === domainFilter;

      if (!matchDomain) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (item.user_name || '').toLowerCase().includes(q);
        const uidMatch = (item.user_id || '').toLowerCase().includes(q);
        const idMatch = (item.id || '').toLowerCase().includes(q);
        const orderMatch = (item.provider_order_id || '').toLowerCase().includes(q);
        const payIdMatch = (item.provider_payment_id || '').toLowerCase().includes(q);
        const courseMatch = (item.course_name || item.course_id || '').toLowerCase().includes(q);
        return nameMatch || uidMatch || idMatch || orderMatch || payIdMatch || courseMatch;
      }

      return true;
    });
  }, [payments, domainFilter, searchQuery]);

  // Handle Authoritative Refund
  const handleRefund = async (payment: PaymentItem) => {
    if (!adminNote || adminNote.trim().length < 4) {
      Alert.alert('Reason Required', 'Please enter an admin reason/note (at least 4 characters) before issuing a refund.');
      return;
    }

    const domain = resolveDomain(payment);
    const domainText = domain === 'donation' ? 'Donation' : 'Academic Course Fee';
    const rawAmt = Number(payment.amount || 0);
    const amt = rawAmt > 10000 ? rawAmt / 100 : rawAmt;

    Alert.alert(
      `Issue Razorpay Refund (${domainText})`,
      `Are you sure you want to refund ₹${amt.toFixed(2)} to ${payment.user_name || payment.user_id} via Razorpay API?\n\nReason: "${adminNote.trim()}"\n\n${domain === 'donation' ? 'Note: Donation refunds do not affect student enrollments.' : 'Note: Refunding academic fees will revoke course enrollment.'}`,
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
              Alert.alert('Refund Completed', `Refund ID: ${res.refundId}\nPayment has been authoritatively refunded.`);
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

  // Handle Offline / Manual Approval
  const handleApprovePayment = async (payment: PaymentItem) => {
    setUpdatingId(payment.id);
    try {
      await adminPaymentAction({
        paymentId: payment.id,
        action: 'approve',
        note: adminNote.trim() || 'Offline bank verification approved by admin',
      });
      await createAdminLog(profile, {
        action: 'approve_payment',
        performed_by: profile?.email || profile?.name || 'admin',
        target_id: payment.id,
        details: `Approved payment of ₹${payment.amount} for user ${payment.user_id}`,
      }).catch(() => {});
      Alert.alert('Success', 'Payment approved successfully.');
      await loadPayments('reset');
    } catch (err: any) {
      Alert.alert('Approval Failed', err?.message || 'Could not approve payment.');
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

    const isDonation = resolveDomain(payment) === 'donation';
    const rawAmt = Number(payment.amount || 0);
    const amt = rawAmt > 10000 ? rawAmt / 100 : rawAmt;

    const receiptData: FeeReceiptData = {
      receiptId: `MSLB-${isDonation ? 'DON' : 'FEE'}-${payment.id.slice(-6).toUpperCase()}`,
      studentName: payment.user_name || (isDonation ? 'محترم ڈونر' : 'طالبہ'),
      donorName: isDonation ? payment.user_name : undefined,
      studentId: payment.user_id,
      courseName: payment.course_name || payment.course_id,
      amount: amt,
      category: payment.payment_type || payment.type || (isDonation ? 'sadqah' : 'course_fee'),
      paymentDomain: isDonation ? 'donation' : 'academic_fee',
      paymentMethod: payment.provider ? 'Razorpay Online' : 'Standard Payment',
      transactionId: payment.provider_payment_id || payment.id,
      issueDateGregorian: formatDate(payment) || new Date().toLocaleDateString(),
      status: 'منظور شدہ (Approved & Verified)',
    };

    await shareReceiptToWhatsApp(receiptData, parentPhone);
  };

  const handleBulkWhatsAppReminder = async () => {
    const pendingAcademic = payments.filter((p) => {
      const s = paymentState(p);
      const d = resolveDomain(p);
      return d === 'academic_fee' && ['pending', 'submitted', 'processing'].includes(s);
    });
    if (pendingAcademic.length === 0) {
      Alert.alert('No Pending Fees', 'There are currently no pending academic fee payments.');
      return;
    }
    setBulkReminderLoading(true);
    try {
      const lines: string[] = [
        '🕌 *Madrasatu-s-Salikat Lil Banat*',
        '📋 *Fee Reminder — Pending Academic Fees*',
        `📅 Date: ${new Date().toLocaleDateString('en-IN')}`,
        '━━━━━━━━━━━━━━━━━━━━━━',
        '',
      ];
      for (const p of pendingAcademic) {
        const name = p.user_name || p.user_id;
        const rawAmt = Number(p.amount || 0);
        const amount = `₹${(rawAmt > 10000 ? rawAmt / 100 : rawAmt).toFixed(0)}`;
        const type = (p.payment_type || p.type || 'fees').toUpperCase();
        const course = p.course_name || p.course_id || 'Course';
        const dueNote = p.due_date ? `\n   ⏰ Due Date: ${p.due_date}` : '';
        lines.push(`👩‍🎓 *${name}*\n   📚 Course: ${course}\n   💰 Amount: ${amount} (${type})${dueNote}`);
        lines.push('');
      }
      lines.push('━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('براہ کرم تعلیمی فیس جلد از جلد جمع کرائیں۔ جزاکم اللہ خیراً');
      const fullText = lines.join('\n');
      const encodedText = encodeURIComponent(fullText);
      const waUrl = `whatsapp://send?text=${encodedText}`;
      const canOpen = await Linking.canOpenURL(waUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        await Share.share({ message: fullText, title: 'Fee Reminder — MSLB' });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not prepare reminder.');
    } finally {
      setBulkReminderLoading(false);
    }
  };

  const handleSetDueDate = async (paymentId: string, dateStr: string) => {
    const trimmed = dateStr.trim();
    const dateRegex = /^(0?[1-9]|[12]\d|3[01])-(0?[1-9]|1[0-2])-\d{4}$/;
    if (!dateRegex.test(trimmed)) {
      Alert.alert('Invalid Format', 'Date format must be DD-MM-YYYY (e.g. 15-10-2026)');
      return;
    }
    try {
      setUpdatingId(paymentId);
      await updateDoc(doc(db, 'payments', paymentId), {
        due_date: trimmed,
        due_date_set_by: profile?.email || profile?.name || 'admin',
        due_date_set_at: serverTimestamp(),
      });
      setDueDateInputId(null);
      setDueDateText('');
      await loadPayments('reset');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to set due date.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')} testID="payments-back-btn">
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>Financial Operations</Text>
          <Text style={styles.topBarSub}>Separate Academic Fees & Donations</Text>
        </View>
        <TouchableOpacity onPress={() => void loadPayments('reset')} disabled={fetching} style={{ padding: 8 }}>
          {fetching ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={20} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* SEARCH BAR */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search student, donor, payment ID, course..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* FINANCIAL METRICS SUMMARY BAR */}
      <View style={styles.accountingContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
          {/* Card 1: Combined */}
          <View style={[styles.metricCard, { borderColor: '#E2E8F0' }]}>
            <Text style={styles.metricLabel}>Total Collection</Text>
            <Text style={styles.metricValue}>₹{accounting.combinedTotal.toLocaleString()}</Text>
            <Text style={styles.metricSub}>All Succeeded Payments</Text>
          </View>

          {/* Card 2: Academic Fees */}
          <View style={[styles.metricCard, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="school" size={14} color="#047857" />
              <Text style={[styles.metricLabel, { color: '#047857' }]}>Academic Fees</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#047857' }]}>₹{accounting.academicFees.toLocaleString()}</Text>
            <Text style={[styles.metricSub, { color: '#065F46' }]}>
              Tuition: ₹{accounting.tuitionFees} | Adm: ₹{accounting.admissionFees}
            </Text>
          </View>

          {/* Card 3: Donations */}
          <View style={[styles.metricCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="heart" size={14} color="#B45309" />
              <Text style={[styles.metricLabel, { color: '#B45309' }]}>Donations & Funds</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#B45309' }]}>₹{accounting.donationsTotal.toLocaleString()}</Text>
            <Text style={[styles.metricSub, { color: '#92400E' }]}>
              Zakat: ₹{accounting.zakatTotal} | Sadqah: ₹{accounting.sadqahTotal}
            </Text>
          </View>

          {/* Card 4: Refunded */}
          {accounting.refundedTotal > 0 && (
            <View style={[styles.metricCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
              <Text style={[styles.metricLabel, { color: '#DC2626' }]}>Total Refunded</Text>
              <Text style={[styles.metricValue, { color: '#DC2626' }]}>₹{accounting.refundedTotal.toLocaleString()}</Text>
              <Text style={[styles.metricSub, { color: '#991B1B' }]}>Authoritative Refunds</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* DOMAIN SEGMENTED TABS */}
      <View style={styles.domainTabsRow}>
        {[
          { key: 'all', label: `All (${payments.length})` },
          { key: 'academic_fee', label: `Academic Fees (${payments.filter(p => resolveDomain(p) === 'academic_fee').length})` },
          { key: 'donation', label: `Donations (${payments.filter(p => resolveDomain(p) === 'donation').length})` },
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

      {/* SECONDARY STATUS FILTER */}
      <View style={styles.statusFiltersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          {(['all', 'succeeded', 'pending', 'refunded', 'failed'] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.statusFilterChip, statusFilter === st && styles.statusFilterChipActive]}
              onPress={() => setStatusFilter(st as any)}
            >
              <Text style={[styles.statusFilterText, statusFilter === st && styles.statusFilterTextActive]}>
                {st.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ADMIN NOTE INPUT (FOR REFUNDS) */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        <TextInput
          style={styles.noteInput}
          placeholder="Admin audit note (required before issuing a Razorpay refund)"
          placeholderTextColor={COLORS.textMuted}
          value={adminNote}
          onChangeText={setAdminNote}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <>
          {/* BULK REMINDER BAR FOR PENDING ACADEMIC FEES */}
          {domainFilter !== 'donation' && (
            <View style={styles.bulkReminderBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bulkReminderTitle}>
                  Pending Academic Fees ({payments.filter(p => resolveDomain(p) === 'academic_fee' && ['pending','submitted','processing'].includes(paymentState(p))).length})
                </Text>
                <Text style={styles.bulkReminderSub}>Send Fee Reminder to all parents via WhatsApp</Text>
              </View>
              <TouchableOpacity
                style={styles.bulkReminderBtn}
                onPress={() => { void handleBulkWhatsAppReminder(); }}
                disabled={bulkReminderLoading}
              >
                {bulkReminderLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="logo-whatsapp" size={15} color="#FFF" />
                )}
                <Text style={styles.bulkReminderBtnText}>Send Reminder</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            data={filteredPayments}
            refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const state = paymentState(item);
              const domain = resolveDomain(item);
              const isDonation = domain === 'donation';
              const isSucceeded = ['succeeded', 'approved', 'verified'].includes(state);
              const isRefunded = state === 'refunded';
              const isPending = ['pending', 'processing', 'submitted'].includes(state);

              const rawAmt = Number(item.amount || 0);
              const amt = rawAmt > 10000 ? rawAmt / 100 : rawAmt;

              return (
                <View style={[styles.card, isDonation && styles.cardDonation]} testID={`admin-payment-${item.id}`}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons
                          name={isDonation ? 'heart' : 'school'}
                          size={14}
                          color={isDonation ? '#B45309' : '#047857'}
                        />
                        <Text style={[styles.domainBadgeText, isDonation ? { color: '#B45309' } : { color: '#047857' }]}>
                          {isDonation ? 'DONATION' : 'ACADEMIC FEE'}
                        </Text>
                      </View>
                      <Text style={styles.name}>{item.user_name || item.user_id}</Text>
                    </View>

                    <View style={[styles.badge, isSucceeded ? styles.badgeSuccess : isRefunded ? styles.badgeRefunded : styles.badgePending]}>
                      <Text style={[styles.badgeText, isSucceeded ? styles.badgeTextSuccess : isRefunded ? styles.badgeTextRefunded : styles.badgeTextPending]}>
                        {state.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.amount}>₹{amt.toFixed(2)}</Text>

                  {/* Classification & Details */}
                  <Text style={styles.meta}>
                    Fund / Type: <Text style={{ fontWeight: '700', color: COLORS.textMain }}>{(item.payment_type || item.type || (isDonation ? 'sadqah' : 'course_fee')).toUpperCase()}</Text>
                  </Text>
                  {!isDonation && (item.course_name || item.course_id) ? (
                    <Text style={styles.meta}>Course: <Text style={{ fontWeight: '600' }}>{item.course_name || item.course_id}</Text></Text>
                  ) : null}

                  {item.provider_order_id ? <Text style={styles.meta}>Razorpay Order: {item.provider_order_id}</Text> : null}
                  {item.provider_payment_id ? <Text style={styles.meta}>Razorpay Payment ID: {item.provider_payment_id}</Text> : null}
                  {item.refund_id ? (
                    <Text style={[styles.meta, { color: '#DC2626', fontWeight: '600' }]}>
                      Refund ID: {item.refund_id} ({item.refund_reason || 'Administrative refund'})
                    </Text>
                  ) : null}

                  <Text style={styles.time}>Date: {formatDate(item)}</Text>

                  {/* Due Date Management */}
                  {!isDonation && item.due_date ? (
                    <View style={styles.dueDateBadgeRow}>
                      <Ionicons name="calendar-outline" size={14} color="#B45309" />
                      <Text style={styles.dueDateText}>Due Date: <Text style={{ fontWeight: '700' }}>{item.due_date}</Text></Text>
                    </View>
                  ) : null}

                  {/* Inline Due Date Setter for Pending Academic Fees */}
                  {!isDonation && isPending && dueDateInputId === item.id ? (
                    <View style={styles.inlineDueDateContainer}>
                      <TextInput
                        style={styles.inlineDueDateInput}
                        placeholder="DD-MM-YYYY (e.g. 15-10-2026)"
                        placeholderTextColor="#92400E"
                        value={dueDateText}
                        onChangeText={setDueDateText}
                      />
                      <TouchableOpacity
                        style={styles.saveDueDateBtn}
                        onPress={() => handleSetDueDate(item.id, dueDateText)}
                      >
                        <Text style={styles.saveDueDateBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelDueDateBtn}
                        onPress={() => setDueDateInputId(null)}
                      >
                        <Ionicons name="close" size={18} color="#92400E" />
                      </TouchableOpacity>
                    </View>
                  ) : !isDonation && isPending ? (
                    <TouchableOpacity
                      style={styles.setDueDateBtn}
                      onPress={() => {
                        setDueDateInputId(item.id);
                        setDueDateText(item.due_date || '');
                      }}
                    >
                      <Ionicons name="calendar" size={14} color="#B45309" />
                      <Text style={styles.setDueDateBtnText}>{item.due_date ? 'Edit Due Date' : 'Set Due Date'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Card Action Buttons */}
                  <View style={styles.actions}>
                    {/* View Receipt */}
                    <TouchableOpacity
                      style={styles.receiptBtn}
                      onPress={() => {
                        setSelectedReceipt({
                          receiptId: `MSLB-${isDonation ? 'DON' : 'FEE'}-${item.id.slice(-6).toUpperCase()}`,
                          studentName: item.user_name || (isDonation ? 'Donor' : 'Student'),
                          donorName: isDonation ? item.user_name : undefined,
                          studentId: item.user_id,
                          courseName: item.course_name || item.course_id,
                          amount: amt,
                          category: item.payment_type || item.type || (isDonation ? 'sadqah' : 'course_fee'),
                          paymentDomain: isDonation ? 'donation' : 'academic_fee',
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

                    {/* WhatsApp Quick Share */}
                    <TouchableOpacity
                      style={styles.whatsappReceiptBtn}
                      onPress={() => handleSendWhatsAppReceipt(item)}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#059669" />
                      <Text style={styles.whatsappReceiptBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    {/* Pending Manual Action: Approve / Reject */}
                    {isPending ? (
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
                    ) : null}

                    {/* Razorpay Authoritative Refund */}
                    {isSucceeded && item.provider_payment_id ? (
                      <TouchableOpacity
                        style={[styles.refundBtn, updatingId === item.id && styles.disabledBtn]}
                        onPress={() => handleRefund(item)}
                        disabled={updatingId === item.id}
                      >
                        {updatingId === item.id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={styles.refundText}>Refund</Text>
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
                <Text style={styles.empty}>No payments found for selected criteria</Text>
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
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  topBarSub: { fontSize: 11, color: COLORS.textMuted },
  searchBarContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4, paddingHorizontal: 12,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: 8, height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.textMain },
  accountingContainer: { paddingVertical: 6 },
  metricsRow: { paddingHorizontal: 16, gap: 8 },
  metricCard: {
    padding: 12, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface,
    borderWidth: 1, minWidth: 140, ...SHADOWS.card,
  },
  metricLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  metricValue: { fontSize: 18, fontWeight: '900', color: COLORS.textMain, marginVertical: 2 },
  metricSub: { fontSize: 10, color: COLORS.textMuted },
  domainTabsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginVertical: 4 },
  domainTabChip: {
    flex: 1, paddingVertical: 6, borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  domainTabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  domainTabChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  domainTabChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  statusFiltersRow: { paddingVertical: 4 },
  statusFilterChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  statusFilterChipActive: { backgroundColor: '#E2E8F0', borderColor: '#94A3B8' },
  statusFilterText: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },
  statusFilterTextActive: { color: COLORS.textMain, fontWeight: '700' },
  errorText: { color: COLORS.error, fontSize: 12, paddingHorizontal: SPACING.md, paddingTop: 8 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  cardDonation: {
    borderColor: '#FDE68A',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  domainBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '900', color: COLORS.primary, marginVertical: 4 },
  meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  time: { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeSuccess: { backgroundColor: '#D1FAE5' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeRefunded: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextSuccess: { color: '#065F46' },
  badgeTextPending: { color: '#92400E' },
  badgeTextRefunded: { color: '#991B1B' },
  actions: { flexDirection: 'row', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  receiptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8F5EE', borderWidth: 1, borderColor: '#C6E8D4',
    borderRadius: RADIUS.md, paddingVertical: 7, gap: 4,
  },
  receiptBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 11 },
  refundBtn: {
    backgroundColor: '#FEE2E2', borderRadius: RADIUS.md, paddingHorizontal: 12,
    paddingVertical: 7, alignItems: 'center', justifyContent: 'center',
  },
  refundText: { color: '#DC2626', fontWeight: '700', fontSize: 11 },
  whatsappReceiptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 7, gap: 4,
  },
  whatsappReceiptBtnText: { color: '#059669', fontWeight: '700', fontSize: 11 },
  approveBtn: {
    backgroundColor: '#059669', borderRadius: RADIUS.md, paddingHorizontal: 12,
    paddingVertical: 7, alignItems: 'center', justifyContent: 'center',
  },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  disabledBtn: { opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, fontSize: 13, marginTop: 8 },
  noteInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.surface,
    color: COLORS.textMain, fontSize: 12,
  },
  bulkReminderBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ECFDF5', marginHorizontal: 16, marginBottom: 8, padding: 10,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#A7F3D0', gap: 8,
  },
  bulkReminderTitle: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  bulkReminderSub: { fontSize: 10, color: '#047857', marginTop: 1 },
  bulkReminderBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, gap: 4,
  },
  bulkReminderBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  dueDateBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: '#FEF3C7', alignSelf: 'flex-start', paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: RADIUS.sm,
  },
  dueDateText: { fontSize: 10, color: '#92400E' },
  inlineDueDateContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: '#FFFBEB', padding: 6, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  inlineDueDateInput: {
    flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D97706',
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11,
    color: COLORS.textMain,
  },
  saveDueDateBtn: { backgroundColor: '#D97706', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  saveDueDateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  cancelDueDateBtn: { padding: 4 },
  setDueDateBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    borderWidth: 1, borderColor: '#FDE68A', borderRadius: RADIUS.md,
    paddingHorizontal: 8, paddingVertical: 4, gap: 4, alignSelf: 'flex-start', marginTop: 4,
  },
  setDueDateBtnText: { color: '#92400E', fontWeight: '600', fontSize: 10 },
});
