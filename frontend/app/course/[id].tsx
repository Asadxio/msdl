import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  StatusBar,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS, getCourseImage, getTeacherAvatar } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { courses, teachers, loading } = useData();
  const [recordings, setRecordings] = useState<{ id: string; title: string; description: string; file_url: string }[]>([]);
  const course = courses.find((c) => c.id === id);
  const classTimeLabel = course?.class_time || course?.time || '';
  const meetLink = course?.meet_link || course?.class_link || '';

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'recordings'), where('course_id', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      const arr: { id: string; title: string; description: string; file_url: string }[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setRecordings(arr);
    });
    return unsub;
  }, [id]);

  const showJoinNow = useMemo(() => {
    if (!classTimeLabel) return true;
    const [hh, mm] = classTimeLabel.split(':').map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return true;
    const now = new Date();
    const slot = new Date();
    slot.setHours(hh, mm, 0, 0);
    return Math.abs(now.getTime() - slot.getTime()) <= 60 * 60 * 1000;
  }, [classTimeLabel]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading course...</Text>
        </View>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Go Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Course not found</Text>
      </View>
    );
  }

  // Find teacher by matching teacher_name
  const teacher = teachers.find((t) => course.teacher_name.includes(t.name.split(' ').slice(-2).join(' ')));
  const courseIndex = courses.findIndex((c) => c.id === id);

  const handleJoinClass = () => {
    if (meetLink && meetLink.trim().length > 0) {
      Linking.openURL(meetLink).catch(() => {
        Alert.alert('Error', 'Unable to open the class link');
      });
    } else {
      Alert.alert(
        'Join Class',
        'Class link will be shared by teacher',
        [{ text: 'OK', style: 'default' }]
      );
    }
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
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => router.back()}
            testID="course-detail-back-btn"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{course.name}</Text>
          </View>
        </View>

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
              <Text style={styles.teacherNameText}>{course.teacher_name}</Text>
            </View>
            {teacher && <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />}
          </TouchableOpacity>

          {/* Schedule */}
          <View style={styles.infoCard} testID="course-detail-schedule">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Schedule</Text>
            </View>
            <Text style={styles.infoCardValue}>{course.schedule || 'Schedule to be announced'}</Text>
            <Text style={styles.infoCardSubValue}>{classTimeLabel || 'Time to be announced'}</Text>
          </View>

          <View style={styles.infoCard} testID="course-detail-meet-link">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="videocam-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Google Meet Link</Text>
            </View>
            <Text style={styles.infoCardValue} numberOfLines={2}>
              {meetLink || 'Meet link will be shared by teacher'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="mic-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Recordings</Text>
            </View>
            {recordings.length === 0 ? (
              <Text style={styles.infoCardSubValue}>No recordings yet.</Text>
            ) : recordings.map((rec) => (
              <TouchableOpacity key={rec.id} style={styles.recordingRow} onPress={() => Linking.openURL(rec.file_url)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordingTitle}>{rec.title || 'Recording'}</Text>
                  <Text style={styles.recordingDesc}>{rec.description || 'Tap to play'}</Text>
                </View>
                <Ionicons name="play-circle-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <View style={styles.infoCard} testID="course-detail-description">
            <View style={styles.infoCardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardTitle}>About this Course</Text>
            </View>
            <Text style={styles.descriptionText}>{course.description || 'Course details coming soon.'}</Text>
          </View>

          {/* Join Class Button */}
          {showJoinNow ? (
            <TouchableOpacity
              style={styles.joinBtn}
              testID="join-class-btn"
              activeOpacity={0.8}
              onPress={handleJoinClass}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" />
              <Text style={styles.joinBtnText}>Join Class</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.joinLaterCard}>
              <Text style={styles.infoCardSubValue}>Next class at {classTimeLabel}. Join button appears 1 hour before class.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  errorBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.lg },
  errorBackText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  errorText: { fontSize: 16, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  heroWrapper: { height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.lg },
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
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.card },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  infoCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  infoCardValue: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  infoCardSubValue: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  descriptionText: { fontSize: 15, color: COLORS.textMuted, lineHeight: 24 },
  joinBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: SPACING.sm, ...SHADOWS.card,
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 },
  recordingTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  recordingDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  joinLaterCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md },
});
