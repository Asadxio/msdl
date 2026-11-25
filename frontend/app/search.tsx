import React, { useState, useMemo, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { QURAN_SURAHS, searchSurahs } from '@/constants/quranSurahs';
import { searchDuas } from '@/lib/duasService';
import { searchNames } from '@/lib/asmaUlHusnaService';
import { OFFLINE_SEED_HADITHS, ALL_HADITH_BOOKS } from '@/lib/hadithService';
import { getSalahSteps } from '@/lib/salahGuideService';
import { getAzaanRecitations } from '@/lib/azaanAudioService';
import { searchKalmas } from '@/lib/sixKalmasService';
import { goBackOrReplace } from '@/lib/navigation';
import { HadithBookId } from '@/types/islamic';

export type SearchCategory =
  | 'all'
  | 'hadith'
  | 'duas'
  | 'asma'
  | 'quran'
  | 'courses'
  | 'books'
  | 'tools'
  | 'admin';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  arabic?: string;
  category:
    | 'hadith'
    | 'dua'
    | 'asma'
    | 'quran'
    | 'course'
    | 'book'
    | 'tool'
    | 'admin'
    | 'teacher'
    | 'salah';
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  badge: string;
  onPress: () => void;
}

const APP_TOOLS = [
  {
    id: 'hadith',
    title: 'Hadith Library (Kutub as-Sittah)',
    subtitle: 'Bukhari, Muslim, Tirmidhi & Sunan with Urdu & English translations',
    route: '/hadith',
    icon: 'sparkles',
    badge: 'Hadith',
  },
  {
    id: 'duas',
    title: 'Masnoon Duas & Daily Azkar',
    subtitle: 'Morning/Evening, Salah, Sleep & Healing prayers from Hisn al-Muslim',
    route: '/duas',
    icon: 'moon',
    badge: 'Duas',
  },
  {
    id: 'asma',
    title: 'Asma-ul-Husna (99 Names of Allah)',
    subtitle: 'Virtues, Arabic pronunciation, Urdu & English meanings',
    route: '/asma-ul-husna',
    icon: 'heart',
    badge: '99 Names',
  },
  {
    id: 'salah-guide',
    title: 'Salah Guide & Visual Steps',
    subtitle: 'Step-by-step prayer tutorial, Hanafi/Shafi postures & audio recitations',
    route: '/salah-guide',
    icon: 'body',
    badge: 'Salah',
  },
  {
    id: 'azaan-audio',
    title: 'Azaan Audio & Muadhin Library',
    subtitle: 'Makkah, Madinah, Al-Aqsa & Istanbul Azaan recitations',
    route: '/azaan-audio',
    icon: 'notifications',
    badge: 'Azaan',
  },
  {
    id: 'quran',
    title: 'Holy Quran & Reader',
    subtitle: 'Tilawat, Roman Urdu, Surah Index & Khatam tracking',
    route: '/quran',
    icon: 'book',
    badge: 'Quran',
  },
  {
    id: 'prayer',
    title: 'Prayer Times & Adhan',
    subtitle: 'Salah timings, Qibla direction & local notifications',
    route: '/prayer-times',
    icon: 'time',
    badge: 'Waqt',
  },
  {
    id: 'islamic-calendar',
    title: 'Islamic Calendar (Hijri Dates & Events)',
    subtitle: 'Upcoming Rajab, Ramadan, Eid, Ashura & Dhul Hijjah dates',
    route: '/islamic-calendar',
    icon: 'calendar-number',
    badge: 'Hijri',
  },
  {
    id: 'islamic-radio',
    title: 'Live Islamic Radio (24/7 Quran)',
    subtitle: 'Stream Haramain Imams, Urdu Translation & Reciter Channels',
    route: '/islamic-radio',
    icon: 'radio',
    badge: 'Radio',
  },
  {
    id: 'nearby-masjids',
    title: 'Nearby Masjids & Halal Compass',
    subtitle: 'Discover nearby mosques & halal spots via OpenStreetMap',
    route: '/nearby-masjids',
    icon: 'location',
    badge: 'Masjids',
  },
  {
    id: 'asma-un-nabi',
    title: '99 Names of Prophet Muhammad (ﷺ) & Seerah',
    subtitle: 'Asma-un-Nabi blessed names & interactive Makki/Madani timeline',
    route: '/asma-un-nabi',
    icon: 'star',
    badge: 'Seerah',
  },
  {
    id: 'muhasabah',
    title: 'Daily Muhasabah & Sadaqah Journal',
    subtitle: 'Spiritual deed accountability checklist & charity log',
    route: '/muhasabah',
    icon: 'heart',
    badge: 'Muhasabah',
  },
  {
    id: 'wirasat',
    title: 'Wirasat (Mirath) Inheritance Guide',
    subtitle: 'Qur’anic inheritance shares calculator & jurisprudence guide',
    route: '/wirasat',
    icon: 'pie-chart',
    badge: 'Mirath',
  },
  {
    id: 'umrah-hajj',
    title: 'Umrah & Hajj Guide + Tawaf/Sa’i Counter',
    subtitle: 'Makkah & Madinah step-by-step guide with live 7-round counter',
    route: '/umrah-hajj',
    icon: 'cube',
    badge: 'Pilgrimage',
  },
  {
    id: 'six-kalmas',
    title: 'Six Kalmas (Tayyab to Radde Kufr)',
    subtitle: 'Arabic declarations of faith, transliteration, English & Urdu',
    route: '/six-kalmas',
    icon: 'shield-checkmark',
    badge: 'Kalmas',
  },
  {
    id: 'zakat',
    title: 'Zakat Calculator (Gold & Silver Nisab)',
    subtitle: 'Calculate net zakatable wealth & 2.5% Zakat due accurately',
    route: '/zakat',
    icon: 'calculator',
    badge: 'Zakat',
  },
  {
    id: 'tasbeeh',
    title: 'Smart Digital Tasbeeh',
    subtitle: 'Zikr counter with tactile haptic feedback & 7-day stats',
    route: '/tasbeeh',
    icon: 'finger-print',
    badge: 'Zikr',
  },
  {
    id: 'taharat',
    title: 'Taharat & Menstrual Tracker',
    subtitle: 'Specialized Islamic jurisprudence tracker for sisters',
    route: '/taharat-tracker',
    icon: 'water',
    badge: 'Fiqh',
  },
  {
    id: 'fatwa',
    title: 'Dar-ul-Iftaa & Fatwa',
    subtitle: 'Ask questions to Muftiyan & Browse verified fatawa',
    route: '/fatawa',
    icon: 'chatbubbles',
    badge: 'Shariah',
  },
  {
    id: 'flashcards',
    title: 'Islamic Flashcards & Revision',
    subtitle: 'Active recall for Arabic vocabulary & Hadees',
    route: '/flashcards',
    icon: 'albums',
    badge: 'Learning',
  },
  {
    id: 'attendance',
    title: 'Attendance Register',
    subtitle: 'Class-wise attendance, lecture tracking & teacher records',
    route: '/(tabs)/attendance',
    icon: 'calendar',
    badge: 'Class',
  },
  {
    id: 'notifications',
    title: 'Announcements & Notifications',
    subtitle: 'Madrasa circulars and daily reminders',
    route: '/(tabs)/notifications',
    icon: 'notifications',
    badge: 'Updates',
  },
  {
    id: 'settings',
    title: 'App Settings & Preferences',
    subtitle: 'Theme, language, font size & audio cache',
    route: '/settings',
    icon: 'settings',
    badge: 'System',
  },
];

