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
  arabicTitle,
  iconName = 'shield-checkmark',
  children,
}: {
  title: string;
  subtitle: string;
  arabicTitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#003D2E" />

      {/* ─── Islamic Hero Header ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => goBackOrReplace(router, '/more')}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color="#C8A84E" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.sealBadge}>
            <Ionicons name="ribbon" size={14} color="#C8A84E" />
            <Text style={styles.sealBadgeText}>OFFICIAL REGULATION</Text>
          </View>
        </View>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
          <Text style={styles.madrasaName}>MADRASATU-S-SALIKAT LIL BANAT</Text>
          {arabicTitle ? <Text style={styles.arabicTitle}>{arabicTitle}</Text> : null}
          <Text allowFontScaling style={styles.title}>{title}</Text>
          <Text allowFontScaling style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* ─── Document Body ─── */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {children}

          {/* Institutional Compliance Footer */}
          <View style={styles.complianceFooter}>
            <Ionicons name={iconName} size={24} color="#005F46" />
            <View style={styles.footerTextWrap}>
              <Text style={styles.footerHeading}>Madrasatu-s-Salikat Lil Banat</Text>
              <Text style={styles.footerSub}>Academic Directorate & Islamic Ethics Governance Council</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: '#003D2E',
    borderBottomWidth: 2,
    borderBottomColor: '#C8A84E',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  backText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,168,78,0.15)',
    borderWidth: 1,
    borderColor: '#C8A84E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  sealBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C8A84E',
    letterSpacing: 0.8,
  },
  headerTitleBlock: {
    marginTop: 4,
  },
  bismillah: {
    fontSize: 14,
    color: '#C8A84E',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  madrasaName: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  arabicTitle: {
    fontSize: 16,
    color: '#C8A84E',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  complianceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: RADIUS.md,
  },
  footerTextWrap: {
    flex: 1,
  },
  footerHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#005F46',
  },
  footerSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});
