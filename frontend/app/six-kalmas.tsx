import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScalePressable } from '@/components/ui';
import { ReadingControlsSheet } from '@/components/ui/ReadingControlsSheet';
import { RADIUS, SPACING } from '@/constants/theme';
import { useReadingPreferences, useTheme } from '@/context/ThemeContext';
import { goBackOrReplace } from '@/lib/navigation';
import { getSixKalmas, type KalmaEntry } from '@/lib/sixKalmasService';

export default function SixKalmasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { readingPreferences } = useReadingPreferences();

  const kalmas = useMemo(() => getSixKalmas(), []);
  const [selectedKalma, setSelectedKalma] = useState<KalmaEntry | null>(null);
  const [showReadingSheet, setShowReadingSheet] = useState(false);

  const screenBg = isDark ? colors.background : '#F6F7F6';
  const cardBg = isDark ? colors.surface : '#FFFFFF';
  const cardBorder = isDark ? colors.border : 'rgba(15, 23, 42, 0.05)';
  const pillBg = isDark ? 'rgba(16, 185, 129, 0.16)' : '#E5F4EC';
  const pillText = isDark ? '#34D399' : '#056049';

  const arabicFontSize = readingPreferences.arabicFontSize || 24;
  const arabicLineHeight = Math.round(arabicFontSize * 1.72);
  const transFontSize = readingPreferences.translationFontSize || 14;
  const transLineHeight = Math.round(transFontSize * 1.48);

  const handleSelectKalma = (kalma: KalmaEntry) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedKalma(kalma);
  };

  const handleCopyKalma = async (kalma: KalmaEntry) => {
    try {
      const text = `${kalma.title} (${kalma.arabicTitle})\n\n${kalma.arabicText}\n\n${kalma.transliteration}\n\nEnglish: ${kalma.englishTranslation}\n\nUrdu: ${kalma.urduTranslation}`;
      await Clipboard.setStringAsync(text);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Copied', `${kalma.title} copied to clipboard.`);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleShareKalma = async (kalma: KalmaEntry) => {
    try {
      await Share.share({
        message: `${kalma.title}\n${kalma.arabicTitle}\n\n${kalma.arabicText}\n\n${kalma.transliteration}\n\n"${kalma.englishTranslation}"\n\n${kalma.urduTranslation}\n\n— Shared via SUFFAH`,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleStepKalma = (delta: number) => {
    if (!selectedKalma) return;
    const idx = kalmas.findIndex((k) => k.id === selectedKalma.id);
    const nextIdx = idx + delta;
    if (nextIdx >= 0 && nextIdx < kalmas.length) {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      setSelectedKalma(kalmas[nextIdx]);
    }
  };

  const selectedIndex = selectedKalma
    ? kalmas.findIndex((k) => k.id === selectedKalma.id)
    : -1;

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]} testID="six-kalmas-screen">
      {/* Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + SPACING.xs,
            backgroundColor: screenBg,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Six Kalmas
        </Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            setShowReadingSheet(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Reading and display settings"
        >
          <Text style={[styles.aaBtnText, { color: colors.text }]}>Aa</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Stack of 6 Kalma Cards */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {kalmas.map((kalma) => (
          <ScalePressable
            key={kalma.id}
            style={[
              styles.kalmaCard,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
            onPress={() => handleSelectKalma(kalma)}
            accessibilityRole="button"
            accessibilityLabel={`${kalma.title}. Tap to view full Arabic, Urdu translation, and transliteration.`}
          >
            {/* Card Header Row: Mint Badge + Title */}
            <View style={styles.cardHeaderRow}>
              <View style={[styles.kalmaBadge, { backgroundColor: pillBg }]}>
                <Text style={[styles.kalmaBadgeText, { color: pillText }]}>
                  {kalma.badge}
                </Text>
              </View>
              <Text style={[styles.kalmaTitle, { color: colors.text }]}>
                {kalma.title}
              </Text>
            </View>

            {/* Right-aligned Diacritized Arabic Text */}
            <Text
              style={[
                styles.arabicText,
                {
                  color: colors.text,
                  fontSize: arabicFontSize,
                  lineHeight: arabicLineHeight,
                },
              ]}
            >
              {kalma.arabicText}
            </Text>

            {/* Concise Translation Preview (matching reference layout) */}
            {readingPreferences.showEnglishTranslation && (
              <Text
                style={[
                  styles.englishPreview,
                  {
                    color: colors.textSecondary,
                    fontSize: transFontSize,
                    lineHeight: transLineHeight,
                  },
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {kalma.englishTranslation}
              </Text>
            )}
          </ScalePressable>
        ))}
      </ScrollView>

      {/* Focus Detail Modal when tapping any Kalma Card */}
      <Modal
        visible={!!selectedKalma}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedKalma(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedKalma(null)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, SPACING.md),
              },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            {selectedKalma && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalTopRow}>
                  <View style={[styles.kalmaBadge, { backgroundColor: pillBg }]}>
                    <Text style={[styles.kalmaBadgeText, { color: pillText }]}>
                      {selectedKalma.badge}
                    </Text>
                  </View>

                  <View style={styles.modalIconActions}>
                    <TouchableOpacity
                      style={styles.modalActionIcon}
                      onPress={() => handleCopyKalma(selectedKalma)}
                      accessibilityRole="button"
                      accessibilityLabel="Copy Kalma"
                    >
                      <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalActionIcon}
                      onPress={() => handleShareKalma(selectedKalma)}
                      accessibilityRole="button"
                      accessibilityLabel="Share Kalma"
                    >
                      <Ionicons name="share-social-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalActionIcon}
                      onPress={() => setSelectedKalma(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Close modal"
                    >
                      <Ionicons name="close" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedKalma.title}
                </Text>
                <Text style={[styles.modalArabicHeading, { color: colors.secondary }]}>
                  {selectedKalma.arabicTitle} {'\u2022'} {selectedKalma.urduTitle}
                </Text>

                {/* Full Arabic Block */}
                <View
                  style={[
                    styles.arabicBox,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : '#F8FAF9',
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalArabicText,
                      {
                        color: colors.text,
                        fontSize: arabicFontSize + 2,
                        lineHeight: Math.round((arabicFontSize + 2) * 1.78),
                      },
                    ]}
                  >
                    {selectedKalma.arabicText}
                  </Text>
                </View>

                {readingPreferences.showTransliteration && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.blockLabel, { color: pillText }]}>TRANSLITERATION</Text>
                    <Text
                      style={[
                        styles.translitText,
                        {
                          color: colors.text,
                          fontSize: transFontSize,
                          lineHeight: transLineHeight,
                        },
                      ]}
                    >
                      {selectedKalma.transliteration}
                    </Text>
                  </View>
                )}

                {readingPreferences.showEnglishTranslation && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.blockLabel, { color: pillText }]}>ENGLISH TRANSLATION</Text>
                    <Text
                      style={[
                        styles.translationText,
                        {
                          color: colors.text,
                          fontSize: transFontSize + 0.5,
                          lineHeight: Math.round((transFontSize + 0.5) * 1.5),
                        },
                      ]}
                    >
                      {selectedKalma.englishTranslation}
                    </Text>
                  </View>
                )}

                {readingPreferences.showUrduTranslation && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.blockLabel, { color: colors.secondary }]}>
                      URDU TRANSLATION ({'\u0627\u0631\u062f\u0648 \u062a\u0631\u062c\u0645\u06c1'})
                    </Text>
                    <Text
                      style={[
                        styles.urduText,
                        {
                          color: colors.text,
                          fontSize: transFontSize + 3,
                          lineHeight: Math.round((transFontSize + 3) * 1.75),
                        },
                      ]}
                    >
                      {selectedKalma.urduTranslation}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.significanceBox,
                    { backgroundColor: isDark ? 'rgba(198,161,91,0.12)' : '#FCF9F0' },
                  ]}
                >
                  <Text style={[styles.significanceLabel, { color: colors.goldText }]}>
                    Meaning &amp; Reflection
                  </Text>
                  <Text style={[styles.significanceBody, { color: colors.textSecondary }]}>
                    {selectedKalma.significance}
                  </Text>
                </View>

                {/* Sequential Next / Previous Controls */}
                <View style={styles.modalNavRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalNavBtn,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : '#F3F4F6',
                        opacity: selectedIndex <= 0 ? 0.45 : 1,
                      },
                    ]}
                    disabled={selectedIndex <= 0}
                    onPress={() => handleStepKalma(-1)}
                    accessibilityRole="button"
                    accessibilityLabel="Previous Kalma"
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                    <Text style={[styles.modalNavText, { color: colors.text }]}>Previous</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalNavBtn,
                      {
                        backgroundColor: isDark ? colors.primaryDeep : '#045E44',
                        opacity: selectedIndex >= kalmas.length - 1 ? 0.45 : 1,
                      },
                    ]}
                    disabled={selectedIndex >= kalmas.length - 1}
                    onPress={() => handleStepKalma(1)}
                    accessibilityRole="button"
                    accessibilityLabel="Next Kalma"
                  >
                    <Text style={[styles.modalNavText, { color: '#FFFFFF' }]}>Next Kalma</Text>
                    <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ReadingControlsSheet
        visible={showReadingSheet}
        onClose={() => setShowReadingSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  aaBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    gap: 14,
  },
  kalmaCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kalmaBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kalmaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kalmaTitle: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  arabicText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '500',
    paddingVertical: 4,
  },
  englishPreview: {
    marginTop: 12,
    fontWeight: '400',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  modalScrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -8,
  },
  modalActionIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    marginTop: 4,
  },
  modalArabicHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  arabicBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  modalArabicText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '500',
  },
  sectionBlock: {
    marginTop: SPACING.md,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  translitText: {
    fontStyle: 'italic',
    fontWeight: '500',
  },
  translationText: {
    fontWeight: '500',
  },
  urduText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '500',
  },
  significanceBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  significanceLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  significanceBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  modalNavRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalNavBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
  },
  modalNavText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
