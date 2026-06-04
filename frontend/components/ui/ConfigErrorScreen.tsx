import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type ConfigErrorScreenProps = {
  error: string;
  missingVars: string[];
};

export function ConfigErrorScreen({ error, missingVars }: ConfigErrorScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Configuration Error</Text>
        <Text style={styles.message}>{error}</Text>
        {missingVars.length > 0 ? (
          <View style={styles.list}>
            <Text style={styles.listLabel}>Missing environment variables:</Text>
            {missingVars.map((name) => (
              <Text key={name} style={styles.listItem}>{name}</Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.helpText}>
          Add the missing variables to your `frontend/.env` or to your Expo environment, then rebuild the app.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    gap: SPACING.sm,
    shadowColor: COLORS.text,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    lineHeight: 22,
  },
  list: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  listLabel: {
    ...TYPOGRAPHY.label,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  listItem: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
  },
  helpText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});
