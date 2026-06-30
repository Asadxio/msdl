import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { memo, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, StatusBar, TouchableOpacity, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, getCourseImage } from '@/constants/theme';
import { useData, Course } from '@/context/DataContext';
import { EmptyState, FadeInView, ScalePressable } from '@/components/ui';
import { getPerformanceState, registerPerformanceSurface, trackPerformanceMetric } from '@/lib/performanceEngine';

const CourseCard = memo(function CourseCard({ course, index }: { course: Course; index: number }) {
  const router = useRouter();
  const { getCourseProgress } = useData();
  const progress = getCourseProgress(course.id);
  const handlePress = () => {
    try {
      if (!course?.id) return;
      router.push(`/course/${course.id}`); // router.push(path)
    } catch (e) {
      console.log('[Courses] navigation ERROR:', e);
    }
  };

  return (
    <ScalePressable
      style={styles.card}
      testID={`course-card-${course.id}`}
      onPress={handlePress}
    >
      <Image source={{ uri: getCourseImage(index) }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.courseName}>{course.name}</Text>
        <View style={styles.teacherRow}>
          <Ionicons name="person-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.teacherName} numberOfLines={1}>{course.teacher_name}</Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress {progress.completionPercent}%</Text>
          <Text style={styles.progressMeta}>
            {progress.totalLessons && progress.totalLessons > 0
              ? `${progress.totalLessons} lessons`
              : 'No lessons available yet'}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress.completionPercent))}%` }]} />
        </View>
        <View style={styles.attendBtn}>
          <Text style={styles.attendBtnText}>Open Course</Text>
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
  const { courses, loading, refetch } = useData();
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
  const [search, setSearch] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const perfRef = useRef(registerPerformanceSurface({ surface: 'courses_feed', maxRendersPerMinute: 90, lowEndSafe: true }));
  const teacherOptions = useMemo(
    () => ['all', ...Array.from(new Set(safeCourses.map((course) => String(course?.teacher_name || '').trim()).filter(Boolean)))],
    [safeCourses],
  );
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FadeInView style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Our Courses</Text>
            <Text style={styles.headerSubtitle}>
              {loading ? 'Loading...' : `${filteredCourses.length} of ${safeCourses.length} courses`}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses or teachers"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
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
              >
                <Text style={[styles.teacherChipText, selected && styles.teacherChipTextSelected]}>
                  {item === 'all' ? 'All Teachers' : item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </FadeInView>
      {loading ? (
        <EmptyState icon="hourglass-outline" message="Loading courses..." />
      ) : filteredCourses.length === 0 ? (
        <EmptyState icon="search-outline" message={safeCourses.length === 0 ? 'No lessons available yet.' : 'No courses match this search/filter.'} />
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  searchInput: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textMain,
    fontSize: 13,
  },
  teacherFilterList: { paddingTop: SPACING.sm, gap: 8, paddingRight: 16 },
  teacherChip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6 },
  teacherChipSelected: { borderColor: COLORS.primary, backgroundColor: '#E8F5EE' },
  teacherChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  teacherChipTextSelected: { color: COLORS.primary },
  refreshBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 6 },
  refreshText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  headerSubtitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardImage: { width: '100%', height: 116 },
  cardBody: { padding: SPACING.md, gap: SPACING.sm },
  courseName: { ...TYPOGRAPHY.heading, fontSize: 17, color: COLORS.text },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  teacherName: { ...TYPOGRAPHY.body, color: COLORS.textMuted, flex: 1 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMain },
  progressMeta: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
  attendBtn: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  attendBtnText: { color: COLORS.goldText, fontSize: 13, fontWeight: '700' },
});
