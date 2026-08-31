import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

export default function CommunityGuidelinesScreen() {
  const doc = LEGAL_DOCS.community;

  return (
    <LegalDocScreen
      title={doc.title}
      subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}
      arabicTitle={doc.arabicTitle}
      iconName="people"
    >
      {/* ─── Adab Banner ─── */}
      <View style={styles.highlightBanner}>
        <Ionicons name="heart-circle" size={22} color="#005F46" />
        <Text style={styles.highlightText}>
          "The most complete of believers in faith are those with the best character." (Tirmidhi) — Let us maintain supreme Adab, humility, and kindness in all interactions.
        </Text>
      </View>

      {/* 1. Islamic Adab & Classroom Etiquette */}
      <Text style={styles.sectionHeading}>1. Islamic Adab & Sacred Etiquette</Text>
      <Text style={styles.bodyText}>
        Learners, teachers, and guardians must communicate with kindness, modesty, and honor. Disrespect towards Islamic scholars, Ustaadhas, fellow sisters, or sacred texts is strictly prohibited.
      </Text>

      {/* 2. Zero-Tolerance for Harassment & Bullying */}
      <Text style={styles.sectionHeading}>2. Anti-Harassment & Safe Haven for Sisters</Text>
      <Text style={styles.bodyText}>
        We enforce a strict zero-tolerance policy against cyberbullying, offensive speech, trolling, mocking recitations, unwanted private contact, or intimidation. Madrasatu-s-Salikat Lil Banat is a sanctuary of sacred knowledge for female learners.
      </Text>

      {/* 3. Live Purdah Respect & Non-Intrusion */}
      <Text style={styles.sectionHeading}>3. Live Class Purdah & Non-Intrusion</Text>
      <Text style={styles.bodyText}>
        During live interactive sessions, male voices or outside interruptions must be strictly avoided near the student's listening area. Recording, re-broadcasting, or capturing audio of female teachers or students is a severe violation of Islamic trust (Amanah) and will result in immediate expulsion.
      </Text>

      {/* 4. Chat & Discussion Board Adab */}
      <Text style={styles.sectionHeading}>4. Chat & Messaging Conduct</Text>
      <Text style={styles.bodyText}>
        Classroom discussion channels are reserved strictly for Dars questions, Tajweed corrections, and madrasa announcements. Spamming, advertising external services, sharing unverified religious rulings, or political arguments are forbidden.
      </Text>

      {/* 5. Homework, Audio Submissions & Media */}
      <Text style={styles.sectionHeading}>5. Media Submissions & Homework Safety</Text>
      <Text style={styles.bodyText}>
        Upload only requested homework sheets, Quranic recitation recordings, and academic queries. Never share private home photos, unauthorized personal contact details, or irrelevant media files.
      </Text>

      {/* 6. Active Reporting & Islamic Mediation */}
      <Text style={styles.sectionHeading}>6. Incident Reporting & Mediation</Text>
      <Text style={styles.bodyText}>
        If you experience or witness any violation of these guidelines, notify your teacher or administrator immediately via the in-app reporting button. All reports are handled confidentially with wisdom, fairness, and Islamic justice.
      </Text>
    </LegalDocScreen>
  );
}

const styles = StyleSheet.create({
  highlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#C6E8D4',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
  },
  highlightText: {
    flex: 1,
    fontSize: 12,
    color: '#005F46',
    fontWeight: '700',
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  bodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
});
