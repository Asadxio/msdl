const fs = require('fs');
const f = 'app/(tabs)/notifications.tsx';
let content = fs.readFileSync(f, 'utf8');

const stateFind = "const [items, setItems] = useState<NotificationItem[]>([]);\r\n  const [loading, setLoading] = useState(true);";
const stateRepl = "const [items, setItems] = useState<NotificationItem[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [searchQuery, setSearchQuery] = useState('');\n  const [activeCategory, setActiveCategory] = useState('All');";
if (content.includes(stateFind)) content = content.replace(stateFind, stateRepl);

const logicFind = "const skeletonRows = useMemo(() => Array.from({ length: 5 }), []);";
const logicRepl = `const skeletonRows = useMemo(() => Array.from({ length: 5 }), []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' 
        ? true 
        : activeCategory === 'Announcements' 
          ? item.category === 'announcement'
          : activeCategory === 'Reminders'
            ? item.category === 'class_reminder'
            : item.category === 'notification';
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, activeCategory]);

  const markAllAsRead = async () => {
    if (!user?.uid) return;
    const unread = items.filter(item => !item.read?.[user.uid]);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map(item => updateDoc(doc(db, 'notifications', item.id), {
        [\`read.\${user.uid}\`]: true,
      })));
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'notifications', operation: 'update', query: \`batch mark read\` }, err);
    }
  };`;
if (content.includes(logicFind)) content = content.replace(logicFind, logicRepl);

const headerFind = `<View style={styles.headerTopRow}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          
        </View>
        <Text style={styles.headerSubtitle}>Latest updates and class reminders</Text>
      </View>`;
const headerRepl = `<View style={styles.headerTopRow}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.headerSubtitle}>Latest updates and class reminders</Text>
        
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notifications..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.categoriesRow}>
          {['All', 'Announcements', 'Reminders'].map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>`;

if (content.includes(headerFind.replace(/\n/g, '\r\n'))) {
  content = content.replace(headerFind.replace(/\n/g, '\r\n'), headerRepl.replace(/\n/g, '\r\n'));
} else if (content.includes(headerFind)) {
  content = content.replace(headerFind, headerRepl);
}

const listFind = "data={items}";
const listRepl = "data={filteredItems}";
if (content.includes(listFind)) content = content.replace(listFind, listRepl);

const stylesFind = "headerSubtitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },";
const stylesRepl = `headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  markAllReadText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 44, marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: COLORS.textMain },
  categoriesRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  categoryChipTextActive: { color: '#fff' },`;

if (content.includes(stylesFind)) content = content.replace(stylesFind, stylesRepl);

fs.writeFileSync(f, content);
console.log('Patched cleanly');
