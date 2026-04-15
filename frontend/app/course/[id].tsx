import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS, COURSES, TEACHERS, getCourseImage, getTeacherAvatar } from '@/constants/theme';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const course = COURSES.find((c) => c.id === id);
  if (!course) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Course not found</Text>
      </View>
    );
  }

  const teacher = TEACHERS.find((t) => t.id === course.teacherId);
  const courseIndex = COURSES.findIndex((c) => c.id === id);

  const handleJoinClass = () => {
    Alert.alert(
      'Join Class',
      'Class link will be shared by teacher',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero Image */}
        <View style={styles.heroWrapper}>
          <Image source={{ uri: getCourseImage(courseIndex) }} style={styles.heroImage} />
          <LinearGradient
            colors={['rgba(15,56,34,0.3)', 'rgba(15,56,34,0.95)']}
            style={styles.heroGradient}
          />
          {/* Back Button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => router.back()}
            testID="course-detail-back-btn"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          {/* Course Title on Hero */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{course.name}</Text>
          </View>
        </View>

        {/* Course Info */}
        <View style={styles.body}>
          {/* Teacher Info Row */}
          <TouchableOpacity
            style={styles.teacherCard}
            testID="course-detail-teacher-link"
            activeOpacity={0.8}
            onPress={() => teacher && router.push(`/teacher/${teacher.id}`)}
          >
            {teacher && (
              <Image source={{ uri: getTeacherAvatar(teacher.id) }} style={styles.teacherAvatar} />
            )}
            <View style={styles.teacherInfo}>
              <Text style={styles.teacherLabel}>Instructor</Text>
              <Text style={styles.teacherNameText}>{course.teacher}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Schedule */}
          <View style={styles.infoCard} testID="course-detail-schedule">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Schedule</Text>
            </View>
            <Text style={styles.infoCardValue}>{course.schedule}</Text>
          </View>

          {/* Description */}
          <View style={styles.infoCard} testID="course-detail-description">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>About this Course</Text>
            </View>
            <Text style={styles.descriptionText}>{course.description}</Text>
          </View>

          {/* Join Class Button */}
          <TouchableOpacity
            style={styles.joinBtn}
            testID="join-class-btn"
            activeOpacity={0.8}
            onPress={handleJoinClass}
          >
            <Ionicons name="videocam" size={20} color="#FFFFFF" />
            <Text style={styles.joinBtnText}>Join Class</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  heroWrapper: { height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  heroContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.lg,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', lineHeight: 34 },
  body: { padding: SPACING.lg, gap: SPACING.md },
  teacherCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.md, gap: 12, ...SHADOWS.card,
  },
  teacherAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: COLORS.secondary },
  teacherInfo: { flex: 1 },
  teacherLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  teacherNameText: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginTop: 2 },
  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.card,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  infoCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  infoCardValue: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  descriptionText: { fontSize: 15, color: COLORS.textMuted, lineHeight: 24 },
  joinBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: SPACING.sm, ...SHADOWS.card,
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
