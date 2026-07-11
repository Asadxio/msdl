import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/theme';
import { UX_RADIUS, UX_SPACING } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function UIButton({ label, onPress, loading, disabled, variant = 'primary', style, accessibilityLabel }: Props) {
  const v = variantStyles[variant];
  const isDisabled = !!disabled || !!loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, v.base, isDisabled && styles.disabled, pressed && !isDisabled && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator size="small" color={v.text.color} /> : <Text style={[styles.text, v.text]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: { fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
});

const variantStyles = {
  primary: StyleSheet.create({ base: { backgroundColor: COLORS.primary }, text: { color: '#fff' } }),
  secondary: StyleSheet.create({ base: { backgroundColor: COLORS.secondaryLight }, text: { color: COLORS.text } }),
  ghost: StyleSheet.create({ base: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border }, text: { color: COLORS.text } }),
};
