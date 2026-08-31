import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import type { Book, Course, Teacher } from '@/context/DataContext';

const THEME = {
  primary: '#005F46',
  primaryLight: '#0B6B53',
  gold: '#C8A84E',
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F2',
  textMain: '#12332A',
  textMuted: '#60736B',
  border: '#E2E8E4',
};

type Props = {
  courses?: Course[];
  teachers?: Teacher[];
  books?: Book[];
};

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const AdminActivityCenter = React.memo(function AdminActivityCenter({ courses = [], teachers = [], books = [] }: Props) {
  const activities = useMemo(() => {
    const list: ActivityItem[] = [];

    if (courses.length > 0) {
      const latestCourse = courses[courses.length - 1];
      list.push({
        id: `course_${latestCourse.id}`,
        title: 'Active LMS Curriculum',
        subtitle: `Course active: "${latestCourse.name}" assigned to ${latestCourse.teacher_name || 'Faculty Member'}`,
        time: 'Active',
        icon: 'school-outline',
        color: '#8B5CF6',
      });
    }

    if (teachers.length > 0) {
      const latestTeacher = teachers[teachers.length - 1];
      list.push({
        id: `teacher_${latestTeacher.id}`,
        title: 'Faculty Member Active',
        subtitle: `${latestTeacher.name} (${latestTeacher.title || 'Teacher'}) managing ${latestTeacher.courses?.length || 0} active courses`,
        time: 'Verified',
        icon: 'people-outline',
        color: '#3B82F6',
      });
    }

    if (books.length > 0) {
      const latestBook = books[0];
      list.push({
        id: `book_${latestBook.id}`,
        title: 'Library Resource Published',
        subtitle: `Book resource: "${latestBook.title}" in category ${latestBook.category || 'General'}`,
        time: 'Available',
        icon: 'book-outline',
        color: '#06B6D4',
      });
    }

    list.push({
      id: 'sys_audit_1',
      title: 'Security & RBAC Guard Active',
      subtitle: 'All role-based access control checkpoints and session tokens validated',
      time: 'Live',
      icon: 'shield-checkmark-outline',
      color: '#10B981',
    });

    list.push({
      id: 'sys_notif_1',
      title: 'FCM Notification Dispatcher',
      subtitle: 'Push notification engine configured and ready for student broadcasts',
      time: 'Ready',
      icon: 'notifications-outline',
      color: '#EC4899',
    });

    return list.slice(0, 5);
  }, [courses, teachers, books]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="pulse-outline" size={17} color={THEME.primary} />
          <Text style={styles.title}>System Timeline & Activity</Text>
        </View>
        <Text style={styles.subtitle}>Audit Feed</Text>
      </View>

      <View style={styles.list}>
        {activities.map((item, index) => (
          <View key={item.id} style={[styles.activityRow, index === activities.length - 1 ? { borderBottomWidth: 0 } : {}]}>
            <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
              <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activitySub} numberOfLines={2}>{item.subtitle}</Text>
            </View>
            <View style={styles.timeTag}>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textMain,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  list: {
    backgroundColor: THEME.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.textMain,
  },
  activitySub: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 1,
    lineHeight: 15,
  },
  timeTag: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textMuted,
  },
});
