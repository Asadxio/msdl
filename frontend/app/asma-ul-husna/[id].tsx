import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useGlobalAudio } from '@/context/GlobalAudioContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  getNameById,
  isNameFavorite,
  toggleFavoriteName,
} from '@/lib/asmaUlHusnaService';
import { AllahName } from '@/types/islamic';

export default function AsmaNameDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { playTrack, pauseTrack, currentTrack, isPlaying } = useGlobalAudio();
  const { id } = useLocalSearchParams<{ id: string }>();

  const nameId = parseInt(id || '1', 10);
  const [nameData, setNameData] = useState<AllahName | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadName(nameId);
  }, [nameId]);

  const loadName = async (targetId: number) => {
    try {
      setLoading(true);
      const item = getNameById(targetId);
      if (item) {
        setNameData(item);
      }
      const fav = await isNameFavorite(targetId);
      setIsFavorite(fav);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFav = async () => {
    if (!nameData) return;
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const updated = await toggleFavoriteName(nameData.id);
      setIsFavorite(updated);
    } catch {}
  };

  const isCurrentPlaying =
    nameData ? currentTrack?.id === `asma-${nameData.id}` && isPlaying : false;

  const handlePlayAudio = () => {
    if (!nameData) return;

    if (isCurrentPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: `asma-${nameData.id}`,
        titleEn: `#${nameData.id} ${nameData.transliteration} (${nameData.arabic})`,
        subtitle: `${nameData.urduMeaning} • ${nameData.englishMeaning}`,
        audioUrl: nameData.audioUrl || '',
        category: 'asma',
        arabicTitle: nameData.arabic,
      });
    }
  };

  const handleShare = async () => {
    if (!nameData) return;
    try {
      const quranRef = nameData.quranicReference || nameData.quranicVerse || 'Holy Quran';
      const text = `✨ *${nameData.arabic}* (Name #${nameData.id})\n*${nameData.transliteration}* — ${nameData.englishMeaning}\n*اردو:* ${nameData.urduMeaning}\n\n*Quranic Proof:* "${quranRef}"\n\n*Reflection:* ${nameData.explanationEn}\n\nShared via SUFFAH Islamic Knowledge`;
      await Share.share({ message: text, title: nameData.transliteration });
    } catch {}
  };

  const handleNavigateNext = () => {
    if (nameId < 99) {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      router.replace(`/asma-ul-husna/${nameId + 1}` as any);
    }
  };

  const handleNavigatePrev = () => {
    if (nameId > 1) {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      router.replace(`/asma-ul-husna/${nameId - 1}` as any);
    }
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
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/asma-ul-husna')}
          accessibilityRole="button"
          accessibilityLabel="Back to 99 Names"
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>اسم مبارک #{nameId}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.gold }]}>
            {nameData?.transliteration || ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleToggleFav}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={22}
              color={isFavorite ? colors.gold : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share this Name"
          >
            <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body */}
      {loading || !nameData ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading reflection...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
        >
          {/* Hero Calligraphy Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>#{nameData.id} / 99</Text>
              </View>
              {nameData.audioUrl && (
                <TouchableOpacity
                  style={[styles.audioPill, isCurrentPlaying && styles.audioPillPlaying]}
                  onPress={handlePlayAudio}
                  accessibilityRole="button"
                  accessibilityLabel={isCurrentPlaying ? 'Pause pronunciation' : 'Listen to pronunciation'}
                >
                  <Ionicons
                    name={isCurrentPlaying ? 'pause-circle' : 'volume-medium'}
                    size={18}
                    color={COLORS.white}
                  />
                  <Text style={styles.audioPillText}>{isCurrentPlaying ? 'روکیں' : 'تلفظ سنیں'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text
              style={[
                styles.heroArabic,
                { color: isDark ? colors.gold : colors.primary },
              ]}
            >
              {nameData.arabic}
            </Text>
            <Text style={[styles.heroTranslit, { color: colors.text }]}>
              {nameData.transliteration}
            </Text>

            <View style={styles.meaningsWrap}>
              <View style={styles.meaningItem}>
                <Text style={[styles.meaningLabel, { color: colors.textSecondary }]}>
                  English Meaning
                </Text>
                <Text style={[styles.meaningTextEn, { color: colors.text }]}>
                  {nameData.englishMeaning}
                </Text>
              </View>
              <View style={[styles.meaningDivider, { backgroundColor: colors.border }]} />
              <View style={styles.meaningItem}>
                <Text style={[styles.meaningLabelUr, { color: colors.gold }]}>اردو معنی</Text>
                <Text style={[styles.meaningTextUr, { color: colors.text }]}>
                  {nameData.urduMeaning}
                </Text>
              </View>
            </View>
          </View>

          {/* Quranic Citation */}
          <View
            style={[
              styles.quranCard,
              {
                backgroundColor: isDark ? colors.surfaceAlt : '#F0FDF4',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.quranHeader}>
              <Ionicons name="book" size={18} color={colors.primary} />
              <Text style={[styles.quranTitle, { color: colors.primary }]}>
                قرآنی سند • Quranic Reference
              </Text>
            </View>
            <Text style={[styles.quranVerse, { color: colors.text }]}>
              &quot;{nameData.quranicReference || nameData.quranicVerse}&quot;
            </Text>
          </View>

          {/* Detailed Theological Explanations */}
          <View
            style={[
              styles.reflectionCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.reflectionHeader}>
              <Ionicons name="sparkles" size={18} color={colors.gold} />
              <Text style={[styles.reflectionTitle, { color: colors.gold }]}>
                Theological Reflection • تفہیم و فضیلت
              </Text>
            </View>

            {/* Urdu Reflection */}
            <View style={styles.explBlock}>
              <Text style={[styles.explHeadingUr, { color: colors.primary }]}>
                اردو میں مفہوم و تشریح:
              </Text>
              <Text style={[styles.explUrdu, { color: colors.text }]}>
                {nameData.explanationUr}
              </Text>
            </View>

            {/* English Reflection */}
            <View style={styles.explBlock}>
              <Text style={[styles.explHeadingEn, { color: colors.primary }]}>
                Spiritual Significance in Islam:
              </Text>
              <Text style={[styles.explEn, { color: colors.textSecondary }]}>
                {nameData.explanationEn}
              </Text>
            </View>
          </View>

          {/* Next / Previous Navigation Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity
              style={[styles.navBtn, nameId <= 1 && styles.navBtnDisabled]}
              onPress={handleNavigatePrev}
              disabled={nameId <= 1}
              accessibilityRole="button"
              accessibilityLabel="Previous Name"
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={nameId <= 1 ? COLORS.textTertiary : COLORS.emerald}
              />
              <Text style={[styles.navBtnText, nameId <= 1 && styles.navBtnTextDisabled]}>
                پچھلا (Prev)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.allNamesBtn}
              onPress={() => goBackOrReplace(router, '/asma-ul-husna')}
              accessibilityRole="button"
              accessibilityLabel="View All 99 Names"
            >
              <Ionicons name="grid-outline" size={18} color={COLORS.white} />
              <Text style={styles.allNamesText}>تمام اسماء</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navBtn, nameId >= 99 && styles.navBtnDisabled]}
              onPress={handleNavigateNext}
              disabled={nameId >= 99}
              accessibilityRole="button"
              accessibilityLabel="Next Name"
            >
              <Text style={[styles.navBtnText, nameId >= 99 && styles.navBtnTextDisabled]}>
                اگلا (Next)
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={nameId >= 99 ? COLORS.textTertiary : COLORS.emerald}
              />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
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
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F291E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 2,
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
  heroCard: {
    backgroundColor: '#0F291E',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8A84E50',
    ...SHADOWS.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.md,
  },
  numberBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  numberText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gold,
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  audioPillPlaying: {
    backgroundColor: '#DC2626',
  },
  audioPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  heroArabic: {
    fontSize: 46,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
    lineHeight: 70,
    marginBottom: SPACING.sm,
  },
  heroTranslit: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  meaningsWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
  },
  meaningItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  meaningDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  meaningLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  meaningTextEn: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
  },
  meaningLabelUr: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  meaningTextUr: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
  },
  quranCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  quranHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  quranTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854D0E',
  },
  quranVerse: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#713F12',
    lineHeight: 22,
  },
  reflectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reflectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F291E',
  },
  explBlock: {
    marginBottom: SPACING.lg,
  },
  explHeadingUr: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.emerald,
    marginBottom: 6,
    textAlign: 'right',
  },
  explUrdu: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  explHeadingEn: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.emerald,
    marginBottom: 6,
  },
  explEn: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 24,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.emerald,
  },
  navBtnTextDisabled: {
    color: COLORS.textTertiary,
  },
  allNamesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  allNamesText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
