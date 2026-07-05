import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonShimmer: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = RADIUS.md,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: isDark ? '#334155' : '#E2E8F0',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const CourseCardSkeleton: React.FC = () => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }]}>
      <SkeletonShimmer height={140} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
      <SkeletonShimmer width="80%" height={20} style={{ marginBottom: SPACING.xs }} />
      <SkeletonShimmer width="50%" height={14} style={{ marginBottom: SPACING.md }} />
      <View style={styles.footerRow}>
        <SkeletonShimmer width={80} height={16} />
        <SkeletonShimmer width={60} height={28} borderRadius={RADIUS.full} />
      </View>
    </View>
  );
};

export const NoticeSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.noticeCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.sm }}>
        <SkeletonShimmer width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1 }}>
          <SkeletonShimmer width="60%" height={16} style={{ marginBottom: 4 }} />
          <SkeletonShimmer width="30%" height={12} />
        </View>
      </View>
      <SkeletonShimmer width="95%" height={14} style={{ marginBottom: 4 }} />
      <SkeletonShimmer width="80%" height={14} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
});
