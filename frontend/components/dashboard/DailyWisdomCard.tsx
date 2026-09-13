import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface DailyWisdomCardProps {
  arabic: string;
  translation: string;
  reference: string;
}

export function DailyWisdomCard({ arabic, translation, reference }: DailyWisdomCardProps) {
  const handleShareWhatsApp = () => {
    const msg = `${arabic}\n\n"${translation}"\n— ${reference}\n\n🕌 Madrasatu-s-Salikat Lil Banat`;
    const encoded = encodeURIComponent(msg);
    Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encoded}`)
    );
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7E4DA',
    ...SHADOWS.premiumCard,
  },
  artworkContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 130,
    height: 130,
    opacity: 0.22,
  },
  lanternImage: {
    width: '100%',
    height: '100%',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    opacity: 0.15,
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
    fontSize: 21,
    color: '#17332C',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 36,
    marginVertical: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 13,
    color: '#71817B',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE1',
  },
  referenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C6A15B',
    letterSpacing: 0.4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7, 91, 73, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(7, 91, 73, 0.15)',
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#075B49',
  },
});
