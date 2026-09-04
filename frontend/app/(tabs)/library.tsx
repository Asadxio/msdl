import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  TextInput,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBookProgress,
  getAllBooksProgress,
  getBookReadCounts,
  type BookReadingProgress,
} from '@/lib/libraryStorage';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useData, Book } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmptyState, FeedbackBanner, ScalePressable, SkeletonCard } from '@/components/ui';

const RECENTLY_VIEWED_KEY = 'library_recently_viewed_v1';
const MAX_RECENTLY_VIEWED = 10;

// Teacher recommended foundational books
const TEACHER_RECOMMENDED_TITLES = [
  'Risala Roohi Sharif',
  'Misbah-ul-Insha',
  'Qirat Course',
  'Uroos ul Adab',
];

async function getRecentlyViewed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function addRecentlyViewed(bookId: string): Promise<void> {
  try {
    const prev = await getRecentlyViewed();
    const next = [bookId, ...prev.filter((id) => id !== bookId)].slice(0, MAX_RECENTLY_VIEWED);
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Islamic: { bg: '#E8F5E9', text: '#2E7D32' },
  Urdu: { bg: '#FFF3E0', text: '#E65100' },
  Qirat: { bg: '#E3F2FD', text: '#1565C0' },
  Hadith: { bg: '#FCE4EC', text: '#AD1457' },
  Fiqh: { bg: '#F3E5F5', text: '#7B1FA2' },
  Tafseer: { bg: COLORS.goldBg, text: COLORS.goldText },
};

const BOOK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Islamic: 'moon',
  Urdu: 'language',
  Qirat: 'mic',
  Hadith: 'book',
  Fiqh: 'document-text',
  Tafseer: 'reader',
};

