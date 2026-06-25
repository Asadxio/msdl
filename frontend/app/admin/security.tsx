import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { fetchSecurityEvents, detectAnomalies, buildIncidentTimeline, toCsvIncidentReport, type SecuritySeverity } from '@/lib/securityMonitoring';
import { useAuth } from '@/context/AuthContext';
import { ScreenRefreshControl } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hasPermission } from '@/lib/rbac';

export default function SecurityDashboard() {
  const { profile } = useAuth();
  const allowed = hasPermission(profile, 'admin.analytics.read');
  const [events, setEvents] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<SecuritySeverity | 'all'>('all');

  const load = async () => {
    if (!allowed) return;
    const items = await fetchSecurityEvents({ q, severity, pageSize: 100 }).catch(() => []);
    setEvents(items);
  };
  useEffect(() => { load(); }, [allowed, severity]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await load();
  });

  const anomalies = useMemo(() => detectAnomalies(events), [events]);
  const timeline = useMemo(() => buildIncidentTimeline(events), [events]);

  const exportReport = async () => {
    const csv = toCsvIncidentReport(timeline);
    const path = `${FileSystem.cacheDirectory}security_incident_report.csv`;
    await FileSystem.writeAsStringAsync(path, csv);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  };

  if (!allowed) return <View style={styles.center}><Text>Unauthorized</Text></View>;

  return <View style={styles.container}>
    <Text style={styles.title}>Security Incident Dashboard</Text>
    <TextInput style={styles.input} placeholder="Search events" value={q} onChangeText={setQ} onSubmitEditing={load} />
    <View style={styles.row}><TouchableOpacity onPress={() => setSeverity(severity === 'all' ? 'high' : 'all')}><Text>Severity: {severity}</Text></TouchableOpacity><TouchableOpacity onPress={exportReport}><Text>Export CSV</Text></TouchableOpacity></View>
    <Text style={styles.subtitle}>Anomalies: {anomalies.length}</Text>
    <Text style={styles.subtitle}>Heatmap proxy (events loaded): {events.length}</Text>
    <FlatList refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />} data={events} keyExtractor={(i) => i.id} renderItem={({ item }) => <View style={styles.card}><Text>{item.event}</Text><Text>{item.severity || 'n/a'} • {item.created_at_ms || ''}</Text></View>} />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 12 }, title: { fontSize: 20, fontWeight: '700' }, subtitle: { marginVertical: 6 }, row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }, input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8 }, card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
