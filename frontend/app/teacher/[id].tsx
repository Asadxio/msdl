import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, getTeacherAvatar, getCourseImage } from '@/constants/theme';
import { useData, Course, CourseSubject } from '@/context/DataContext';
import { normalizeGoogleDriveFileUrl } from '@/lib/links';

export default function TeacherDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { courses, teachers, loading } = useData();

  const teacher = useMemo(() => {
    if (!id) return undefined;
    return teachers.find((t) => t.id === id);
  }, [id, teachers]);

  // 1. Dynamic Matching of Courses genuinely associated with this teacher
  const matchedCourses = useMemo(() => {
    if (!teacher) return [];
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();

    return courses.filter((c) => {
      // Direct teacher_id match
      if (c.teacher_id && c.teacher_id === tId) return true;
      // Lead teacher_name match
      if (c.teacher_name && tName && c.teacher_name.toLowerCase().includes(tName)) return true;
      // In teacher.courses array
      if (Array.isArray(teacher.courses) && teacher.courses.some((tc) => tc.toLowerCase() === c.name.toLowerCase())) {
        return true;
      }
      // In teacher.assigned_courses array
      if (Array.isArray(teacher.assigned_courses) && teacher.assigned_courses.includes(c.id)) {
        return true;
      }
      // Subject-level assignment
      if (Array.isArray(c.subjects) && c.subjects.length > 0) {
        return c.subjects.some((s) => {
          if (s.teacher_id && s.teacher_id === tId) return true;
          if (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName)) return true;
          return false;
        });
      }
      return false;
    });
  }, [teacher, courses]);

  // 2. Helper to get subjects specifically taught by THIS teacher in a course
  const getTeacherSubjectsInCourse = (course: Course): CourseSubject[] => {
    if (!teacher || !Array.isArray(course.subjects)) return [];
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();

    const specificSubjects = course.subjects.filter((s) => {
      if (s.teacher_id && s.teacher_id === tId) return true;
      if (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName)) return true;
      return false;
    });

    // If teacher is the lead teacher of the course and no subject is explicitly marked, return all
    if (specificSubjects.length === 0 && (course.teacher_id === tId || (course.teacher_name && course.teacher_name.toLowerCase().includes(tName)))) {
      return course.subjects;
    }

    return specificSubjects;
  };

  // 3. Dynamic Aggregation & Deduplication of Subjects Taught across all classes
  const distinctSubjectsTaught = useMemo(() => {
    if (!teacher) return [];
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();
    const subjectsMap = new Map<string, string>();

    courses.forEach((c) => {
      if (Array.isArray(c.subjects)) {
        c.subjects.forEach((s) => {
          const isAssigned =
            (s.teacher_id && s.teacher_id === tId) ||
            (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName));
          if (isAssigned && s.name) {
            const cleanName = s.name.trim();
            if (!subjectsMap.has(cleanName.toLowerCase())) {
              subjectsMap.set(cleanName.toLowerCase(), cleanName);
            }
          }
        });
      }
    });

    // If specializations list is stored on teacher object, include those too
    if (teacher.specializations) {
      const specs = Array.isArray(teacher.specializations)
        ? teacher.specializations
        : String(teacher.specializations).split(',').map((s) => s.trim());
      specs.forEach((spec) => {
        if (spec && !subjectsMap.has(spec.toLowerCase())) {
          subjectsMap.set(spec.toLowerCase(), spec);
        }
      });
    }

    return Array.from(subjectsMap.values());
  }, [teacher, courses]);

  // 4. Formatted Qualifications List
  const qualificationsList = useMemo(() => {
    if (!teacher?.qualifications) return [];
    if (Array.isArray(teacher.qualifications)) return teacher.qualifications;
    return String(teacher.qualifications)
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);
  }, [teacher?.qualifications]);

  // 5. Formatted Languages List
  const languagesList = useMemo(() => {
    if (!teacher?.languages) return [];
    if (Array.isArray(teacher.languages)) return teacher.languages;
    return String(teacher.languages)
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }, [teacher?.languages]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading faculty profile...</Text>
        </View>
      </View>
    );
  }

  if (!teacher) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.errorBackBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)/teachers')}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Return to Faculty</Text>
        </TouchableOpacity>
        <View style={styles.notFoundWrap}>
          <Ionicons name="person-circle-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.errorTitle}>Faculty Member Not Found</Text>
          <Text style={styles.errorSub}>The requested teacher profile is not registered in the institutional system.</Text>
        </View>
      </View>
    );
  }

  const avatarUri = teacher.photo_url
    ? normalizeGoogleDriveFileUrl(teacher.photo_url)
    : getTeacherAvatar(teacher.id);
  const initial = (teacher.name || 'U').charAt(0).toUpperCase();

  const handleStartChat = () => {
    if (teacher.id) {
      router.push(`/chat/${teacher.id}` as any);
    } else {
      router.push('/(tabs)/chats');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)/teachers')}
          testID="teacher-detail-back-btn"
          activeOpacity={0.8}
          accessibilityLabel="Back to teachers list"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={styles.topBarTitleCenter}>
          <Text style={styles.topBarInstitution}>مدرسۃ السالکات للبنات</Text>
          <Text style={styles.topBarTitle}>Faculty Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.directChatTopBtn}
          onPress={handleStartChat}
          activeOpacity={0.8}
          accessibilityLabel={`Chat with ${teacher.name}`}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ========================================================================= */}
        {/* HERO SECTION: AVATAR, NAME, TITLE & VERIFICATION BADGE                     */}
        {/* ========================================================================= */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            {teacher.photo_url ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitialText}>{initial}</Text>
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FFF" />
            </View>
          </View>

          <Text style={styles.teacherName} testID="teacher-detail-name">
            {teacher.name}
          </Text>

          <View style={styles.titleBadge}>
            <Ionicons name="school" size={13} color={COLORS.goldText} />
            <Text style={styles.titleBadgeText}>
              {teacher.title || 'Ustaadha • Madrasatu-s-Salikat Faculty'}
            </Text>
          </View>

          <View style={styles.facultyMetaRow}>
            <View style={styles.facultyStatusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.facultyStatusText}>APPROVED FACULTY • Certified Scholar</Text>
            </View>
          </View>

          {/* 1-Tap Guidance Chat Action Button */}
          <TouchableOpacity
            style={styles.chatActionBtn}
            onPress={handleStartChat}
            activeOpacity={0.85}
            accessibilityLabel={`Start Direct 1-on-1 Guidance Chat with ${teacher.name}`}
          >
            <Ionicons name="chatbubbles" size={18} color="#FFF" />
            <Text style={styles.chatActionBtnText}>Direct 1-on-1 Guidance Chat</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================================= */}
        {/* FACULTY KPIS (COURSES, SUBJECTS, EXPERIENCE, SYSTEM)                       */}
        {/* ========================================================================= */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="book" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.statNumber}>{matchedCourses.length}</Text>
            <Text style={styles.statLabel}>Assigned Classes</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="library" size={16} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>
              {distinctSubjectsTaught.length > 0 ? distinctSubjectsTaught.length : '—'}
            </Text>
            <Text style={styles.statLabel}>Subjects Taught</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="time" size={16} color="#2563EB" />
            </View>
            <Text style={styles.statNumber}>
              {teacher.experience_years ? `${teacher.experience_years}` : '—'}
            </Text>
            <Text style={styles.statLabel}>Experience</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION: ACADEMIC SUBJECTS TAUGHT & SPECIALIZATIONS                       */}
        {/* ========================================================================= */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="library-outline" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Academic Subjects & Specializations</Text>
              <Text style={styles.sectionSubtitle}>Institutional disciplines taught by this Ustaadha</Text>
            </View>
          </View>

          {distinctSubjectsTaught.length > 0 ? (
            <View style={styles.subjectsWrap}>
              {distinctSubjectsTaught.map((subjectName, idx) => (
                <View key={idx} style={styles.subjectChip}>
                  <Ionicons name="book" size={13} color={COLORS.primary} />
                  <Text style={styles.subjectChipText}>{subjectName}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyInlineCard}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.emptyInlineText}>
                Subject assignments are linked per academic session syllabus.
              </Text>
            </View>
          )}
        </View>

        {/* ========================================================================= */}
        {/* SECTION: QUALIFICATIONS & SANAD CREDENTIALS                               */}
        {/* ========================================================================= */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF9C3' }]}>
              <Ionicons name="ribbon-outline" size={18} color="#CA8A04" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Qualifications & Credentials</Text>
              <Text style={styles.sectionSubtitle}>Islamic degrees and teaching certifications</Text>
            </View>
          </View>

          {qualificationsList.length > 0 ? (
            <View style={styles.qualificationsList}>
              {qualificationsList.map((qual, idx) => (
                <View key={idx} style={styles.qualificationRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.qualificationText}>{qual}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyInlineCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#059669" />
              <Text style={styles.emptyInlineText}>
                Official Sanads and Alimiyyah credentials verified on institutional file.
              </Text>
            </View>
          )}
        </View>

        {/* ========================================================================= */}
        {/* SECTION: BIOGRAPHY & TEACHING PHILOSOPHY                                   */}
        {/* ========================================================================= */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>About Ustaadha</Text>
              <Text style={styles.sectionSubtitle}>Teaching philosophy and guidance</Text>
            </View>
          </View>

          <Text style={styles.bioText}>
            {teacher.bio
              ? teacher.bio
              : 'Dedicated faculty member at Madrasatu-s-Salikat Lil Banat, committed to nurturing students with authentic Islamic scholarship, Tajweed perfection, and moral tarbiyah.'}
          </Text>

          {languagesList.length > 0 ? (
            <View style={styles.languagesRow}>
              <Text style={styles.languagesLabel}>Instruction Languages:</Text>
              <View style={styles.languagesPills}>
                {languagesList.map((lang, idx) => (
                  <View key={idx} style={styles.languagePill}>
                    <Text style={styles.languagePillText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* ========================================================================= */}
        {/* SECTION: ASSIGNED CLASSES & SABAQ TIMETABLE                               */}
        {/* ========================================================================= */}
        <View style={styles.sectionCard} testID="teacher-detail-courses">
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Assigned Classes ({matchedCourses.length})</Text>
              <Text style={styles.sectionSubtitle}>Courses and schedules supervised by this faculty member</Text>
            </View>
          </View>

          {matchedCourses.length > 0 ? (
            <View style={styles.coursesList}>
              {matchedCourses.map((course) => {
                const courseIndex = courses.findIndex((c) => c.id === course.id);
                const teacherSubs = getTeacherSubjectsInCourse(course);

                return (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.courseCard}
                    testID={`teacher-course-${course.id}`}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/course/${course.id}`)}
                  >
                    <Image source={{ uri: getCourseImage(courseIndex) }} style={styles.courseThumb} />
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                      <Text style={styles.courseSchedule} numberOfLines={1}>
                        {course.schedule || course.time || 'Regular Academic Class'}
                      </Text>

                      {/* Explicitly show only subjects taught by THIS teacher in this course */}
                      {teacherSubs.length > 0 ? (
                        <View style={styles.courseSubsRow}>
                          <Text style={styles.courseSubsLabel}>Teaches: </Text>
                          {teacherSubs.map((sub, sIdx) => (
                            <View key={sub.id || sIdx} style={styles.courseSubBadge}>
                              <Text style={styles.courseSubBadgeText}>{sub.name}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyInlineCard}>
              <Ionicons name="calendar-clear-outline" size={20} color={COLORS.textMuted} />
              <Text style={styles.emptyInlineText}>
                No active classes are assigned to this faculty member for the current term.
              </Text>
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
  notFoundWrap: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, marginTop: 40 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginTop: SPACING.md },
  errorSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, maxWidth: 280 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleCenter: { alignItems: 'center' },
  topBarInstitution: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.3 },
  topBarTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textMain },
  directChatTopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3.5,
    borderColor: COLORS.secondary,
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: COLORS.secondary,
  },
  avatarInitialText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    backgroundColor: '#059669',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  teacherName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    textAlign: 'center',
    marginTop: 4,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginTop: 6,
  },
  titleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldText,
    letterSpacing: 0.3,
  },
  facultyMetaRow: {
    marginTop: 8,
  },
  facultyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  facultyStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.md,
    width: '100%',
    ...SHADOWS.card,
  },
  chatActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.sm,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  subjectsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  qualificationsList: {
    gap: 8,
    marginTop: 4,
  },
  qualificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  qualificationText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMain,
    flex: 1,
  },

  bioText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  languagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  languagesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  languagesPills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  languagePill: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  languagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMain,
  },

  coursesList: {
    gap: SPACING.sm,
    marginTop: 4,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  courseThumb: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  courseSchedule: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  courseSubsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  courseSubsLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  courseSubBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  courseSubBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },

  emptyInlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  emptyInlineText: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
});
