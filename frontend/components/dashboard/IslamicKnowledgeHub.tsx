import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { RADIUS, SPACING, SHADOWS } from '@/constants/theme';

export function IslamicKnowledgeHub() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const handlePress = (route: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(route as any);
  };

  const HUB_ITEMS = [
    {
      id: 'hadith',
      titleEn: 'Hadith Library',
      titleUr: 'کتبِ حدیث',
      subtitle: 'Kutub as-Sittah',
      badge: '7 Books',
      icon: 'library-outline' as const,
      route: '/hadith',
      accent: '#059669',
      bgLight: '#ECFDF5',
      bgDark: '#0D2721',
    },
    {
      id: 'duas',
      titleEn: 'Duas & Azkar',
      titleUr: 'حصن المسلم',
      subtitle: 'Daily Masnoon',
      badge: '10 Categories',
      icon: 'heart-outline' as const,
      route: '/duas',
      accent: '#D97706',
      bgLight: '#FEF3C7',
      bgDark: '#2A200B',
    },
    {
      id: 'asma',
      titleEn: '99 Names',
      titleUr: 'اسماء الحسنیٰ',
      subtitle: 'Divine Attributes',
      badge: 'All 99',
      icon: 'sparkles-outline' as const,
      route: '/asma-ul-husna',
      accent: '#0284C7',
      bgLight: '#E0F2FE',
      bgDark: '#08253B',
    },
    {
      id: 'salah',
      titleEn: 'Salah Guide',
      titleUr: 'رہنمائے نماز',
      subtitle: 'Dual Fiqh Steps',
      badge: '14 Steps',
      icon: 'body-outline' as const,
      route: '/salah-guide',
      accent: '#7C3AED',
      bgLight: '#EDE9FE',
      bgDark: '#221538',
    },
    {
      id: 'kalmas',
      titleEn: 'Six Kalmas',
      titleUr: 'چھ کلمے',
      subtitle: 'Core Creed & Faith',
      badge: '6 Kalmas',
      icon: 'shield-checkmark-outline' as const,
      route: '/six-kalmas',
      accent: '#059669',
      bgLight: '#ECFDF5',
      bgDark: '#0D2721',
    },
    {
      id: 'zakat',
      titleEn: 'Zakat Calculator',
      titleUr: 'حسابِ زکوٰۃ',
      subtitle: 'Gold & Silver Nisab',
      badge: '2.5% Guide',
      icon: 'calculator-outline' as const,
      route: '/zakat',
      accent: '#B45309',
      bgLight: '#FEF3C7',
      bgDark: '#2A200B',
    },
    {
      id: 'quran',
      titleEn: 'Holy Quran',
      titleUr: 'قرآن کریم',
      subtitle: 'Read & Khatam',
      badge: '114 Surahs',
      icon: 'book-outline' as const,
      route: '/quran',
      accent: '#C6A15B',
      bgLight: '#FCF9F0',
      bgDark: '#2C2513',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconTag, { backgroundColor: isDark ? '#1C4A3E' : '#ECFDF5' }]}>
            <Ionicons name="moon-outline" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Islamic Knowledge Hub</Text>
        </View>

        <TouchableOpacity
          onPress={() => handlePress('/more')}
          style={styles.viewAllBtn}
          accessibilityRole="button"
          accessibilityLabel="View all Islamic modules"
        >
          <Text style={[styles.viewAllText, { color: colors.primary }]}>Explore All</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {HUB_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.card,
              {
                backgroundColor: isDark ? item.bgDark : colors.surface,
                borderColor: isDark ? '#1C4A3E' : colors.border,
              },
            ]}
            onPress={() => handlePress(item.route)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${item.titleEn}: ${item.subtitle}`}
          >
            <View style={styles.cardTopRow}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : item.bgLight },
                ]}
              >
                <Ionicons name={item.icon} size={20} color={item.accent} />
              </View>
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{item.badge}</Text>
              </View>
            </View>

            <Text style={[styles.cardTitleEn, { color: colors.text }]} numberOfLines={1}>
              {item.titleEn}
            </Text>
            <Text style={[styles.cardTitleUr, { color: colors.gold }]} numberOfLines={1}>
              {item.titleUr}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconTag: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    paddingVertical: 4,
  },
  card: {
    width: 150,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardTitleEn: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardTitleUr: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
});
