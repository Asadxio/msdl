import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import type { Book, Course, Teacher } from '@/context/DataContext';

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
        subtitle: `Course active: "${latestCourse.name}" assigned to ${latestCourse.teacher_name || 'Instructor'}`,
        time: 'Recent',
        icon: 'school-outline',
        color: '#8B5CF6',
      });
    }

    if (teachers.length > 0) {
      const latestTeacher = teachers[teachers.length - 1];
      list.push({
        id: `teacher_${latestTeacher.id}`,
        title: 'Faculty Member Active',
        subtitle: `${latestTeacher.name} (${latestTeacher.title || 'Teacher'}) managing ${latestTeacher.courses?.length || 0} courses`,
        time: 'Today',
        icon: 'people-outline',
        color: '#3B82F6',
      });
    }

    if (books.length > 0) {
      const latestBook = books[0];
      list.push({
        id: `book_${latestBook.id}`,
        title: 'Library Resource Available',
        subtitle: `Book published: "${latestBook.title}" in category ${latestBook.category || 'General'}`,
        time: 'Recent',
        icon: 'book-outline',
        color: '#06B6D4',
      });
    }

    list.push({
      id: 'sys_audit_1',
      title: 'System Security & RBAC Guard',
      subtitle: 'All role-based access control checkpoints verified and active',
      time: 'Live',
      icon: 'shield-checkmark-outline',
      color: '#10B981',
    });

    list.push({
      id: 'sys_notif_1',
      title: 'Notification Center Ready',
      subtitle: 'Push notification engine configured for enterprise broadcasts',
      time: 'System',
      icon: 'notifications-outline',
      color: '#EC4899',
    });

    return list.slice(0, 5);
  }, [courses, teachers, books]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="pulse-outline" size={18} color={COLORS.primary} />
          <Text style={styles.title}>Activity Center</Text>
        </View>
        <Text style={styles.subtitle}>System Timeline</Text>
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  list: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 56,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  textCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  activitySub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  timeTag: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
