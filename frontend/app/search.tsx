import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { QURAN_SURAHS, searchSurahs } from '@/constants/quranSurahs';
import { MASNOON_DUAS, HADITHS, DAILY_WISDOM } from '@/constants/wisdomData';
import { goBackOrReplace } from '@/lib/navigation';

export type SearchCategory = 'all' | 'courses' | 'quran' | 'books' | 'duas' | 'tools' | 'admin';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'course' | 'quran' | 'book' | 'dua' | 'hadith' | 'tool' | 'admin' | 'teacher';
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  badge: string;
  onPress: () => void;
}

const APP_TOOLS = [
  { id: 'quran', title: 'Holy Quran & Reader', subtitle: 'Tilawat, Roman Urdu, Surah Index & Khatam', route: '/quran', icon: 'book', badge: 'Quran' },
  { id: 'prayer', title: 'Prayer Times & Adhan', subtitle: 'Salah timings, Qibla direction & Settings', route: '/prayer-times', icon: 'time', badge: 'Waqt' },
  { id: 'tasbeeh', title: 'Smart Digital Tasbeeh', subtitle: 'Zikr counter with vibration feedback', route: '/tasbeeh', icon: 'finger-print', badge: 'Zikr' },
  { id: 'taharat', title: 'Taharat & Menstrual Tracker', subtitle: 'Specialized Islamic jurisprudence tracker for sisters', route: '/taharat-tracker', icon: 'water', badge: 'Fiqh' },
  { id: 'fatwa', title: 'Dar-ul-Iftaa & Fatwa', subtitle: 'Ask questions to Muftiyan & Browse verified fatawa', route: '/fatwa', icon: 'chatbubbles', badge: 'Shariah' },
  { id: 'flashcards', title: 'Islamic Flashcards & Revision', subtitle: 'Active recall for Arabic vocabulary & Hadees', route: '/flashcards', icon: 'albums', badge: 'Learning' },
  { id: 'attendance', title: 'Attendance Register', subtitle: 'Class-wise attendance, lecture tracking & teacher records', route: '/(tabs)/attendance', icon: 'calendar', badge: 'Class' },
  { id: 'notifications', title: 'Announcements & Notifications', subtitle: 'Madrasa circulars and daily reminders', route: '/(tabs)/notifications', icon: 'notifications', badge: 'Updates' },
  { id: 'downloads', title: 'Offline Kitabs & Audio', subtitle: 'Manage downloaded PDF notes and lectures', route: '/downloads', icon: 'download', badge: 'Offline' },
  { id: 'settings', title: 'App Settings & Preferences', subtitle: 'Theme, language, font size & audio cache', route: '/settings', icon: 'settings', badge: 'System' },
];

const ADMIN_ACTIONS = [
  { id: 'adm-manage-quizzes', title: 'Manage Quiz Question Bank', subtitle: 'View, edit, update & delete Firestore quiz questions', route: '/admin/manage-quizzes', icon: 'list', badge: 'Admin' },
  { id: 'adm-ai-quiz', title: 'AI Auto-Quiz & Exam Maker', subtitle: 'Generate exam papers & new quiz sets in seconds', route: '/admin/ai-quiz-maker', icon: 'sparkles', badge: 'Admin' },
  { id: 'adm-users', title: 'Manage Users & Permissions', subtitle: 'Approve, deactivate, assign roles & grant free courses', route: '/admin/users', icon: 'people', badge: 'Admin' },
  { id: 'adm-academics', title: 'Manage Courses & Faculty', subtitle: 'Create courses, modules, assign ustaadha & rosters', route: '/admin/manage-academics', icon: 'school', badge: 'Admin' },
  { id: 'adm-payments', title: 'Fee Management & Transactions', subtitle: 'Track fee submissions, manual receipts & invoices', route: '/admin/payments', icon: 'card', badge: 'Admin' },
  { id: 'adm-notif', title: 'Send Mass Broadcast', subtitle: 'Push notifications to all students or specific batches', route: '/admin/notifications', icon: 'megaphone', badge: 'Admin' },
  { id: 'adm-reports', title: 'System Analytics & Audit Logs', subtitle: 'Security logs, activity tracking and usage trends', route: '/admin/logs', icon: 'shield-checkmark', badge: 'Admin' },
];

