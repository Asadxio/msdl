import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { collection, where } from 'firebase/firestore';
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

  useEffect(() => { load('reset'); }, [severity, state, allowed]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await load('reset');
  });

  const filtered = useMemo(() => items.filter((i) => !q || String(i.reason || '').toLowerCase().includes(q.toLowerCase()) || String(i.accused_user_id || '').includes(q)), [items, q]);

  const act = async (item: any, action: 'warn_user' | 'temporary_suspension' | 'dismiss_report') => {
    if (busy) return;
    Alert.alert('Confirm moderation action', `${action} for ${item.accused_user_id}?`, [
      { text: 'Cancel' },
      {
        text: 'Apply', onPress: async () => {
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

  if (!allowed) return <View style={styles.center}><Text>Unauthorized</Text></View>;

  return <View style={styles.container}>
    <Text style={styles.title}>Moderation Queue</Text>
    <TextInput value={q} onChangeText={setQ} placeholder="Search reason/user" style={styles.input} />
    <View style={styles.row}><TouchableOpacity onPress={() => setSeverity(severity === 'all' ? 'high' : 'all')}><Text>Severity: {severity}</Text></TouchableOpacity><TouchableOpacity onPress={() => setState(state === 'pending' ? 'under_review' : 'pending')}><Text>Tab: {state}</Text></TouchableOpacity></View>
    {loading ? <ActivityIndicator /> : <FlatList refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />} data={filtered} keyExtractor={(i) => i.id} removeClippedSubviews windowSize={8} maxToRenderPerBatch={10} renderItem={({ item }) => <View style={styles.card}><Text>{item.reason}</Text><Text>{item.state} • {item.severity}</Text><Text>{item.accused_user_id}</Text><Text numberOfLines={2}>Evidence: {item.evidence_ref || 'n/a'}</Text><View style={styles.row}><TouchableOpacity disabled={busy===item.id} onPress={() => act(item, 'warn_user')}><Text>Warn</Text></TouchableOpacity><TouchableOpacity disabled={busy===item.id} onPress={() => act(item, 'temporary_suspension')}><Text>Suspend</Text></TouchableOpacity><TouchableOpacity disabled={busy===item.id} onPress={() => act(item, 'dismiss_report')}><Text>Dismiss</Text></TouchableOpacity></View></View>} ListFooterComponent={<View style={styles.row}><TouchableOpacity onPress={() => load('prev')}><Text>Prev</Text></TouchableOpacity><TouchableOpacity onPress={() => load('next')}><Text>Next</Text></TouchableOpacity></View>} />}
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: SPACING.md }, title: { fontSize: 20, fontWeight: '700' }, input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  }, row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }, card: { padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: RADIUS.md, marginBottom: 8 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
