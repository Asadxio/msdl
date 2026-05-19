import React from 'react';
import { Text } from 'react-native';
import { LegalDocScreen } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal';

export default function TermsScreen() {
  const doc = LEGAL_DOCS.terms;
  return (
    <LegalDocScreen title={doc.title} subtitle={`Version ${doc.version} • Effective ${doc.effectiveAt.slice(0, 10)}`}>
      <Text accessibilityRole="text" allowFontScaling>
        Use of this platform requires lawful behavior, respectful classroom conduct, and accurate billing participation.
        Harassment, fraud, cheating, or misuse can result in moderated restrictions or suspension with audit traceability.
      </Text>
    </LegalDocScreen>
  );
}
