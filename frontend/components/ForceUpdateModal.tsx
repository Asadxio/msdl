/**
 * ForceUpdateModal.tsx
 * Enterprise Force Update & Minimum Version Gate Modal for Madrasatu-s-Salikat.
 * Provides non-dismissible gate for hard updates and dismissible banner for soft updates.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  BackHandler,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  type VersionStatus,
  getCurrentAppVersion,
  PLAY_STORE_WEB_URL,
} from '@/lib/versionCheck';

const SOFT_UPDATE_SNOOZE_KEY = '@mslb_soft_update_snooze_until';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ForceUpdateModalProps {
  status: VersionStatus;
  onRefresh?: () => void;
}

export function ForceUpdateModal({ status, onRefresh }: ForceUpdateModalProps) {
  const [softUpdateSnoozed, setSoftUpdateSnoozed] = useState(false);
  const currentApp = getCurrentAppVersion();

  // Check if soft update was snoozed
  useEffect(() => {
    if (status.type === 'soft_update') {
      AsyncStorage.getItem(SOFT_UPDATE_SNOOZE_KEY).then((val) => {
        if (val) {
          const snoozeUntil = parseInt(val, 10);
          if (Date.now() < snoozeUntil) {
            setSoftUpdateSnoozed(true);
          }
        }
      }).catch(() => {});
    }
  }, [status.type]);

  // Prevent Android hardware back button from closing a hard force update or maintenance modal
  useEffect(() => {
    if (status.type === 'force_update' || status.type === 'maintenance') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        return true; // prevent exit/dismiss
      });
      return () => backHandler.remove();
    }
  }, [status.type]);

  const handleOpenStore = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(PLAY_STORE_WEB_URL);
      }
    } catch {
      await Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
    }
  };

  const handleSnoozeSoftUpdate = async () => {
    setSoftUpdateSnoozed(true);
    try {
      const snoozeUntil = Date.now() + SNOOZE_DURATION_MS;
      await AsyncStorage.setItem(SOFT_UPDATE_SNOOZE_KEY, snoozeUntil.toString());
    } catch {}
  };

  // If app is up to date or soft update is snoozed, render nothing
  if (status.type === 'ok' || (status.type === 'soft_update' && softUpdateSnoozed)) {
    return null;
  }

  // 1. Emergency Maintenance Mode
  if (status.type === 'maintenance') {
    return (
      <Modal visible={true} transparent={false} animationType="fade">
        <StatusBar barStyle="dark-content" backgroundColor="#F7F2E9" />
        <View style={styles.fullscreenContainer}>
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="construct-outline" size={42} color="#D97706" />
            </View>
            <Text style={styles.title}>Scheduled Maintenance</Text>
            <Text style={styles.message}>{status.message}</Text>
            {onRefresh && (
              <TouchableOpacity style={styles.primaryButton} onPress={onRefresh} activeOpacity={0.85}>
                <Ionicons name="refresh-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Check Status Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // 2. Hard Gate: Force Update Required
  if (status.type === 'force_update') {
    return (
      <Modal visible={true} transparent={false} animationType="fade">
        <StatusBar barStyle="dark-content" backgroundColor="#F7F2E9" />
        <View style={styles.fullscreenContainer}>
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="arrow-up-circle-outline" size={44} color="#DC2626" />
            </View>

            <Text style={styles.title}>{status.title}</Text>
            <Text style={styles.message}>{status.message}</Text>

            <View style={styles.versionBadgeContainer}>
              <View style={styles.versionBadge}>
                <Text style={styles.versionLabel}>Installed</Text>
                <Text style={styles.versionValue}>v{currentApp.version}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.textMuted} />
              <View style={[styles.versionBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.versionLabel, { color: '#15803D' }]}>Required</Text>
                <Text style={[styles.versionValue, { color: '#15803D' }]}>v{status.minVersion}</Text>
              </View>
            </View>

            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
                <Text style={styles.bulletText}>Essential security & database synchronization</Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="sparkles" size={16} color={COLORS.secondary || '#D97706'} />
                <Text style={styles.bulletText}>Latest Islamic curriculum & bug fixes</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleOpenStore(status.updateUrl)}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Update on Google Play</Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Madrasatu-s-Salikat Lil Banat • Official Play Store Release
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // 3. Soft Update (Recommended update available)
  if (status.type === 'soft_update') {
    return (
      <Modal visible={true} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />

            <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE', marginBottom: 12 }]}>
              <Ionicons name="sparkles-outline" size={32} color="#0284C7" />
            </View>

            <Text style={styles.sheetTitle}>{status.title}</Text>
            <Text style={styles.sheetMessage}>{status.message}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSnoozeSoftUpdate}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1.5, marginTop: 0 }]}
                onPress={() => handleOpenStore(status.updateUrl)}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-google-playstore" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryButtonText}>Update Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#F7F2E9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  versionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: SPACING.lg,
  },
  versionBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 2,
  },
  bulletList: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 10,
    marginBottom: SPACING.xl,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    fontSize: 13,
    color: COLORS.textMain,
    flex: 1,
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    ...SHADOWS.header,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6,
    textAlign: 'center',
  },
  sheetMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: '#F1F5F9',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
