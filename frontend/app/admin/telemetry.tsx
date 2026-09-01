import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import {
  TelemetryErrorDoc,
  TelemetrySeverity,
  TelemetryCategory,
  subscribeToTelemetryErrors,
  updateTelemetryErrorStatus,
} from '@/lib/telemetry';
import { goBackOrReplace } from '@/lib/navigation';

export default function AdminTelemetryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [errors, setErrors] = useState<TelemetryErrorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'critical' | 'resolved'>('active');
  const [categoryFilter, setCategoryFilter] = useState<TelemetryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected error for modal
  const [selectedError, setSelectedError] = useState<TelemetryErrorDoc | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToTelemetryErrors(
      {
        statusFilter: activeTab === 'all' || activeTab === 'critical' ? 'all' : activeTab,
        maxLimit: 150,
      },
      (data) => {
        setErrors(data);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activeTab]);

  const metrics = useMemo(() => {
    const active = errors.filter((e) => e.status === 'active').length;
    const critical = errors.filter((e) => e.severity === 'critical' && e.status === 'active').length;
    const resolved = errors.filter((e) => e.status === 'resolved').length;
    return { active, critical, resolved, total: errors.length };
  }, [errors]);

  const filteredErrors = useMemo(() => {
    return errors.filter((item) => {
      // Tab filter
      if (activeTab === 'critical' && item.severity !== 'critical') return false;
      if (activeTab === 'active' && item.status !== 'active' && item.status !== 'investigating') return false;
      if (activeTab === 'resolved' && item.status !== 'resolved') return false;

      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchMsg = item.message.toLowerCase().includes(q);
        const matchEmail = item.user_email?.toLowerCase().includes(q);
        const matchRoute = item.screen_route.toLowerCase().includes(q);
        if (!matchMsg && !matchEmail && !matchRoute) return false;
      }

      return true;
    });
  }, [errors, activeTab, categoryFilter, searchQuery]);

  const handleUpdateStatus = async (status: 'active' | 'investigating' | 'resolved') => {
    if (!selectedError) return;
    setUpdating(true);
    try {
      await updateTelemetryErrorStatus(selectedError.id, status, adminNote);
      Alert.alert('Success', 'Status updated to ' + status + '.');
      setSelectedError(null);
      setAdminNote('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update status');
    } finally {
      setUpdating(false);
    }
  };

  const getSeverityBadge = (severity: TelemetrySeverity) => {
    switch (severity) {
      case 'critical':
        return { bg: '#FEE2E2', fg: '#DC2626', icon: 'flame', label: 'CRITICAL' };
      case 'high':
        return { bg: '#FFEDD5', fg: '#EA580C', icon: 'alert-circle', label: 'HIGH' };
      case 'medium':
        return { bg: '#FEF3C7', fg: '#D97706', icon: 'warning', label: 'MEDIUM' };
      default:
        return { bg: '#F1F5F9', fg: '#64748B', icon: 'information-circle', label: 'LOW' };
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>مُرَاقَبَةُ الأَخْطَاءِ وَالأَعْطَال</Text>
          <Text style={styles.headerTitle}>Real-Time Error Telemetry</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Metrics Banner */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, styles.metricCardActive]}>
          <Text style={styles.metricVal}>{metrics.active}</Text>
          <Text style={styles.metricLabel}>Active Issues</Text>
        </View>
        <View style={[styles.metricCard, styles.metricCardCritical]}>
          <Text style={[styles.metricVal, { color: '#DC2626' }]}>{metrics.critical}</Text>
          <Text style={styles.metricLabel}>Critical Alerts</Text>
        </View>
        <View style={[styles.metricCard, styles.metricCardResolved]}>
          <Text style={[styles.metricVal, { color: '#16A34A' }]}>{metrics.resolved}</Text>
          <Text style={styles.metricLabel}>Resolved</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student email, route, or error message..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        {[
          { key: 'active', label: 'Active Issues' },
          { key: 'critical', label: '🔴 Critical' },
          { key: 'all', label: 'All Errors' },
          { key: 'resolved', label: 'Resolved' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabButton, activeTab === t.key && styles.tabButtonActive]}
            onPress={() => setActiveTab(t.key as any)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading telemetry feed...</Text>
          </View>
        ) : filteredErrors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark" size={48} color="#16A34A" />
            <Text style={styles.emptyTitle}>All Systems Normal</Text>
            <Text style={styles.emptySubtitle}>
              No errors matching the selected filter. Live monitoring is active.
            </Text>
          </View>
        ) : (
          filteredErrors.map((err) => {
            const sev = getSeverityBadge(err.severity);
            const isResolved = err.status === 'resolved';

            return (
              <TouchableOpacity
                key={err.id}
                style={[styles.errorCard, isResolved && styles.errorCardResolved]}
                onPress={() => {
                  setSelectedError(err);
                  setAdminNote(err.admin_notes || '');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
                    <Ionicons name={sev.icon as any} size={12} color={sev.fg} />
                    <Text style={[styles.sevBadgeText, { color: sev.fg }]}>{sev.label}</Text>
                  </View>
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{err.category.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.routeBadge} numberOfLines={1}>
                    {err.screen_route}
                  </Text>
                </View>

                <Text style={styles.errorMsg} numberOfLines={2}>
                  {err.message}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.userInfoRow}>
                    <Ionicons name="person-outline" size={12} color="#64748B" />
                    <Text style={styles.userEmailText} numberOfLines={1}>
                      {err.user_email || ('User: ' + err.user_id.slice(0, 10) + '...')}
                    </Text>
                  </View>
                  <View style={styles.deviceInfoRow}>
                    <Ionicons name="phone-portrait-outline" size={12} color="#64748B" />
                    <Text style={styles.deviceText}>
                      {err.device_os} • v{err.app_version}
                    </Text>
                  </View>
                </View>

                {err.status === 'investigating' && (
                  <View style={styles.investigatingBanner}>
                    <Ionicons name="search" size={12} color="#D97706" />
                    <Text style={styles.investigatingText}>Under Investigation</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Error Details & Action Modal */}
      <Modal
        visible={!!selectedError}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedError(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedError && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Error Diagnostics</Text>
                    <Text style={styles.modalSub}>{selectedError.id}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedError(null)}
                  >
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Error Message */}
                <View style={styles.diagBox}>
                  <Text style={styles.diagLabel}>Error Message:</Text>
                  <Text style={styles.diagValue}>{selectedError.message}</Text>
                </View>

                {/* Metadata Grid */}
                <View style={styles.metaGrid}>
                  <View style={styles.metaGridCol}>
                    <Text style={styles.metaLabel}>Category:</Text>
                    <Text style={styles.metaVal}>{selectedError.category}</Text>
                  </View>
                  <View style={styles.metaGridCol}>
                    <Text style={styles.metaLabel}>Severity:</Text>
                    <Text style={styles.metaVal}>{selectedError.severity.toUpperCase()}</Text>
                  </View>
                  <View style={styles.metaGridCol}>
                    <Text style={styles.metaLabel}>Screen / Route:</Text>
                    <Text style={styles.metaVal}>{selectedError.screen_route}</Text>
                  </View>
                  <View style={styles.metaGridCol}>
                    <Text style={styles.metaLabel}>User Email:</Text>
                    <Text style={styles.metaVal}>{selectedError.user_email || 'Anonymous'}</Text>
                  </View>
                  <View style={styles.metaGridCol}>
                    <Text style={styles.metaLabel}>User UID:</Text>
                    <Text style={styles.metaVal}>{selectedError.user_id}</Text>
                  </View>
                  <View style={styles.metaGridCol}>
                    <Text style={styles.metaLabel}>App / OS:</Text>
                    <Text style={styles.metaVal}>
                      v{selectedError.app_version} ({selectedError.device_os})
                    </Text>
                  </View>
                </View>

                {/* Stack Trace Snippet */}
                {selectedError.stack_snippet && (
                  <View style={styles.stackBox}>
                    <Text style={styles.diagLabel}>Stack Trace Snippet:</Text>
                    <Text style={styles.stackText}>{selectedError.stack_snippet}</Text>
                  </View>
                )}

                {/* Admin Resolution Notes */}
                <Text style={styles.diagLabel}>Admin Resolution Notes:</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add notes about fix, root cause, or follow-up with student..."
                  placeholderTextColor="#94A3B8"
                  value={adminNote}
                  onChangeText={setAdminNote}
                  multiline
                  numberOfLines={3}
                />

                {/* Action Buttons */}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.investigateBtn]}
                    onPress={() => handleUpdateStatus('investigating')}
                    disabled={updating}
                  >
                    <Ionicons name="search" size={16} color="#D97706" />
                    <Text style={styles.investigateBtnText}>Investigating</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.resolveBtn]}
                    onPress={() => handleUpdateStatus('resolved')}
                    disabled={updating}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  arabicHeader: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricCardActive: {
    borderColor: '#38BDF8',
  },
  metricCardCritical: {
    borderColor: '#EF4444',
  },
  metricCardResolved: {
    borderColor: '#10B981',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  metricLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: SPACING.md,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 12,
    color: '#F8FAFC',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: SPACING.md,
    marginTop: 8,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  tabButtonActive: {
    backgroundColor: '#334155',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 8,
    paddingBottom: 40,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.lg,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
    ...SHADOWS.card,
  },
  errorCardResolved: {
    opacity: 0.65,
    borderColor: '#10B981',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  sevBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  catBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  routeBadge: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '600',
    flex: 1,
  },
  errorMsg: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 6,
    marginTop: 2,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  userEmailText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deviceText: {
    fontSize: 10,
    color: '#64748B',
  },
  investigatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  investigatingText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSub: {
    fontSize: 10,
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    gap: 10,
    paddingBottom: 24,
  },
  diagBox: {
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.md,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  diagLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  diagValue: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaGridCol: {
    width: '48%',
    backgroundColor: '#1E293B',
    padding: 8,
    borderRadius: RADIUS.sm,
  },
  metaLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '700',
    marginTop: 2,
  },
  stackBox: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  stackText: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  noteInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#F8FAFC',
    minHeight: 60,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    gap: 6,
  },
  investigateBtn: {
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  investigateBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  resolveBtn: {
    backgroundColor: '#10B981',
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
