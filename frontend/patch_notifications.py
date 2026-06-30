import re

with open('app/(tabs)/notifications.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add Imports
if "import AsyncStorage" not in code:
    code = code.replace(
        "import { registerDevicePushToken",
        "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { Swipeable } from 'react-native-gesture-handler';\nimport { registerDevicePushToken"
    )

# 2. Add pinnedIds and readSegment state
if "const [pinnedIds, setPinnedIds]" not in code:
    code = code.replace(
        "const [focusedEditField, setFocusedEditField] = useState<'editTitle' | 'editMessage' | null>(null);",
        "const [focusedEditField, setFocusedEditField] = useState<'editTitle' | 'editMessage' | null>(null);\n  const [pinnedIds, setPinnedIds] = useState<string[]>([]);\n  const [readSegment, setReadSegment] = useState<'All' | 'Unread' | 'Read'>('All');"
    )

# 3. Add togglePin and AsyncStorage logic
if "const togglePin = async" not in code:
    code = code.replace(
        "const perfRef = useRef",
        """useEffect(() => {
    AsyncStorage.getItem('pinned_notifications').then(res => {
      if (res) setPinnedIds(JSON.parse(res));
    }).catch(() => {});
  }, []);

  const togglePin = async (id: string) => {
    const next = pinnedIds.includes(id) ? pinnedIds.filter(pid => pid !== id) : [...pinnedIds, id];
    setPinnedIds(next);
    await AsyncStorage.setItem('pinned_notifications', JSON.stringify(next)).catch(() => {});
  };

  const perfRef = useRef"""
    )

# 4. Add markAsUnread
if "const markAsUnread = async" not in code:
    code = code.replace(
        "const unreadCount =",
        """const markAsUnread = async (item: NotificationItem) => {
    if (!user?.uid) return;
    if (!item.read?.[user.uid]) return;
    try {
      await updateDoc(doc(db, 'notifications', item.id), {
        [`read.${user.uid}`]: false,
      });
    } catch (err: unknown) {
      logFirestoreFailure({ collection: 'notifications', operation: 'update', query: `doc notifications/${item.id} mark unread` }, err);
    }
  };

  const unreadCount ="""
    )

# 5. Update filteredItems
old_filter = """  const filteredItems = useMemo(() => {
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
  }, [items, searchQuery, activeCategory]);"""

new_filter = """  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = item.title.toLowerCase().includes(q) || item.message.toLowerCase().includes(q);
      
      const isUnread = !item.read?.[user?.uid || ''];
      const matchesSegment = readSegment === 'All' 
        ? true 
        : readSegment === 'Unread' ? isUnread : !isUnread;

      let matchesCategory = true;
      if (activeCategory !== 'All') {
        const cat = item.category || 'general';
        const titleLower = item.title.toLowerCase();
        if (activeCategory === 'Announcements') matchesCategory = cat === 'announcement' || titleLower.includes('announcement');
        else if (activeCategory === 'Courses') matchesCategory = titleLower.includes('course');
        else if (activeCategory === 'Quiz') matchesCategory = titleLower.includes('quiz');
        else if (activeCategory === 'Payments') matchesCategory = titleLower.includes('payment') || titleLower.includes('fee');
        else if (activeCategory === 'Live Classes') matchesCategory = cat === 'class_reminder' || titleLower.includes('live') || titleLower.includes('class');
        else if (activeCategory === 'Library') matchesCategory = titleLower.includes('library') || titleLower.includes('book');
        else if (activeCategory === 'General') matchesCategory = cat === 'notification' && !titleLower.includes('payment') && !titleLower.includes('course');
      }

      return matchesSearch && matchesSegment && matchesCategory;
    });

    result.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0; // The items are already time-sorted from the firestore stream
    });

    return result;
  }, [items, searchQuery, activeCategory, readSegment, pinnedIds, user?.uid]);"""

code = code.replace(old_filter, new_filter)

# 6. Update search and segments UI
old_ui_top = """        <View style={styles.searchWrap}>
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
        </View>"""

new_ui_top = """        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search title or message..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.segmentWrap}>
          {['All', 'Unread', 'Read'].map((segment) => (
            <TouchableOpacity
              key={segment}
              style={[styles.segmentBtn, readSegment === segment && styles.segmentBtnActive]}
              onPress={() => setReadSegment(segment as any)}
            >
              <Text style={[styles.segmentBtnText, readSegment === segment && styles.segmentBtnTextActive]}>
                {segment}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.categoriesRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['All', 'Announcements', 'Courses', 'Quiz', 'Payments', 'Live Classes', 'Library', 'General']}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.categoryChip, activeCategory === item && styles.categoryChipActive]}
                onPress={() => setActiveCategory(item)}
              >
                <Text style={[styles.categoryChipText, activeCategory === item && styles.categoryChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>"""

code = code.replace(old_ui_top, new_ui_top)

# 7. Add getCategoryInfo
if "const getCategoryInfo" not in code:
    code = code.replace(
        "function formatRelativeTime",
        """const getCategoryInfo = (item: NotificationItem) => {
  const titleLower = item.title.toLowerCase();
  if (titleLower.includes('security') || titleLower.includes('alert')) return { color: COLORS.error, icon: 'shield-alert' };
  if (titleLower.includes('payment') || titleLower.includes('fee')) return { color: COLORS.error, icon: 'card' };
  if (titleLower.includes('certificate')) return { color: COLORS.success, icon: 'ribbon' };
  if (titleLower.includes('course completed') || titleLower.includes('passed')) return { color: COLORS.success, icon: 'checkmark-circle' };
  if (item.category === 'announcement' || titleLower.includes('announcement')) return { color: COLORS.primary, icon: 'megaphone' };
  if (titleLower.includes('quiz')) return { color: COLORS.warning, icon: 'help-circle' };
  if (item.category === 'class_reminder' || titleLower.includes('live') || titleLower.includes('class')) return { color: COLORS.warning, icon: 'videocam' };
  if (titleLower.includes('prayer') || titleLower.includes('salah')) return { color: COLORS.warning, icon: 'time' };
  if (titleLower.includes('library') || titleLower.includes('book')) return { color: '#8B5CF6', icon: 'library' };
  return { color: COLORS.primary, icon: 'notifications' };
};

function formatRelativeTime"""
    )


# 8. Update Render Item and Empty List
import re

old_list_regex = r"ListEmptyComponent=\{\(.*?\)\s*\}\s*renderItem=\{.*?return \(\s*<ScalePressable.*?</ScalePressable>\s*\);\s*\}\}"
match = re.search(old_list_regex, code, re.DOTALL)
if match:
    new_render = """ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptyText}>You're all caught up! Important updates, payments, and class reminders will appear here.</Text>
              <TouchableOpacity style={styles.emptyRefreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={16} color={COLORS.primary} />
                <Text style={styles.emptyRefreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => {
            const isUnread = !item.read?.[user?.uid || ''];
            const isPinned = pinnedIds.includes(item.id);
            const catInfo = getCategoryInfo(item);
            
            const renderRightActions = () => (
              <TouchableOpacity
                style={styles.swipeActionRight}
                onPress={() => isUnread ? markAsRead(item) : markAsUnread(item)}
              >
                <Ionicons name={isUnread ? 'checkmark-done' : 'mail-unread'} size={24} color="#fff" />
                <Text style={styles.swipeActionText}>{isUnread ? 'Mark Read' : 'Mark Unread'}</Text>
              </TouchableOpacity>
            );

            const renderLeftActions = () => (
              <TouchableOpacity style={styles.swipeActionLeft} onPress={() => deleteNotification(item)}>
                <Ionicons name="trash" size={24} color="#fff" />
                <Text style={styles.swipeActionText}>Delete</Text>
              </TouchableOpacity>
            );

            return (
              <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
                <ScalePressable
                  style={[
                    styles.card,
                    isUnread && styles.cardUnread,
                    isPinned && styles.cardPinned,
                  ]}
                  testID={`notification-${item.id}`}
                  onPress={() => isUnread ? markAsRead(item) : null}
                  onLongPress={() => togglePin(item.id)}
                >
                  {isUnread && <View style={[styles.unreadLeftBar, { backgroundColor: catInfo.color }]} />}
                  <View style={styles.cardTop}>
                    <View style={[styles.cardIconCircle, { backgroundColor: catInfo.color + '15' }]}>
                      <Ionicons name={catInfo.icon as any} size={16} color={catInfo.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>{item.title}</Text>
                    </View>
                    <View style={styles.badgesRow}>
                      {isPinned && <Ionicons name="star" size={14} color="#F59E0B" />}
                      {item.user_id === 'all' ? (
                        <View style={styles.badge}><Text style={styles.badgeText}>Broadcast</Text></View>
                      ) : (
                        <View style={styles.badge}><Text style={styles.badgeText}>Private</Text></View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.cardMsg}>{item.message}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardTime}>{formatRelativeTime(item)}</Text>
                    {!isUnread && <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />}
                  </View>
                  <View style={styles.adminActions}>
                    {isAdmin ? (
                      <TouchableOpacity onPress={() => startEditNotification(item)} style={{ padding: 4 }}>
                        <Text style={styles.editActionText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </ScalePressable>
              </Swipeable>
            );
          }}"""
    code = code[:match.start()] + new_render + code[match.end():]

# 9. Update styles
old_styles = """  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  categoryChipTextActive: { color: '#fff' },"""

new_styles = """  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  categoryChipTextActive: { color: '#fff' },
  segmentWrap: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: RADIUS.full, padding: 4, marginTop: SPACING.md },
  segmentBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: RADIUS.full },
  segmentBtnActive: { backgroundColor: COLORS.surface, ...SHADOWS.card },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  segmentBtnTextActive: { color: COLORS.primary },"""
code = code.replace(old_styles, new_styles)

old_card_styles = """  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card, overflow: 'hidden' },
  cardUnread: { borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: '#FEFDF5' },
  unreadLeftBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: COLORS.secondary, borderTopLeftRadius: RADIUS.xl, borderBottomLeftRadius: RADIUS.xl },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconCircle: { width: 32, height: 32, borderRadius: RADIUS.xxl, backgroundColor: 'rgba(6,78,59,0.08)', alignItems: 'center', justifyContent: 'center' },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  cardTitleUnread: { fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.goldBg },
  badgeText: { color: COLORS.goldText, fontSize: 10, fontWeight: '700' },
  cardMsg: { fontSize: 14, color: COLORS.textMuted, marginTop: 8, lineHeight: 20 },
  cardTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 8, fontWeight: '600' },
  adminActions: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  editActionText: { color: COLORS.primary, fontWeight: '700' },
  deleteActionText: { color: COLORS.error, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 8 },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },"""

new_card_styles = """  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card, overflow: 'hidden' },
  cardUnread: { backgroundColor: '#F0FDF4' }, // Light emerald background for unread
  cardPinned: { borderColor: '#F59E0B', borderWidth: 1, elevation: 4 }, // Gold border + elevated
  unreadLeftBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: RADIUS.xl, borderBottomLeftRadius: RADIUS.xl },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
  cardTitleUnread: { fontWeight: '800', color: '#1F2937' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.goldBg },
  badgeText: { color: COLORS.goldText, fontSize: 10, fontWeight: '700' },
  cardMsg: { fontSize: 14, color: COLORS.textMuted, marginTop: 12, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  cardTime: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  adminActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  editActionText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  deleteActionText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  emptyRefreshText: { color: COLORS.primary, fontWeight: '700' },
  swipeActionRight: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: RADIUS.xl, marginLeft: 8 },
  swipeActionLeft: { backgroundColor: COLORS.error, justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: RADIUS.xl, marginRight: 8 },
  swipeActionText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },"""

code = code.replace(old_card_styles, new_card_styles)


with open('app/(tabs)/notifications.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