const ADMIN_ACTIONS = [
  {
    id: 'adm-islamic-content',
    title: 'Islamic Knowledge & Content Hub',
    subtitle: 'Audit Hadiths, Duas, 99 Names & Prayer Guide settings',
    route: '/admin/islamic-content',
    icon: 'sparkles',
    badge: 'Admin',
  },
  {
    id: 'adm-manage-quizzes',
    title: 'Manage Quiz Question Bank',
    subtitle: 'View, edit, update & delete Firestore quiz questions',
    route: '/admin/manage-quizzes',
    icon: 'list',
    badge: 'Admin',
  },
  {
    id: 'adm-ai-quiz',
    title: 'AI Auto-Quiz & Exam Maker',
    subtitle: 'Generate exam papers & new quiz sets in seconds',
    route: '/admin/ai-quiz-maker',
    icon: 'sparkles',
    badge: 'Admin',
  },
  {
    id: 'adm-users',
    title: 'Manage Users & Permissions',
    subtitle: 'Approve, deactivate, assign roles & grant free courses',
    route: '/admin/users',
    icon: 'people',
    badge: 'Admin',
  },
  {
    id: 'adm-academics',
    title: 'Manage Courses & Faculty',
    subtitle: 'Create courses, modules, assign ustaadha & rosters',
    route: '/admin/manage-academics',
    icon: 'school',
    badge: 'Admin',
  },
  {
    id: 'adm-payments',
    title: 'Fee Management & Transactions',
    subtitle: 'Track fee submissions, manual receipts & invoices',
    route: '/admin/payments',
    icon: 'card',
    badge: 'Admin',
  },
  {
    id: 'adm-notif',
    title: 'Send Mass Broadcast',
    subtitle: 'Push notifications to all students or specific batches',
    route: '/admin/send-push',
    icon: 'megaphone',
    badge: 'Admin',
  },
  {
    id: 'adm-reports',
    title: 'System Analytics & Audit Logs',
    subtitle: 'Security logs, activity tracking and usage trends',
    route: '/admin/security',
    icon: 'shield-checkmark',
    badge: 'Admin',
  },
];

