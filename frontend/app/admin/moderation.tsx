import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, StyleSheet, StatusBar } from 'react-native';
import { collection, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { useAuth } from '@/context/AuthContext';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { hasPermission } from '@/lib/rbac';
import { ADMIN_DEFAULT_PAGE_SIZE, fetchCursorPage } from '@/lib/adminPagination';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { applyModerationDecision } from '@/lib/moderationOps';
import { normalizeModerationState, type ModerationSeverity } from '@/lib/moderationDomain';
import { ScreenRefreshControl } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function ModerationDashboard() {
  const { profile } = useAuth();
  const allowed = hasPermission(profile, 'moderation.reports.read');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<'all' | ModerationSeverity>('all');
  const [state, setState] = useState<'pending' | 'under_review' | 'actioned' | 'dismissed' | 'appealed' | 'resolved'>('pending');
  const [cursor, setCursor] = useState<any>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const load = async (dir: 'next' | 'prev' | 'reset' = 'reset') => {
    if (!allowed) return;
    setLoading(true);
    const extra: any[] = [where('state', '==', state)];
    if (severity !== 'all') extra.push(where('severity', '==', severity));
    const page = await fetchCursorPage<any>({ ref: collection(db, 'moderation_reports'), orderField: 'created_at', orderDirection: 'desc', pageSize: ADMIN_DEFAULT_PAGE_SIZE, cursor: dir === 'reset' ? null : cursor, direction: dir === 'reset' ? 'next' : dir, extra }).catch(() => null);
    if (page) {
      setItems(page.items.map((i: any) => ({ ...i, state: normalizeModerationState(i.state) })));
      setCursor(dir === 'prev' ? page.prevCursor : page.nextCursor);
    }
    setLoading(false);
  };

  useEffect(() => { void load('reset'); }, [severity, state, allowed]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await load('reset');
  });

  const filtered = useMemo(() => items.filter((i) => !q || String(i.reason || '').toLowerCase().includes(q.toLowerCase()) || String(i.accused_user_id || '').includes(q)), [items, q]);

  const act = async (item: any, action: 'warn_user' | 'temporary_suspension' | 'dismiss_report') => {
    if (busy) return;
    Alert.alert('Confirm moderation action', `${action.replace('_', ' ').toUpperCase()} for ${item.accused_user_id}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Apply Action', onPress: async () => {
          try {
            setBusy(item.id);
            await applyModerationDecision({
              actorUid: profile?.email || profile?.name || 'moderator',
              actorProfile: profile,
              targetUid: item.accused_user_id,
              targetRole: item.accused_role || 'student',
              reportId: item.id,
              action,
              severity: item.severity || 'medium',
              reason: item.reason || 'moderation_action',
              notes: 'Action applied from moderation dashboard',
              requestId: `${Date.now()}-${item.id}`,
            });
            await load('reset');
          } catch (e: any) {
            Alert.alert('Action blocked', e?.message || 'Unable to apply action');
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  };

  if (!allowed && profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorTitle}>Unauthorized Access</Text>
        <Text style={styles.errorSub}>You do not have permission to access the moderation queue.</Text>
      </View>
    );
  }

  const getSeverityStyle = (sev: string) => {
    if (sev === 'high' || sev === 'critical') return { bg: '#FEE2E2', text: COLORS.error };
    if (sev === 'medium') return { bg: '#FEF3C7', text: '#D97706' };
    return { bg: '#E0F2FE', text: '#0284C7' };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Moderation Queue</Text>
          <Text style={styles.subtitle}>Review user reports & enforce platform safety</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { void load('reset'); }} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      <View style={styles.topSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search accused user ID or reason..."
            placeholderTextColor={COLORS.textMuted}
            value={q}
            onChangeText={setQ}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Status:</Text>
          <View style={styles.tabsRow}>
            {(['pending', 'under_review', 'actioned', 'dismissed'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.tabChip, state === s && styles.tabChipActive]}
                onPress={() => setState(s)}
              >
                <Text style={[styles.tabChipText, state === s && styles.tabChipTextActive]}>
                  {s.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Severity:</Text>
          <View style={styles.tabsRow}>
            {(['all', 'low', 'medium', 'high'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.tabChip, severity === s && styles.tabChipActive]}
                onPress={() => setSeverity(s)}
              >
                <Text style={[styles.tabChipText, severity === s && styles.tabChipTextActive]}>
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        data={filtered}
        keyExtractor={(i) => i.id || Math.random().toString()}
        removeClippedSubviews
        windowSize={8}
        maxToRenderPerBatch={10}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Queue is Clear</Text>
              <Text style={styles.emptyDesc}>There are currently no reports matching "{state.replace('_', ' ')}" status.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const sevStyle = getSeverityStyle(item.severity);
          const isBusy = busy === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: sevStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: sevStyle.text }]}>
                    {(item.severity || 'medium').toUpperCase()} SEVERITY
                  </Text>
                </View>
                <Text style={styles.statusBadgeText}>{(item.state || 'pending').replace('_', ' ').toUpperCase()}</Text>
              </View>

              <Text style={styles.reasonText}>{item.reason || 'No reason provided'}</Text>
              
              <View style={styles.userRow}>
                <Ionicons name="person" size={16} color={COLORS.textMuted} />
                <Text style={styles.userText}>Target ID: <Text style={styles.userIdVal}>{item.accused_user_id || 'Unknown'}</Text></Text>
              </View>

              <View style={styles.evidenceBox}>
                <Text style={styles.evidenceTitle}>Evidence / Notes:</Text>
                <Text style={styles.evidenceVal} numberOfLines={3}>{item.evidence_ref || item.notes || 'No supporting evidence documented.'}</Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.warnBtn, isBusy && styles.btnDisabled]}
                  disabled={isBusy}
                  onPress={() => act(item, 'warn_user')}
                >
                  <Ionicons name="warning-outline" size={16} color="#D97706" />
                  <Text style={[styles.actionBtnText, { color: '#D97706' }]}>Warn</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.suspendBtn, isBusy && styles.btnDisabled]}
                  disabled={isBusy}
                  onPress={() => act(item, 'temporary_suspension')}
                >
                  <Ionicons name="ban-outline" size={16} color={COLORS.error} />
                  <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Suspend</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.dismissBtn, isBusy && styles.btnDisabled]}
                  disabled={isBusy}
                  onPress={() => act(item, 'dismiss_report')}
                >
                  <Ionicons name="close-circle-outline" size={16} color={COLORS.textMuted} />
                  <Text style={[styles.actionBtnText, { color: COLORS.textMuted }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity style={styles.pageBtn} onPress={() => void load('prev')}>
                <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
                <Text style={styles.pageBtnText}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageBtn} onPress={() => void load('next')}>
                <Text style={styles.pageBtnText}>Next Page</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  errorTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, marginTop: SPACING.md },
  errorSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  topSection: { padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, color: COLORS.textMain },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, width: 55 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tabChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  tabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabChipText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  tabChipTextActive: { color: '#FFFFFF' },
  listContent: { padding: SPACING.md, paddingBottom: 60 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginTop: SPACING.md },
  emptyDesc: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 280 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeText: { fontSize: 10, fontWeight: '800' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  reasonText: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  userText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  userIdVal: { color: COLORS.textMain, fontWeight: '800' },
  evidenceBox: { backgroundColor: COLORS.surfaceAlt, padding: 10, borderRadius: RADIUS.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  evidenceTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  evidenceVal: { fontSize: 12, color: COLORS.textMain, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  warnBtn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  suspendBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  dismissBtn: { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
  btnDisabled: { opacity: 0.5 },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  pageBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
