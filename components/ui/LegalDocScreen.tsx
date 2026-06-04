import React, { ReactNode } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';

export function LegalDocScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/more')} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text allowFontScaling style={styles.title}>{title}</Text>
        <Text allowFontScaling style={styles.subtitle}>{subtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginBottom: SPACING.xs },
  backText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  content: { padding: SPACING.md },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.card, gap: 10 },
});
