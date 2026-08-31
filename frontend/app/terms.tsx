import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

export default function TermsScreen() {
  const doc = LEGAL_DOCS.terms;

  return (
    <LegalDocScreen
      title={doc.title}
      subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}
      arabicTitle={doc.arabicTitle}
      iconName="document-text"
    >
      {/* ─── Mission Banner ─── */}
      <View style={styles.highlightBanner}>
        <Ionicons name="book" size={20} color="#005F46" />
        <Text style={styles.highlightText}>
          By enrolling in Madrasatu-s-Salikat Lil Banat, students, parents, and teachers pledge to uphold Islamic values, academic integrity, and mutual respect.
        </Text>
      </View>

      {/* 1. Platform Purpose */}
      <Text style={styles.sectionHeading}>1. Educational Purpose & Islamic Framework</Text>
      <Text style={styles.bodyText}>
        Madrasatu-s-Salikat Lil Banat provides authentic Islamic education, Quran recitation with Tajweed, Islamic jurisprudence (Fiqh), Seerah, and Hadith studies. All curriculum materials, live audio lectures, and interactive resources are curated according to the Quran and authentic Sunnah.
      </Text>

      {/* 2. Account Eligibility & Responsibilities */}
      <Text style={styles.sectionHeading}>2. Enrollment, Verification & Account Safety</Text>
      <Text style={styles.bodyText}>
        Learners must register with verified credentials. Parents or guardians must supervise minor learners. Accounts are personal and non-transferable. You are responsible for safeguarding your login credentials and must immediately report unauthorized access.
      </Text>

      {/* 3. Live Purdah Classrooms & Audio Etiquette */}
      <Text style={styles.sectionHeading}>3. Live Purdah Classrooms & Audio Code</Text>
      <Text style={styles.bodyText}>
        Our live classrooms prioritize student modesty and focused learning. Students must enter on time, observe Islamic adab, unmute only when invited by the Ustaadha for recitation (Dars/Sabaq), and maintain a quiet, dignified learning environment. Recording, screenshotting, or sharing class audio outside the platform without permission is strictly prohibited.
      </Text>

      {/* 4. Academic Integrity & Sanad Issuance */}
      <Text style={styles.sectionHeading}>4. Assessments, Quizzes & Official Sanads</Text>
      <Text style={styles.bodyText}>
        All quizzes and assessments must be taken honestly without cheating or unfair assistance. Official Sanads (Certificates of Academic Excellence) are awarded based on verified scores (minimum 60% passing mark) and attendance compliance.
      </Text>

      {/* 5. Tuition Fees, Donations & Receipts */}
      <Text style={styles.sectionHeading}>5. Tuition Fees, Receipts & Donations</Text>
      <Text style={styles.bodyText}>
        Course tuition fees and voluntary contributions must be made through authorized payment channels. Official electronic fee vouchers with institutional verification numbers are issued upon reconciliation. Fee dispute or refund requests must be routed through the Academic Accounts Directorate.
      </Text>

      {/* 6. Intellectual Property & Dars Materials */}
      <Text style={styles.sectionHeading}>6. Intellectual Property & Course Materials</Text>
      <Text style={styles.bodyText}>
        All Islamic study guides, audio lectures, Tajweed rulebooks, and Dars notes provided in the Library are the property of Madrasatu-s-Salikat Lil Banat. Materials are licensed strictly for personal educational use and may not be sold or redistributed.
      </Text>

      {/* 7. Suspension & Termination */}
      <Text style={styles.sectionHeading}>7. Policy Enforcement & Account Termination</Text>
      <Text style={styles.bodyText}>
        The Madrasa reserves the right to restrict, suspend, or terminate access for individuals who violate Islamic adab, harass teachers/students, attempt fraud, or disrupt classrooms.
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
