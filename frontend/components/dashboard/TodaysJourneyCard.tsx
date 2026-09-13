import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

interface ChecklistItem {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
  route: string;
}

interface TodaysJourneyCardProps {
  items: ChecklistItem[];
  loading?: boolean;
}

export function TodaysJourneyCard({ items, loading }: TodaysJourneyCardProps) {
  const router = useRouter();

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length || 4;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <View style={styles.badgeRow}>
            <Ionicons name="flag-outline" size={14} color="#C6A15B" />
            <Text style={styles.eyebrow}>DAILY GOALS</Text>
          </View>
          <Text style={styles.title}>Today&apos;s Journey</Text>
        </View>

        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>
            {loading ? '...' : `${completedCount} / ${totalCount} Done`}
          </Text>
          <View style={styles.miniRing}>
            <Text style={styles.miniRingText}>{loading ? '•' : `${percentage}%`}</Text>
          </View>
        </View>
      </View>

      {/* Progress Line */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${loading ? 25 : percentage}%` }]} />
      </View>

      {/* Tasks List */}
      <View style={styles.tasksContainer}>
        {loading ? (
          /* Skeleton rows while data hydrates */
          [0, 1, 2].map((i) => (
            <View key={i} style={[styles.taskRow, i < 2 && styles.taskRowBorder]}>
              <View style={styles.skeletonCircle} />
              <View style={styles.taskTextCol}>
                <View style={[styles.skeletonLine, { width: i === 0 ? '65%' : i === 1 ? '50%' : '70%' }]} />
                <View style={[styles.skeletonLine, { width: '40%', marginTop: 6, height: 9 }]} />
              </View>
            </View>
          ))
        ) : (
          items.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.taskRow,
                idx < items.length - 1 && styles.taskRowBorder,
              ]}
              onPress={() => router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}: ${item.completed ? 'Completed' : 'Pending'}`}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkCircle,
                  item.completed && styles.checkCircleDone,
                ]}
              >
                <Ionicons
                  name={item.completed ? 'checkmark' : 'ellipse-outline'}
                  size={item.completed ? 14 : 18}
                  color={item.completed ? '#FFFFFF' : '#71817B'}
                />
              </View>

              <View style={styles.taskTextCol}>
                <Text
                  style={[
                    styles.taskTitle,
                    item.completed && styles.taskTitleDone,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.taskSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#71817B" />
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E7E4DA',
    ...SHADOWS.premiumCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C6A15B',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#17332C',
    letterSpacing: -0.3,
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCF9F0',
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFECE2',
  },
  progressPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17332C',
  },
  miniRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#075B49',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniRingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E7E4DA',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#075B49',
    borderRadius: 3,
  },
  tasksContainer: {
    backgroundColor: '#FCFBF7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECE2',
    overflow: 'hidden',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
  },
  taskRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFECE2',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D8C28A',
  },
  checkCircleDone: {
    backgroundColor: '#075B49',
    borderColor: '#075B49',
  },
  taskTextCol: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17332C',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#71817B',
  },
  taskSubtitle: {
    fontSize: 11,
    color: '#71817B',
    marginTop: 1,
  },
  skeletonCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFECE2',
  },
  skeletonLine: {
    height: 11,
    borderRadius: 6,
    backgroundColor: '#EFECE2',
  },
});
