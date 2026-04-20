import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

type PaymentItem = {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'verified' | 'submitted';
  provider?: 'razorpay';
  type?: 'fees' | 'sadqa' | 'zakat' | 'fitra';
  created_at?: { toDate?: () => Date };
};

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
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/');
      return;
    }
    if (!isAdmin) return;
    const q = query(collection(db, 'payments'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: PaymentItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setPayments(arr);
      setError('');
      setLoading(false);
    }, () => {
      setError('Could not load payments. Please refresh and try again.');
      setLoading(false);
    });
    return unsub;
  }, [profile, isAdmin, router]);

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'payments', id), { status, reviewed_at: new Date() });
    } catch {
      Alert.alert('Update Failed', 'Could not update payment status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmStatusChange = (id: string, status: 'approved' | 'rejected') => {
    const label = status === 'approved' ? 'Approve' : 'Reject';
    Alert.alert(`${label} Payment`, `Are you sure you want to ${label.toLowerCase()} this payment?`, [
      { text: 'Cancel' },
      { text: label, style: status === 'rejected' ? 'destructive' : 'default', onPress: () => setStatus(id, status) },
    ]);
  };

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="payments-back-btn">
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Manage Payments</Text>
        <TouchableOpacity onPress={() => setLoading(true)}>
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`payment-${item.id}`}>
              <Text style={styles.name}>{item.user_name}</Text>
              <Text style={styles.meta}>User ID: {item.user_id}</Text>
              <Text style={styles.meta}>Amount: ₹{Number(item.amount || 0).toFixed(2)}</Text>
              <Text style={styles.meta}>Type: {item.type || 'fees'}</Text>
              <Text style={styles.meta}>Provider: {item.provider || 'razorpay'}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Text style={styles.time}>{formatDate(item)}</Text>

              {(item.status === 'submitted' || item.status === 'pending' || item.status === 'verified') && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.verifyBtn, updatingId === item.id && styles.disabledBtn]} onPress={() => confirmStatusChange(item.id, 'approved')} disabled={updatingId === item.id}>
                    {updatingId === item.id ? <ActivityIndicator size="small" color="#166534" /> : <Text style={styles.verifyText}>Approve</Text>}
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
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  errorText: { color: COLORS.error, fontSize: 12, paddingHorizontal: SPACING.md, paddingTop: 8 },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 24 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  meta: { fontSize: 13, color: COLORS.textMuted, marginTop: 3, textTransform: 'capitalize' },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  verifyBtn: { flex: 1, backgroundColor: '#DCFCE7', borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center' },
  verifyText: { color: '#166534', fontWeight: '700' },
  rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center' },
  disabledBtn: { opacity: 0.7 },
  rejectText: { color: COLORS.error, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  empty: { color: COLORS.textMuted, fontSize: 14 },
});
