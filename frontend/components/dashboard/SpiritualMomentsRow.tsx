import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface SpiritualMomentsRowProps {
  dua: {
    arabic: string;
    translation: string;
    reference: string;
  };
  hadith: {
    arabic: string;
    translation: string;
    reference: string;
  };
}

export function SpiritualMomentsRow({ dua, hadith }: SpiritualMomentsRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconTag}>
          <Ionicons name="sparkles" size={14} color="#C6A15B" />
        </View>
        <Text style={styles.sectionTitle}>Spiritual Moments</Text>
      </View>

      <View style={styles.cardsRow}>
        {/* Dua Card */}
        <View style={styles.momentCard}>
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="moon-outline" size={15} color="#075B49" />
            </View>
            <Text style={styles.cardCategory}>DUA OF THE DAY</Text>
          </View>
          <Text style={styles.arabicText}>{dua.arabic}</Text>
          <Text style={styles.translationText} numberOfLines={3}>
            &ldquo;{dua.translation}&rdquo;
          </Text>
          <Text style={styles.referenceText}>{dua.reference}</Text>
        </View>

        {/* Hadith Card */}
        <View style={styles.momentCard}>
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#FCF9F0' }]}>
              <Ionicons name="book-outline" size={15} color="#C6A15B" />
            </View>
            <Text style={styles.cardCategory}>HADITH OF THE DAY</Text>
          </View>
          <Text style={styles.arabicText}>{hadith.arabic}</Text>
          <Text style={styles.translationText} numberOfLines={3}>
            &ldquo;{hadith.translation}&rdquo;
          </Text>
          <Text style={styles.referenceText}>{hadith.reference}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  iconTag: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FCF9F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17332C',
    letterSpacing: -0.2,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  momentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E4DA',
    ...SHADOWS.card,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#71817B',
    letterSpacing: 0.8,
  },
  arabicText: {
    fontSize: 15,
    color: '#17332C',
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 11,
    color: '#71817B',
    lineHeight: 16,
    marginBottom: 8,
  },
  referenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C6A15B',
  },
});
