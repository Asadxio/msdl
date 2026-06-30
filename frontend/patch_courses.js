const fs = require('fs');
const f = 'app/(tabs)/courses.tsx';
let content = fs.readFileSync(f, 'utf8');

// Fix headerSubtitle
content = content.replace(
  "headerSubtitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },",
  "headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },"
);

// Improve Search Input
content = content.replace(
  `<TextInput
          style={styles.searchInput}
          placeholder="Search courses or teachers"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />`,
  `<View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses or teachers..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
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
    marginTop: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.textMain,
    fontSize: 15,
  },`
);

// Add Badge to Image and improve card body
content = content.replace(
  `<Image source={{ uri: getCourseImage(index) }} style={styles.cardImage} />`,
  `<View>
        <Image source={{ uri: getCourseImage(index) }} style={styles.cardImage} />
        {progress.completionPercent === 100 && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        )}
      </View>`
);

// Button styling
content = content.replace(
  `<View style={styles.attendBtn}>
          <Text style={styles.attendBtnText}>Open Course</Text>
        </View>`,
  `<View style={[styles.attendBtn, progress.completionPercent > 0 && styles.attendBtnActive]}>
          <Text style={[styles.attendBtnText, progress.completionPercent > 0 && styles.attendBtnTextActive]}>
            {progress.completionPercent > 0 && progress.completionPercent < 100 ? 'Continue Learning' : 'Open Course'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={progress.completionPercent > 0 ? '#FFFFFF' : COLORS.goldText} />
        </View>`
);

// Additional styles (inject right after StyleSheet.create)
const extraStyles = `
  completedBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.success, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, gap: 4 },
  completedBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  attendBtnActive: { backgroundColor: COLORS.primary },
  attendBtnTextActive: { color: '#FFFFFF' },`;
content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + extraStyles);

fs.writeFileSync(f, content);
console.log('courses.tsx patched correctly');
