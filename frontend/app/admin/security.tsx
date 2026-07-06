import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, StatusBar, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { fetchSecurityEvents, detectAnomalies, buildIncidentTimeline, toCsvIncidentReport, type SecuritySeverity } from '@/lib/securityMonitoring';
import { useAuth } from '@/context/AuthContext';
import { ScreenRefreshControl } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hasPermission } from '@/lib/rbac';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';

export default function SecurityDashboard() {
  const { profile } = useAuth();
  const allowed = hasPermission(profile, 'admin.analytics.read');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<SecuritySeverity | 'all'>('all');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const load = async () => {
    if (!allowed) return;
    setLoading(true);
    const items = await fetchSecurityEvents({ q, severity, pageSize: 100 }).catch(() => []);
    setEvents(items);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [allowed, severity]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await load();
  });

  const anomalies = useMemo(() => detectAnomalies(events), [events]);
  const timeline = useMemo(() => buildIncidentTimeline(events), [events]);

  const exportReport = async () => {
    try {
      const csv = toCsvIncidentReport(timeline);
      const path = `${FileSystem.cacheDirectory}security_incident_report.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path);
      } else {
        Alert.alert('Export Complete', 'Report saved to local cache.');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'Could not export report.');
    }
  };

  if (!allowed && profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorTitle}>Unauthorized Access</Text>
        <Text style={styles.errorSub}>You do not have permission to view the security dashboard.</Text>
      </View>
    );
  }

  const getSeverityBadgeStyle = (sev: string) => {
    if (sev === 'high' || sev === 'critical') return { bg: '#FEE2E2', text: COLORS.error, icon: 'alert-circle' };
    if (sev === 'medium') return { bg: '#FEF3C7', text: '#D97706', icon: 'warning' };
    return { bg: '#E0F2FE', text: '#0284C7', icon: 'information-circle' };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Security Dashboard</Text>
          <Text style={styles.subtitle}>System threat monitoring & anomaly detection</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { void load(); }} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      <View style={styles.topSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search security logs or events..."
            placeholderTextColor={COLORS.textMuted}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => { setQ(''); void load(); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <View style={styles.severityTabs}>
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
          <TouchableOpacity style={styles.exportBtn} onPress={exportReport}>
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{events.length}</Text>
            <Text style={styles.metricLabel}>Total Events</Text>
          </View>
          <View style={[styles.metricBox, anomalies.length > 0 && styles.metricBoxAlert]}>
            <Text style={[styles.metricVal, anomalies.length > 0 && { color: COLORS.error }]}>{anomalies.length}</Text>
            <Text style={styles.metricLabel}>Anomalies</Text>
          </View>
          <View style={styles.metricBox}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: anomalies.length > 0 ? COLORS.error : '#10B981' }]} />
              <Text style={styles.statusText}>{anomalies.length > 0 ? 'ALERT' : 'SECURE'}</Text>
            </View>
            <Text style={styles.metricLabel}>System Status</Text>
          </View>
        </View>
      </View>

      <FlatList removeClippedSubviews initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5}
        contentContainerStyle={styles.listContent}
        refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        data={events}
        keyExtractor={(i, idx) => i.id || String(idx)}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyBox}>
              <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Security Incidents</Text>
              <Text style={styles.emptyDesc}>No suspicious activities or logs match the selected filter criteria.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const badge = getSeverityBadgeStyle(item.severity);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Ionicons name={badge.icon as any} size={14} color={badge.text} />
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {(item.severity || 'info').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.timeText}>
                  {item.created_at_ms ? new Date(item.created_at_ms).toLocaleString() : 'Recent'}
                </Text>
              </View>
              <Text style={styles.eventText}>{item.event || 'Security log recorded'}</Text>
              {!!item.details && (
                <Text style={styles.detailsText} numberOfLines={2}>
                  {typeof item.details === 'object' ? JSON.stringify(item.details) : String(item.details)}
                </Text>
              )}
            </View>
          );
        }}
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
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, gap: 10 },
  severityTabs: { flexDirection: 'row', gap: 6, flex: 1 },
  tabChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  tabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  tabChipTextActive: { color: '#FFFFFF' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full },
  exportBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  metricsRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  metricBox: { flex: 1, backgroundColor: COLORS.surfaceAlt, padding: 10, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  metricBoxAlert: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  metricVal: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  metricLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '800', color: COLORS.textMain },
  listContent: { padding: SPACING.md, paddingBottom: 60 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginTop: SPACING.md },
  emptyDesc: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 280 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  timeText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  eventText: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  detailsText: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
});
