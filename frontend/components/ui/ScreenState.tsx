import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { UIButton } from '@/components/ui/Button';

export function useMinimumLoading(active: boolean, minMs = 350): boolean {
  const [visible, setVisible] = useState(active);
  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(false), minMs);
    return () => clearTimeout(timer);
  }, [active, minMs]);
  return visible;
}

export const FullScreenLoader = React.memo(function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.fullscreen}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text allowFontScaling style={styles.busyText}>{label}</Text>
    </View>
  );
});

export const InlineLoader = React.memo(function InlineLoader({ label }: { label: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.busyRow}>
      <ActivityIndicator size="small" color={COLORS.primary} />
      <Text allowFontScaling style={styles.busyText}>{label}</Text>
    </View>
  );
});

export const InlineError = React.memo(function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={styles.errorWrap}>
      <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
      <Text allowFontScaling style={styles.errorText}>{message}</Text>
    </View>
  );
});

export const RetryState = React.memo(function RetryState({ title, message, actionLabel = 'Retry', onRetry }: { title: string; message: string; actionLabel?: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="summary" style={styles.stateWrap}>
      <Ionicons name="warning-outline" size={28} color={COLORS.error} />
      <Text allowFontScaling style={styles.stateTitle}>{title}</Text>
      <Text allowFontScaling style={styles.stateMessage}>{message}</Text>
      <UIButton label={actionLabel} onPress={onRetry} accessibilityLabel={`${actionLabel}. ${title}`} />
    </View>
  );
});

export const OfflineState = React.memo(function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <View accessibilityRole="summary" style={styles.stateWrap}>
      <Ionicons name="cloud-offline-outline" size={32} color={COLORS.textMuted} />
      <Text allowFontScaling style={styles.stateTitle}>You appear to be offline</Text>
      <Text allowFontScaling style={styles.stateMessage}>Please check your network connection and try again.</Text>
      {onRetry ? (
        <UIButton label="Reconnect" onPress={onRetry} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
});

export const EmptyState = React.memo(function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View accessibilityRole="summary" style={styles.stateWrap}>
      <Ionicons name={icon} size={30} color={COLORS.textMuted} />
      <Text allowFontScaling style={styles.stateTitle}>{title}</Text>
      <Text allowFontScaling style={styles.stateMessage}>{message}</Text>
      {action ? (
        <UIButton label={action.label} onPress={action.onPress} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
});

export function useFeedbackMessage(success: string, error: string) {
  return useMemo(() => (error ? `Error: ${error}` : success), [success, error]);
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.background, padding: SPACING.lg },
  errorWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: '#FDECEC', borderWidth: 1, borderColor: COLORS.error, borderRadius: RADIUS.md, padding: SPACING.sm },
  errorText: { ...TYPOGRAPHY.body, color: COLORS.error, flex: 1 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  busyText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  stateWrap: { alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.sm },
  stateTitle: { ...TYPOGRAPHY.heading, color: COLORS.textMain, textAlign: 'center' },
  stateMessage: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center' },
});
