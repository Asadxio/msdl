import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, orderBy, query, serverTimestamp, updateDoc, doc, where, limit } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { withTimeout } from '@/lib/errors';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/rbac';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

type PrivacyRequestState = 'requested' | 'reviewing' | 'processing' | 'completed' | 'rejected';

type PrivacyRequest = {
  id: string;
  user_id: string;
  anonymous_requester_uid?: string;
  source?: 'in_app' | 'public_web';
  email?: string;
  type: 'deletion' | 'export';
  reason: string;
  state: PrivacyRequestState;
  verification_status?: 'unverified' | 'pending' | 'verified';
  target_uid?: string;
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
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
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
          anonymous_requester_uid: data.anonymous_requester_uid ? String(data.anonymous_requester_uid) : undefined,
          source: data.source === 'public_web' ? 'public_web' : 'in_app',
          email: data.email ? String(data.email) : undefined,
          type: data.type === 'deletion' ? 'deletion' : 'export',
          reason: String(data.reason || ''),
          state: STATUS_FLOW.includes(data.state) ? data.state : 'requested',
          verification_status: data.verification_status || (data.source === 'public_web' ? 'unverified' : 'verified'),
          target_uid: data.target_uid ? String(data.target_uid) : undefined,
          created_at: data.created_at || null,
        };
      }));
      setError('');
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'privacy_requests', operation: 'get', query: 'orderBy created_at desc', role: profile?.role, status: profile?.status }, error);
      setError('Could not load privacy requests. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, profile?.role, profile?.status]);

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/unauthorized?required=admin');
      return;
    }
    void loadRequests();
  }, [isAdmin, loadRequests, profile, router]);

  const verifyAccountOwnership = async (request: PrivacyRequest) => {
    if (!request.email) {
      Alert.alert('Missing Email', 'This request has no email address associated with it.');
      return;
    }
    setVerifyingId(request.id);
    try {
      const cleanEmail = request.email.trim().toLowerCase();
      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1)));
      if (userSnap.empty) {
        Alert.alert(
          'No Account Found',
          `No registered user account was found with email '${cleanEmail}'. If this user does not exist, you can reject this request.`,
          [{ text: 'OK' }]
        );
        return;
      }

      const foundUser = userSnap.docs[0];
      const userData = foundUser.data() as any;
      const targetUid = foundUser.id;

      Alert.alert(
        'Confirm Account Ownership Verification',
        `Found user account:\n\nName: ${userData.name || 'Student'}\nUID: ${targetUid}\nEmail: ${cleanEmail}\n\nHave you verified that the requester owns this account?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify & Link',
            onPress: async () => {
              try {
                await updateDoc(doc(db, 'privacy_requests', request.id), {
                  verification_status: 'verified',
                  target_uid: targetUid,
                  updated_at: serverTimestamp(),
                });
                setRequests((prev) =>
                  prev.map((r) =>
                    r.id === request.id ? { ...r, verification_status: 'verified', target_uid: targetUid } : r
                  )
                );
                Alert.alert('Ownership Verified', `Request linked to account UID: ${targetUid}`);
              } catch (e: any) {
                Alert.alert('Update Failed', e?.message || 'Could not update verification status.');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Lookup Error', err?.message || 'Failed to query users collection.');
    } finally {
      setVerifyingId(null);
    }
  };

  const updateStatus = async (request: PrivacyRequest, state: PrivacyRequestState) => {
    if (request.state === state || updatingId || !NEXT_STATUS[request.state].includes(state)) return;

    // Guard: Public deletion requests MUST be verified before moving to completed
    if (state === 'completed' && request.type === 'deletion' && request.source === 'public_web' && request.verification_status !== 'verified') {
      Alert.alert(
        'Verification Required',
        'Public deletion requests cannot be completed until account ownership has been verified. Please tap "Verify Account Ownership" first.'
      );
      return;
    }

    setUpdatingId(request.id);
    try {
      if (state === 'completed' && request.type === 'deletion') {
        const processFn = httpsCallable<
          { targetUid?: string; targetEmail?: string; requestId?: string; reason?: string },
          { success: boolean; message?: string }
        >(functions, 'processAccountDeletion');

        // Never pass anonymous submitter UID as targetUid
        const safeTargetUid = request.target_uid || (request.source === 'public_web' ? undefined : request.user_id);

        const res = await withTimeout(
          processFn({
            targetUid: safeTargetUid,
            targetEmail: request.email || undefined,
            requestId: request.id,
            reason: request.reason || 'Admin processed account deletion request',
          }),
          20000,
          'Processing account deletion timed out'
        );

        if (!res.data?.success) {
          throw new Error(res.data?.message || 'Deletion processor did not return success.');
        }

        Alert.alert('Deletion Processed', 'The account has been deleted and user data anonymized successfully.');
      } else {
        await withTimeout(
          updateDoc(doc(db, 'privacy_requests', request.id), {
            state,
            updated_at: serverTimestamp(),
          }),
          10000,
          'Updating privacy request timed out'
        );
      }
      setRequests((prev) => prev.map((item) => (item.id === request.id ? { ...item, state } : item)));
    } catch (error: unknown) {
      logFirestoreFailure({ collection: 'privacy_requests', operation: 'update', path: `privacy_requests/${request.id}`, query: `set state ${state}`, role: profile?.role, status: profile?.status }, error);
      const msg = error instanceof Error ? error.message : 'Could not update privacy request status. Please try again.';
      Alert.alert('Operation Failed', msg);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
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
        <FlatList removeClippedSubviews initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5}
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No privacy requests yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.typeText}>{item.type === 'deletion' ? 'Account Deletion' : 'Data Export'}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {item.source === 'public_web' ? (
                    <Text style={[styles.sourceBadge, { backgroundColor: '#FEF3C7', color: '#92400E' }]}>Public Web</Text>
                  ) : (
                    <Text style={[styles.sourceBadge, { backgroundColor: '#E0E7FF', color: '#3730A3' }]}>In-App</Text>
                  )}
                  <Text style={styles.statusPill}>{item.state}</Text>
                </View>
              </View>
              {item.email ? <Text style={styles.metaText}>Email: {item.email}</Text> : null}
              {item.source === 'public_web' ? (
                <>
                  <Text style={styles.metaText}>Anonymous Submitter: {item.user_id}</Text>
                  <Text style={[styles.metaText, { fontWeight: '700', color: item.verification_status === 'verified' ? '#065F46' : '#B45309' }]}>
                    Ownership Verification: {item.verification_status?.toUpperCase() || 'UNVERIFIED'}
                  </Text>
                  {item.target_uid ? (
                    <Text style={[styles.metaText, { fontWeight: '700', color: COLORS.primary }]}>
                      Resolved Account UID: {item.target_uid}
                    </Text>
                  ) : null}
                  {item.verification_status !== 'verified' && item.state !== 'completed' && item.state !== 'rejected' ? (
                    <TouchableOpacity
                      style={[styles.verifyBtn, verifyingId === item.id && { opacity: 0.6 }]}
                      disabled={verifyingId === item.id}
                      onPress={() => verifyAccountOwnership(item)}
                    >
                      <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                      <Text style={styles.verifyBtnText}>Verify Account Ownership</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <Text style={styles.metaText}>User ID: {item.user_id || 'Unknown'}</Text>
              )}
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
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, gap: 8, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  typeText: { flex: 1, color: COLORS.textMain, fontSize: 16, fontWeight: '800' },
  sourceBadge: { overflow: 'hidden', borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800' },
  statusPill: { overflow: 'hidden', borderRadius: RADIUS.full, backgroundColor: '#EEF6F2', color: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  metaText: { color: COLORS.textMuted, fontSize: 12 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, marginTop: 4 },
  verifyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  reasonText: { color: COLORS.textMain, fontSize: 14, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusBtn: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7 },
  statusBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  statusBtnDisabled: { opacity: 0.45 },
  statusBtnText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  statusBtnTextActive: { color: '#fff' },
  errorText: { color: COLORS.error, padding: SPACING.md, fontSize: 13, fontWeight: '700' },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
