# -*- coding: utf-8 -*-
import os

file_path = r'C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\app\recordings.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Normalize CRLF
code = code.replace('\r\n', '\n')

# 1. Update setAudioModeAsync
old_audio_mode = """      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });"""

new_audio_mode = """      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });"""

if old_audio_mode in code:
    code = code.replace(old_audio_mode, new_audio_mode)
    print("1. Audio mode updated.")
else:
    print("1. Audio mode not found or already updated.")

# 2. Update sortedItems useMemo
old_sorted_items = """  const sortedItems = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    const q = search.trim().toLowerCase();
    return base.filter((item) => {
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.teacher_name || '').toLowerCase().includes(q) ||
        (courseMap[item.course_id || ''] || '').toLowerCase().includes(q);
      const matchCourse = !selectedCourseId || item.course_id === selectedCourseId;
      return matchSearch && matchCourse;
    });
  }, [items, search, selectedCourseId, courseMap]);"""

new_sorted_items = """  const sortedItems = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    const q = search.trim().toLowerCase();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(startOfToday.getDate() - 30);

    const filtered = base.filter((item) => {
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.teacher_name || '').toLowerCase().includes(q) ||
        (courseMap[item.course_id || ''] || '').toLowerCase().includes(q);
      const matchCourse = !selectedCourseId || item.course_id === selectedCourseId;
      if (!matchSearch || !matchCourse) return false;

      if (selectedDateFilter === 'all') return true;
      const d = parseRecordingDate(item);
      if (!d) return selectedDateFilter === 'older';
      const t = d.getTime();

      if (selectedDateFilter === 'today') {
        return t >= startOfToday.getTime();
      }
      if (selectedDateFilter === 'yesterday') {
        return t >= startOfYesterday.getTime() && t < startOfToday.getTime();
      }
      if (selectedDateFilter === 'week') {
        return t >= startOfWeek.getTime();
      }
      if (selectedDateFilter === 'month') {
        return t >= startOfMonth.getTime();
      }
      if (selectedDateFilter === 'older') {
        return t < startOfMonth.getTime();
      }
      return true;
    });

    filtered.sort((a, b) => {
      const da = parseRecordingDate(a)?.getTime() || 0;
      const db = parseRecordingDate(b)?.getTime() || 0;
      return sortOrder === 'desc' ? db - da : da - db;
    });

    return filtered;
  }, [items, search, selectedCourseId, selectedDateFilter, sortOrder, courseMap]);"""

if old_sorted_items in code:
    code = code.replace(old_sorted_items, new_sorted_items)
    print("2. sortedItems updated.")
else:
    print("2. sortedItems not found!")

# 3. Add SubFilterBar (Date chips + Sort toggle) after course filter
old_filter_end = """              </ScrollView>
            )}
          </View>

          <FlatList"""

new_filter_end = """              </ScrollView>
            )}

            {/* Date-wise Filter & Sort Toggle Bar */}
            <View style={styles.subFilterBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateFilterRow}
              >
                {DATE_FILTERS.map((df) => (
                  <TouchableOpacity
                    key={df.key}
                    style={[styles.dateChip, selectedDateFilter === df.key && styles.dateChipActive]}
                    onPress={() => setSelectedDateFilter(df.key)}
                  >
                    <Ionicons
                      name={df.icon as any}
                      size={12}
                      color={selectedDateFilter === df.key ? '#FFFFFF' : COLORS.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.dateChipText, selectedDateFilter === df.key && styles.dateChipTextActive]}>
                      {df.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.sortToggleBtn}
                onPress={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                accessibilityLabel={`Sort by date: ${sortOrder === 'desc' ? 'newest first' : 'oldest first'}`}
              >
                <Ionicons
                  name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                  size={13}
                  color={COLORS.primary}
                />
                <Text style={styles.sortToggleText}>
                  {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList"""

if old_filter_end in code:
    code = code.replace(old_filter_end, new_filter_end)
    print("3. subFilterBar added.")
else:
    print("3. Filter end not found!")

# 4. Add Date Badge to Recording Card Header
old_card_meta = """                      <View style={styles.metaRow}>
                        <Text style={styles.cardMetaCourse}>{courseMap[item.course_id || ''] || 'General Session'}</Text>
                        {item.teacher_name ? (
                          <Text style={styles.cardMetaTeacher}> • {item.teacher_name}</Text>
                        ) : null}
                      </View>"""

new_card_meta = """                      <View style={styles.metaRow}>
                        <View style={styles.dateMetaBadge}>
                          <Ionicons name="calendar-outline" size={11} color={COLORS.primary} />
                          <Text style={styles.dateMetaText}>{formatRecordingDate(parseRecordingDate(item))}</Text>
                        </View>
                        <Text style={styles.cardMetaCourse}>{courseMap[item.course_id || ''] || 'General Session'}</Text>
                        {item.teacher_name ? (
                          <Text style={styles.cardMetaTeacher}> • {item.teacher_name}</Text>
                        ) : null}
                      </View>"""

if old_card_meta in code:
    code = code.replace(old_card_meta, new_card_meta)
    print("4. dateMetaBadge added to card.")
else:
    print("4. card meta not found!")

# 5. Update EmptyState filter condition
old_empty = """                  profile?.role === 'student' && Object.keys(courseMap).length === 0
                    ? 'You must be enrolled in an active course to access class recordings.'
                    : search || selectedCourseId
                    ? 'No recordings match your filter.'
                    : 'Live class recordings will appear here once teachers record audio sessions.'"""

new_empty = """                  profile?.role === 'student' && Object.keys(courseMap).length === 0
                    ? 'You must be enrolled in an active course to access class recordings.'
                    : search || selectedCourseId || selectedDateFilter !== 'all'
                    ? 'No recordings match your filter.'
                    : 'Live class recordings will appear here once teachers record audio sessions.'"""

if old_empty in code:
    code = code.replace(old_empty, new_empty)
    print("5. EmptyState filter condition updated.")
else:
    print("5. EmptyState filter not found!")

# 6. Add Styles before StyleSheet.create closing
new_styles = """  subFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  dateMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  dateMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryDeep,
  },
});"""

if '\n});' in code:
    code = code.replace('\n});', '\n' + new_styles)
    print("6. Styles added.")
else:
    print("6. Style closing not found!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved frontend/app/recordings.tsx successfully!")