export default function GlobalSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { courses, books, teachers } = useData();
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SearchCategory>('all');
  const inputRef = useRef<TextInput>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.founder;
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'assistant_teacher';

  const cleanQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!cleanQuery) return [];

    const list: SearchResultItem[] = [];

    // 1. Search Courses
    if (selectedFilter === 'all' || selectedFilter === 'courses') {
      courses?.forEach((c) => {
        if (
          c.name.toLowerCase().includes(cleanQuery) ||
          (c.teacher_name && c.teacher_name.toLowerCase().includes(cleanQuery)) ||
          (c.description && c.description.toLowerCase().includes(cleanQuery))
        ) {
          list.push({
            id: `course-${c.id}`,
            title: c.name,
            subtitle: `Instructor: ${c.teacher_name || 'Ustaadha'} • ${c.schedule || 'Regular Class'}`,
            category: 'course',
            icon: 'school',
            iconBg: '#E0F2FE',
            iconColor: '#0284C7',
            badge: 'Course',
            onPress: () => router.push(`/course/${c.id}` as any),
          });
        }
      });

      teachers?.forEach((t) => {
        if (
          t.name.toLowerCase().includes(cleanQuery) ||
          (t.title && t.title.toLowerCase().includes(cleanQuery))
        ) {
          list.push({
            id: `teacher-${t.id}`,
            title: t.name,
            subtitle: `${t.title || 'Faculty Ustaadha'} • ${t.assigned_courses?.length || 0} Courses`,
            category: 'teacher',
            icon: 'person',
            iconBg: '#EDE9FE',
            iconColor: '#7C3AED',
            badge: 'Faculty',
            onPress: () => router.push(`/teacher/${t.id}` as any),
          });
        }
      });
    }

    // 2. Search Quran Surahs
    if (selectedFilter === 'all' || selectedFilter === 'quran') {
      const matchingSurahs = searchSurahs(cleanQuery);
      matchingSurahs.slice(0, 10).forEach((s) => {
        list.push({
          id: `quran-${s.number}`,
          title: `Surah ${s.englishName} (${s.arabicName})`,
          subtitle: `Surah #${s.number} • ${s.totalAyat} Verses • Para ${s.parah} • ${s.type}`,
          category: 'quran',
          icon: 'book',
          iconBg: '#ECFDF5',
          iconColor: '#059669',
          badge: 'Quran',
          onPress: () => router.push(`/quran-reader?surah=${s.number}` as any),
        });
      });
    }

    // 3. Search Library Kitabs / Books
    if (selectedFilter === 'all' || selectedFilter === 'books') {
      books?.forEach((b) => {
        if (
          b.title.toLowerCase().includes(cleanQuery) ||
          (b.category && b.category.toLowerCase().includes(cleanQuery)) ||
          (b.description && b.description.toLowerCase().includes(cleanQuery))
        ) {
          list.push({
            id: `book-${b.id}`,
            title: b.title,
            subtitle: `Category: ${b.category || 'Islamic Studies'} • PDF Resource`,
            category: 'book',
            icon: 'document-text',
            iconBg: '#FEF3C7',
            iconColor: '#D97706',
            badge: 'Library Book',
            onPress: () => router.push(`/book/${b.id}` as any),
          });
        }
      });
    }

    // 4. Search Masnoon Duas & Hadiths
    if (selectedFilter === 'all' || selectedFilter === 'duas') {
      MASNOON_DUAS.forEach((d, idx) => {
        if (
          d.reference.toLowerCase().includes(cleanQuery) ||
          d.translation.toLowerCase().includes(cleanQuery) ||
          d.arabic.includes(cleanQuery)
        ) {
          list.push({
            id: `dua-${idx}`,
            title: `Dua (${d.reference})`,
            subtitle: `"${d.translation.slice(0, 80)}..."`,
            category: 'dua',
            icon: 'moon',
            iconBg: '#F3E8FF',
            iconColor: '#9333EA',
            badge: 'Dua',
            onPress: () => router.push('/flashcards' as any),
          });
        }
      });

      HADITHS.forEach((h, idx) => {
        if (
          h.translation.toLowerCase().includes(cleanQuery) ||
          h.reference.toLowerCase().includes(cleanQuery) ||
          h.arabic.includes(cleanQuery)
        ) {
          list.push({
            id: `hadith-${idx}`,
            title: `Hadith: ${h.reference}`,
            subtitle: `"${h.translation.slice(0, 80)}..."`,
            category: 'hadith',
            icon: 'sparkles',
            iconBg: '#FDF2F8',
            iconColor: '#DB2777',
            badge: 'Hadith',
            onPress: () => router.push('/flashcards' as any),
          });
        }
      });
    }

    // 5. Search App Features & Tools
    if (selectedFilter === 'all' || selectedFilter === 'tools') {
      APP_TOOLS.forEach((tool) => {
        if (
          tool.title.toLowerCase().includes(cleanQuery) ||
          tool.subtitle.toLowerCase().includes(cleanQuery)
        ) {
          list.push({
            id: `tool-${tool.id}`,
            title: tool.title,
            subtitle: tool.subtitle,
            category: 'tool',
            icon: tool.icon as any,
            iconBg: '#EEF2FF',
            iconColor: '#4F46E5',
            badge: tool.badge,
            onPress: () => router.push(tool.route as any),
          });
        }
      });
    }

    // 6. Admin Control Search
    if (isAdmin && (selectedFilter === 'all' || selectedFilter === 'admin')) {
      ADMIN_ACTIONS.forEach((action) => {
        if (
          action.title.toLowerCase().includes(cleanQuery) ||
          action.subtitle.toLowerCase().includes(cleanQuery)
        ) {
          list.push({
            id: `admin-${action.id}`,
            title: action.title,
            subtitle: action.subtitle,
            category: 'admin',
            icon: action.icon as any,
            iconBg: '#FEE2E2',
            iconColor: '#DC2626',
            badge: 'Admin Panel',
            onPress: () => router.push(action.route as any),
          });
        }
      });
    }

    return list;
  }, [cleanQuery, selectedFilter, courses, books, teachers, isAdmin, router]);

  const filterTabs: Array<{ id: SearchCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: 'all', label: 'All Results', icon: 'search' },
    { id: 'courses', label: 'Courses & Teachers', icon: 'school-outline' },
    { id: 'quran', label: 'Holy Quran', icon: 'book-outline' },
    { id: 'books', label: 'Library Books', icon: 'document-text-outline' },
    { id: 'duas', label: 'Duas & Hadiths', icon: 'moon-outline' },
    { id: 'tools', label: 'App Tools', icon: 'apps-outline' },
    ...(isAdmin ? [{ id: 'admin' as SearchCategory, label: 'Admin Controls', icon: 'shield-outline' as keyof typeof Ionicons.glyphMap }] : []),
  ];

  const renderResult = ({ item }: { item: SearchResultItem }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => {
        Keyboard.dismiss();
        item.onPress();
      }}
      activeOpacity={0.7}
      testID={`search-result-${item.id}`}
    >
      <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={22} color={item.iconColor} />
      </View>
      <View style={styles.resultContent}>
        <View style={styles.titleRow}>
          <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.badgePill, { backgroundColor: item.iconBg }]}>
            <Text style={[styles.badgeText, { color: item.iconColor }]}>{item.badge}</Text>
          </View>
        </View>
        <Text style={styles.resultSubtitle} numberOfLines={2}>{item.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Search Input Bar */}
      <View style={styles.searchHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <Ionicons name="search" size={18} color="#002E23" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search courses, surahs, kitabs, duas, tools..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterTabs.map((tab) => {
            const isSelected = selectedFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => setSelectedFilter(tab.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isSelected ? '#FFFFFF' : '#475569'}
                />
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Section or Quick Suggestions */}
      {query.trim().length === 0 ? (
        <ScrollView style={styles.suggestionsContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeaderTitle}>Popular & Quick Actions</Text>
          <View style={styles.quickGrid}>
            {APP_TOOLS.slice(0, 6).map((tool) => (
              <TouchableOpacity
                key={tool.id}
                style={styles.quickCard}
                onPress={() => router.push(tool.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.quickIconCircle}>
                  <Ionicons name={tool.icon as any} size={20} color="#002E23" />
                </View>
                <Text style={styles.quickCardTitle} numberOfLines={1}>{tool.title.split('&')[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionHeaderTitle, { marginTop: SPACING.lg }]}>Recent Quran Surahs</Text>
          {QURAN_SURAHS.slice(0, 4).map((s) => (
            <TouchableOpacity
              key={s.number}
              style={styles.quickSurahRow}
              onPress={() => router.push(`/quran-reader?surah=${s.number}` as any)}
            >
              <View style={styles.surahNumBadge}>
                <Text style={styles.surahNumBadgeText}>{s.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.surahEnglish}>{s.englishName}</Text>
                <Text style={styles.surahSub}>{s.totalAyat} Verses • Para {s.parah}</Text>
              </View>
              <Text style={styles.surahArabic}>{s.arabicName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            We couldn&apos;t find anything matching &quot;{query}&quot;. Try searching for a course name, Surah, kitab, or prayer feature.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipSelected: {
    backgroundColor: '#002E23',
    borderColor: '#002E23',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: SPACING.md,
    gap: 10,
    paddingBottom: 40,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...SHADOWS.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  resultTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  suggestionsContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    ...SHADOWS.card,
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  quickSurahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 12,
  },
  surahNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahNumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#002E23',
  },
  surahEnglish: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  surahSub: {
    fontSize: 11,
    color: '#64748B',
  },
  surahArabic: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002E23',
    fontFamily: 'serif',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
