import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, getTeacherAvatar } from '@/constants/theme';
import { useData, Teacher } from '@/context/DataContext';
import { EmptyState, FadeInView, ScalePressable, ScreenRefreshControl } from '@/components/ui';
import { normalizeGoogleDriveFileUrl } from '@/lib/links';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

function TeacherCard({ teacher, isOnly }: { teacher: Teacher; isOnly: boolean }) {
  const router = useRouter();
  const { courses } = useData();
  const avatarUri = teacher.photo_url ? normalizeGoogleDriveFileUrl(teacher.photo_url) : getTeacherAvatar(teacher.id);
  const initial = (teacher.name || 'T').charAt(0).toUpperCase();

  // Dynamic subject count
  const subjectsTaughtCount = React.useMemo(() => {
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();
    const subSet = new Set<string>();

    courses.forEach((c) => {
      if (Array.isArray(c.subjects)) {
        c.subjects.forEach((s) => {
          const isAssigned =
            (s.teacher_id && s.teacher_id === tId) ||
            (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName));
          if (isAssigned && s.name) {
            subSet.add(s.name.trim().toLowerCase());
          }
        });
      }
    });
    return subSet.size;
  }, [teacher, courses]);

  const coursesTaughtCount = React.useMemo(() => {
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();
    return courses.filter((c) => {
      if (c.teacher_id && c.teacher_id === tId) return true;
      if (c.teacher_name && tName && c.teacher_name.toLowerCase().includes(tName)) return true;
      if (Array.isArray(teacher.courses) && teacher.courses.some((tc) => tc.toLowerCase() === c.name.toLowerCase())) return true;
      if (Array.isArray(teacher.assigned_courses) && teacher.assigned_courses.includes(c.id)) return true;
      if (Array.isArray(c.subjects) && c.subjects.some((s) => s.teacher_id === tId || (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName)))) return true;
      return false;
    }).length;
  }, [teacher, courses]);

  const handleStartChat = (e: any) => {
    e?.stopPropagation?.();
    if (teacher.id) {
      router.push(`/chat/${teacher.id}` as any);
    } else {
      router.push('/(tabs)/chats');
    }
  };

  return (
    <ScalePressable
      style={[styles.card, isOnly && styles.cardCentered]}
      testID={`teacher-card-${teacher.id}`}
      onPress={() => router.push(`/teacher/${teacher.id}`)}
    >
      <View style={styles.cardTop}>
        {teacher.photo_url ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <View style={styles.verifiedTag}>
          <Ionicons name="shield-checkmark" size={11} color="#059669" />
          <Text style={styles.verifiedTagText}>APPROVED FACULTY</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.teacherName}>{teacher.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="school-outline" size={14} color={COLORS.primary} />
          <Text style={styles.titleText}>{teacher.title || 'Ustaadha'}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="book-outline" size={13} color={COLORS.primary} />
            <Text style={styles.statText}>{coursesTaughtCount > 0 ? coursesTaughtCount : teacher.courses.length} Classes</Text>
          </View>
          {subjectsTaughtCount > 0 ? (
            <View style={styles.statItem}>
              <Ionicons name="library-outline" size={13} color="#D97706" />
              <Text style={styles.statText}>{subjectsTaughtCount} Subjects</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.coursesText} numberOfLines={2}>
          {teacher.courses && teacher.courses.length > 0 ? `Teaches: ${teacher.courses.join(', ')}` : 'Dedicated Madrasa Faculty'}
        </Text>

        {/* Dual Actions: Message + View Profile */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={handleStartChat}
            activeOpacity={0.8}
            accessibilityLabel={`Message ${teacher.name}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
          <View style={styles.viewProfileBtn}>
            <Text style={styles.viewProfileText}>View Profile</Text>
            <Ionicons name="chevron-forward" size={13} color={COLORS.goldText} />
          </View>
        </View>
      </View>
    </ScalePressable>
  );
}

export default function TeachersScreen() {
  const { teachers, loading, error, refetch } = useData();
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    if (refetch) await refetch();
  });
  const insets = useSafeAreaInsets();
  const isOnly = teachers.length === 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FadeInView style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Our Teachers</Text>
            <Text style={styles.headerSubtitle}>Guiding with knowledge & wisdom</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refetch}>
            <Ionicons name="refresh" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </FadeInView>
      {loading ? (
        <EmptyState icon="hourglass-outline" title="Loading" message="Loading teachers..." />
      ) : error && teachers.length === 0 ? (
        <EmptyState icon="alert-circle-outline" title="Unable to Load Teachers" message={error} action={{ label: 'Retry', onPress: refetch }} />
      ) : teachers.length === 0 ? (
        <EmptyState icon="people-outline" title="No Teachers Yet" message="Teachers will appear here once added." />
      ) : (
        <ScrollView
          refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.listContent, isOnly && styles.listCentered]} 
          testID="teachers-list"
        >
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} isOnly={isOnly} />
          ))}
        </ScrollView>
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
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  headerSubtitle: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: RADIUS.xxl,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  listCentered: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCentered: { maxWidth: 400, alignSelf: 'center', width: '100%' },
  cardTop: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surfaceAlt,
  },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: COLORS.primary,
  },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.goldBg,
    borderWidth: 3, borderColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: COLORS.goldText },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginTop: 8,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  cardBody: { padding: SPACING.md, gap: SPACING.xs },
  teacherName: { ...TYPOGRAPHY.heading, color: COLORS.text, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  titleText: { ...TYPOGRAPHY.label, color: COLORS.primary },
  statsRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: SPACING.md, marginTop: 4,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  coursesText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  messageBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  viewProfileBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
  },
  viewProfileText: { color: COLORS.goldText, fontSize: 13, fontWeight: '700' },
});
