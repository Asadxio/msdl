import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { UIButton, InlineError } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { createPrivacyRequest } from '@/lib/legal';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { goBackOrReplace } from '@/lib/navigation';

export default function DataPrivacyScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState<'deletion' | 'export' | null>(null);
  const [error, setError] = useState('');

  const submit = async (type: 'deletion' | 'export') => {
    if (!user?.uid || loading) return;
    const trimmed = reason.trim();
    if (trimmed.length < 8) {
      setError('Please provide at least 8 characters so support can process your request safely.');
      return;
    }
    setError('');
    setLoading(type);
    try {
      await createPrivacyRequest(user.uid, type, trimmed);
      Alert.alert('Request submitted', `Your ${type} request was recorded and queued for review.`);
      setReason('');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/settings')} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text allowFontScaling accessibilityRole="header" style={styles.title}>Data & Privacy Controls</Text>
        <Text allowFontScaling style={styles.body}>Request export or deletion. Deletion follows a reviewable, soft-delete-first lifecycle.</Text>
        <InlineError message={error} />
        <TextInput
          style={styles.input}
          multiline
          value={reason}
          onChangeText={setReason}
          placeholder="Reason / legal request details"
          placeholderTextColor={COLORS.textMuted}
          accessibilityLabel="Privacy request reason"
          maxLength={600}
        />
        <UIButton label="Request Data Export" onPress={() => submit('export')} loading={loading === 'export'} />
        <UIButton label="Request Account Deletion" onPress={() => submit('deletion')} loading={loading === 'deletion'} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 10, ...SHADOWS.card },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  backText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textMain, fontWeight: '800' },
  body: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  input: {
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
  },
});
