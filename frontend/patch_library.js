const fs = require('fs');
const f = 'app/(tabs)/library.tsx';
let content = fs.readFileSync(f, 'utf8');

// 1. Fix headerSubtitle
content = content.replace(
  "headerSubtitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },",
  "headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },"
);

// 2. Improve Search Input UI
content = content.replace(
  `<View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search books by title or category"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />`,
  `<View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search books by title or category..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>`
);

content = content.replace(
  `searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },`,
  `searchBar: {
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
    fontSize: 15,
  },`
);

// 3. Improve Empty State (Instant Search Feedback)
content = content.replace(
  `{booksLoading ? (
        <View style={styles.loadingList} testID="library-loading">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : filteredBooks.length === 0 ? (
        <View style={styles.centerContainer} testID="library-empty">
          <EmptyState icon="library-outline" message="No books found. Try another search or category." />`,
  `{booksLoading ? (
        <View style={styles.loadingList} testID="library-loading">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : filteredBooks.length === 0 ? (
        <View style={styles.centerContainer} testID="library-empty">
          <EmptyState icon="search-outline" title="No results found" message="We couldn't find any books matching your search. Try adjusting your keywords or category." />`
);

fs.writeFileSync(f, content);
console.log('library.tsx patched');
