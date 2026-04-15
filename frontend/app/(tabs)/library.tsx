import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useData, Book } from '@/context/DataContext';

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

function BookCard({ book }: { book: Book }) {
  const router = useRouter();
  const catColor = CATEGORY_COLORS[book.category] || { bg: COLORS.surfaceAlt, text: COLORS.textMuted };
  const iconName = BOOK_ICONS[book.category] || 'book';

  return (
    <TouchableOpacity
      style={styles.card}
      testID={`book-card-${book.id}`}
      activeOpacity={0.85}
      onPress={() => router.push(`/book/${book.id}`)}
    >
      <View style={[styles.coverArea, { backgroundColor: catColor.bg }]}>
        <Ionicons name={iconName as any} size={36} color={catColor.text} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
          <Text style={[styles.categoryText, { color: catColor.text }]}>{book.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books, booksLoading } = useData();
  let adminTapCount = 0;
  let lastTap = 0;

  const handleAdminAccess = () => {
    const now = Date.now();
    if (now - lastTap < 500) {
      adminTapCount++;
    } else {
      adminTapCount = 1;
    }
    lastTap = now;
    if (adminTapCount >= 5) {
      adminTapCount = 0;
      router.push('/admin/add-book');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <TouchableOpacity activeOpacity={1} onPress={handleAdminAccess}>
              <Text style={styles.headerTitle} testID="library-title">Library</Text>
            </TouchableOpacity>
            <Text style={styles.headerSubtitle}>
              {booksLoading ? 'Loading...' : `${books.length} books available`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            testID="admin-add-book-btn"
            onPress={() => router.push('/admin/add-book')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {booksLoading ? (
        <View style={styles.centerContainer} testID="library-loading">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading books...</Text>
        </View>
      ) : books.length === 0 ? (
        <View style={styles.centerContainer} testID="library-empty">
          <Ionicons name="library-outline" size={56} color={COLORS.border} />
          <Text style={styles.centerTitle}>No books yet</Text>
          <Text style={styles.centerText}>Books will appear here once added</Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            testID="add-first-book-btn"
            onPress={() => router.push('/admin/add-book')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addFirstBtnText}>Add First Book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => <BookCard book={item} />}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
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
  addBtn: { padding: 4 },
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
  bookTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  categoryText: { fontSize: 11, fontWeight: '700' },
});
