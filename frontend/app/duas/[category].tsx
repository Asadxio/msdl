import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme, useReadingPreferences } from '@/context/ThemeContext';
import { useGlobalAudio } from '@/context/GlobalAudioContext';
import { ReadingControlsSheet } from '@/components/ui/ReadingControlsSheet';
import { goBackOrReplace } from '@/lib/navigation';
import {
  getDuaCategoryById,
  getDuasByCategory,
  isDuaBookmarked,
  toggleDuaBookmark,
  getDuaCountProgress,
  incrementDuaCount,
  resetDuaCount,
} from '@/lib/duasService';
import { DuaCategory, DuaCategoryId, DuaEntry } from '@/types/islamic';

export default function DuaCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { readingPreferences } = useReadingPreferences();
  const { playTrack, pauseTrack, currentTrack, isPlaying } = useGlobalAudio();
  const { category } = useLocalSearchParams<{ category: string }>();
  const { width } = useWindowDimensions();

  const [categoryInfo, setCategoryInfo] = useState<DuaCategory | null>(null);
  const [duas, setDuas] = useState<DuaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [showReadingControls, setShowReadingControls] = useState(false);

  useEffect(() => {
    if (category) {
      loadCategoryData(category as DuaCategoryId);
    }
  }, [category]);

  const loadCategoryData = async (catId: DuaCategoryId) => {
    try {
      setLoading(true);
      const cat = getDuaCategoryById(catId);
      if (cat) {
        setCategoryInfo(cat);
      }
      const list = getDuasByCategory(catId);
      setDuas(list);

      // Load progress and bookmark state for each dua
      const initialCounts: Record<string, number> = {};
      const initialBms: Record<string, boolean> = {};
      for (const d of list) {
        initialCounts[d.id] = await getDuaCountProgress(d.id);
        initialBms[d.id] = await isDuaBookmarked(d.id);
      }
      setCounts(initialCounts);
      setBookmarkedMap(initialBms);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = async (dua: DuaEntry) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const newState = await toggleDuaBookmark(dua);
      setBookmarkedMap((prev) => ({ ...prev, [dua.id]: newState }));
    } catch {}
  };

  const handleIncrement = async (dua: DuaEntry) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const cur = counts[dua.id] || 0;
      const target = dua.targetCount || dua.repeatCount || 1;
      const next = await incrementDuaCount(dua.id, cur, target);
      setCounts((prev) => ({ ...prev, [dua.id]: next }));
      if (next === target && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {}
  };

  const handleReset = async (duaId: string) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      await resetDuaCount(duaId);
      setCounts((prev) => ({ ...prev, [duaId]: 0 }));
    } catch {}
  };

  const handleAudioPlay = (dua: DuaEntry) => {
    if (!dua.audioUrl) return;
    if (currentTrack?.id === dua.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: dua.id,
        titleEn: `${dua.titleEn} (${dua.titleUr})`,
        subtitle: dua.reference || 'Hisn al-Muslim',
        audioUrl: dua.audioUrl,
        category: 'dua',
        arabicTitle: dua.arabicText.slice(0, 60),
      });
    }
  };

  const handleShare = async (dua: DuaEntry) => {
    try {
      const text = `🤲 *${dua.titleEn} | ${dua.titleUr}*\n\n${dua.arabicText}\n\n*English:* ${dua.englishTranslation}\n\n*Urdu:* ${dua.urduTranslation}\n\n${
        dua.virtueEn ? `*Virtue:* ${dua.virtueEn}\n\n` : ''
      }*Reference:* ${dua.reference}\n\nShared via SUFFAH Islamic Knowledge`;
      await Share.share({ message: text, title: dua.titleEn });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/duas')}
          accessibilityRole="button"
          accessibilityLabel="Back to categories"
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitleEn, { color: colors.text }]} numberOfLines={1}>
            {categoryInfo?.titleEn || 'Duas'}
          </Text>
          <Text style={[styles.headerTitleUr, { color: colors.gold }]} numberOfLines={1}>
            {categoryInfo?.titleUr || 'مسنون دعائیں'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowReadingControls(true)}
            accessibilityRole="button"
            accessibilityLabel="Reading and font settings"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="text" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => router.push('/tasbeeh' as any)}
            accessibilityRole="button"
            accessibilityLabel="Open Tasbeeh"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="finger-print-outline" size={22} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Category Banner */}
      {categoryInfo && (
        <View
          style={[
            styles.heroBanner,
            {
              backgroundColor: isDark ? colors.surfaceAlt : '#E8F5E9',
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.heroArabicWrap}>
            <Text
              style={[
                styles.heroArabic,
                { color: isDark ? colors.gold : colors.primary },
              ]}
            >
              {categoryInfo.titleAr}
            </Text>
          </View>
          <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
            {duas.length} Authentic Masnoon Duas with Arabic text, Urdu & English translations, and repeat counters.
          </Text>
        </View>
      )}

      {/* Duas List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Duas...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
        >
          {duas.map((dua, index) => {
            const currentCount = counts[dua.id] || 0;
            const targetCount = dua.targetCount || dua.repeatCount || 1;
            const isCompleted = currentCount >= targetCount;
            const isBookmarked = !!bookmarkedMap[dua.id];
            const isCurrentPlaying = currentTrack?.id === dua.id && isPlaying;

            return (
              <View
                key={dua.id}
                style={[
                  styles.duaCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.indexBadge,
                      { backgroundColor: isDark ? colors.surfaceAlt : '#E8F5E9' },
                    ]}
                  >
                    <Text style={[styles.indexText, { color: colors.primary }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.duaTitleArea}>
                    <Text style={[styles.duaTitleEn, { color: colors.text }]}>{dua.titleEn}</Text>
                    <Text style={[styles.duaTitleUr, { color: colors.gold }]}>{dua.titleUr}</Text>
                  </View>
                  <View style={styles.cardHeaderActions}>
                    {dua.audioUrl && (
                      <TouchableOpacity
                        style={[
                          styles.iconActionBtn,
                          isCurrentPlaying && {
                            backgroundColor: isDark
                              ? 'rgba(198, 161, 91, 0.25)'
                              : '#FEF3C7',
                          },
                        ]}
                        onPress={() => handleAudioPlay(dua)}
                        accessibilityRole="button"
                        accessibilityLabel={isCurrentPlaying ? 'Pause audio' : 'Play recitation audio'}
                      >
                        <Ionicons
                          name={isCurrentPlaying ? 'pause-circle' : 'volume-high-outline'}
                          size={24}
                          color={isCurrentPlaying ? colors.gold : colors.primary}
                        />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleToggleBookmark(dua)}
                      accessibilityRole="button"
                      accessibilityLabel="Bookmark Dua"
                    >
                      <Ionicons
                        name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={isBookmarked ? colors.gold : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleShare(dua)}
                      accessibilityRole="button"
                      accessibilityLabel="Share Dua"
                    >
                      <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Arabic Text Box */}
                <View
                  style={[
                    styles.arabicBox,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : '#F0FDF4',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.arabicText,
                      {
                        fontSize: readingPreferences.arabicFontSize,
                        lineHeight: Math.round(readingPreferences.arabicFontSize * 1.8),
                        color: colors.text,
                      },
                    ]}
                  >
                    {dua.arabicText}
                  </Text>
                </View>

                {/* Transliteration */}
                {readingPreferences.showTransliteration !== false && (
                  <View
                    style={[
                      styles.translitBox,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : '#F8FAFC',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.translitLabel, { color: colors.gold }]}>
                      Transliteration:
                    </Text>
                    <Text style={[styles.translitText, { color: colors.textSecondary }]}>
                      {dua.transliteration}
                    </Text>
                  </View>
                )}

                {/* English & Urdu Translations */}
                <View style={styles.translationContainer}>
                  {readingPreferences.showEnglishTranslation !== false && (
                    <View style={styles.transRow}>
                      <Text style={[styles.transLangLabel, { color: colors.primary }]}>
                        English:
                      </Text>
                      <Text
                        style={[
                          styles.englishText,
                          {
                            fontSize: readingPreferences.translationFontSize,
                            lineHeight: Math.round(readingPreferences.translationFontSize * 1.5),
                            color: colors.text,
                          },
                        ]}
                      >
                        {dua.englishTranslation}
                      </Text>
                    </View>
                  )}
                  {readingPreferences.showUrduTranslation !== false && (
                    <View style={styles.transRow}>
                      <Text style={[styles.transLangLabelUr, { color: colors.primary }]}>
                        اردو ترجمہ:
                      </Text>
                      <Text
                        style={[
                          styles.urduText,
                          {
                            fontSize: readingPreferences.translationFontSize,
                            lineHeight: Math.round(readingPreferences.translationFontSize * 1.6),
                            color: colors.text,
                          },
                        ]}
                      >
                        {dua.urduTranslation}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Virtue / Fadhilah if available */}
                {(dua.virtueEn || dua.virtueUr) && (
                  <View
                    style={[
                      styles.virtueBox,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : '#FFF9E6',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.virtueHeader}>
                      <Ionicons name="star" size={16} color={colors.gold} />
                      <Text style={[styles.virtueTitle, { color: colors.gold }]}>
                        Virtue & Reward • فضیلت
                      </Text>
                    </View>
                    {dua.virtueEn && (
                      <Text style={[styles.virtueTextEn, { color: colors.text }]}>
                        {dua.virtueEn}
                      </Text>
                    )}
                    {dua.virtueUr && (
                      <Text style={[styles.virtueTextUr, { color: colors.text }]}>
                        {dua.virtueUr}
                      </Text>
                    )}
                  </View>
                )}

                {/* Footer with Reference and Interactive Counter */}
                <View style={styles.footerRow}>
                  <View
                    style={[
                      styles.referenceBadge,
                      { backgroundColor: isDark ? colors.surfaceAlt : '#F0F4F8' },
                    ]}
                  >
                    <Ionicons name="book-outline" size={14} color={colors.primary} />
                    <Text
                      style={[styles.referenceText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {dua.reference}
                    </Text>
                  </View>

                  <View style={styles.counterControlWrap}>
                    <TouchableOpacity
                      style={[
                        styles.mainCounterBtn,
                        isCompleted && styles.mainCounterBtnDone,
                      ]}
                      onPress={() => handleIncrement(dua)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Tap to repeat: ${currentCount} of ${targetCount}`}
                    >
                      <Ionicons
                        name={isCompleted ? 'checkmark-circle' : 'finger-print'}
                        size={20}
                        color={COLORS.white}
                      />
                      <Text style={styles.mainCounterText}>
                        {currentCount} / {targetCount}
                      </Text>
                    </TouchableOpacity>

                    {currentCount > 0 && (
                      <TouchableOpacity
                        style={styles.counterResetBtn}
                        onPress={() => handleReset(dua.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Reset counter"
                      >
                        <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <ReadingControlsSheet
        visible={showReadingControls}
        onClose={() => setShowReadingControls(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  headerTitleEn: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F291E',
  },
  headerTitleUr: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  headerAction: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBanner: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
    alignItems: 'center',
  },
  heroArabicWrap: {
    marginBottom: 4,
  },
  heroArabic: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.emerald,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 18,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  duaCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  duaTitleArea: {
    flex: 1,
  },
  duaTitleEn: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F291E',
  },
  duaTitleUr: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    gap: 2,
  },
  iconActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  arabicBox: {
    backgroundColor: '#F8FAF9',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderRightWidth: 4,
    borderRightColor: COLORS.gold,
    marginBottom: SPACING.md,
  },
  arabicText: {
    fontSize: 22,
    lineHeight: 42,
    color: '#0F291E',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  translitBox: {
    marginBottom: SPACING.md,
  },
  translitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  translitText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 22,
  },
  translationContainer: {
    marginBottom: SPACING.md,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  transRow: {
    marginBottom: SPACING.sm,
  },
  transLangLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
    marginBottom: 2,
  },
  englishText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
  },
  transLangLabelUr: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gold,
    marginBottom: 2,
    textAlign: 'right',
  },
  urduText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  virtueBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  virtueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  virtueTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
  },
  virtueTextEn: {
    fontSize: 13,
    color: '#713F12',
    lineHeight: 18,
    marginBottom: 4,
  },
  virtueTextUr: {
    fontSize: 13,
    color: '#713F12',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  referenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: SPACING.sm,
  },
  referenceText: {
    fontSize: 12,
    color: COLORS.emerald,
    fontWeight: '600',
  },
  counterControlWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mainCounterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  mainCounterBtnDone: {
    backgroundColor: COLORS.gold,
  },
  mainCounterText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  counterResetBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
  },
});