function BookCard({
  book,
  isAdmin,
  progress,
  isRecommended,
  rank,
  onDelete,
  onOpen,
}: {
  book: Book;
  isAdmin: boolean;
  progress?: BookReadingProgress;
  isRecommended?: boolean;
  rank?: number;
  onDelete: (book: Book) => void;
  onOpen: (book: Book) => void;
}) {
  const catColor = CATEGORY_COLORS[book.category] || { bg: COLORS.surfaceAlt, text: COLORS.textMuted };
  const iconName = BOOK_ICONS[book.category] || 'book';

  const lastPage = progress?.lastPage || 1;
  const totalPages = progress?.totalPages || 100;
  const hasStarted = lastPage > 1;
  const progressPercent = hasStarted ? Math.min(100, Math.round((lastPage / totalPages) * 100)) : 0;

  return (
    <ScalePressable
      style={styles.card}
      testID={`book-card-${book.id}`}
      onPress={() => onOpen(book)}
    >
      <View style={[styles.coverArea, { backgroundColor: catColor.bg }]}>
        <Ionicons name={iconName} size={36} color={catColor.text} />
        {rank && rank <= 3 ? (
          <View style={[styles.rankBadge, rank === 1 ? styles.rank1Badge : rank === 2 ? styles.rank2Badge : styles.rank3Badge]}>
            <Text style={styles.rankBadgeText}>#{rank}</Text>
          </View>
        ) : isRecommended ? (
          <View style={styles.recommendedBadge}>
            <Ionicons name="star" size={10} color="#92400E" />
            <Text style={styles.recommendedBadgeText}>Recommended</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>

        <View style={styles.bookMetaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
            <Text style={[styles.categoryText, { color: catColor.text }]}>{book.category}</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(book)}
              testID={`delete-book-btn-${book.id}`}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* 7.1 Reading Progress Bar per book */}
        {hasStarted ? (
          <View style={styles.cardProgressContainer}>
            <View style={styles.cardProgressBarTrack}>
              <View style={[styles.cardProgressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.cardProgressStatsRow}>
              <Text style={styles.cardProgressText}>
                p. {lastPage}/{totalPages}
              </Text>
              <Text style={styles.cardProgressPercentText}>{progressPercent}%</Text>
            </View>
          </View>
        ) : null}
      </View>
    </ScalePressable>
  );
}

export default function LibraryScreen() {
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    if (refetchBooks) await refetchBooks();
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books, booksLoading, deleteBook, refetchBooks, error } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all'); // 'all' | 'popular' | 'recommended' | categoryId
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [bookProgressMap, setBookProgressMap] = useState<Record<string, BookReadingProgress>>({});
  const [bookReadCounts, setBookReadCounts] = useState<Record<string, number>>({});
  const refreshSpin = useRef(new Animated.Value(0)).current;

  // Load recently viewed IDs, read progress, and popularity rankings on mount & when books change
  useEffect(() => {
    getRecentlyViewed().then(setRecentlyViewedIds).catch(() => {});
    getBookReadCounts().then(setBookReadCounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!books.length) return;
    const bookIds = books.map((b) => b.id);
    getAllBooksProgress(bookIds)
      .then(setBookProgressMap)
      .catch(() => {});
  }, [books]);

  const handleOpenBook = useCallback((book: Book) => {
    router.push(`/book/${book.id}`);
    addRecentlyViewed(book.id)
      .then(() => getRecentlyViewed())
      .then(setRecentlyViewedIds)
      .catch(() => {});
    // Refresh read counts
    getBookReadCounts().then(setBookReadCounts).catch(() => {});
  }, [router]);

  const recentlyViewedBooks = useMemo(
    () => recentlyViewedIds
      .map((id) => books.find((b) => b.id === id))
      .filter((b): b is Book => !!b)
      .slice(0, 6),
    [recentlyViewedIds, books],
  );

  // 7.3 Most Read / Popular Books ranking
  const popularBookIds = useMemo(() => {
    return Object.entries(bookReadCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => id);
  }, [bookReadCounts]);

  const bookRankMap = useMemo(() => {
    const map: Record<string, number> = {};
    popularBookIds.forEach((id, index) => {
      map[id] = index + 1;
    });
    return map;
  }, [popularBookIds]);

  const teacherRecommendedBooks = useMemo(() => {
    return books.filter((b) =>
      TEACHER_RECOMMENDED_TITLES.some(
        (rec) => b.title.toLowerCase().includes(rec.toLowerCase())
      )
    );
  }, [books]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!refreshing) {
      refreshSpin.stopAnimation();
      refreshSpin.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [refreshSpin, refreshing]);

  const fetchCategoriesOnce = async () => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const snap = await getDocs(q);
    const arr: { id: string; name: string }[] = [];
    snap.forEach((d) => {
      const data = d.data() as { name?: string };
      arr.push({ id: d.id, name: String(data.name || '') });
    });
    setCategories(arr.filter((c) => c.name.trim()));
  };

  const handleRefreshLibrary = async () => {
    if (refreshing) return;
    
    setFeedback(null);
    try {
      const ok = await refetchBooks();
      await fetchCategoriesOnce();
      const readCounts = await getBookReadCounts();
      setBookReadCounts(readCounts);
      if (!ok) throw new Error('library refresh failed');
    } catch {
      setFeedback({ type: 'error', text: 'Unable to refresh library. Please try again.' });
    }
  };

  const refreshRotation = refreshSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: { id: string; name: string }[] = [];
      snap.forEach((d) => {
        const data = d.data() as { name?: string };
        arr.push({ id: d.id, name: String(data.name || '') });
      });
      setCategories(arr.filter((c) => c.name.trim()));
    });
    return unsub;
  }, []);

  const filteredBooks = useMemo(() => {
    let list = books.filter((book) => {
      const matchSearch = !debouncedSearch
        || book.title.toLowerCase().includes(debouncedSearch)
        || book.category.toLowerCase().includes(debouncedSearch);
      return matchSearch;
    });

    if (selectedFilter === 'popular') {
      // Sort by read counts descending
      list = [...list].sort((a, b) => {
        const countA = bookReadCounts[a.id] || 0;
        const countB = bookReadCounts[b.id] || 0;
        return countB - countA;
      });
    } else if (selectedFilter === 'recommended') {
      list = list.filter((b) =>
        TEACHER_RECOMMENDED_TITLES.some(
          (rec) => b.title.toLowerCase().includes(rec.toLowerCase())
        )
      );
    } else if (selectedFilter !== 'all') {
      list = list.filter((b) => b.category_id === selectedFilter);
    }

    return list;
  }, [books, debouncedSearch, selectedFilter, bookReadCounts]);

  const handleDeleteBook = (book: Book) => {
    Alert.alert('Archive Book', `Move "${book.title}" to archive? You can restore later from Firestore backups.`, [
      { text: 'Cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteBook(book.id);
          if (!success) {
            setFeedback({ type: 'error', text: 'Only admin can archive books or request failed.' });
            Alert.alert('Error', 'Only admin can archive books or request failed.');
            return;
          }
          setFeedback({ type: 'success', text: `"${book.title}" archived.` });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle} testID="library-title">Library</Text>
            <Text style={styles.headerSubtitle}>
              {refreshing ? 'Refreshing library...' : booksLoading ? 'Loading...' : `${books.length} books available`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
              testID="library-refresh-btn"
              onPress={handleRefreshLibrary}
              activeOpacity={0.8}
              disabled={refreshing || booksLoading}
              accessibilityRole="button"
              accessibilityLabel="Refresh library"
            >
              <Animated.View style={{ transform: [{ rotate: refreshRotation }] }}>
                <Ionicons name="refresh" size={18} color={COLORS.primary} />
              </Animated.View>
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity
                style={styles.addBtn}
                testID="admin-add-book-btn"
                onPress={() => router.push('/admin/add-book')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {feedback ? (
        <View style={styles.feedbackWrap}>
          <FeedbackBanner type={feedback.type} message={feedback.text} />
        </View>
      ) : null}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search books by title or category"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {/* All */}
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>

          {/* 7.3 Popular Books ranking filter */}
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'popular' && styles.filterChipActive, styles.popularChip]}
            onPress={() => setSelectedFilter('popular')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'popular' && styles.filterChipTextActive]}>
              🔥 Popular
            </Text>
          </TouchableOpacity>

          {/* 7.3 Teacher Recommended filter */}
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'recommended' && styles.filterChipActive, styles.recommendedChip]}
            onPress={() => setSelectedFilter('recommended')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'recommended' && styles.filterChipTextActive]}>
              ⭐ Recommended
            </Text>
          </TouchableOpacity>

          {/* Category Chips */}
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, selectedFilter === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedFilter(cat.id)}
            >
              <Text style={[styles.filterChipText, selectedFilter === cat.id && styles.filterChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetchBooks}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : null}

      {booksLoading ? (
        <View style={styles.loadingList} testID="library-loading">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : filteredBooks.length === 0 ? (
        <View style={styles.centerContainer} testID="library-empty">
          <EmptyState icon="library-outline" message="No books found. Try another search or category." />
          {isAdmin && (
            <ScalePressable
              style={styles.addFirstBtn}
              testID="add-first-book-btn"
              onPress={() => router.push('/admin/add-book')}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addFirstBtnText}>Add First Book</Text>
            </ScalePressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredBooks}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={
            <View>
              {/* Recently Viewed (when not searching) */}
              {recentlyViewedBooks.length > 0 && !debouncedSearch ? (
                <View style={styles.recentlyViewedSection}>
                  <Text style={styles.recentlyViewedTitle}>Recently Viewed</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentlyViewedRow}>
                    {recentlyViewedBooks.map((book) => {
                      const catColor = CATEGORY_COLORS[book.category] || { bg: COLORS.surfaceAlt, text: COLORS.textMuted };
                      return (
                        <TouchableOpacity
                          key={book.id}
                          style={[styles.recentChip, { backgroundColor: catColor.bg }]}
                          onPress={() => { void handleOpenBook(book); }}
                        >
                          <Ionicons name={BOOK_ICONS[book.category] || 'book'} size={14} color={catColor.text} />
                          <Text style={[styles.recentChipText, { color: catColor.text }]} numberOfLines={1}>
                            {book.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* 7.3 Teacher Recommended Section Showcase banner */}
              {selectedFilter === 'all' && !debouncedSearch && teacherRecommendedBooks.length > 0 ? (
                <View style={styles.recommendedSection}>
                  <View style={styles.recommendedHeaderRow}>
                    <Ionicons name="star" size={14} color="#D97706" />
                    <Text style={styles.recommendedHeaderTitle}>Teacher Recommended (اساتذہ کی پسند)</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRow}>
                    {teacherRecommendedBooks.map((recBook) => (
                      <TouchableOpacity
                        key={recBook.id}
                        style={styles.recommendedCard}
                        onPress={() => handleOpenBook(recBook)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.recommendedIconBox}>
                          <Ionicons name="book" size={20} color="#92400E" />
                        </View>
                        <View style={styles.recommendedCardContent}>
                          <Text style={styles.recommendedCardTitle} numberOfLines={1}>{recBook.title}</Text>
                          <Text style={styles.recommendedCardCategory}>{recBook.category}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <BookCard
              book={item}
              isAdmin={isAdmin}
              progress={bookProgressMap[item.id]}
              isRecommended={TEACHER_RECOMMENDED_TITLES.some((t) => item.title.toLowerCase().includes(t.toLowerCase()))}
              rank={selectedFilter === 'popular' ? bookRankMap[item.id] : undefined}
              onDelete={handleDeleteBook}
              onOpen={handleOpenBook}
            />
          )}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
          testID="library-grid"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  headerSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  searchWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '500',
  },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  filterChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  errorBanner: {
    marginHorizontal: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#F2B8B5', backgroundColor: '#FDECEC',
    paddingHorizontal: SPACING.md, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { color: '#B3261E', fontSize: 12, flex: 1 },
  retryText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  refreshBtnDisabled: { opacity: 0.58 },
  addBtn: { padding: 4 },
  loadingList: { padding: SPACING.md, gap: SPACING.sm },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.lg },
  centerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  centerText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', textAlign: 'center' },
  addFirstBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: SPACING.md, borderRadius: RADIUS.full, marginTop: SPACING.md,
  },
  addFirstBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  listContent: { padding: SPACING.md, paddingBottom: 30 },
  columnWrapper: { gap: SPACING.md, marginBottom: SPACING.md },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card,
  },
  coverArea: {
    width: '100%', height: 110, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: SPACING.sm + 4 },
  bookMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bookTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  categoryBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { fontSize: 11, fontWeight: '700' },
  cardBookmarkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBookmarkText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  recentlyViewedSection: { marginBottom: SPACING.md },
  recentlyViewedTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  recentlyViewedRow: { gap: 8 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full,
    maxWidth: 180,
  },
  recentChipText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },

  // 7.1 & 7.3 Library Enhancements Styles
  popularChip: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  recommendedChip: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  rank1Badge: {
    backgroundColor: '#FEF08A',
  },
  rank2Badge: {
    backgroundColor: '#E2E8F0',
  },
  rank3Badge: {
    backgroundColor: '#FED7AA',
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1E293B',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
  },
  cardProgressContainer: {
    marginTop: 8,
    gap: 4,
  },
  cardProgressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  cardProgressBarFill: {
    height: '100%',
    backgroundColor: '#005F46',
    borderRadius: RADIUS.full,
  },
  cardProgressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardProgressText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  cardProgressPercentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#005F46',
  },

  // Recommended showcase banner
  recommendedSection: {
    marginBottom: SPACING.md,
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  recommendedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendedHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendedRow: {
    gap: 8,
  },
  recommendedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
    maxWidth: 200,
  },
  recommendedIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedCardContent: {
    flex: 1,
  },
  recommendedCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  recommendedCardCategory: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
});
