import React from 'react';
import { Text } from 'react-native';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';

export default function TermsScreen() {
  const doc = LEGAL_DOCS.terms;
  return (
    <LegalDocScreen title={doc.title} subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}>
      <Text accessibilityRole="header" allowFontScaling>
        Platform Purpose
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Madarsa Tus Salikat Lil Banat provides Islamic education services, course materials, live classes, assignments,
        chat, status updates, payment confirmation, donation support, and administrative tools for approved students,
        teachers, and administrators.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Account Responsibilities
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        You must provide accurate registration, profile, and payment information, keep your login private, and use only
        your own account. Parents or guardians should supervise learners who need adult support. Accounts may require
        email verification and admin approval before full access is available.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Acceptable Use and Classroom Conduct
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        You agree to behave respectfully in courses, live classes, chats, comments, media uploads, and status posts. Do
        not harass others, impersonate someone, share illegal or unsafe content, disrupt classes, spam, cheat, misuse
        uploads, or attempt to access admin, teacher, payment, or student data without permission.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Content Rules and Moderation
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Course work, messages, images, videos, documents, and status posts may be reviewed by authorized teachers or
        administrators for safety, abuse prevention, classroom management, support, or legal compliance. We may remove
        content, restrict features, suspend accounts, or escalate serious issues when platform rules are violated.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Payments and Donations
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Fees and donations must be submitted truthfully with valid reference details. Payment or donation records may be
        held for manual admin verification before enrollment, access, receipts, or other benefits are updated. Fraudulent,
        duplicate, disputed, or unverifiable payments may be rejected, delayed, refunded, or escalated according to the
        madrasa payment process.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Suspension and Termination
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        We may limit, suspend, or deactivate access for safety concerns, non-payment, fraud, abuse, repeated classroom
        disruption, policy violations, or legal requirements. Users may request data export or account deletion through
        Settings → Data & Privacy, subject to retention needed for legal, safety, accounting, or dispute records.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Service Availability and Liability
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        We work to keep the platform reliable, but internet, device, Firebase, Railway, Agora, notification, storage, or
        payment-provider issues may interrupt service. To the extent allowed by law, the platform is provided without a
        guarantee of uninterrupted access, and liability is limited to the amount permitted by applicable law.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Contact and Support
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        For account, privacy, payment, deletion, or safety requests, use Settings → Data & Privacy or contact the madrasa
        administration through the official support channel provided to enrolled users.
      </Text>
    </LegalDocScreen>
  );
}
