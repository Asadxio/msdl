import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Share, Linking } from 'react-native';
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

interface ModalContent {
  title: string;
  arabic: string;
  translation: string;
  reference: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

export function SpiritualMomentsRow({ dua, hadith }: SpiritualMomentsRowProps) {
  const [selectedMoment, setSelectedMoment] = useState<ModalContent | null>(null);

  const handleShare = async (item: ModalContent) => {
    const msg = `✨ ${item.title} — Madrasatu-s-Salikat Lil Banat ✨\n\n${item.arabic}\n\n"${item.translation}"\n— ${item.reference}\n\n🕌 Madrasatu-s-Salikat Lil Banat`;
    try {
      await Share.share({ message: msg, title: item.title });
    } catch {
      const encoded = encodeURIComponent(msg);
      Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() =>
        Linking.openURL(`https://wa.me/?text=${encoded}`)
      );
    }
  };

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
        <TouchableOpacity
          style={styles.momentCard}
          onPress={() =>
            setSelectedMoment({
              title: 'Dua of the Day',
              arabic: dua.arabic,
              translation: dua.translation,
              reference: dua.reference,
              icon: 'moon-outline',
              iconColor: '#075B49',
            })
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Dua of the Day: ${dua.translation}`}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="moon-outline" size={14} color="#075B49" />
            </View>
            <Text style={styles.cardCategory}>DUA OF THE DAY</Text>
          </View>
          <Text style={styles.arabicText}>{dua.arabic}</Text>
          <Text style={styles.translationText} numberOfLines={3}>
            &ldquo;{dua.translation}&rdquo;
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.referenceText} numberOfLines={1}>{dua.reference}</Text>
            <Ionicons name="open-outline" size={12} color="#C6A15B" />
          </View>
        </TouchableOpacity>

        {/* Hadith Card */}
        <TouchableOpacity
          style={styles.momentCard}
          onPress={() =>
            setSelectedMoment({
              title: 'Hadith of the Day',
              arabic: hadith.arabic,
              translation: hadith.translation,
              reference: hadith.reference,
              icon: 'book-outline',
              iconColor: '#C6A15B',
            })
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Hadith of the Day: ${hadith.translation}`}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#FCF9F0' }]}>
              <Ionicons name="book-outline" size={14} color="#C6A15B" />
            </View>
            <Text style={styles.cardCategory}>HADITH OF THE DAY</Text>
          </View>
          <Text style={styles.arabicText}>{hadith.arabic}</Text>
          <Text style={styles.translationText} numberOfLines={3}>
            &ldquo;{hadith.translation}&rdquo;
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.referenceText} numberOfLines={1}>{hadith.reference}</Text>
            <Ionicons name="open-outline" size={12} color="#C6A15B" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Interactive Detail Modal */}
      {selectedMoment && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedMoment(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name={selectedMoment.icon} size={18} color={selectedMoment.iconColor} />
                  <Text style={styles.modalTitle}>{selectedMoment.title}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedMoment(null)}
                  style={styles.closeBtn}
                  accessibilityLabel="Close detail"
                >
                  <Ionicons name="close" size={20} color="#71817B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalArabic}>{selectedMoment.arabic}</Text>
              <Text style={styles.modalTranslation}>&ldquo;{selectedMoment.translation}&rdquo;</Text>
              <Text style={styles.modalRef}>— {selectedMoment.reference}</Text>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalShareBtn}
                  onPress={() => handleShare(selectedMoment)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#075B49" />
                  <Text style={styles.modalShareBtnText}>Share on WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDismissBtn}
                  onPress={() => setSelectedMoment(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDismissBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    minHeight: 160,
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
    fontSize: 15.5,
    color: '#17332C',
    textAlign: 'right',
    lineHeight: 25,
    marginBottom: 6,
    writingDirection: 'rtl',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 11.5,
    color: '#71817B',
    lineHeight: 17,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F7F5EF',
  },
  referenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C6A15B',
    flex: 1,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: '#E7E4DA',
    ...SHADOWS.premiumCard,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17332C',
  },
  closeBtn: {
    padding: 4,
  },
  modalArabic: {
    fontSize: 22,
    color: '#17332C',
    textAlign: 'center',
    lineHeight: 38,
    writingDirection: 'rtl',
    marginVertical: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  modalTranslation: {
    fontSize: 14,
    color: '#5A6B65',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    marginVertical: 10,
  },
  modalRef: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C6A15B',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(7, 91, 73, 0.08)',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(7, 91, 73, 0.16)',
  },
  modalShareBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#075B49',
  },
  modalDismissBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F7F5EF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E4DA',
  },
  modalDismissBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17332C',
  },
});
