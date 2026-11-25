import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme, useReadingPreferences } from '@/context/ThemeContext';
import { useGlobalAudio } from '@/context/GlobalAudioContext';
import { ReadingControlsSheet } from '@/components/ui/ReadingControlsSheet';
import {
  HADITH_BOOKS,
  addRecentHadith,
  getHadithChapters,
  getHadiths,
  isHadithBookmarked,
  toggleHadithBookmark,
} from '@/lib/hadithService';
import { goBackOrReplace } from '@/lib/navigation';
import { HadithBook, HadithBookId, HadithChapter, HadithEntry } from '@/types/islamic';

export default function HadithReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { readingPreferences } = useReadingPreferences();
  const { playTrack, pauseTrack, currentTrack, isPlaying } = useGlobalAudio();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { book: bookParam, hadithNumber: queryHadithNumber } = useLocalSearchParams<{
    book: string;
    hadithNumber?: string;
  }>();

  const bookId = (bookParam as HadithBookId) || 'bukhari';
  const bookInfo: HadithBook =
    HADITH_BOOKS.find((b) => b.id === bookId) || HADITH_BOOKS[0];

  const [chapters, setChapters] = useState<HadithChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [hadiths, setHadiths] = useState<HadithEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [showChapterModal, setShowChapterModal] = useState<boolean>(false);
  const [showReadingControls, setShowReadingControls] = useState<boolean>(false);
  const [jumpHadithInput, setJumpHadithInput] = useState<string>('');

  // Load chapters
  useEffect(() => {
    getHadithChapters(bookId).then((chList) => {
      setChapters(chList);
    });
  }, [bookId]);

  // Load Hadiths for chapter & page
  const loadHadithData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHadiths(bookId, selectedChapter, page, 10);
      setHadiths(res.hadiths);
      setTotalCount(res.total);

      // check bookmark status for each
      const bMap: Record<string, boolean> = {};
      for (const h of res.hadiths) {
        bMap[h.id] = await isHadithBookmarked(h.id);
        if (h.hadithNumber === Number(queryHadithNumber)) {
          addRecentHadith(h, bookInfo.titleEnglish);
        }
      }
      setBookmarkedMap(bMap);

      if (res.hadiths.length > 0 && !queryHadithNumber) {
        addRecentHadith(res.hadiths[0], bookInfo.titleEnglish);
      }
    } finally {
      setLoading(false);
    }
  }, [bookId, selectedChapter, page, queryHadithNumber, bookInfo.titleEnglish]);

  useEffect(() => {
    loadHadithData();
  }, [loadHadithData]);

  const handleToggleBookmark = async (hadith: HadithEntry) => {
    const isNowBookmarked = await toggleHadithBookmark(hadith, bookInfo.titleEnglish);
    setBookmarkedMap((prev) => ({ ...prev, [hadith.id]: isNowBookmarked }));
  };

  const handleShareHadith = (hadith: HadithEntry) => {
    const shareMessage = `📖 ${bookInfo.titleEnglish} — Hadith #${hadith.hadithNumber}\n\n${hadith.arabicText}\n\nاردو ترجمہ:\n${hadith.urduText}\n\nEnglish Translation:\n${hadith.englishText}\n\nحوالہ: ${bookInfo.titleUrdu} | باب ${hadith.chapterNumber}\n\nShared via SUFFAH Islamic Education`;
    Share.share({ message: shareMessage });
  };

  const handleJumpToHadith = () => {
    const target = parseInt(jumpHadithInput.trim(), 10);
    if (!target) return;
    setShowChapterModal(false);
    setJumpHadithInput('');
    // Calculate approximate page or chapter
    loadHadithData();
  };

  const currentChapterObj = chapters.find((c) => c.chapterNumber === selectedChapter);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/hadith')}
          accessibilityRole="button"
          accessibilityLabel="Go back to collections"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setShowChapterModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.headerBookName}>{bookInfo.titleEnglish}</Text>
          <View style={styles.chapterBadgeRow}>
            <Text style={styles.headerChapterName} numberOfLines={1}>
              Ch {selectedChapter}: {currentChapterObj?.titleEnglish || 'General'}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#C8A84E" />
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.chapterSelectBtn}
            onPress={() => setShowReadingControls(true)}
            accessibilityRole="button"
            accessibilityLabel="Reading and text settings"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="text" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chapterSelectBtn}
            onPress={() => setShowChapterModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Open chapters index"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="list" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Chapter Title Sub-Bar ─── */}
      <View style={styles.subBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subBarUrdu} numberOfLines={1}>
            {currentChapterObj?.titleUrdu || bookInfo.titleUrdu}
          </Text>
          <Text style={styles.subBarMeta}>
            Showing {hadiths.length} Hadiths • Page {page}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.changeChapterChip}
          onPress={() => setShowChapterModal(true)}
        >
          <Ionicons name="swap-horizontal" size={14} color={COLORS.primary} />
          <Text style={styles.changeChapterText}>Change Chapter</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Hadith Cards List ─── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading authentic narrations...</Text>
        </View>
      ) : (
        <FlatList
          data={hadiths}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { backgroundColor: colors.background },
            isTablet && styles.listContentTablet,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isBookmarked = !!bookmarkedMap[item.id];
            const isCurrentPlaying = currentTrack?.id === item.id && isPlaying;
            return (
              <View
                style={[
                  styles.hadithCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardTopRow}>
                  <View style={styles.badgeGroup}>
                    <View style={styles.hadithNumberPill}>
                      <Text style={styles.hadithNumberText}>#{item.hadithNumber}</Text>
                    </View>
                    {item.grades && item.grades.length > 0 ? (
                      <View
                        style={[
                          styles.gradePill,
                          item.grades[0].grade.toLowerCase().includes('sahih')
                            ? styles.gradeSahih
                            : styles.gradeHasan,
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color={
                            item.grades[0].grade.toLowerCase().includes('sahih')
                              ? '#059669'
                              : '#D97706'
                          }
                        />
                        <Text
                          style={[
                            styles.gradeText,
                            item.grades[0].grade.toLowerCase().includes('sahih')
                              ? { color: '#059669' }
                              : { color: '#D97706' },
                          ]}
                        >
                          {item.grades[0].grade}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.gradePill, styles.gradeSahih]}>
                        <Text style={[styles.gradeText, { color: '#059669' }]}>Authentic (صحیح)</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => {
                        if (isCurrentPlaying) {
                          pauseTrack();
                        } else {
                          playTrack({
                            id: item.id,
                            titleEn: `${bookInfo.titleEnglish} #${item.hadithNumber}`,
                            subtitle: item.urduText.slice(0, 85) || item.englishText.slice(0, 85),
                            audioUrl: `https://everyayah.com/data/hadith/${item.id}.mp3`,
                            category: 'hadith',
                            arabicTitle: item.arabicText.slice(0, 60),
                          });
                        }
                      }}
                      style={[
                        styles.iconBtn,
                        { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' },
                        isCurrentPlaying && {
                          backgroundColor: isDark ? 'rgba(198, 161, 91, 0.25)' : '#FEF3C7',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Listen to Hadith narration"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isCurrentPlaying ? 'pause' : 'volume-high-outline'}
                        size={18}
                        color={isCurrentPlaying ? colors.gold : colors.primary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleToggleBookmark(item)}
                      style={[
                        styles.iconBtn,
                        { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Bookmark this hadith"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                        size={18}
                        color={isBookmarked ? colors.gold : colors.textSecondary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleShareHadith(item)}
                      style={[
                        styles.iconBtn,
                        { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Share hadith"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="share-social-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Narrator */}
                {item.narrator ? (
                  <View
                    style={[
                      styles.narratorBox,
                      { backgroundColor: isDark ? colors.surfaceAlt : '#FEF9EE' },
                    ]}
                  >
                    <Ionicons name="person-circle-outline" size={14} color={colors.gold} />
                    <Text style={[styles.narratorText, { color: colors.gold }]}>
                      {item.narrator}
                    </Text>
                  </View>
                ) : null}

                {/* Arabic Text */}
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
                  {item.arabicText}
                </Text>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Urdu Translation */}
                {readingPreferences.showUrduTranslation !== false && (
                  <View style={styles.translationBlock}>
                    <Text style={[styles.languageLabel, { color: colors.primary }]}>اردو ترجمہ</Text>
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
                      {item.urduText || 'ترجمہ دستیاب نہیں'}
                    </Text>
                  </View>
                )}

                {/* English Translation */}
                {readingPreferences.showEnglishTranslation !== false && item.englishText ? (
                  <View style={[styles.translationBlock, { marginTop: 12 }]}>
                    <Text style={[styles.languageLabel, { color: colors.primary }]}>English Translation</Text>
                    <Text
                      style={[
                        styles.englishText,
                        {
                          fontSize: readingPreferences.translationFontSize,
                          lineHeight: Math.round(readingPreferences.translationFontSize * 1.5),
                          color: colors.textSecondary,
                        },
                      ]}
                    >
                      {item.englishText}
                    </Text>
                  </View>
                ) : null}

                {/* Footer Reference */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.footerRefText, { color: colors.textSecondary }]}>
                    {bookInfo.titleEnglish} • Book {item.reference.book}, Hadith {item.reference.hadith}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageNavBtn, page <= 1 && styles.pageNavBtnDisabled]}
                onPress={() => page > 1 && setPage(page - 1)}
                disabled={page <= 1}
              >
                <Ionicons name="arrow-back" size={16} color={page <= 1 ? '#94A3B8' : '#FFFFFF'} />
                <Text style={[styles.pageNavText, page <= 1 && { color: '#94A3B8' }]}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicator}>Page {page}</Text>

              <TouchableOpacity
                style={styles.pageNavBtn}
                onPress={() => setPage(page + 1)}
              >
                <Text style={styles.pageNavText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ─── Chapter Selector Modal ─── */}
      <Modal
        visible={showChapterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowChapterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Chapters of {bookInfo.titleEnglish}</Text>
                <Text style={styles.modalSubtitle}>فہرست ابواب</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowChapterModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            {/* Jump to Hadith Input */}
            <View style={styles.jumpRow}>
              <TextInput
                style={styles.jumpInput}
                placeholder="Jump to Hadith #..."
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={jumpHadithInput}
                onChangeText={setJumpHadithInput}
              />
              <TouchableOpacity style={styles.jumpBtn} onPress={handleJumpToHadith}>
                <Text style={styles.jumpBtnText}>Go</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: SPACING.md, gap: 8 }}
              renderItem={({ item }) => {
                const isSelected = item.chapterNumber === selectedChapter;
                return (
                  <TouchableOpacity
                    style={[styles.chapterItem, isSelected && styles.chapterItemActive]}
                    onPress={() => {
                      setSelectedChapter(item.chapterNumber);
                      setPage(1);
                      setShowChapterModal(false);
                    }}
                  >
                    <View style={[styles.chapterNumCircle, isSelected && styles.chapterNumCircleActive]}>
                      <Text style={[styles.chapterNumText, isSelected && { color: '#FFFFFF' }]}>
                        {item.chapterNumber}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.chapterItemTitleEn, isSelected && { color: COLORS.primary }]}>
                        {item.titleEnglish}
                      </Text>
                      <Text style={styles.chapterItemTitleUr}>{item.titleUrdu}</Text>
                    </View>
                    <Text style={styles.chapterItemCount}>{item.hadithCount} hadiths</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

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
    backgroundColor: '#002E23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerBookName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  chapterBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerChapterName: {
    fontSize: 11,
    color: '#C8A84E',
    fontWeight: '700',
    maxWidth: 220,
  },
  chapterSelectBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 10,
  },
  subBarUrdu: {
    fontSize: 13,
    color: '#FDE68A',
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  subBarMeta: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  changeChapterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    minHeight: 36,
  },
  changeChapterText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  loadingBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 16,
  },
  listContentTablet: {
    paddingHorizontal: 32,
  },
  hadithCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hadithNumberPill: {
    backgroundColor: '#002E23',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  hadithNumberText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#C8A84E',
  },
  gradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  gradeSahih: {
    backgroundColor: '#ECFDF5',
  },
  gradeHasan: {
    backgroundColor: '#FEF3C7',
  },
  gradeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  narratorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  narratorText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '700',
  },
  arabicText: {
    fontSize: 18,
    lineHeight: 32,
    color: '#0F172A',
    fontWeight: '700',
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  translationBlock: {
    gap: 4,
  },
  languageLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urduText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1E293B',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  englishText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  footerRefText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    gap: 6,
    minHeight: 44,
  },
  pageNavBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  pageNavText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.primary,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  jumpRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  jumpInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.textMain,
    minHeight: 40,
  },
  jumpBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
    gap: 12,
  },
  chapterItemActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  chapterNumCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumCircleActive: {
    backgroundColor: COLORS.primary,
  },
  chapterNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  chapterItemTitleEn: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  chapterItemTitleUr: {
    fontSize: 11,
    color: COLORS.textSecondary,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  chapterItemCount: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
