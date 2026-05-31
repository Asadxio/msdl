import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, orderBy, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';

type PrivacyRequestState = 'requested' | 'reviewing' | 'processing' | 'completed' | 'rejected';

type PrivacyRequest = {
  id: string;
  user_id: string;
  type: 'deletion' | 'export';
  reason: string;
  state: PrivacyRequestState;
  created_at?: { toDate?: () => Date };
};

const STATUS_FLOW: PrivacyRequestState[] = ['requested', 'reviewing', 'processing', 'completed', 'rejected'];
const NEXT_STATUS: Record<PrivacyRequestState, PrivacyRequestState[]> = {
  requested: ['reviewing'],
  reviewing: ['processing'],
  processing: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

function formatDate(value?: { toDate?: () => Date }) {
  try {
    const dt = value?.toDate ? value.toDate() : null;
    return dt ? dt.toLocaleString() : 'Not recorded';
  } catch {
    return 'Not recorded';
  }
}

export default function AdminPrivacyRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isAdmin = hasPermission(profile, 'admin.users.manage');
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'privacy_requests'), orderBy('created_at', 'desc')));
      setRequests(snap.docs.map((item) => {
        const data = item.data() as any;
        return {
          id: item.id,
          user_id: String(data.user_id || ''),
          type: data.type === 'deletion' ? 'deletion' : 'export',
          reason: String(data.reason || ''),
          state: STATUS_FLOW.includes(data.state) ? data.state : 'requested',
          created_at: data.created_at || null,
        };
      }));
      setError('');
    } catch {
      setError('Could not load privacy requests. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/');
      return;
    }
    void loadRequests();
  }, [isAdmin, loadRequests, profile, router]);

  const updateStatus = async (request: PrivacyRequest, state: PrivacyRequestState) => {
    if (request.state === state || updatingId || !NEXT_STATUS[request.state].includes(state)) return;
    setUpdatingId(request.id);
    try {
      await updateDoc(doc(db, 'privacy_requests', request.id), {
        state,
        updated_at: serverTimestamp(),
      });
      setRequests((prev) => prev.map((item) => (item.id === request.id ? { ...item, state } : item)));
    } catch {
      Alert.alert('Update Failed', 'Could not update privacy request status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmUpdate = (request: PrivacyRequest, state: PrivacyRequestState) => {
    Alert.alert('Update request status', `Move this ${request.type} request to "${state}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Update', onPress: () => { void updateStatus(request, state); } },
    ]);
  };

  if (!isAdmin && profile) {
    return <View style={styles.center}><Text style={styles.errorText}>Unauthorized</Text></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Privacy Requests</Text>
          <Text style={styles.subtitle}>Review account deletion and data export requests</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { void loadRequests(); }} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No privacy requests yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.typeText}>{item.type === 'deletion' ? 'Account Deletion' : 'Data Export'}</Text>
                <Text style={styles.statusPill}>{item.state}</Text>
              </View>
              <Text style={styles.metaText}>User ID: {item.user_id || 'Unknown'}</Text>
              <Text style={styles.metaText}>Created: {formatDate(item.created_at)}</Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
              <View style={styles.actionsRow}>
                {STATUS_FLOW.map((state) => {
                  const allowedNext = NEXT_STATUS[item.state].includes(state);
                  const active = item.state === state;
                  return (
                    <TouchableOpacity
                      key={state}
                      style={[styles.statusBtn, active && styles.statusBtnActive, !active && !allowedNext && styles.statusBtnDisabled]}
                      disabled={updatingId === item.id || active || !allowedNext}
                      onPress={() => confirmUpdate(item, state)}
                    >
                      <Text style={[styles.statusBtnText, active && styles.statusBtnTextActive]}>{state}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  list: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, gap: 8, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  typeText: { flex: 1, color: COLORS.textMain, fontSize: 16, fontWeight: '800' },
  statusPill: { overflow: 'hidden', borderRadius: RADIUS.full, backgroundColor: '#EEF6F2', color: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  metaText: { color: COLORS.textMuted, fontSize: 12 },
  reasonText: { color: COLORS.textMain, fontSize: 14, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusBtn: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7 },
  statusBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  statusBtnDisabled: { opacity: 0.45 },
  statusBtnText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  statusBtnTextActive: { color: '#fff' },
  errorText: { color: COLORS.error, padding: SPACING.md, fontSize: 13, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: SPACING.xl },
});
