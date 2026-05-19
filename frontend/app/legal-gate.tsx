import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { UIButton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { acceptLegalDocs, LEGAL_DOCS } from '@/lib/legal';

export default function LegalGateScreen() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const docs = useMemo(() => Object.values(LEGAL_DOCS), []);

  const accept = async () => {
    if (!user?.uid || busy) return;
    setBusy(true);
    try {
      await acceptLegalDocs(user.uid, docs.map((d) => d.key));
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text allowFontScaling accessibilityRole="header" style={styles.title}>Action Required</Text>
        <Text allowFontScaling style={styles.subtitle}>Please review and accept the latest policies to continue.</Text>
        {docs.map((d) => <Text key={d.key} style={styles.item}>• {d.title} (v{d.version})</Text>)}
        <View style={styles.links}>
          <UIButton label="Terms" variant="ghost" onPress={() => router.push('/terms')} />
          <UIButton label="Privacy" variant="ghost" onPress={() => router.push('/privacy')} />
          <UIButton label="Guidelines" variant="ghost" onPress={() => router.push('/community-guidelines')} />
        </View>
        <UIButton
          label={busy ? 'Saving acceptance…' : 'Accept and Continue'}
          onPress={accept}
          loading={busy}
          accessibilityLabel="Accept legal documents and continue"
        />
        {busy ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: SPACING.lg },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.card, gap: 12 },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textMain, fontWeight: '800' },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  item: { ...TYPOGRAPHY.body, color: COLORS.textMain },
  links: { gap: SPACING.xs },
});
