import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goBackOrReplace } from '@/lib/navigation';
import IslamicDashboardWidget from '@/components/IslamicDashboardWidget';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { ScalePressable } from '@/components/ui';

export default function IslamicDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.sm }]} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/more/applications')} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Applications</Text>
          <Text style={styles.title}>Islamic Dashboard</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeader}>Overview</Text>
        <Text style={styles.sectionText}>Your complete Islamic dashboard for prayer times, Hijri date, Qibla direction, and daily worship details.</Text>
      </View>

      <View style={styles.widgetCard}>
        <IslamicDashboardWidget />
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.sectionHeader}>What you can find here</Text>
        <Text style={styles.sectionText}>A live prayer countdown, daily Hijri date, qibla direction guidance, and prayer timing details in a polished dashboard layout.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  backButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F2E7C8',
    ...SHADOWS.card,
  },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { ...TYPOGRAPHY.title, color: COLORS.text, letterSpacing: -0.6 },
  sectionCard: {
    marginBottom: SPACING.lg,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  sectionHeader: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  sectionText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },
  widgetCard: { borderRadius: 28, overflow: 'hidden', backgroundColor: 'transparent', marginBottom: SPACING.lg },
  detailsCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    padding: SPACING.md,
    ...SHADOWS.card,
  },
});
