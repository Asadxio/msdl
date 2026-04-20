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

  return (
    <ScalePressable
      style={styles.card}
      testID={`course-card-${course.id}`}
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <Image source={{ uri: getCourseImage(index) }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.courseName}>{course.name}</Text>
        <View style={styles.teacherRow}>
          <Ionicons name="person-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.teacherName} numberOfLines={1}>{course.teacher_name}</Text>
        </View>
        <View style={styles.attendBtn}>
          <Ionicons name="videocam" size={16} color="#FFFFFF" />
          <Text style={styles.attendBtnText}>Attend Class</Text>
        </View>
      </View>
    </ScalePressable>
  );
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { courses, loading } = useData();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FadeInView style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.headerTitle}>Our Courses</Text>
        <Text style={styles.headerSubtitle}>
          {loading ? 'Loading...' : `${courses.length} courses available`}
        </Text>
      </FadeInView>
      {loading ? (
        <EmptyState icon="hourglass-outline" message="Loading courses..." />
      ) : courses.length === 0 ? (
        <EmptyState icon="book-outline" message="No courses available yet." />
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <CourseCard course={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardImage: { width: '100%', height: 132 },
  cardBody: { padding: SPACING.md, gap: SPACING.sm },
  courseName: { ...TYPOGRAPHY.heading, fontSize: 18, color: COLORS.text },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  teacherName: { ...TYPOGRAPHY.body, color: COLORS.textMuted, flex: 1 },
  attendBtn: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  attendBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
