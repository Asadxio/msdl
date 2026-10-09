import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';
import { hasPermission } from '@/lib/rbac';
import { logFirestoreFailure } from '@/lib/firestoreDebug';

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export type PrivacyRequestState =
  | 'requested'
  | 'reviewing'
  | 'processing'
  | 'failed'
  | 'completed'
  | 'rejected';

export type PrivacyRequest = {
  id: string;
  user_id: string;
  anonymous_requester_uid?: string;
  source?: 'in_app' | 'public_web' | 'in_app_direct';
  email?: string;
  type: 'deletion' | 'export';
  reason: string;
  state: PrivacyRequestState;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'verified_no_account';
  verification_method?: string;
  target_uid?: string;
  failure_step?: string;
  failure_reason?: string;
  created_at?: { toDate?: () => Date };
};

const STATUS_FLOW: PrivacyRequestState[] = [
  'requested',
  'reviewing',
  'processing',
  'failed',
  'completed',
  'rejected',
];

const NEXT_STATUS: Record<PrivacyRequestState, PrivacyRequestState[]> = {
  requested: ['reviewing', 'processing'],
  reviewing: ['processing', 'rejected'],
  processing: ['completed', 'failed', 'rejected'],
  failed: ['processing', 'rejected'],
  completed: [],
  rejected: [],
};

