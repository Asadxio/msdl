import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  HADITH_BOOKS,
  getHadithBookmarks,
  getRecentHadiths,
  searchHadiths,
} from '@/lib/hadithService';
import { goBackOrReplace } from '@/lib/navigation';
import { HadithBook, HadithBookmark, HadithEntry } from '@/types/islamic';

type TabMode = 'collections' | 'bookmarks' | 'recent';

export default function HadithLibraryIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [activeTab, setActiveTab] = useState<TabMode>('collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HadithEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bookmarks, setBookmarks] = useState<HadithBookmark[]>([]);
  const [recent, setRecent] = useState<HadithBookmark[]>([]);

  const loadSavedData = useCallback(async () => {
    const [bms, rec] = await Promise.all([getHadithBookmarks(), getRecentHadiths()]);
    setBookmarks(bms);
    setRecent(rec);
  }, []);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  const handleSearch = useCallback(async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchHadiths(text);
      setSearchResults(res);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const openBook = (bookId: string) => {
    router.push((`/hadith/${bookId}`) as any);
  };

  const openHadithDirect = (bookId: string, hadithNum: number) => {
    router.push((`/hadith/${bookId}?hadithNumber=${hadithNum}`) as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSubtitle}>مكتبة الحديث الشريف</Text>
          <Text style={styles.headerTitle}>Hadith Library</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* ─── Search Bar ─── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.gold} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hadith #, narrator, or keyword (Urdu/English)..."
            placeholderTextColor="#8492A6"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.searchClearBtn}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Tabs Bar ─── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'collections' && styles.tabItemActive]}
          onPress={() => setActiveTab('collections')}
          accessibilityRole="tab"
        >
          <Ionicons
            name="library-outline"
            size={18}
            color={activeTab === 'collections' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === 'collections' && styles.tabLabelActive]}>
            Collections (7)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'bookmarks' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('bookmarks');
            loadSavedData();
          }}
          accessibilityRole="tab"
        >
          <Ionicons
            name="bookmark-outline"
            size={18}
            color={activeTab === 'bookmarks' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === 'bookmarks' && styles.tabLabelActive]}>
            Bookmarks ({bookmarks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'recent' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('recent');
            loadSavedData();
          }}
          accessibilityRole="tab"
        >
          <Ionicons
            name="time-outline"
            size={18}
            color={activeTab === 'recent' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === 'recent' && styles.tabLabelActive]}>
            Recent
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── Content Body ─── */}
      {searchQuery.trim().length > 0 ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>
            {isSearching ? 'Searching...' : `Search Results (${searchResults.length})`}
          </Text>
          {isSearching ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Hadith Found</Text>
              <Text style={styles.emptySubtitle}>Try searching with a hadith number (e.g. 1) or general keyword.</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultCard}
                  onPress={() => openHadithDirect(item.bookId, item.hadithNumber)}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.bookBadge}>{item.bookId.toUpperCase()}</Text>
                    <Text style={styles.hadithNumBadge}>Hadith #{item.hadithNumber}</Text>
                  </View>
                  <Text style={styles.cardArabicSnippet} numberOfLines={2}>
                    {item.arabicText}
                  </Text>
                  <Text style={styles.cardUrduSnippet} numberOfLines={2}>
                    {item.urduText || item.englishText}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : activeTab === 'collections' ? (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introBanner}>
            <Ionicons name="shield-checkmark" size={24} color={COLORS.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Authentic Prophet’s Traditions</Text>
              <Text style={styles.introText}>
                Complete Kutub as-Sittah + Muwatta Malik with Arabic text, Urdu and English translations, and authenticity grades.
              </Text>
            </View>
          </View>

          <View style={[styles.booksGrid, isTablet && styles.booksGridTablet]}>
            {HADITH_BOOKS.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[styles.bookCard, isTablet && styles.bookCardTablet]}
                onPress={() => openBook(book.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${book.titleEnglish}. ${book.totalHadith} hadiths.`}
              >
                <View style={[styles.bookIconBadge, { backgroundColor: book.colorBg }]}>
                  <Ionicons name="book" size={26} color={book.colorFg} />
                </View>

                <View style={styles.bookDetails}>
                  <View style={styles.bookTitleRow}>
                    <Text style={styles.bookTitleEn}>{book.titleEnglish}</Text>
                    <Text style={styles.bookTitleAr}>{book.titleArabic}</Text>
                  </View>
                  <Text style={styles.bookTitleUr}>{book.titleUrdu}</Text>
                  <Text style={styles.bookAuthor}>
                    {book.author} (d. {book.deathYearHijri} AH)
                  </Text>
                  <Text style={styles.bookDesc} numberOfLines={2}>
                    {book.descriptionUr}
                  </Text>

                  <View style={styles.bookFooter}>
                    <View style={styles.statChip}>
                      <Ionicons name="document-text-outline" size={13} color={COLORS.primary} />
                      <Text style={styles.statChipText}>{book.totalHadith.toLocaleString()} Hadiths</Text>
                    </View>
                    <View style={styles.statChip}>
                      <Ionicons name="folder-open-outline" size={13} color={COLORS.gold} />
                      <Text style={styles.statChipText}>{book.totalChapters} Chapters</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : activeTab === 'bookmarks' ? (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 30 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Bookmarks Saved</Text>
              <Text style={styles.emptySubtitle}>Tap the bookmark icon on any hadith to save it here for quick offline access.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.savedCard}
              onPress={() => openHadithDirect(item.bookId, item.hadithNumber)}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.bookBadge}>{item.bookName}</Text>
                <Text style={styles.hadithNumBadge}>#{item.hadithNumber}</Text>
              </View>
              <Text style={styles.cardUrduSnippet} numberOfLines={2}>
                {item.snippet}
              </Text>
              <Text style={styles.timestampText}>
                Saved: {new Date(item.timestamp).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 30 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Recent Hadiths</Text>
              <Text style={styles.emptySubtitle}>Recently read hadiths will automatically appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.savedCard}
              onPress={() => openHadithDirect(item.bookId, item.hadithNumber)}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.bookBadge}>{item.bookName}</Text>
                <Text style={styles.hadithNumBadge}>#{item.hadithNumber}</Text>
              </View>
              <Text style={styles.cardUrduSnippet} numberOfLines={2}>
                {item.snippet}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E23', // Emerald green sanctuary theme
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
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
  headerSubtitle: {
    fontSize: 12,
    color: '#C8A84E',
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerRight: {
    width: 44,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    minHeight: 48,
    gap: 8,
    ...SHADOWS.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMain,
    paddingVertical: 10,
  },
  searchClearBtn: {
    padding: 4,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    gap: 6,
    minHeight: 44,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.card,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  introBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9EE',
    borderWidth: 1,
    borderColor: '#F3E5BE',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 16,
    gap: 12,
  },
  introTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  introText: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 17,
  },
  booksGrid: {
    gap: 12,
  },
  booksGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bookCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    ...SHADOWS.card,
  },
  bookCardTablet: {
    width: '48.5%',
  },
  bookIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDetails: {
    flex: 1,
  },
  bookTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookTitleEn: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  bookTitleAr: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    writingDirection: 'rtl',
  },
  bookTitleUr: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 2,
    writingDirection: 'rtl',
  },
  bookAuthor: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  bookDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
    writingDirection: 'rtl',
  },
  bookFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  statChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.md,
  },
  resultsHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 10,
  },
  listContent: {
    padding: SPACING.md,
    gap: 12,
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    ...SHADOWS.card,
  },
  savedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    ...SHADOWS.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hadithNumBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
  },
  cardArabicSnippet: {
    fontSize: 14,
    color: '#0F172A',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  cardUrduSnippet: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  timestampText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
