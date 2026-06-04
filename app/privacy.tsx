import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { LEGAL_DOCS } from '@/lib/legal';
import { goBackOrReplace } from '@/lib/navigation';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const policy = LEGAL_DOCS.privacy;
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/more')} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Version {policy.version} • Effective {policy.effectiveAt.slice(0, 10)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.heading}>Information We Collect</Text>
          <Text style={styles.body}>
            We collect account and authentication data such as name, email address, role, verification status, approval
            status, profile photo/avatar, referral details, login metadata, and Firebase user identifiers needed to create
            and protect student, teacher, and admin accounts.
          </Text>

          <Text style={styles.heading}>Learning, Class, and Attendance Data</Text>
          <Text style={styles.body}>
            We store course enrollment, progress, assignments, submissions, teacher feedback, attendance, live-class
            session details, participant status, reconnect information, class duration, and recording metadata when those
            features are used.
          </Text>

          <Text style={styles.heading}>Chat, Status, and Media Uploads</Text>
          <Text style={styles.body}>
            We process messages, read receipts, status posts, comments, reactions, uploaded images, videos, documents,
            file names, file sizes, and moderation evidence so that classroom communication, assignments, media sharing,
            abuse prevention, and safety review can work.
          </Text>

          <Text style={styles.heading}>Payments and Donations</Text>
          <Text style={styles.body}>
            We store payment or donation purpose, amount, reference details, user identity, review state, admin notes,
            reconciliation status, audit events, and entitlement/enrollment updates. Do not submit card numbers or banking
            secrets inside free-text fields.
          </Text>

          <Text style={styles.heading}>Notifications and Device Data</Text>
          <Text style={styles.body}>
            If you enable notifications, we may store Expo/Firebase push tokens and delivery metadata to send class,
            payment, chat, status, admin, and reminder notifications. Device permissions such as camera, microphone,
            gallery, documents, and notifications are requested only when a feature needs them.
          </Text>

          <Text style={styles.heading}>Analytics, Security, and Logs</Text>
          <Text style={styles.body}>
            We may use operational logs, error reports, security events, moderation events, duplicate-upload checks, and
            audit trails to maintain reliability, detect misuse, prevent fraud, support users, and protect students.
          </Text>

          <Text style={styles.heading}>How We Use and Share Data</Text>
          <Text style={styles.body}>
            Data is used to provide education services, approve accounts, run live classes, manage payments and donations,
            support users, send notifications, enforce safety rules, and meet legal or accounting duties. Access is limited
            by role-based controls for students, teachers, and administrators. We use service providers such as Firebase,
            Railway/backend hosting, Agora live-class services, push-notification services, file storage, and payment or
            reconciliation providers where needed to operate the app.
          </Text>

          <Text style={styles.heading}>Retention and User Rights</Text>
          <Text style={styles.body}>
            We keep data while your account is active or while needed for education, safety, legal, audit, dispute,
            accounting, or compliance purposes. You can request export or deletion through Settings → Data & Privacy.
            Some records may be retained or anonymized when required for legal, safety, fraud-prevention, or financial
            recordkeeping reasons.
          </Text>

          <Text style={styles.heading}>Contact</Text>
          <Text style={styles.body}>
            For privacy, export, deletion, payment, or safety requests, use Settings → Data & Privacy or contact the
            madrasa administration through the official support channel provided to enrolled users.
          </Text>
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
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginBottom: SPACING.xs },
  backText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 12, color: COLORS.textMuted },
  content: { padding: SPACING.md, paddingBottom: 24 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.card, gap: 10 },
  heading: { fontSize: 14, fontWeight: '800', color: COLORS.textMain },
  body: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },
});
