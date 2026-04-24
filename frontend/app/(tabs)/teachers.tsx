import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, getTeacherAvatar } from '@/constants/theme';
import { useData, Teacher } from '@/context/DataContext';
import { EmptyState, FadeInView, ScalePressable } from '@/components/ui';
import { normalizeGoogleDriveFileUrl } from '@/lib/links';

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const avatarUri = teacher.photo_url ? normalizeGoogleDriveFileUrl(teacher.photo_url) : getTeacherAvatar(teacher.id);

  return (
    <ScalePressable
      style={styles.card}
      testID={`teacher-card-${teacher.id}`}
      onPress={() => router.push(`/teacher/${teacher.id}`)}
    >
      <View style={styles.cardTop}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.teacherName}>{teacher.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="school-outline" size={14} color={COLORS.primary} />
          <Text style={styles.titleText}>{teacher.title}</Text>
        </View>
        <Text style={styles.coursesText} numberOfLines={2}>Teaches: {teacher.courses.join(', ')}</Text>
      </View>
    </ScalePressable>
  );
}

export default function TeachersScreen() {
  const insets = useSafeAreaInsets();
  const { teachers, loading, refetch } = useData();

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
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
      {loading ? (
        <EmptyState icon="hourglass-outline" message="Loading teachers..." />
      ) : teachers.length === 0 ? (
        <EmptyState icon="people-outline" message="No teachers available yet." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent} testID="teachers-list">
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
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitle: { ...TYPOGRAPHY.title, color: COLORS.text },
  headerSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  refreshBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 6 },
  refreshText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.card },
  cardTop: { alignItems: 'center', paddingVertical: SPACING.md, backgroundColor: COLORS.background },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: COLORS.primary },
  cardBody: { padding: SPACING.md, gap: SPACING.xs },
  teacherName: { ...TYPOGRAPHY.heading, color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  titleText: { ...TYPOGRAPHY.label, color: COLORS.primary },
  coursesText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
});
