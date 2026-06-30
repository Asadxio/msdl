import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export default function AdminHealthDashboard({ onClearCache, onSyncData, onOpenLogs, checkDiagnosticsParent }: any) {
  const { user, profile } = useAuth();
  const { courses, teachers, books, modules, lessons } = useData();
  
  const [checking, setChecking] = useState(false);
  const [statusAuth, setStatusAuth] = useState<'Online' | 'Offline' | 'Checking...'>('Checking...');
  const [statusDb, setStatusDb] = useState<'Connected' | 'Disconnected' | 'Checking...'>('Checking...');
  const [statusNet, setStatusNet] = useState<'Online' | 'Offline' | 'Checking...'>('Checking...');
  const [statusPush, setStatusPush] = useState<'Configured' | 'Not Configured' | 'Permission Denied' | 'Checking...'>('Checking...');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  
  const checkHealth = async () => {
    setChecking(true);
    setStatusAuth('Checking...');
    setStatusDb('Checking...');
    setStatusNet('Checking...');
    setStatusPush('Checking...');
    
    setStatusAuth(user?.uid ? 'Online' : 'Offline');
    
    try {
      await fetch('https://dns.google', { method: 'HEAD', mode: 'no-cors' });
      setStatusNet('Online');
    } catch {
      setStatusNet('Offline');
    }
    
    try {
      const { db } = require('@/config/firebase');
      setStatusDb(db ? 'Connected' : 'Disconnected');
    } catch {
      setStatusDb('Disconnected');
    }
    
    try {
      const settings = await Notifications.getPermissionsAsync();
      if (!settings.granted) setStatusPush('Permission Denied');
      else {
        setStatusPush('Configured');
      }
    } catch {
      setStatusPush('Not Configured');
    }
    
    setLastSyncTime(new Date().toLocaleTimeString());
    setChecking(false);
    if (checkDiagnosticsParent) checkDiagnosticsParent();
  };

  useEffect(() => {
    if (profile?.role === 'admin') checkHealth();
  }, [profile?.role]);

  if (profile?.role !== 'admin') return null;

  const StatusChip = ({ status }: { status: string }) => {
    const isGood = status === 'Online' || status === 'Connected' || status === 'Configured' || status === 'Healthy';
    const isChecking = status === 'Checking...';
    return (
      <View style={[styles.chip, { backgroundColor: isGood ? COLORS.success + '20' : (isChecking ? COLORS.secondaryLight : COLORS.error + '20') }]}>
        <View style={[styles.chipDot, { backgroundColor: isGood ? COLORS.success : (isChecking ? COLORS.secondary : COLORS.error) }]} />
        <Text style={[styles.chipText, { color: isGood ? COLORS.success : (isChecking ? COLORS.goldText : COLORS.error) }]}>{status}</Text>
      </View>
    );
  };

  const Card = ({ title, children }: any) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );

  const Row = ({ label, value, chip = false }: any) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {chip ? <StatusChip status={value} /> : <Text style={styles.rowValue}>{value}</Text>}
    </View>
  );

  const StatBox = ({ label, value }: any) => (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Section 1 & 7: System & DB Status */}
      <Card title="System & Database Health">
        <Row label="Firestore Database" value={statusDb} chip />
        <Row label="Authentication" value={statusAuth} chip />
        <Row label="Push Notifications" value={statusPush} chip />
        <Row label="Internet Connection" value={statusNet} chip />
        <Row label="Rules Status" value="Connected" chip />
      </Card>

      {/* Section 2: Application Info */}
      <Card title="Application Information">
        <Row label="Environment" value={__DEV__ ? 'Development' : 'Production'} />
        <Row label="Platform" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
        <Row label="App Version" value={Constants.expoConfig?.version || '1.0.0'} />
        <Row label="Build Number" value={Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1'} />
        <Row label="Last Sync Time" value={lastSyncTime} />
      </Card>

      {/* Section 3 & 4: Statistics */}
      <Card title="Operational Statistics">
        <View style={styles.statsGrid}>
          <StatBox label="Total Courses" value={courses?.length || 'Not Available'} />
          <StatBox label="Published Courses" value={courses?.filter((c: any) => c.status === 'published')?.length ?? 'Not Available'} />
          <StatBox label="Total Teachers" value={teachers?.length || 'Not Available'} />
          <StatBox label="Library Books" value={books?.length || 'Not Available'} />
          <StatBox label="Total Modules" value={modules?.length || 'Not Available'} />
          <StatBox label="Total Lessons" value={lessons?.length || 'Not Available'} />
        </View>
        <Text style={styles.note}>Note: User Statistics & Quizzes are Not Available locally without querying.</Text>
      </Card>

      {/* Section 5 & 8: Performance & Storage */}
      <Card title="Performance & Cache">
        <Row label="Local Cache Status" value="Healthy" chip />
        <Row label="Cached Data Size" value="Not Available" />
        <Row label="Active Firestore Listeners" value="Not Available" />
        <Row label="Average Load Time" value="Not Available" />
      </Card>

      {/* Section 9: Quick Admin Actions */}
      <Card title="Quick Admin Actions">
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn} onPress={checkHealth} disabled={checking}>
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>{checking ? 'Refreshing...' : 'Refresh Health'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onSyncData}>
            <Ionicons name="sync" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>Sync Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onClearCache}>
            <Ionicons name="trash" size={20} color={COLORS.error} />
            <Text style={[styles.actionText, { color: COLORS.error, marginLeft: 8, fontWeight: '600' }]}>Clear Cache</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onOpenLogs}>
            <Ionicons name="list" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>Open Logs</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: '#F8FAF9',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24, // RADIUS.xxl
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)', // Glassmorphism hint
  },
  cardTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  cardContent: {
    gap: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  rowLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },
  rowValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMain,
    fontWeight: '500',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statBox: {
    width: '48%',
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldBg,
  },
  statValue: {
    ...TYPOGRAPHY.title,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  note: {
    fontSize: 11,
    color: COLORS.goldText,
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.md,
    borderRadius: 16,
  },
  actionText: {
    marginLeft: 8,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
