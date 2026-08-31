import React, { PropsWithChildren, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
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
import { SkeletonShimmer } from './ui/SkeletonShimmer';

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

type ScalePressableProps = PropsWithChildren<PressableProps & {
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}>;

export function ScalePressable({
  children,
  style,
  onPress,
  onLongPress,
  testID,
  disabled,
  haptic = true,
  ...pressableProps
}: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      disabled={disabled}
      onPressIn={() => {
        if (haptic && !disabled) {
          Haptics.selectionAsync().catch(() => {});
        }
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
      }}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }).start()}
      {...pressableProps}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function AppCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.emptyStateCard}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name={icon} size={32} color={COLORS.secondary} />
      </View>
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      <Text style={styles.emptyText}>{message}</Text>
      {action ? (
        <Pressable style={styles.emptyActionBtn} onPress={action.onPress}>
          <Text style={styles.emptyActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
      {children}
    </View>
  );
}



export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonShimmer height={18} width="45%" borderRadius={8} style={{ marginBottom: 4 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonShimmer key={String(i)} height={12} width={i === lines - 1 ? '60%' : '100%'} borderRadius={6} style={{ marginTop: 6 }} />
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

type AppInputProps = TextInputProps & {
  label: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  error?: string;
  success?: boolean;
  rightElement?: React.ReactNode;
  prefix?: React.ReactNode;
};

export const AppInput = React.memo(function AppInput({
  label,
  leftIcon,
  style,
  onFocus,
  onBlur,
  error,
  success,
  rightElement,
  prefix,
  ...props
}: AppInputProps) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const animateFocus = React.useCallback((toValue: 0 | 1) => {
    Animated.timing(focusAnim, {
      toValue,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focusAnim]);

  const handleFocus = React.useCallback((e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    animateFocus(1);
    onFocus?.(e);
  }, [animateFocus, onFocus]);

  const handleBlur = React.useCallback((e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    animateFocus(0);
    onBlur?.(e);
  }, [animateFocus, onBlur]);

  const animatedInputStyle = React.useMemo(() => {
    if (error) {
      return { borderColor: COLORS.error };
    }
    if (success) {
      return { borderColor: COLORS.success };
    }
    return {
      borderColor: focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#E5E5E5', COLORS.primary],
      }),
    };
  }, [focusAnim, error, success]);

  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, error ? { color: COLORS.error } : null]}>{label}</Text>
      <Animated.View style={[styles.inputRow, animatedInputStyle]}>
        {leftIcon ? <Ionicons name={leftIcon} size={18} color={error ? COLORS.error : COLORS.textMuted} style={{ marginRight: 4 }} /> : null}
        {prefix ? <View style={{ marginRight: 6 }}>{prefix}</View> : null}
        <TextInput
          {...props}
          style={styles.input}
          placeholderTextColor={COLORS.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {rightElement}
      </Animated.View>
      {error ? (
        <Text style={[styles.inputErrorText, { color: COLORS.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});


export { UIButton } from './ui/Button';
export { FullScreenLoader, InlineError, RetryState } from './ui/ScreenState';
export { LegalDocScreen } from './ui/LegalDocScreen';
export { SectionCard } from './ui/SectionCard';
export { SkeletonShimmer, CourseCardSkeleton, NoticeSkeleton } from './ui/SkeletonShimmer';

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8E5',
    padding: 24,
    ...SHADOWS.card,
  },
  emptyStateCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
    ...SHADOWS.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyActionBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  field: { gap: SPACING.xs },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6A6A6A',
    lineHeight: 16,
  },
  inputRow: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
  },
  input: {
    flex: 1,
    height: '100%',
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    paddingVertical: 0,
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
  inputErrorText: {
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 4,
    marginTop: 2,
  },
});

export * from './ui/ScreenRefreshControl';
