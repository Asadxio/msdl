import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { ScalePressable } from '@/components/ui';

export default function UnauthorizedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ required?: string }>();
  const requiredRole = String(params?.required || 'authorized').toLowerCase();
  const roleLabel = requiredRole === 'admin' ? 'Admin' : (requiredRole === 'teacher' ? 'Teacher' : 'Authorized');

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="lock-closed-outline" size={34} color={COLORS.error} />
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.subtitle}>
          This page requires {roleLabel} permission.
        </Text>
        <ScalePressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Go to Home</Text>
        </ScalePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 10,
    ...SHADOWS.card,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
