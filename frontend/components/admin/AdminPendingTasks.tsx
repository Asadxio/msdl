import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

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
          <Ionicons name="checkbox-outline" size={18} color={COLORS.primary} />
          <Text style={styles.title}>Pending Tasks</Text>
        </View>
        {totalPending > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalPending} Action Required</Text>
          </View>
        ) : null}
      </View>

      {totalPending === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={36} color="#10B981" />
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>There are no pending approvals, payments, or privacy requests requiring your review right now.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {approvals > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: '#F59E0B' }]}
              onPress={() => handleNavigate('/admin/users')}
              activeOpacity={0.7}
            >
              <View style={styles.taskIconBox}>
                <Ionicons name="person-add" size={20} color="#F59E0B" />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{approvals} Student Approvals Pending</Text>
                <Text style={styles.taskSub}>Review and verify registration applications</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {payments > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: '#10B981' }]}
              onPress={() => handleNavigate('/admin/payments')}
              activeOpacity={0.7}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="card" size={20} color="#10B981" />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{payments} Pending Payments</Text>
                <Text style={styles.taskSub}>Verify receipts and reconcile billing transactions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {privacy > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: '#6366F1' }]}
              onPress={() => handleNavigate('/admin/privacy-requests')}
              activeOpacity={0.7}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#6366F115' }]}>
                <Ionicons name="document-lock" size={20} color="#6366F1" />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{privacy} Privacy & GDPR Requests</Text>
                <Text style={styles.taskSub}>Process user data export and deletion inquiries</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {moderation > 0 && (
            <TouchableOpacity
              style={[styles.taskCard, { borderLeftColor: '#EF4444' }]}
              onPress={() => handleNavigate('/admin/moderation')}
              activeOpacity={0.7}
            >
              <View style={[styles.taskIconBox, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="flag" size={20} color="#EF4444" />
              </View>
              <View style={styles.taskTextCol}>
                <Text style={styles.taskTitle}>{moderation} Moderation Reports</Text>
                <Text style={styles.taskSub}>Review flagged community discussions and content</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
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
  badge: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  list: {
    gap: SPACING.sm,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: COLORS.border,
    minHeight: 64,
  },
  taskIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: '#F59E0B15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  taskTextCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  taskSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
