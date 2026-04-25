import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>How your data is used and protected</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.heading}>Data We Store</Text>
          <Text style={styles.body}>We store profile details, course activity, attendance, and submissions to provide learning services.</Text>
          <Text style={styles.heading}>Permissions</Text>
          <Text style={styles.body}>Camera, gallery, and notifications are requested only when features require them. You can deny access at any time in settings.</Text>
          <Text style={styles.heading}>Safety</Text>
          <Text style={styles.body}>Role-based access is enforced for admin and teacher actions. Student data access is limited to authorized workflows.</Text>
          <Text style={styles.heading}>Contact</Text>
          <Text style={styles.body}>For data removal or privacy requests, contact the school administrator.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  content: { padding: SPACING.md, paddingBottom: 24 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.card, gap: 10 },
  heading: { fontSize: 14, fontWeight: '800', color: COLORS.textMain },
  body: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },
});
