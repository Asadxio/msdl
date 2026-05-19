import React, { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, SHADOWS } from '@/constants/theme';
import { UX_RADIUS, UX_SPACING } from '@/theme/tokens';

export function SectionCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: UX_RADIUS.lg,
    padding: UX_SPACING.md,
    ...SHADOWS.card,
  },
});
