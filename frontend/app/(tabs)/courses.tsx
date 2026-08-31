import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { memo, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, StatusBar, TouchableOpacity, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, getCourseImage } from '@/constants/theme';
import { useData, Course } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, FadeInView, ScalePressable } from '@/components/ui';
import { getPerformanceState, registerPerformanceSurface, trackPerformanceMetric } from '@/lib/performanceEngine';

const CourseCard = memo(function CourseCard({ course, index }: { course: Course; index: number }) {
  const router = useRouter();
  const { getCourseProgress } = useData();
  const progress = getCourseProgress(course.id);
  
  const handlePress = () => {
    try {
      if (!course?.id) return;
      router.push(`/course/${course.id}`);
    } catch (e) {
      console.log('[Courses] navigation ERROR:', e);
    }
  };

  const isCompleted = progress.completionPercent === 100 && (progress.totalLessons || 0) > 0;
  const isInProgress = !isCompleted && (progress.completionPercent > 0 || (progress.lessonsDone || 0) > 0);
  
  const statusText = isCompleted ? 'COMPLETED' : (isInProgress ? 'IN PROGRESS' : 'NEW');
  const statusBg = isCompleted ? 'rgba(16, 185, 129, 0.15)' : (isInProgress ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 169, 88, 0.15)');
  const statusColor = isCompleted ? '#059669' : (isInProgress ? '#D97706' : COLORS.primary);

  return (
    <ScalePressable
      style={styles.card}
      testID={`course-card-${course.id}`}
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Course: ${course.name}, Instructor: ${course.teacher_name}, Status: ${statusText}, Progress: ${progress.completionPercent}%`}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: getCourseImage(index) }} style={styles.cardImage} resizeMode="cover" />
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>
        <View style={styles.teacherRow}>
          <Ionicons name="person-circle-outline" size={16} color={COLORS.secondary} />
          <Text style={styles.teacherName} numberOfLines={1}>{course.teacher_name}</Text>
        </View>
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressPercent}>{progress.completionPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress.completionPercent))}%` }]} />
          </View>
          <View style={styles.lessonsMetaRow}>
            <Text style={styles.progressMeta}>
              {progress.totalLessons && progress.totalLessons > 0
                ? `${progress.lessonsDone || 0} of ${progress.totalLessons} lessons completed`
                : 'Curriculum preparing'}
            </Text>
          </View>
        </View>
        <View style={styles.actionBtnRow}>
          <View style={[styles.attendBtn, isInProgress && styles.attendBtnActive]}>
            <Text style={[styles.attendBtnText, isInProgress && styles.attendBtnTextActive]}>
              {isInProgress ? 'Continue Learning' : 'Open Course'}
            </Text>
            <Ionicons 
              name={isInProgress ? "play" : "arrow-forward"} 
              size={14} 
              color={isInProgress ? COLORS.surface : COLORS.primary} 
            />
          </View>
        </View>
      </View>
    </ScalePressable>
  );
});