function formatDate(value?: { toDate?: () => Date }) {
  try {
    const dt = value?.toDate ? value.toDate() : null;
    return dt ? dt.toLocaleDateString() : 'Unknown';
  } catch {
    return 'Unknown';
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
      const snap = await getDocs(
        query(collection(db, 'privacy_requests'), orderBy('created_at', 'desc'))
      );
      setRequests(
        snap.docs.map((item) => {
          const data = item.data() as any;
          return {
            id: item.id,
            user_id: String(data.user_id || ''),
            anonymous_requester_uid: data.anonymous_requester_uid
              ? String(data.anonymous_requester_uid)
              : undefined,
            source: data.source || 'in_app',
            email: data.email ? String(data.email) : undefined,
            type: data.type === 'deletion' ? 'deletion' : 'export',
            reason: String(data.reason || ''),
            state: STATUS_FLOW.includes(data.state) ? data.state : 'requested',
            verification_status:
              data.verification_status ||
              (data.source === 'public_web' ? 'unverified' : 'verified'),
            verification_method: data.verification_method,
            target_uid: data.target_uid ? String(data.target_uid) : undefined,
            failure_step: data.failure_step ? String(data.failure_step) : undefined,
            failure_reason: data.failure_reason ? String(data.failure_reason) : undefined,
            created_at: data.created_at || null,
          };
        })
      );
      setError('');
    } catch (error: unknown) {
      logFirestoreFailure(
        {
          collection: 'privacy_requests',
          operation: 'get',
          query: 'orderBy created_at desc',
          role: profile?.role,
          status: profile?.status,
        },
        error
      );
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

  const updateStatus = async (request: PrivacyRequest, state: PrivacyRequestState) => {
    if (request.state === state || updatingId || !NEXT_STATUS[request.state].includes(state)) {
      return;
    }

    // Guard: Public deletion requests MUST have verified email proof before completing
    if (
      state === 'completed' &&
      request.type === 'deletion' &&
      request.source === 'public_web' &&
      request.verification_status !== 'verified'
    ) {
      Alert.alert(
        'Email Proof Required',
        'Public deletion requests cannot be processed until the requester validates email ownership using the 6-digit code.'
      );
      return;
    }

    setUpdatingId(request.id);
    try {
      if (
        (state === 'completed' || state === 'processing') &&
        request.type === 'deletion'
      ) {
        const processFn = httpsCallable<
          { targetUid?: string; targetEmail?: string; requestId?: string; reason?: string },
          { success: boolean; message?: string }
        >(functions, 'processAccountDeletion');

        // Never pass anonymous submitter UID as targetUid
        const safeTargetUid =
          request.target_uid || (request.source === 'public_web' ? undefined : request.user_id);

        const res = await withTimeout(
          processFn({
            targetUid: safeTargetUid,
            targetEmail: request.email || undefined,
            requestId: request.id,
            reason: request.reason || 'Admin processed account deletion request',
          }),
          30000,
          'Processing account deletion timed out'
        );

        if (!res.data?.success) {
          throw new Error(res.data?.message || 'Deletion processor did not return success.');
        }

        Alert.alert(
          'Deletion Completed',
          'The account has been deleted and user data permanently anonymized.'
        );
        void loadRequests();
      } else {
        await withTimeout(
          updateDoc(doc(db, 'privacy_requests', request.id), {
            state,
            updated_at: serverTimestamp(),
          }),
          10000,
          'Updating privacy request timed out'
        );
        setRequests((prev) =>
          prev.map((item) => (item.id === request.id ? { ...item, state } : item))
        );
      }
    } catch (error: unknown) {
      logFirestoreFailure(
        {
          collection: 'privacy_requests',
          operation: 'update',
          path: `privacy_requests/${request.id}`,
          query: `set state ${state}`,
          role: profile?.role,
          status: profile?.status,
        },
        error
      );
      const msg =
        error instanceof Error
          ? error.message
          : 'Could not update privacy request status. Please try again.';
      Alert.alert('Operation Failed', msg);
      void loadRequests();
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmUpdate = (request: PrivacyRequest, state: PrivacyRequestState) => {
    const actionLabel =
      state === 'completed' || state === 'processing'
        ? `execute deletion for`
        : `move this request to "${state}"`;
    Alert.alert('Confirm Action', `Are you sure you want to ${actionLabel}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Proceed',
        style: state === 'completed' ? 'destructive' : 'default',
        onPress: () => {
          void updateStatus(request, state);
        },
      },
    ]);
  };

  if (!isAdmin && profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Unauthorized</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/more')}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Privacy Requests</Text>
          <Text style={styles.subtitle}>Review account deletion and data export requests</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            void loadRequests();
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="refresh" size={18} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No privacy requests yet.</Text>}
          renderItem={({ item }) => {
            const isFailed = item.state === 'failed';
            return (
              <View style={[styles.card, isFailed && styles.cardFailed]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.typeText}>
                    {item.type === 'deletion' ? 'Account Deletion' : 'Data Export'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {item.source === 'public_web' ? (
                      <Text
                        style={[
                          styles.sourceBadge,
                          { backgroundColor: '#FEF3C7', color: '#92400E' },
                        ]}
                      >
                        Public Web
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.sourceBadge,
                          { backgroundColor: '#E0E7FF', color: '#3730A3' },
                        ]}
                      >
                        {item.source === 'in_app_direct' ? 'In-App Direct' : 'In-App'}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.statusPill,
                        isFailed && { backgroundColor: '#FEE2E2', color: '#991B1B' },
                      ]}
                    >
                      {item.state}
                    </Text>
                  </View>
                </View>

                {item.email ? <Text style={styles.metaText}>Email: {item.email}</Text> : null}

                {/* Public Verification State Badges */}
                {item.source === 'public_web' ? (
                  <View style={styles.verificationBadgeBox}>
                    {item.verification_status === 'verified' ? (
                      <Text style={[styles.metaText, { color: '#065F46', fontWeight: '700' }]}>
                        ✓ Email Proof Verified (Linked UID: {item.target_uid})
                      </Text>
                    ) : item.verification_status === 'verified_no_account' ? (
                      <Text style={[styles.metaText, { color: '#6B7280', fontWeight: '700' }]}>
                        ℹ Verified: No Account Registered
                      </Text>
                    ) : (
                      <Text style={[styles.metaText, { color: '#B45309', fontWeight: '700' }]}>
                        ⏳ Awaiting Requester Email Verification Code
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.metaText}>User ID: {item.user_id || 'Unknown'}</Text>
                )}

                {/* Failure State Diagnostics */}
                {isFailed ? (
                  <View style={styles.failureBox}>
                    <Text style={styles.failureTitle}>
                      Deletion Failed at Step: {item.failure_step || 'unknown'}
                    </Text>
                    <Text style={styles.failureReason}>
                      {item.failure_reason || 'An error occurred during deletion.'}
                    </Text>
                    <TouchableOpacity
                      style={styles.retryBtn}
                      disabled={updatingId === item.id}
                      onPress={() => confirmUpdate(item, 'processing')}
                    >
                      <Ionicons name="reload" size={14} color="#fff" />
                      <Text style={styles.retryBtnText}>Retry Deletion Process</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <Text style={styles.metaText}>Created: {formatDate(item.created_at)}</Text>
                <Text style={styles.reasonText}>{item.reason}</Text>

                {/* Action Transitions */}
                <View style={styles.actionsRow}>
                  {STATUS_FLOW.map((state) => {
                    const allowedNext = NEXT_STATUS[item.state]?.includes(state);
                    const active = item.state === state;
                    return (
                      <TouchableOpacity
                        key={state}
                        style={[
                          styles.statusBtn,
                          active && styles.statusBtnActive,
                          !active && !allowedNext && styles.statusBtnDisabled,
                        ]}
                        disabled={updatingId === item.id || active || !allowedNext}
                        onPress={() => confirmUpdate(item, state)}
                      >
                        <Text
                          style={[
                            styles.statusBtnText,
                            active && styles.statusBtnTextActive,
                          ]}
                        >
                          {state}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  list: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.md,
    gap: 8,
    ...SHADOWS.card,
  },
  cardFailed: {
    borderColor: '#FECACA',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  typeText: { flex: 1, color: COLORS.textMain, fontSize: 16, fontWeight: '800' },
  sourceBadge: {
    overflow: 'hidden',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '800',
  },
  statusPill: {
    overflow: 'hidden',
    borderRadius: RADIUS.full,
    backgroundColor: '#EEF6F2',
    color: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  metaText: { color: COLORS.textMuted, fontSize: 12 },
  verificationBadgeBox: {
    paddingVertical: 4,
  },
  failureBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: RADIUS.md,
    padding: 10,
    gap: 6,
    marginVertical: 4,
  },
  failureTitle: { color: '#991B1B', fontWeight: '800', fontSize: 12 },
  failureReason: { color: '#B91C1C', fontSize: 12 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  retryBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reasonText: { color: COLORS.textMain, fontSize: 14, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  statusBtnDisabled: { opacity: 0.45 },
  statusBtnText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  statusBtnTextActive: { color: '#fff' },
  errorText: { color: COLORS.error, padding: SPACING.md, fontSize: 13, fontWeight: '700' },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
