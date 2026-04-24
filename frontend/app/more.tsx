import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { ScalePressable } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

type MoreItem = { label: string; icon: keyof typeof Ionicons.glyphMap; route: string; adminOnly?: boolean };

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const MORE_ITEMS: MoreItem[] = [
    { label: 'Library', icon: 'library-outline', route: '/library' },
    { label: 'Attendance', icon: 'calendar-outline', route: '/attendance' },
    { label: 'Quiz', icon: 'help-circle-outline', route: '/quiz' },
    { label: 'Recordings', icon: 'play-circle-outline', route: '/recordings' },
    { label: 'Status', icon: 'radio-outline', route: '/status' },
    { label: 'Teachers', icon: 'people-outline', route: '/teachers' },
    { label: 'Settings', icon: 'settings-outline', route: '/settings' },
    { label: 'About & Donations', icon: 'heart-outline', route: '/payment' },
    { label: 'Manage Academics', icon: 'school-outline', route: '/admin/manage-academics', adminOnly: true },
    { label: 'Admin Payments', icon: 'card-outline', route: '/admin/payments', adminOnly: true },
    { label: 'Admin Users', icon: 'people-circle-outline', route: '/admin/users', adminOnly: true },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Explore tools and settings</Text>
      </View>

      <View style={styles.grid}>
        {MORE_ITEMS.filter((item) => (item.adminOnly ? isAdmin : true)).map((item) => (
          <ScalePressable key={item.route} style={styles.card} onPress={() => router.push(item.route)}>
            <Ionicons name={item.icon} size={20} color={COLORS.primary} />
            <Text style={styles.cardText}>{item.label}</Text>
          </ScalePressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.lg },
  header: { paddingBottom: SPACING.md },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  grid: { gap: SPACING.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  cardText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600' },
});
