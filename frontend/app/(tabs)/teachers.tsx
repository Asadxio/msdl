import React from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, getTeacherAvatar } from '@/constants/theme';
import { useData, Teacher } from '@/context/DataContext';

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      testID={`teacher-card-${teacher.id}`}
      activeOpacity={0.85}
      onPress={() => router.push(`/teacher/${teacher.id}`)}
    >
      <View style={styles.cardTop}>
        <Image source={{ uri: getTeacherAvatar(teacher.id) }} style={styles.avatar} />
        <View style={styles.titleBadge}>
          <Ionicons name="star" size={12} color={COLORS.secondary} />
          <Text style={styles.titleBadgeText}>{teacher.title}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.teacherName}>{teacher.name}</Text>
        <View style={styles.divider} />
        <Text style={styles.coursesText} numberOfLines={2}>
          Teaches: {teacher.courses.join(', ')}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="book-outline" size={16} color={COLORS.primary} />
            <Text style={styles.statText}>{teacher.courses.length} Courses</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color={COLORS.primary} />
            <Text style={styles.statText}>30+ Students</Text>
          </View>
        </View>
        <View style={styles.viewProfileRow}>
          <Text style={styles.viewProfileText}>View Profile</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TeachersScreen() {
  const insets = useSafeAreaInsets();
  const { teachers, loading } = useData();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Our Teachers</Text>
        <Text style={styles.headerSubtitle}>Guiding with knowledge & wisdom</Text>
      </View>
      {loading ? (
        <View style={styles.loadingContainer} testID="teachers-loading">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading teachers...</Text>
        </View>
      ) : teachers.length === 0 ? (
        <View style={styles.emptyContainer} testID="teachers-empty">
          <Ionicons name="people-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyText}>No teachers available</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          testID="teachers-list"
        >
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </ScrollView>
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
  listContent: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 30 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, overflow: 'hidden', ...SHADOWS.card },
  cardTop: {
    alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: COLORS.surfaceAlt,
  },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.secondary, marginBottom: SPACING.sm },
  titleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.goldBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  titleBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.goldText, letterSpacing: 0.5 },
  cardBody: { padding: SPACING.lg },
  teacherName: { fontSize: 20, fontWeight: '700', color: COLORS.textMain, textAlign: 'center' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  coursesText: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.xl, marginTop: SPACING.md },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  viewProfileRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  viewProfileText: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
});
