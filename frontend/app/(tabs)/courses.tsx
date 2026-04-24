import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, getCourseImage } from '@/constants/theme';
import { useData, Course } from '@/context/DataContext';
import { EmptyState, FadeInView, ScalePressable } from '@/components/ui';

function CourseCard({ course, index }: { course: Course; index: number }) {
  const router = useRouter();
  const { getCourseProgress } = useData();
  const progress = getCourseProgress(course.id);
  const handlePress = () => {
    try {
      const path = course?.id ? `/course/${course.id}` : '';
      if (!path) return;
      console.log('[Courses] course card pressed:', path);
      router.push(path);
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
            {progress.lessonsDone}/{progress.totalLessons || 0} lessons
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
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { courses, loading } = useData();
  const safeCourses = Array.isArray(courses) ? courses : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FadeInView style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.headerTitle}>Our Courses</Text>
        <Text style={styles.headerSubtitle}>
          {loading ? 'Loading...' : `${safeCourses.length} courses available`}
        </Text>
      </FadeInView>
      {loading ? (
        <EmptyState icon="hourglass-outline" message="Loading courses..." />
      ) : safeCourses.length === 0 ? (
        <EmptyState icon="book-outline" message="No courses available yet." />
      ) : (
        <FlatList
          data={safeCourses}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <CourseCard course={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={6}
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
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: { ...TYPOGRAPHY.title, color: COLORS.text },
  headerSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
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
