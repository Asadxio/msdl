import React, { PropsWithChildren, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '@/constants/theme';

export function FadeInView({ children, style, delay = 0 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; delay?: number }>) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function ScalePressable({
  children,
  style,
  onPress,
  testID,
  disabled,
  haptic = true,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; disabled?: boolean; haptic?: boolean }>) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      disabled={disabled}
      onPressIn={() => {
        if (haptic && !disabled) {
          Haptics.selectionAsync().catch(() => {});
        }
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
      }}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function AppCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={36} color={COLORS.textMuted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}



export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={String(i)} style={[styles.skeletonLine, i === lines - 1 && { width: '60%' }]} />
      ))}
    </View>
  );
}

export function FeedbackBanner({ type, message }: { type: 'success' | 'error'; message: string }) {
  const isError = type === 'error';
  return (
    <View style={[styles.feedback, isError ? styles.feedbackError : styles.feedbackSuccess]}>
      <Ionicons name={isError ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={16} color={isError ? COLORS.error : COLORS.primary} />
      <Text style={[styles.feedbackText, { color: isError ? COLORS.error : COLORS.text }]}>{message}</Text>
    </View>
  );
}

export function AppInput({
  label,
  focused,
  leftIcon,
  style,
  ...props
}: TextInputProps & { label: string; focused?: boolean; leftIcon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle> }) {
  const [internalFocused, setInternalFocused] = React.useState(false);
  const isFocused = focused ?? internalFocused;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, isFocused && styles.inputFocused]}>
        {leftIcon ? <Ionicons name={leftIcon} size={18} color={COLORS.textMuted} /> : null}
        <TextInput
          {...props}
          style={styles.input}
          placeholderTextColor={COLORS.textMuted}
          onFocus={(e) => {
            setInternalFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setInternalFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  field: { gap: SPACING.xs },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
  },
  inputRow: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    paddingVertical: 12,
  },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  skeletonHeader: {
    height: 18,
    width: '45%',
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    width: '100%',
  },
  feedback: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  feedbackError: {
    borderColor: '#F9C7C3',
    backgroundColor: '#FDECEC',
  },
  feedbackSuccess: {
    borderColor: '#B6E9CB',
    backgroundColor: '#E6F7EE',
  },
  feedbackText: {
    ...TYPOGRAPHY.body,
    flex: 1,
  },
});
