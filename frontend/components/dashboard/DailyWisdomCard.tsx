import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Share } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface DailyWisdomCardProps {
  arabic: string;
  translation: string;
  reference: string;
}

export function DailyWisdomCard({ arabic, translation, reference }: DailyWisdomCardProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const handleShareWhatsApp = async () => {
    const msg = `✨ Daily Wisdom — Suffah ✨\n\n${arabic}\n\n"${translation}"\n— ${reference}\n\n🕌 Suffah • Digital Madrasa Portal`;
    try {
      await Share.share({
        message: msg,
        title: 'Daily Wisdom — Suffah',
      });
    } catch {
      const encoded = encodeURIComponent(msg);
      Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() =>
        Linking.openURL(`https://wa.me/?text=${encoded}`)
      );
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? '#0D2721' : '#FCFBF7',
          borderColor: isDark ? '#1C4A3E' : '#EFECE2',
        },
      ]}
    >
      {/* Subtle Lantern Graphic Accent */}
      <View style={styles.artworkContainer}>
        <Image
          source={require('@/assets/images/islamic_lantern_art.jpg')}
          style={styles.lanternImage}
          contentFit="cover"
        />
        <View
          style={[
            styles.artworkOverlay,
            { backgroundColor: isDark ? '#0D2721' : '#FCFBF7' },
          ]}
        />
      </View>

      {/* Content Layer */}
      <View style={styles.contentWrap}>
        <View style={styles.headerRow}>
          <View style={styles.sparkleRow}>
            <Text style={[styles.goldStar, { color: colors.gold }]}>✦</Text>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>DAILY WISDOM • حکمتِ روزانہ</Text>
          </View>
          <TouchableOpacity
            style={styles.hadithLibBtn}
            onPress={() => router.push('/hadith' as any)}
            accessibilityRole="button"
            accessibilityLabel="Open Hadith Library"
          >
            <Text style={[styles.hadithLibText, { color: colors.primary }]}>احادیث کتب</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.arabicText, { color: colors.text }]}>{arabic}</Text>

        <Text style={[styles.translationText, { color: colors.textSecondary }]}>
          &ldquo;{translation}&rdquo;
        </Text>

        <View style={[styles.footerRow, { borderTopColor: isDark ? '#1C4A3E' : '#EFECE2' }]}>
          <Text style={[styles.referenceText, { color: colors.gold }]}>— {reference}</Text>

          <TouchableOpacity
            style={[
              styles.shareBtn,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(7, 91, 73, 0.08)',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(7, 91, 73, 0.16)',
              },
            ]}
            onPress={handleShareWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Share Daily Wisdom on WhatsApp"
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={15} color={colors.primary} />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    ...SHADOWS.premiumCard,
  },
  artworkContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    opacity: 0.16,
  },
  lanternImage: {
    width: '100%',
    height: '100%',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  contentWrap: {
    padding: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldStar: {
    fontSize: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  hadithLibBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  hadithLibText: {
    fontSize: 11,
    fontWeight: '700',
  },
  arabicText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 38,
    marginVertical: 6,
    writingDirection: 'rtl',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 13.5,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  referenceText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
