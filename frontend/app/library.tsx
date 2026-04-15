import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, BOOKS, MEDIA } from '@/constants/theme';

const COVER_IMAGES = [MEDIA.coursePlaceholder1, MEDIA.coursePlaceholder2];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Hadith: { bg: '#E8F5E9', text: '#2E7D32' },
  Tafseer: { bg: '#FFF3E0', text: '#E65100' },
  Fiqh: { bg: '#E3F2FD', text: '#1565C0' },
  Virtues: { bg: '#FCE4EC', text: '#AD1457' },
  'Hanafi Fiqh': { bg: '#F3E5F5', text: '#7B1FA2' },
  Spirituality: { bg: COLORS.goldBg, text: COLORS.goldText },
};

function BookCard({ book, index }: { book: typeof BOOKS[0]; index: number }) {
  const catColor = CATEGORY_COLORS[book.category] || { bg: COLORS.surfaceAlt, text: COLORS.textMuted };

  return (
    <View style={styles.card} testID={`book-card-${book.id}`}>
      <Image
        source={{ uri: COVER_IMAGES[index % 2] }}
        style={styles.coverImage}
      />
      <View style={styles.cardBody}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
          <Text style={[styles.categoryText, { color: catColor.text }]}>{book.category}</Text>
        </View>
      </View>
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Library</Text>
        <Text style={styles.headerSubtitle}>Explore Islamic literature</Text>
      </View>
      <FlatList
        data={BOOKS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item, index }) => <BookCard book={item} index={index} />}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        testID="library-grid"
        ListFooterComponent={
          <View style={styles.footer} testID="library-footer">
            <Ionicons name="library-outline" size={40} color={COLORS.border} />
            <Text style={styles.footerText}>More books coming soon</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 30,
  },
  columnWrapper: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  coverImage: {
    width: '100%',
    height: 120,
  },
  cardBody: {
    padding: SPACING.sm + 4,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
