import React from 'react';
import { Text } from 'react-native';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';

export default function CommunityGuidelinesScreen() {
  const doc = LEGAL_DOCS.community;
  return (
    <LegalDocScreen title={doc.title} subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}>
      <Text accessibilityRole="text" allowFontScaling>
        Students and teachers must avoid bullying, hate speech, sexual content, unsafe contact requests, and doxxing.
        Reporting and moderation actions are logged to support student safety and legal escalation workflows.
      </Text>
    </LegalDocScreen>
  );
}
