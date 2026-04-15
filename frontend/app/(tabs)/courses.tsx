import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, getCourseImage } from '@/constants/theme';
import { useData, Course } from '@/context/DataContext';

function CourseCard({ course, index }: { course: Course; index: number }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      testID={`course-card-${course.id}`}
      activeOpacity={0.85}
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <Image source={{ uri: getCourseImage(index) }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.courseName}>{course.name}</Text>
        <View style={styles.teacherRow}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.teacherName} numberOfLines={1}>{course.teacher_name}</Text>
        </View>
        <TouchableOpacity
          style={styles.attendBtn}
          testID={`attend-class-btn-${course.id}`}
          activeOpacity={0.8}
          onPress={() => router.push(`/course/${course.id}`)}
        >
          <Ionicons name="videocam" size={18} color="#FFFFFF" />
          <Text style={styles.attendBtnText}>Attend Class</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { courses, loading } = useData();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Our Courses</Text>
        <Text style={styles.headerSubtitle}>
          {loading ? 'Loading...' : `${courses.length} courses available`}
        </Text>
      </View>
      {loading ? (
        <View style={styles.loadingContainer} testID="courses-loading">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading courses...</Text>
        </View>
      ) : courses.length === 0 ? (
        <View style={styles.emptyContainer} testID="courses-empty">
          <Ionicons name="book-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyText}>No courses available</Text>
        </View>
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
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, color: COLORS.textMuted, fontWeight: '500' },
  listContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 30 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.card },
  cardImage: { width: '100%', height: 140 },
  cardBody: { padding: SPACING.md },
  courseName: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  teacherName: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500', flex: 1 },
  attendBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  attendBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
