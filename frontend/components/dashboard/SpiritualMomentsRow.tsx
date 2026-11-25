import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Share, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';

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
  moduleRoute: string;
  moduleBtnText: string;
}

export function SpiritualMomentsRow({ dua, hadith }: SpiritualMomentsRowProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [selectedMoment, setSelectedMoment] = useState<ModalContent | null>(null);

  const handleShare = async (item: ModalContent) => {
    const msg = `✨ ${item.title} — Suffah ✨\n\n${item.arabic}\n\n"${item.translation}"\n— ${item.reference}\n\n🕌 Suffah • Digital Madrasa Portal`;
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
        <View style={[styles.iconTag, { backgroundColor: isDark ? '#2A200B' : '#FEF9C3' }]}>
          <Ionicons name="sparkles" size={14} color={colors.gold} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Spiritual Moments</Text>
      </View>

      <View style={styles.cardsRow}>
        {/* Dua Card */}
        <TouchableOpacity
          style={[
            styles.momentCard,
            {
              backgroundColor: isDark ? '#0D2721' : colors.surface,
              borderColor: isDark ? '#1C4A3E' : colors.border,
            },
          ]}
          onPress={() =>
            setSelectedMoment({
              title: 'Dua of the Day',
              arabic: dua.arabic,
              translation: dua.translation,
              reference: dua.reference,
              icon: 'moon-outline',
              iconColor: colors.primary,
              moduleRoute: '/duas',
              moduleBtnText: 'مسنون دعائیں دیکھیں (Open Duas)',
            })
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Dua of the Day: ${dua.translation}`}
        >
          <View style={styles.cardTopRow}>
            <View
              style={[
                styles.cardIconWrap,
                { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF4' },
              ]}
            >
              <Ionicons name="moon-outline" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.cardCategory, { color: colors.primary }]}>DUA OF THE DAY</Text>
          </View>
          <Text style={[styles.arabicText, { color: colors.text }]}>{dua.arabic}</Text>
          <Text style={[styles.translationText, { color: colors.textSecondary }]} numberOfLines={3}>
            &ldquo;{dua.translation}&rdquo;
          </Text>
          <View style={[styles.cardFooter, { borderTopColor: isDark ? '#1C4A3E' : '#EFECE2' }]}>
            <Text style={[styles.referenceText, { color: colors.gold }]} numberOfLines={1}>
              {dua.reference}
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.gold} />
          </View>
        </TouchableOpacity>

        {/* Hadith Card */}
        <TouchableOpacity
          style={[
            styles.momentCard,
            {
              backgroundColor: isDark ? '#0D2721' : colors.surface,
              borderColor: isDark ? '#1C4A3E' : colors.border,
            },
          ]}
          onPress={() =>
            setSelectedMoment({
              title: 'Hadith of the Day',
              arabic: hadith.arabic,
              translation: hadith.translation,
              reference: hadith.reference,
              icon: 'book-outline',
              iconColor: colors.gold,
              moduleRoute: '/hadith',
              moduleBtnText: 'کتبِ احادیث دیکھیں (Open Hadiths)',
            })
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Hadith of the Day: ${hadith.translation}`}
        >
          <View style={styles.cardTopRow}>
            <View
              style={[
                styles.cardIconWrap,
                { backgroundColor: isDark ? 'rgba(229,195,120,0.12)' : '#FCF9F0' },
              ]}
            >
              <Ionicons name="book-outline" size={14} color={colors.gold} />
            </View>
            <Text style={[styles.cardCategory, { color: colors.gold }]}>HADITH OF THE DAY</Text>
          </View>
          <Text style={[styles.arabicText, { color: colors.text }]}>{hadith.arabic}</Text>
          <Text style={[styles.translationText, { color: colors.textSecondary }]} numberOfLines={3}>
            &ldquo;{hadith.translation}&rdquo;
          </Text>
          <View style={[styles.cardFooter, { borderTopColor: isDark ? '#1C4A3E' : '#EFECE2' }]}>
            <Text style={[styles.referenceText, { color: colors.gold }]} numberOfLines={1}>
              {hadith.reference}
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.gold} />
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
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDark ? '#081B17' : colors.surface,
                  borderColor: isDark ? '#1C4A3E' : colors.border,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name={selectedMoment.icon} size={18} color={selectedMoment.iconColor} />
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {selectedMoment.title}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedMoment(null)}
                  style={styles.closeBtn}
                  accessibilityLabel="Close detail"
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalArabic, { color: colors.text }]}>
                {selectedMoment.arabic}
              </Text>
              <Text style={[styles.modalTranslation, { color: colors.textSecondary }]}>
                &ldquo;{selectedMoment.translation}&rdquo;
              </Text>
              <Text style={[styles.modalRef, { color: colors.gold }]}>
                — {selectedMoment.reference}
              </Text>

              {/* Action to Jump to Full Module */}
              <TouchableOpacity
                style={[styles.jumpModuleBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => {
                  setSelectedMoment(null);
                  router.push(selectedMoment.moduleRoute as any);
                }}
                accessibilityRole="button"
                accessibilityLabel={selectedMoment.moduleBtnText}
              >
                <Ionicons name="arrow-forward-circle" size={18} color={colors.primary} />
                <Text style={[styles.jumpModuleText, { color: colors.primary }]}>
                  {selectedMoment.moduleBtnText}
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[
                    styles.modalShareBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(7, 91, 73, 0.08)',
                    },
                  ]}
                  onPress={() => handleShare(selectedMoment)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
                  <Text style={[styles.modalShareBtnText, { color: colors.primary }]}>
                    Share on WhatsApp
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalDismissBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => setSelectedMoment(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modalDismissBtnText, { color: colors.textSecondary }]}>
                    Close
                  </Text>
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
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  momentCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    ...SHADOWS.sm,
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  arabicText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  translationText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 8,
    minHeight: 36,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
  },
  referenceText: {
    fontSize: 10.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalArabic: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 38,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: SPACING.md,
  },
  modalTranslation: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  modalRef: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  jumpModuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
    marginBottom: SPACING.md,
  },
  jumpModuleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  modalShareBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalDismissBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  modalDismissBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
