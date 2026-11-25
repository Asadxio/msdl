import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';
import {
  getDuaCategories,
  searchDuas,
  getDuaBookmarks,
  toggleDuaBookmark,
  isDuaBookmarked,
  getDuaCountProgress,
  incrementDuaCount,
  resetDuaCount,
} from '@/lib/duasService';
import { DuaCategory, DuaEntry, DuaBookmark } from '@/types/islamic';

export default function DuasIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isTablet = width >= 600;
  const numColumns = isTablet ? 3 : 2;
  const gridGap = SPACING.md;
  const horizontalPadding = SPACING.lg * 2;
  const cardWidth = (width - horizontalPadding - gridGap * (numColumns - 1)) / numColumns;

  const [categories, setCategories] = useState<DuaCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'categories' | 'bookmarks'>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DuaEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<DuaBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick counter state for search view
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const cats = getDuaCategories();
      setCategories(cats);
      const bms = await getDuaBookmarks();
      setBookmarks(bms);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    const results = searchDuas(text);
    setSearchResults(results);

    // Initialize counts and bookmark states for search results
    results.forEach(async (d) => {
      const c = await getDuaCountProgress(d.id);
      const bm = await isDuaBookmarked(d.id);
      setCounts((prev) => ({ ...prev, [d.id]: c }));
      setBookmarkedMap((prev) => ({ ...prev, [d.id]: bm }));
    });
  };

  const handleToggleBookmark = async (dua: DuaEntry) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const newState = await toggleDuaBookmark(dua);
      setBookmarkedMap((prev) => ({ ...prev, [dua.id]: newState }));
      const updatedBms = await getDuaBookmarks();
      setBookmarks(updatedBms);
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
      await resetDuaCount(duaId);
      setCounts((prev) => ({ ...prev, [duaId]: 0 }));
    } catch {}
  };

  const handleShare = async (dua: DuaEntry) => {
    try {
      const text = `🤲 *${dua.titleEn} | ${dua.titleUr}*\n\n${dua.arabicText}\n\n*English:* ${dua.englishTranslation}\n\n*Urdu:* ${dua.urduTranslation}\n\n*Reference:* ${dua.reference}\n\nShared via SUFFAH Islamic Knowledge`;
      await Share.share({ message: text, title: dua.titleEn });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.emerald} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleEn}>Duas & Azkar</Text>
          <Text style={styles.headerTitleUr}>حصن المسلم • مسنون دعائیں</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/tasbeeh' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Tasbeeh Counter"
        >
          <Ionicons name="finger-print-outline" size={24} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Duas by keyword, Arabic, or Urdu..."
            placeholderTextColor={COLORS.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search Duas"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs (when not searching) */}
      {!searchQuery.trim() && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
            onPress={() => setActiveTab('categories')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'categories' }}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={activeTab === 'categories' ? COLORS.white : COLORS.textSecondary}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
              اقسام (Categories)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
            onPress={() => setActiveTab('bookmarks')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'bookmarks' }}
          >
            <Ionicons
              name="bookmark-outline"
              size={18}
              color={activeTab === 'bookmarks' ? COLORS.white : COLORS.textSecondary}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'bookmarks' && styles.tabTextActive]}>
              محفوظ دعائیں ({bookmarks.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading Duas...</Text>
        </View>
      ) : searchQuery.trim() ? (
        /* Search Results View */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>
            تلاش کے نتائج ({searchResults.length} {searchResults.length === 1 ? 'Dua' : 'Duas'})
          </Text>
          {searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>کوئی دعا نہیں ملی</Text>
              <Text style={styles.emptySubtitle}>No matching Duas found for "{searchQuery}"</Text>
            </View>
          ) : (
            searchResults.map((dua) => (
              <View key={dua.id} style={styles.duaCard}>
                <View style={styles.duaCardHeader}>
                  <View style={styles.titleArea}>
                    <Text style={styles.duaTitleEn}>{dua.titleEn}</Text>
                    <Text style={styles.duaTitleUr}>{dua.titleUr}</Text>
                  </View>
                  <View style={styles.actionsArea}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleToggleBookmark(dua)}
                      accessibilityRole="button"
                      accessibilityLabel="Bookmark Dua"
                    >
                      <Ionicons
                        name={bookmarkedMap[dua.id] ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={bookmarkedMap[dua.id] ? COLORS.gold : COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleShare(dua)}
                      accessibilityRole="button"
                      accessibilityLabel="Share Dua"
                    >
                      <Ionicons name="share-social-outline" size={22} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Arabic Text */}
                <View style={styles.arabicBox}>
                  <Text style={styles.arabicText}>{dua.arabicText}</Text>
                </View>

                {/* Transliteration */}
                <Text style={styles.transliterationText}>{dua.transliteration}</Text>

                {/* English & Urdu Translations */}
                <View style={styles.translationWrap}>
                  <Text style={styles.transHeading}>Translation:</Text>
                  <Text style={styles.transEn}>{dua.englishTranslation}</Text>
                  <Text style={styles.transUr}>{dua.urduTranslation}</Text>
                </View>

                {/* Reference & Repeat Counter */}
                <View style={styles.cardFooter}>
                  <View style={styles.referenceBadge}>
                    <Ionicons name="book-outline" size={14} color={COLORS.emerald} />
                    <Text style={styles.referenceText}>{dua.reference}</Text>
                  </View>

                  <View style={styles.counterSection}>
                    <TouchableOpacity
                      style={[
                        styles.counterBtn,
                        (counts[dua.id] || 0) >= (dua.targetCount || 1) && styles.counterBtnDone,
                      ]}
                      onPress={() => handleIncrement(dua)}
                      accessibilityRole="button"
                      accessibilityLabel={`Repeat counter: ${counts[dua.id] || 0} of ${dua.targetCount || 1}`}
                    >
                      <Ionicons
                        name={
                          (counts[dua.id] || 0) >= (dua.targetCount || 1) ? 'checkmark-circle' : 'finger-print'
                        }
                        size={18}
                        color={COLORS.white}
                      />
                      <Text style={styles.counterBtnText}>
                        {counts[dua.id] || 0} / {dua.targetCount || 1}
                      </Text>
                    </TouchableOpacity>

                    {(counts[dua.id] || 0) > 0 && (
                      <TouchableOpacity
                        style={styles.resetBtn}
                        onPress={() => handleReset(dua.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Reset count"
                      >
                        <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeTab === 'categories' ? (
        /* Categories Grid */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>شعبہ جات منتخب کریں (Select Category)</Text>
          <View style={styles.gridContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, { width: cardWidth }]}
                onPress={() => router.push(`/duas/${cat.id}` as any)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${cat.titleEn}, ${cat.count} Duas`}
              >
                <View style={styles.catIconCircle}>
                  <Ionicons name={(cat.icon as any) || 'book-outline'} size={24} color={COLORS.emerald} />
                </View>
                <Text style={styles.catArabic}>{cat.titleAr}</Text>
                <Text style={styles.catTitleEn} numberOfLines={1}>
                  {cat.titleEn}
                </Text>
                <Text style={styles.catTitleUr} numberOfLines={1}>
                  {cat.titleUr}
                </Text>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{cat.count} دعائیں</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Bookmarks View */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>آپ کی محفوظ کردہ دعائیں (Saved Duas)</Text>
          {bookmarks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>کوئی محفوظ دعا موجود نہیں</Text>
              <Text style={styles.emptySubtitle}>You have not saved any Duas to favorites yet.</Text>
            </View>
          ) : (
            bookmarks.map((bm) => (
              <TouchableOpacity
                key={bm.duaId}
                style={styles.bookmarkItem}
                onPress={() => router.push(`/duas/${bm.categoryId}` as any)}
                accessibilityRole="button"
                accessibilityLabel={bm.titleEn}
              >
                <View style={styles.bmIconCircle}>
                  <Ionicons name="bookmark" size={20} color={COLORS.gold} />
                </View>
                <View style={styles.bmTextWrap}>
                  <Text style={styles.bmTitleEn}>{bm.titleEn}</Text>
                  <Text style={styles.bmTitleUr}>{bm.titleUr}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))
          )}
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
  backButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleEn: {
    fontSize: 18,
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
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F6',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.sm,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
    gap: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: RADIUS.md,
    backgroundColor: '#F0F4F6',
  },
  tabActive: {
    backgroundColor: COLORS.emerald,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: SPACING.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  categoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  catIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  catArabic: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 4,
  },
  catTitleEn: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F291E',
    textAlign: 'center',
    marginBottom: 2,
  },
  catTitleUr: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  catBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emerald,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  duaCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  duaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  titleArea: {
    flex: 1,
    marginRight: SPACING.sm,
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
  actionsArea: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  arabicBox: {
    backgroundColor: '#F8FAF9',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderRightWidth: 4,
    borderRightColor: COLORS.gold,
    marginBottom: SPACING.md,
  },
  arabicText: {
    fontSize: 20,
    lineHeight: 38,
    color: '#0F291E',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  transliterationText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#475569',
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  translationWrap: {
    marginBottom: SPACING.md,
  },
  transHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
    marginBottom: 4,
  },
  transEn: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
    marginBottom: 6,
  },
  transUr: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  referenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  referenceText: {
    fontSize: 11,
    color: COLORS.emerald,
    fontWeight: '600',
  },
  counterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  counterBtnDone: {
    backgroundColor: COLORS.gold,
  },
  counterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  resetBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 64,
  },
  bmIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  bmTextWrap: {
    flex: 1,
  },
  bmTitleEn: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F291E',
  },
  bmTitleUr: {
    fontSize: 13,
    color: COLORS.gold,
    marginTop: 2,
  },
});
