import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Share } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface DailyWisdomCardProps {
  arabic: string;
  translation: string;
  reference: string;
}

export function DailyWisdomCard({ arabic, translation, reference }: DailyWisdomCardProps) {
  const handleShareWhatsApp = async () => {
    const msg = `✨ Daily Wisdom — Madrasatu-s-Salikat Lil Banat ✨\n\n${arabic}\n\n"${translation}"\n— ${reference}\n\n🕌 Madrasatu-s-Salikat Lil Banat • Islamic Learning Hub`;
    try {
      await Share.share({
        message: msg,
        title: 'Daily Wisdom — Madrasatu-s-Salikat',
      });
    } catch {
      const encoded = encodeURIComponent(msg);
      Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() =>
        Linking.openURL(`https://wa.me/?text=${encoded}`)
      );
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Subtle Lantern Graphic Accent */}
      <View style={styles.artworkContainer}>
        <Image
          source={require('@/assets/images/islamic_lantern_art.jpg')}
          style={styles.lanternImage}
          contentFit="cover"
        />
        <View style={styles.artworkOverlay} />
      </View>

      {/* Content Layer */}
      <View style={styles.contentWrap}>
        <View style={styles.headerRow}>
          <View style={styles.sparkleRow}>
            <Text style={styles.goldStar}>✦</Text>
            <Text style={styles.eyebrow}>DAILY WISDOM</Text>
          </View>
          <View style={styles.goldDividerSmall} />
        </View>

        <Text style={styles.arabicText}>{arabic}</Text>

        <Text style={styles.translationText}>&ldquo;{translation}&rdquo;</Text>

        <View style={styles.footerRow}>
          <Text style={styles.referenceText}>— {reference}</Text>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Share Daily Wisdom on WhatsApp"
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={15} color="#075B49" />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FCFBF7',
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFECE2',
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
    backgroundColor: '#FCFBF7',
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
    color: '#C6A15B',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C6A15B',
    letterSpacing: 1.2,
  },
  goldDividerSmall: {
    height: 1,
    width: 32,
    backgroundColor: '#E7E4DA',
  },
  arabicText: {
    fontSize: 22,
    color: '#17332C',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 38,
    marginVertical: 6,
    writingDirection: 'rtl',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 13.5,
    color: '#5A6B65',
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
    borderTopColor: '#EFECE2',
  },
  referenceText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#C6A15B',
    letterSpacing: 0.4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7, 91, 73, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(7, 91, 73, 0.16)',
  },
  shareBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#075B49',
  },
});
