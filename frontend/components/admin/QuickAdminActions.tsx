import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { ROUTES } from '@/lib/routes';

const THEME = COLORS;

type ActionItem = {
  id: string;
  label: string;
  subLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
  color: string;
};

type ActionCategory = {
  title: string;
  items: ActionItem[];
};

const ACTION_CATEGORIES: ActionCategory[] = [
  {
    title: 'Academic & Faculty',
    items: [
      { id: 'users', label: 'Approve Students', subLabel: 'Roster Review', icon: 'person-add-outline', route: ROUTES.admin.users, color: '#10B981' },
      { id: 'teachers', label: 'Courses & Faculty', subLabel: 'LMS Curriculum & Teachers', icon: 'school-outline', route: ROUTES.admin.academics, color: '#8B5CF6' },
      { id: 'quizzes', label: 'Quiz & Exams', subLabel: 'Questions & Evaluation', icon: 'list-outline', route: ROUTES.admin.manageQuizzes, color: '#F59E0B' },
      { id: 'sabaq', label: 'Sabaq Diary', subLabel: 'Hifz & Dars Progress', icon: 'journal-outline', route: '/sabaq-diary' as Href, color: '#047857' },
      { id: 'library', label: 'Madrasa Library', subLabel: 'Publish Textbooks', icon: 'book-outline', route: ROUTES.admin.addBook, color: '#06B6D4' },
      { id: 'attendance', label: 'Class Attendance', subLabel: 'Student Logs', icon: 'calendar-outline', route: ROUTES.attendance, color: '#6366F1' },
      { id: 'certificates', label: 'Sanads & Credentials', subLabel: 'Academic Certificates', icon: 'ribbon-outline', route: ROUTES.certificate, color: '#D97706' },
    ],
  },
  {
    title: 'Operations & Broadcasting',
    items: [
      { id: 'live', label: 'Create Live Class', subLabel: 'Stream Host', icon: 'videocam-outline', route: ROUTES.liveClasses, color: '#EF4444' },
      { id: 'payments', label: 'Manage Payments', subLabel: 'Financial Audit', icon: 'card-outline', route: ROUTES.admin.payments, color: '#10B981' },
      { id: 'org_settings', label: 'Madrasa Settings', subLabel: 'Branding, UPI & Bank', icon: 'settings-outline', route: ROUTES.admin.organizationSettings, color: '#059669' },
    ],
  },
  {
    title: 'Communication & Outreach',
    items: [
      { id: 'broadcast', label: 'Broadcast & Push', subLabel: 'Student & Faculty Alerts', icon: 'megaphone-outline', route: ROUTES.admin.sendPush, color: '#EC4899' },
      { id: 'fatawa', label: 'Dar-ul-Iftaa', subLabel: 'Questions & Islamic Q&A', icon: 'shield-checkmark-outline', route: ROUTES.tools.fatawaManage, color: '#D97706' },
    ],
  },
  {
    title: 'Governance & Security',
    items: [
      { id: 'analytics', label: 'Analytics Dashboard', subLabel: 'LMS Telemetry', icon: 'bar-chart-outline', route: ROUTES.admin.analytics, color: '#3B82F6' },
      { id: 'moderation', label: 'Moderation Queue', subLabel: 'Community Review', icon: 'flag-outline', route: ROUTES.admin.moderation, color: '#F97316' },
      { id: 'security', label: 'Security Diagnostics', subLabel: 'System Audit', icon: 'lock-closed-outline', route: ROUTES.admin.security, color: '#EF4444' },
      { id: 'privacy', label: 'Privacy & GDPR', subLabel: 'Data Inquiries', icon: 'document-lock-outline', route: ROUTES.admin.privacyRequests, color: '#64748B' },
    ],
  },
];

export const QuickAdminActions = React.memo(function QuickAdminActions() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;
  const numCols = isTablet ? 3 : 2;
  const gap = 8;
  // container has marginHorizontal: SPACING.md (16*2), padding: SPACING.md (16*2), and borderWidth: 1 (1*2) => 66dp total
  const containerOffset = (SPACING.md * 4) + 2;
  const availableGridWidth = Math.max(0, windowWidth - containerOffset);
  const cardWidth = Math.floor((availableGridWidth - ((numCols - 1) * gap)) / numCols);

  const handlePress = useCallback((route: Href) => {
    try {
      router.push(route);
    } catch (e) {
      console.warn('[QuickAdminActions] Navigation error:', e);
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="grid-outline" size={17} color={THEME.primary} />
          <Text style={styles.title}>Administrative Control Center</Text>
        </View>
        <Text style={styles.subtitle}>Enterprise LMS</Text>
      </View>

      {ACTION_CATEGORIES.map((category) => (
        <View key={category.title} style={styles.categorySection}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <View style={styles.grid}>
            {category.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.actionCard, { width: cardWidth }]}
                onPress={() => handlePress(item.route)}
                activeOpacity={0.75}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${item.label}`}
              >
                <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {item.subLabel ? (
                    <Text style={styles.actionSubLabel} numberOfLines={2}>
                      {item.subLabel}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={THEME.textMuted} style={styles.chevron} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
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
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    marginBottom: SPACING.xs,
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
  categorySection: {
    marginTop: SPACING.sm,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: THEME.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 52,
    gap: 8,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: THEME.textMain,
  },
  actionSubLabel: {
    fontSize: 10,
    lineHeight: 13,
    color: THEME.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
    padding: 4,
  },
});
