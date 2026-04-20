import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useData, Book } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmptyState, FeedbackBanner, ScalePressable, SkeletonCard } from '@/components/ui';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Islamic: { bg: '#E8F5E9', text: '#2E7D32' },
  Urdu: { bg: '#FFF3E0', text: '#E65100' },
  Qirat: { bg: '#E3F2FD', text: '#1565C0' },
  Hadith: { bg: '#FCE4EC', text: '#AD1457' },
  Fiqh: { bg: '#F3E5F5', text: '#7B1FA2' },
  Tafseer: { bg: COLORS.goldBg, text: COLORS.goldText },
};

const BOOK_ICONS: Record<string, string> = {
  Islamic: 'moon',
  Urdu: 'language',
  Qirat: 'mic',
  Hadith: 'book',
  Fiqh: 'document-text',
  Tafseer: 'reader',
};

function BookCard({ book, isAdmin, onDelete }: { book: Book; isAdmin: boolean; onDelete: (book: Book) => void }) {
  const router = useRouter();
  const catColor = CATEGORY_COLORS[book.category] || { bg: COLORS.surfaceAlt, text: COLORS.textMuted };
  const iconName = BOOK_ICONS[book.category] || 'book';

  return (
    <ScalePressable
      style={styles.card}
      testID={`book-card-${book.id}`}
      onPress={() => router.push(`/book/${book.id}`)}
    >
      <View style={[styles.coverArea, { backgroundColor: catColor.bg }]}>
        <Ionicons name={iconName as any} size={36} color={catColor.text} />
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
      </View>
    </ScalePressable>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books, booksLoading, deleteBook, refetchBooks, error } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: { id: string; name: string }[] = [];
      snap.forEach((d) => arr.push({ id: d.id, name: String((d.data() as any).name || '') }));
      setCategories(arr.filter((c) => c.name.trim()));
    });
    return unsub;
  }, []);

  const filteredBooks = useMemo(() => books.filter((book) => {
    const matchSearch = !debouncedSearch
      || book.title.toLowerCase().includes(debouncedSearch)
      || book.category.toLowerCase().includes(debouncedSearch);
    const matchCategory = !selectedCategoryId || book.category_id === selectedCategoryId;
    return matchSearch && matchCategory;
  }), [books, debouncedSearch, selectedCategoryId]);

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
              {booksLoading ? 'Loading...' : `${books.length} books available`}
            </Text>
          </View>
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
          <TouchableOpacity style={[styles.filterChip, !selectedCategoryId && styles.filterChipActive]} onPress={() => setSelectedCategoryId('')}>
            <Text style={[styles.filterChipText, !selectedCategoryId && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.id} style={[styles.filterChip, selectedCategoryId === cat.id && styles.filterChipActive]} onPress={() => setSelectedCategoryId(cat.id)}>
              <Text style={[styles.filterChipText, selectedCategoryId === cat.id && styles.filterChipTextActive]}>{cat.name}</Text>
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
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => <BookCard book={item} isAdmin={isAdmin} onDelete={handleDeleteBook} />}
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
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  feedbackWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  searchWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },
  searchInput: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textMain,
  },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  filterChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.primary },
  errorBanner: {
    marginHorizontal: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: '#F2B8B5', backgroundColor: '#FDECEC',
    paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { color: '#B3261E', fontSize: 12, flex: 1 },
  retryText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  addBtn: { padding: 4 },
  loadingList: { padding: SPACING.md, gap: SPACING.sm },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.lg },
  centerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  centerText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500', textAlign: 'center' },
  addFirstBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.lg, marginTop: SPACING.md,
  },
  addFirstBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  listContent: { padding: SPACING.md, paddingBottom: 30 },
  columnWrapper: { gap: SPACING.md, marginBottom: SPACING.md },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    overflow: 'hidden', ...SHADOWS.card,
  },
  coverArea: {
    width: '100%', height: 110, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: SPACING.sm + 4 },
  bookMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bookTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  categoryText: { fontSize: 11, fontWeight: '700' },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
});
