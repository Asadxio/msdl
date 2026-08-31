import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';

export default function PrivacyScreen() {
  const doc = LEGAL_DOCS.privacy;

  return (
    <LegalDocScreen
      title={doc.title}
      subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}
      arabicTitle={doc.arabicTitle}
      iconName="lock-closed"
    >
      {/* ─── Commitment Notice ─── */}
      <View style={styles.highlightBanner}>
        <Ionicons name="shield-checkmark" size={20} color="#005F46" />
        <Text style={styles.highlightText}>
          Madrasatu-s-Salikat Lil Banat is committed to the highest standards of Islamic modesty (Purdah), student data protection, and transparent educational governance.
        </Text>
      </View>

      {/* 1. Account & Identity */}
      <Text style={styles.sectionHeading}>1. Account & Learner Profile Data</Text>
      <Text style={styles.bodyText}>
        We collect only necessary registration information such as student/teacher name, verified email address, role (Student, Teacher, Admin), enrollment status, and authentication credentials through Google Firebase Authentication. In accordance with Purdah guidelines, female student identities are strictly protected within secure Madrasa boundaries.
      </Text>

      {/* 2. Live Audio Classroom & Purdah Protection */}
      <Text style={styles.sectionHeading}>2. Live Audio Classrooms & Inbuilt Recordings</Text>
      <Text style={styles.bodyText}>
        Our live classrooms operate under strict Islamic privacy protocols. Microphone audio is transmitted during live recitation and class sessions. Teacher-recorded lectures are securely archived in encrypted Firebase Storage for educational replay and student revision. Unauthorized third-party audio recording, screen capturing, or external distribution is strictly prohibited.
      </Text>

      {/* 3. Islamic Utilities & Device Location */}
      <Text style={styles.sectionHeading}>3. Islamic Utilities, Qibla & Tasbeeh Tracker</Text>
      <Text style={styles.bodyText}>
        Spiritual utilities—including the Digital Smart Tasbeeh, Daily Azkar Tracker, and Islamic Hijri Calendar—store progress locally on your device. GPS location is accessed temporarily on-device solely to compute precise prayer times and Qibla compass azimuth direction; your location coordinates are never tracked, logged, or transmitted to third parties.
      </Text>

      {/* 4. Official Receipts, Sanads & Financial Security */}
      <Text style={styles.sectionHeading}>4. Fee Payments, Sanads & Credentials</Text>
      <Text style={styles.bodyText}>
        Tuition fees, registrations, and voluntary Sadqah/Zakat donations are processed via secure encrypted payment gateways (Razorpay). We do not store credit card numbers or banking secrets. Unique verification serial IDs on fee receipts and academic Sanads/Certificates are maintained for official authentication.
      </Text>

      {/* 5. Communication & Moderation */}
      <Text style={styles.sectionHeading}>5. Classroom Communication & Adab Safety</Text>
      <Text style={styles.bodyText}>
        Student-teacher messages, homework submissions, and Dars notes are monitored by authorized Islamic moderators to ensure a safe, adab-compliant, and harassment-free learning atmosphere for female students.
      </Text>

      {/* 6. Data Rights & Permanent Deletion */}
      <Text style={styles.sectionHeading}>6. Student Rights & Account Deletion</Text>
      <Text style={styles.bodyText}>
        Enrolled students and guardians have the full right to export their academic records or request permanent account and data deletion at any time via Settings → Data & Privacy. Deletion requests are processed promptly in compliance with Islamic ethics and data protection laws.
      </Text>

      {/* 7. Contact Academic Administration */}
      <Text style={styles.sectionHeading}>7. Governance & Contact</Text>
      <Text style={styles.bodyText}>
        For privacy queries, data access requests, or official support, please contact the Madrasatu-s-Salikat Lil Banat administration via the in-app support center or official madrasa portal.
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
