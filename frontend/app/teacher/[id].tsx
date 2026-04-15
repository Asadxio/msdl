import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, TEACHERS, COURSES, getTeacherAvatar, getCourseImage } from '@/constants/theme';

export default function TeacherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const teacher = TEACHERS.find((t) => t.id === id);
  if (!teacher) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Teacher not found</Text>
      </View>
    );
  }

  const teacherCourses = COURSES.filter((c) => teacher.courseIds.includes(c.id));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header with Back Button */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            testID="teacher-detail-back-btn"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Teacher Profile</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image source={{ uri: getTeacherAvatar(teacher.id) }} style={styles.avatar} />
          <View style={styles.titleBadge}>
            <Ionicons name="star" size={14} color={COLORS.secondary} />
            <Text style={styles.titleBadgeText}>{teacher.title}</Text>
          </View>
          <Text style={styles.teacherName} testID="teacher-detail-name">{teacher.name}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{teacherCourses.length}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>30+</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>5+</Text>
            <Text style={styles.statLabel}>Years</Text>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.sectionCard} testID="teacher-detail-bio">
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <Text style={styles.bioText}>{teacher.bio}</Text>
        </View>

        {/* Courses Taught */}
        <View style={styles.sectionCard} testID="teacher-detail-courses">
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="book-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>Courses ({teacherCourses.length})</Text>
          </View>
          <View style={styles.coursesList}>
            {teacherCourses.map((course) => {
              const courseIndex = COURSES.findIndex((c) => c.id === course.id);
              return (
                <TouchableOpacity
                  key={course.id}
                  style={styles.courseItem}
                  testID={`teacher-course-${course.id}`}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/course/${course.id}`)}
                >
                  <Image source={{ uri: getCourseImage(courseIndex) }} style={styles.courseThumb} />
                  <View style={styles.courseItemInfo}>
                    <Text style={styles.courseItemName} numberOfLines={1}>{course.name}</Text>
                    <Text style={styles.courseItemSchedule} numberOfLines={1}>{course.schedule}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  profileSection: { alignItems: 'center', paddingVertical: SPACING.lg, backgroundColor: COLORS.surface },
  avatar: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.secondary, marginBottom: SPACING.md,
  },
  titleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.goldBg, paddingHorizontal: 16, paddingVertical: 7, borderRadius: RADIUS.full, marginBottom: SPACING.sm,
  },
  titleBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.goldText, letterSpacing: 0.5 },
  teacherName: { fontSize: 22, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', paddingHorizontal: SPACING.lg },
  statsRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center', ...SHADOWS.card,
  },
  statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginTop: 2 },
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg, ...SHADOWS.card,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  bioText: { fontSize: 15, color: COLORS.textMuted, lineHeight: 24 },
  coursesList: { gap: SPACING.sm },
  courseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  courseThumb: { width: 48, height: 48, borderRadius: RADIUS.md },
  courseItemInfo: { flex: 1 },
  courseItemName: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
  courseItemSchedule: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
