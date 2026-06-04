import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type UploadProgressProps = {
  progress: number;
  label?: string;
};

export function UploadProgress({ progress, label = 'Uploading...' }: UploadProgressProps) {
  const safeProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0;

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ now: safeProgress, min: 0, max: 100 }}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percentage}>{`${Math.round(safeProgress)}%`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safeProgress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: SPACING.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
  },
  percentage: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: RADIUS.full || 999,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full || 999,
    ...SHADOWS.card,
  },
});
