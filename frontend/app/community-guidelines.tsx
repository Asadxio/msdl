import React from 'react';
import { Text } from 'react-native';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';

export default function CommunityGuidelinesScreen() {
  const doc = LEGAL_DOCS.community;
  return (
    <LegalDocScreen title={doc.title} subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}>
      <Text accessibilityRole="header" allowFontScaling>
        Respectful Islamic Learning Environment
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        This platform is for respectful madrasa education. Students, teachers, and administrators must communicate with
        adab, protect modesty, and support a safe learning environment for girls and families.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Harassment, Abuse, and Unsafe Contact
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Bullying, threats, hate speech, sexual content, grooming, unsafe private contact requests, doxxing, intimidation,
        or pressure to share personal information are not allowed in chats, live classes, comments, assignments, uploads,
        or status posts.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Chat and Status Misuse
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Do not spam, flood messages, spread rumors, share misleading claims, impersonate others, coordinate cheating, or
        use chat/status features for advertising, fundraising, political campaigning, or unrelated promotion without admin
        permission.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Media Upload and Assignment Safety
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Upload only appropriate learning materials. Do not upload violent, hateful, explicit, copyrighted, malicious, or
        privacy-invasive files. Avoid sharing faces, addresses, phone numbers, financial details, or other sensitive data
        unless a teacher or administrator specifically requests it for a valid learning or support purpose.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Live Class Expectations
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Join live classes on time, use your real account, keep audio/video behavior respectful, follow teacher directions,
        and do not record, screenshot, redistribute, or invite outsiders unless the madrasa has clearly allowed it.
      </Text>

      <Text accessibilityRole="header" allowFontScaling>
        Reporting and Moderation
      </Text>
      <Text accessibilityRole="text" allowFontScaling>
        Report unsafe behavior to a teacher or administrator. Authorized admins may review reports, content, chat evidence,
        status posts, and account activity to warn users, remove content, suspend accounts, or escalate serious safety or
        legal issues.
      </Text>
    </LegalDocScreen>
  );
}
