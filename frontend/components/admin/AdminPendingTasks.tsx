import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

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
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

export type PendingTasksCounts = {
  approvals: number;
  payments: number;
  privacy: number;
  moderation: number;
};

type Props = {
  counts?: PendingTasksCounts;
};

export const AdminPendingTasks = React.memo(function AdminPendingTasks({ counts }: Props) {
  const router = useRouter();

  const handleNavigate = useCallback((route: string) => {
    try {
      router.push(route as any);
    } catch (e) {
      console.warn('[AdminPendingTasks] Navigation error:', e);
    }
  }, [router]);

  const approvals = counts?.approvals || 0;
  const payments = counts?.payments || 0;
  const privacy = counts?.privacy || 0;
  const moderation = counts?.moderation || 0;
  const totalPending = approvals + payments + privacy + moderation;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="checkbox-outline" size={17} color={THEME.primary} />
          <Text style={styles.title}>Pending Administrative Tasks</Text>
        </View>
        {totalPending > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalPending} Action Required</Text>
          </View>
        ) : (
          <View style={styles.clearBadge}>
            <Ionicons name="checkmark-circle" size={12} color={THEME.success} />
            <Text style={styles.clearBadgeText}>All Clear</Text>
          </View>
        )}
      </View>

      {totalPending === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={32} color={THEME.success} />
          <Text style={styles.emptyTitle}>Roster & Approvals Up-To-Date</Text>
          <Text style={styles.emptySubtitle}>
            There are currently zero pending student applications, unverified payments, or unresolved privacy inquiries.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {approvals > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: THEME.warning }]}
              onPress={() => handleNavigate('/admin/users')}
              activeOpacity={0.75}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${approvals} Student Approvals Pending`}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="person-add" size={18} color="#D97706" />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{approvals} Student Registrations Pending</Text>
                <Text style={styles.taskSub}>Review applicant details and verify enrollment status</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}

          {payments > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: THEME.success }]}
              onPress={() => handleNavigate('/admin/payments')}
              activeOpacity={0.75}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${payments} Pending Payments`}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="card" size={18} color={THEME.success} />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{payments} Unverified Payment Receipts</Text>
                <Text style={styles.taskSub}>Audit Razorpay transaction references and approve access</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}

          {privacy > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: '#6366F1' }]}
              onPress={() => handleNavigate('/admin/privacy-requests')}
              activeOpacity={0.75}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${privacy} Privacy & GDPR Requests`}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="document-lock" size={18} color="#4F46E5" />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{privacy} Privacy & Data Requests</Text>
                <Text style={styles.taskSub}>Process user data export and deletion compliance</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}

          {moderation > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: THEME.error }]}
              onPress={() => handleNavigate('/admin/moderation')}
              activeOpacity={0.75}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${moderation} Moderation Reports`}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="flag" size={18} color={THEME.error} />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{moderation} Moderation Items Flagged</Text>
                <Text style={styles.taskSub}>Review flagged community discussions and messages</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
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
  badge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
  },
  clearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  clearBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.success,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: THEME.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME.border,
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMain,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 11.5,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 16,
  },
  list: {
    gap: 8,
    marginTop: 4,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
    minHeight: 56,
  },
  taskIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTextCol: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMain,
  },
  taskSub: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 1,
  },
});
