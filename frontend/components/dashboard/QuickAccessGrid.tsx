import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

import { ALL_QUICK_ACCESS_SERVICES, type QuickAccessService } from '@/lib/quickAccessData';
export { ALL_QUICK_ACCESS_SERVICES };
export type { QuickAccessService };

export function QuickAccessGrid() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconTag}>
            <Ionicons name="apps" size={14} color="#075B49" />
          </View>
          <Text style={styles.sectionTitle}>Quick Access</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/more')}
          style={styles.viewAllBtn}
          accessibilityRole="button"
          accessibilityLabel="View All Services Directory"
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View All Services</Text>
          <Ionicons name="arrow-forward" size={12} color="#075B49" />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {ALL_QUICK_ACCESS_SERVICES.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}: ${item.subtitle}`}
            activeOpacity={0.75}
          >
            <View style={styles.iconBox}>
              <Ionicons name={item.icon as any} size={20} color="#075B49" />
            </View>

            <View style={styles.textCol}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={14} color="#C6A15B" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconTag: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(7, 91, 73, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17332C',
    letterSpacing: -0.3,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#075B49',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '48.7%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E7E4DA',
    ...SHADOWS.card,
    minHeight: 60,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FCFBF7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFECE2',
  },
  textCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#17332C',
  },
  cardSubtitle: {
    fontSize: 10,
    color: '#71817B',
    marginTop: 1,
  },
});