export default function CoursesScreen() {
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    if (refetch) await refetch();
  });
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { courses, loading, refetch, getCourseProgress } = useData();
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
  const [search, setSearch] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const perfRef = useRef(registerPerformanceSurface({ surface: 'courses_feed', maxRendersPerMinute: 90, lowEndSafe: true }));
  
  const teacherOptions = useMemo(
    () => ['all', ...Array.from(new Set(safeCourses.map((course) => String(course?.teacher_name || '').trim()).filter(Boolean)))],
    [safeCourses],
  );

  const stats = useMemo(() => {
    let total = safeCourses.length;
    let active = 0;
    let completed = 0;
    safeCourses.forEach(c => {
      const prog = getCourseProgress(c.id);
      if (prog) {
        if (prog.completionPercent === 100 && prog.totalLessons > 0) {
          completed += 1;
        } else if (prog.completionPercent > 0 || prog.lessonsDone > 0) {
          active += 1;
        }
      }
    });
    return { total, active, completed };
  }, [safeCourses, getCourseProgress]);

  const filteredCourses = useMemo(() => {
    perfRef.current.touch();
    const q = search.trim().toLowerCase();
    return safeCourses.filter((course) => {
      const safeName = String(course?.name || '').toLowerCase();
      const safeTeacher = String(course?.teacher_name || '').toLowerCase();
      const safeDescription = String(course?.description || '').toLowerCase();
      const matchesSearch = !q || safeName.includes(q) || safeTeacher.includes(q) || safeDescription.includes(q);
      const matchesTeacher = teacherFilter === 'all' || String(course?.teacher_name || '') === teacherFilter;
      return matchesSearch && matchesTeacher;
    });
  }, [safeCourses, search, teacherFilter]);

  const perfState = getPerformanceState();
  if (perfState.lowEndMode && filteredCourses.length > 100) trackPerformanceMetric('courses_low_end_large_list', filteredCourses.length);

  const headerTitleText = useMemo(() => {
    if (profile?.role === 'teacher') return 'Teaching Catalog';
    if (profile?.role === 'super_admin' || profile?.founder) return 'Course Catalog';
    return 'My Courses';
  }, [profile?.role, profile?.founder]);

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setTeacherFilter('all');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FadeInView style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{headerTitleText}</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refetch} accessible={true} accessibilityRole="button" accessibilityLabel="Refresh courses">
            <Ionicons name="refresh-outline" size={14} color={COLORS.primary} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Statistic Chips */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="library-outline" size={14} color={COLORS.primary} />
            <Text style={styles.statChipText}>Total: <Text style={styles.statChipVal}>{stats.total}</Text></Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="flame-outline" size={14} color="#F59E0B" />
            <Text style={styles.statChipText}>Active: <Text style={styles.statChipVal}>{stats.active}</Text></Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
            <Text style={styles.statChipText}>Completed: <Text style={styles.statChipVal}>{stats.completed}</Text></Text>
          </View>
        </View>

        {/* Improved Search Bar */}
        <View style={[styles.searchBox, isSearchFocused && styles.searchBoxFocused]}>
          <Ionicons name="search-outline" size={18} color={isSearchFocused ? COLORS.primary : COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses, instructors, or subjects..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn} accessible={true} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Improved Teacher Filter Chips */}
        <FlatList
          data={teacherOptions}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.teacherFilterList}
          renderItem={({ item }) => {
            const selected = teacherFilter === item;
            return (
              <TouchableOpacity
                style={[styles.teacherChip, selected && styles.teacherChipSelected]}
                onPress={() => setTeacherFilter(item)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={item === 'all' ? 'Filter: All Teachers' : `Filter: ${item}`}
              >
                {selected && <Ionicons name="checkmark" size={12} color={COLORS.surface} style={{ marginRight: 4 }} />}
                <Text style={[styles.teacherChipText, selected && styles.teacherChipTextSelected]}>
                  {item === 'all' ? 'All Teachers' : item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </FadeInView>

      {loading ? (
        <EmptyState icon="hourglass-outline" title="Loading Catalog" message="Please wait while we fetch the learning curriculum..." />
      ) : filteredCourses.length === 0 ? (
        <EmptyState 
          icon="search-outline" 
          title={safeCourses.length === 0 ? "Curriculum Empty" : "No Matching Courses"} 
          message={safeCourses.length === 0 ? "No courses have been published yet. Please check back later." : "We couldn't find any courses matching your search keyword or selected filter."}
          action={safeCourses.length > 0 ? { label: "Reset Filters", onPress: handleResetFilters } : undefined}
        />
      ) : (
        <FlatList
          data={filteredCourses}
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <CourseCard course={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          removeClippedSubviews
          testID="courses-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 },
  refreshBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    borderWidth: 1, 
    borderColor: 'rgba(15,169,88,0.3)', 
    borderRadius: RADIUS.full, 
    backgroundColor: 'rgba(15,169,88,0.08)', 
    paddingHorizontal: 12, 
    paddingVertical: 6,
    minHeight: 36,
  },
  refreshText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  statChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statChipVal: {
    fontWeight: '800',
    color: COLORS.textMain,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchBoxFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  teacherFilterList: { paddingTop: SPACING.md, gap: 8, paddingRight: 16 },
  teacherChip: { 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: COLORS.border, 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.full, 
    paddingHorizontal: 14, 
    paddingVertical: 8,
    minHeight: 36,
  },
  teacherChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  teacherChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  teacherChipTextSelected: { color: COLORS.surface, fontWeight: '700' },
  listContent: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg, gap: SPACING.lg },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
    backgroundColor: COLORS.surfaceAlt,
  },
  cardImage: { width: '100%', height: '100%' },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardBody: { padding: SPACING.lg, gap: SPACING.md },
  courseName: { ...TYPOGRAPHY.heading, fontSize: 17, color: COLORS.textMain, fontWeight: '800', lineHeight: 23 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teacherName: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, flex: 1, fontSize: 13, fontWeight: '600' },
  progressSection: { gap: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMain },
  progressPercent: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },
  lessonsMetaRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  progressMeta: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  actionBtnRow: { marginTop: 4 },
  attendBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  attendBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  attendBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  attendBtnTextActive: { color: COLORS.surface },
});
