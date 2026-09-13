import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { UserProfile } from '@/context/AuthContext';

interface StudentLearningCardProps {
  profile: UserProfile | null;
  resumeCourseName?: string;
  totalLessons?: number;
  lessonsDone?: number;
  completionPercent?: number;
  coursesCount?: number;
}

export function StudentLearningCard({
  profile,
  resumeCourseName,
  totalLessons = 0,
  lessonsDone = 0,
  completionPercent = 0,
  coursesCount = 1,
}: StudentLearningCardProps) {
  const router = useRouter();

  const studentName = profile?.name || 'Taliba';
  const roleLabel =
    profile?.role === 'super_admin' || profile?.founder
      ? 'ADMINISTRATOR'
      : profile?.role === 'teacher' || profile?.role === 'assistant_teacher'
      ? 'USTAADHA • FACULTY'
      : 'TALIBA • STUDENT';

  const courseDisplay = resumeCourseName || (coursesCount > 0 ? 'Darse Nizami & Classical Studies' : 'Islamic Scholarship');

  const hasLessons = totalLessons > 0;
  const safePercent = Math.min(100, Math.max(0, completionPercent));

  return (
    <View style={styles.cardContainer}>
      {/* Top Identity Header */}
      <View style={styles.headerRow}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {studentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.studentInfoCol}>
          <View style={styles.statusRow}>
            <Text style={styles.myLearningEyebrow}>MY LEARNING</Text>
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>
          <Text style={styles.studentName} numberOfLines={1} adjustsFontSizeToFit>
            {studentName}
          </Text>
          <Text style={styles.roleTag}>{roleLabel}</Text>
        </View>

        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => router.push('/(tabs)/about')}
          accessibilityRole="button"
          accessibilityLabel="Open Student Profile"
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Course & Subjects Summary */}
      <View style={styles.courseMetaBox}>
        <View style={styles.courseIconBox}>
          <Ionicons name="school" size={18} color="#C6A15B" />
        </View>
        <View style={styles.courseTextCol}>
          <Text style={styles.courseTitle} numberOfLines={1}>
            {courseDisplay}
          </Text>
          <Text style={styles.courseSubtitle}>
            {hasLessons ? `${totalLessons} Lessons Enrolled` : 'Enrolled Curriculum'}
          </Text>
        </View>
        <View style={styles.percentBadge}>
          <Text style={styles.percentText}>{hasLessons ? `${safePercent}%` : 'Enrolled'}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${hasLessons ? safePercent : 15}%` }]} />
        </View>
        <View style={styles.progressFooterRow}>
          <Text style={styles.progressMetaText}>
            {hasLessons
              ? `${lessonsDone} of ${totalLessons} Lessons Completed`
              : 'Ready to continue study track'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/about')}
            style={styles.viewProfileLink}
            activeOpacity={0.7}
          >
            <Text style={styles.viewProfileText}>View Profile</Text>
            <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginTop: -28,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E7E4DA',
    ...SHADOWS.premiumCard,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#043C32',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C6A15B',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  studentInfoCol: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  myLearningEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71817B',
    letterSpacing: 1.1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7, 91, 73, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#075B49',
  },
  activeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#075B49',
    letterSpacing: 0.3,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17332C',
    letterSpacing: -0.3,
  },
  roleTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C6A15B',
    marginTop: 1,
    letterSpacing: 0.6,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F5EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E4DA',
  },
  courseMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCFBF7',
    borderRadius: 14,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EFECE2',
    gap: 10,
  },
  courseIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#043C32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTextCol: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17332C',
  },
  courseSubtitle: {
    fontSize: 11,
    color: '#71817B',
    marginTop: 1,
  },
  percentBadge: {
    backgroundColor: '#075B49',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E7E4DA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#075B49',
    borderRadius: 3,
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressMetaText: {
    fontSize: 11,
    color: '#71817B',
    fontWeight: '500',
  },
  viewProfileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#075B49',
  },
});
