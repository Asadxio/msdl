import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="ribbon" size={28} color="#C8A84E" />
        </View>

        <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
        <Text style={styles.madrasaTitle}>Madrasatu-s-Salikat Lil Banat</Text>
        <Text style={styles.title}>Updated Institutional Policies</Text>
        <Text style={styles.subtitle}>
          Please review and accept our updated Islamic Academic Guidelines, Purdah Code of Conduct, and Data Privacy Policies to continue into the learning portal.
        </Text>

        <View style={styles.docList}>
          {docs.map((d) => (
            <TouchableOpacity
              key={d.key}
              style={styles.docItem}
              onPress={() => {
                if (d.key === 'terms') router.push('/terms');
                else if (d.key === 'privacy') router.push('/privacy');
                else router.push('/community-guidelines');
              }}
            >
              <View style={styles.docItemLeft}>
                <Ionicons
                  name={d.key === 'terms' ? 'document-text' : d.key === 'privacy' ? 'lock-closed' : 'people'}
                  size={18}
                  color="#005F46"
                />
                <View>
                  <Text style={styles.docTitle}>{d.title}</Text>
                  <Text style={styles.docVersion}>Version {d.version} • {d.arabicTitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        <UIButton
          label={busy ? 'Recording Consent…' : 'Accept & Enter Madrasa'}
          onPress={accept}
          loading={busy}
          accessibilityLabel="Accept legal documents and continue"
        />
        {busy ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#002E23',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.card,
    borderWidth: 2,
    borderColor: '#C8A84E',
    alignItems: 'center',
    gap: 8,
  },
  headerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#003D2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bismillah: {
    fontSize: 14,
    color: '#005F46',
    fontWeight: '700',
  },
  madrasaTitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: 6,
  },
  docList: {
    width: '100%',
    gap: 8,
    marginVertical: 12,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  docItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  docVersion: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});