export default function GlobalSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const { courses, books, teachers } = useData();
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SearchCategory>('all');
  const inputRef = useRef<TextInput>(null);

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.founder;

  const cleanQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!cleanQuery) return [];

    const list: SearchResultItem[] = [];

    // 1. Search Hadith Library (Kutub as-Sittah)
    if (selectedFilter === 'all' || selectedFilter === 'hadith') {
      const bookKeys = Object.keys(OFFLINE_SEED_HADITHS) as HadithBookId[];
      for (const bKey of bookKeys) {
        const bookMeta = ALL_HADITH_BOOKS.find((b) => b.id === bKey);
        const bookTitle = bookMeta?.titleEnglish || bKey;
        const entries = OFFLINE_SEED_HADITHS[bKey] || [];

        for (const h of entries) {
          if (
            String(h.hadithNumber) === cleanQuery ||
            h.urduText.includes(cleanQuery) ||
            h.englishText.toLowerCase().includes(cleanQuery) ||
            h.arabicText.includes(cleanQuery) ||
            (h.narrator && h.narrator.toLowerCase().includes(cleanQuery)) ||
            (h.chapterTitleEn && h.chapterTitleEn.toLowerCase().includes(cleanQuery)) ||
            (h.chapterTitleUr && h.chapterTitleUr.includes(cleanQuery))
          ) {
            list.push({
              id: `hadith-${h.id}`,
              title: `${bookTitle} — Hadith #${h.hadithNumber}`,
              subtitle: h.urduText
                ? `"${h.urduText.slice(0, 85)}..."`
                : `"${h.englishText.slice(0, 85)}..."`,
              arabic: h.arabicText.slice(0, 75),
              category: 'hadith',
              icon: 'sparkles',
              iconBg: isDark ? 'rgba(217, 119, 6, 0.18)' : '#FEF3C7',
              iconColor: '#D97706',
              badge: bookMeta?.titleUrdu || 'حدیث',
              onPress: () =>
                router.push(`/hadith/${h.bookId}?hadithNumber=${h.hadithNumber}` as any),
            });
          }
        }
      }
    }

    // 2. Search Masnoon Duas & Azkar (Hisn al-Muslim)
    if (selectedFilter === 'all' || selectedFilter === 'duas') {
      const matchingDuas = searchDuas(cleanQuery);
      matchingDuas.slice(0, 15).forEach((d) => {
        list.push({
          id: `dua-${d.id}`,
          title: `${d.titleEn} (${d.titleUr})`,
          subtitle: d.urduTranslation
            ? `ترجمہ: ${d.urduTranslation.slice(0, 75)}...`
            : `Meaning: ${d.englishTranslation.slice(0, 75)}...`,
          arabic: d.arabicText.slice(0, 70),
          category: 'dua',
          icon: 'moon',
          iconBg: isDark ? 'rgba(147, 51, 234, 0.18)' : '#F3E8FF',
          iconColor: '#9333EA',
          badge: d.reference || 'دعا',
          onPress: () => router.push(`/duas/${d.categoryId}` as any),
        });
      });
    }

    // 3. Search Asma-ul-Husna (99 Names of Allah)
    if (selectedFilter === 'all' || selectedFilter === 'asma') {
      const matchingNames = searchNames(cleanQuery);
      matchingNames.slice(0, 15).forEach((n) => {
        list.push({
          id: `asma-${n.id}`,
          title: `#${n.id} ${n.transliteration} — ${n.arabic}`,
          subtitle: `Urdu: ${n.urduMeaning} • English: ${n.englishMeaning}`,
          arabic: n.arabic,
          category: 'asma',
          icon: 'heart',
          iconBg: isDark ? 'rgba(198, 161, 91, 0.18)' : '#FDF8EA',
          iconColor: '#C6A15B',
          badge: 'اسمِ الٰہی',
          onPress: () => router.push(`/asma-ul-husna/${n.id}` as any),
        });
      });
    }

    // 4. Search Quran Surahs
    if (selectedFilter === 'all' || selectedFilter === 'quran') {
      const matchingSurahs = searchSurahs(cleanQuery);
      matchingSurahs.slice(0, 10).forEach((s) => {
        list.push({
          id: `quran-${s.number}`,
          title: `Surah ${s.englishName} (${s.arabicName})`,
          subtitle: `Surah #${s.number} • ${s.totalAyat} Verses • Para ${s.parah} • ${s.type}`,
          arabic: s.arabicName,
          category: 'quran',
          icon: 'book',
          iconBg: isDark ? 'rgba(5, 150, 105, 0.18)' : '#ECFDF5',
          iconColor: '#059669',
          badge: `پارہ ${s.parah}`,
          onPress: () => router.push(`/quran-reader?surah=${s.number}` as any),
        });
      });
    }

    // 5. Search Salah Guide & Steps
    if (selectedFilter === 'all' || selectedFilter === 'tools') {
      const steps = getSalahSteps();
      steps.forEach((st) => {
        if (
          st.stepNameEn.toLowerCase().includes(cleanQuery) ||
          st.stepNameUr.includes(cleanQuery) ||
          st.arabicText.includes(cleanQuery) ||
          st.urduTranslation.includes(cleanQuery) ||
          st.instructionsEn.toLowerCase().includes(cleanQuery)
        ) {
          list.push({
            id: `salah-${st.stepNumber}`,
            title: `Salah Step ${st.stepNumber}: ${st.stepNameEn} (${st.stepNameUr})`,
            subtitle: st.urduTranslation || st.instructionsEn,
            arabic: st.arabicText ? st.arabicText.slice(0, 60) : undefined,
            category: 'salah',
            icon: 'body',
            iconBg: isDark ? 'rgba(7, 91, 73, 0.25)' : '#E6F4F1',
            iconColor: '#075B49',
            badge: 'نماز گائیڈ',
            onPress: () => router.push('/salah-guide' as any),
          });
        }
      });

      // Six Kalmas
      const matchingKalmas = searchKalmas(cleanQuery);
      if (
        cleanQuery.includes('kalma') ||
        cleanQuery.includes('kalima') ||
        matchingKalmas.length < 6
      ) {
        matchingKalmas.forEach((k) => {
          list.push({
            id: `kalma-${k.number}`,
            title: `${k.title} (${k.urduTitle})`,
            subtitle: k.englishTranslation,
            arabic: k.arabicText.slice(0, 75),
            category: 'tool',
            icon: 'shield-checkmark',
            iconBg: isDark ? 'rgba(5, 150, 105, 0.18)' : '#ECFDF5',
            iconColor: '#059669',
            badge: k.badge,
            onPress: () => router.push('/six-kalmas' as any),
          });
        });
      }

      // Azaan Audio recitations
      const azaans = getAzaanRecitations();
      azaans.forEach((az) => {
        if (
          az.titleEn.toLowerCase().includes(cleanQuery) ||
          az.titleUr.includes(cleanQuery) ||
          az.muazzin.toLowerCase().includes(cleanQuery) ||
          az.location.toLowerCase().includes(cleanQuery)
        ) {
          list.push({
            id: `azaan-${az.id}`,
            title: `${az.titleEn} (${az.titleUr})`,
            subtitle: `Muazzin: ${az.muazzin} • ${az.location}`,
            category: 'tool',
            icon: 'volume-high',
            iconBg: isDark ? 'rgba(198, 161, 91, 0.2)' : '#FEF9C3',
            iconColor: '#CA8A04',
            badge: 'اذان',
            onPress: () => router.push('/azaan-audio' as any),
          });
        }
      });
    }

    // 6. Search Courses & Teachers
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
            iconBg: isDark ? 'rgba(2, 132, 199, 0.18)' : '#E0F2FE',
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
            iconBg: isDark ? 'rgba(124, 58, 237, 0.18)' : '#EDE9FE',
            iconColor: '#7C3AED',
            badge: 'Faculty',
            onPress: () => router.push(`/teacher/${t.id}` as any),
          });
        }
      });
    }

    // 7. Search Library Books
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
            iconBg: isDark ? 'rgba(217, 119, 6, 0.18)' : '#FEF3C7',
            iconColor: '#D97706',
            badge: 'Library Book',
            onPress: () => router.push(`/book/${b.id}` as any),
          });
        }
      });
    }

    // 8. Search App Features & Tools
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
            iconBg: isDark ? 'rgba(79, 70, 229, 0.18)' : '#EEF2FF',
            iconColor: '#4F46E5',
            badge: tool.badge,
            onPress: () => router.push(tool.route as any),
          });
        }
      });
    }

    // 9. Admin Control Search
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
            iconBg: isDark ? 'rgba(220, 38, 38, 0.18)' : '#FEE2E2',
            iconColor: '#DC2626',
            badge: 'Admin Panel',
            onPress: () => router.push(action.route as any),
          });
        }
      });
    }

    return list;
  }, [cleanQuery, selectedFilter, courses, books, teachers, isAdmin, isDark, router]);

  const filterTabs: Array<{
    id: SearchCategory;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { id: 'all', label: 'All Results', icon: 'search' },
    { id: 'hadith', label: 'Hadith Library', icon: 'sparkles-outline' },
    { id: 'duas', label: 'Duas & Azkar', icon: 'moon-outline' },
    { id: 'asma', label: '99 Names', icon: 'heart-outline' },
    { id: 'quran', label: 'Holy Quran', icon: 'book-outline' },
    { id: 'courses', label: 'Courses & Faculty', icon: 'school-outline' },
    { id: 'books', label: 'Library Books', icon: 'document-text-outline' },
    { id: 'tools', label: 'App Tools & Salah', icon: 'apps-outline' },
    ...(isAdmin
      ? [
          {
            id: 'admin' as SearchCategory,
            label: 'Admin Controls',
            icon: 'shield-outline' as keyof typeof Ionicons.glyphMap,
          },
        ]
      : []),
  ];

  const handleSelectTab = (tabId: SearchCategory) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedFilter(tabId);
  };

  const renderResult = ({ item }: { item: SearchResultItem }) => (
    <TouchableOpacity
      style={[
        styles.resultCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={() => {
        Keyboard.dismiss();
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
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
          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.badgePill, { backgroundColor: item.iconBg }]}>
            <Text style={[styles.badgeText, { color: item.iconColor }]}>{item.badge}</Text>
          </View>
        </View>

        {item.arabic ? (
          <Text
            style={[
              styles.resultArabic,
              { color: isDark ? colors.gold : colors.primary },
            ]}
            numberOfLines={1}
          >
            {item.arabic}
          </Text>
        ) : null}

        <Text
          style={[styles.resultSubtitle, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Top Search Input Bar */}
      <View
        style={[
          styles.searchHeader,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' },
          ]}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={colors.primary}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            placeholder="Search Hadith, Duas, Surahs, 99 Names, Courses..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Filter */}
      <View
        style={[
          styles.filterContainer,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterTabs.map((tab) => {
            const isSelected = selectedFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isDark
                      ? colors.surfaceAlt
                      : '#F1F5F9',
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleSelectTab(tab.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Section or Quick Suggestions */}
      {query.trim().length === 0 ? (
        <ScrollView
          style={styles.suggestionsContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            Islamic Knowledge Hub & Tools
          </Text>
          <View style={styles.quickGrid}>
            {APP_TOOLS.slice(0, 6).map((tool) => (
              <TouchableOpacity
                key={tool.id}
                style={[
                  styles.quickCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.push(tool.route as any)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.quickIconCircle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(7, 91, 73, 0.25)'
                        : '#ECFDF5',
                    },
                  ]}
                >
                  <Ionicons name={tool.icon as any} size={20} color={colors.primary} />
                </View>
                <Text
                  style={[styles.quickCardTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {tool.title.split('(')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Hadith & Dua Suggestions */}
          <Text
            style={[
              styles.sectionHeaderTitle,
              { color: colors.text, marginTop: SPACING.xl },
            ]}
          >
            Suggested Topics
          </Text>
          <View style={styles.suggestedChipsRow}>
            {[
              'Intentions (Niyyah)',
              'Ayat-ul-Kursi',
              'Ar-Rahman',
              'Morning Azkar',
              'Tashahhud',
              'Bukhari #1',
              'Fasting Rules',
              'Forgiveness (Istighfar)',
            ].map((topic) => (
              <TouchableOpacity
                key={topic}
                style={[
                  styles.suggestedChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setQuery(topic)}
              >
                <Ionicons name="sparkles" size={12} color={colors.gold} />
                <Text style={[styles.suggestedChipText, { color: colors.text }]}>
                  {topic}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={[
              styles.sectionHeaderTitle,
              { color: colors.text, marginTop: SPACING.xl },
            ]}
          >
            Popular Quran Surahs
          </Text>
          {QURAN_SURAHS.slice(0, 4).map((s) => (
            <TouchableOpacity
              key={s.number}
              style={[
                styles.quickSurahRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => router.push(`/quran-reader?surah=${s.number}` as any)}
            >
              <View
                style={[
                  styles.surahNumBadge,
                  { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' },
                ]}
              >
                <Text style={[styles.surahNumBadgeText, { color: colors.primary }]}>
                  {s.number}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.surahEnglish, { color: colors.text }]}>
                  {s.englishName}
                </Text>
                <Text style={[styles.surahSub, { color: colors.textSecondary }]}>
                  {s.totalAyat} Verses • Para {s.parah}
                </Text>
              </View>
              <Text
                style={[
                  styles.surahArabic,
                  { color: isDark ? colors.gold : colors.primary },
                ]}
              >
                {s.arabicName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            We couldn&apos;t find anything matching &quot;{query}&quot;. Try searching for
            a Hadith narrator, Dua, 99 Name of Allah, Surah, or course title.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
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
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterContainer: {
    borderBottomWidth: 1,
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
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    minHeight: 36,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.md,
    gap: 10,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 12,
    minHeight: 64,
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
    marginBottom: 2,
  },
  resultTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  resultArabic: {
    fontSize: 15,
    fontWeight: '600',
    marginVertical: 2,
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
  },
  resultSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionsContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
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
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    gap: 8,
    minHeight: 88,
    ...SHADOWS.card,
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  suggestedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  suggestedChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickSurahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  surahNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahNumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  surahEnglish: {
    fontSize: 14,
    fontWeight: '700',
  },
  surahSub: {
    fontSize: 11,
  },
  surahArabic: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
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
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
