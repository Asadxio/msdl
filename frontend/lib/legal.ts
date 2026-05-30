import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type LegalDocKey = 'terms' | 'privacy' | 'community';
export type LegalDocDefinition = {
  key: LegalDocKey;
  title: string;
  version: string;
  effectiveAt: string;
  summary: string;
  required: boolean;
};

export const LEGAL_DOCS: Record<LegalDocKey, LegalDocDefinition> = {
  terms: {
    key: 'terms',
    title: 'Terms & Conditions',
    version: '2026.05.19',
    effectiveAt: '2026-05-19T00:00:00.000Z',
    summary: 'Defines acceptable use, eligibility, billing, and platform obligations.',
    required: true,
  },
  privacy: {
    key: 'privacy',
    title: 'Privacy Policy',
    version: '2026.05.19',
    effectiveAt: '2026-05-19T00:00:00.000Z',
    summary: 'Explains personal data use, sharing, retention, and user rights.',
    required: true,
  },
  community: {
    key: 'community',
    title: 'Community Guidelines',
    version: '2026.05.19',
    effectiveAt: '2026-05-19T00:00:00.000Z',
    summary: 'Safety standards, anti-harassment, and classroom behavior requirements.',
    required: true,
  },
};

export type ConsentStatus = {
  accepted: Record<LegalDocKey, { version: string; acceptedAt?: unknown }>;
  missingRequired: LegalDocDefinition[];
  outdatedRequired: LegalDocDefinition[];
  needsAcceptance: boolean;
};

export async function getConsentStatus(userId: string): Promise<ConsentStatus> {
  const snap = await getDoc(doc(db, 'users', userId, 'compliance', 'legal_acceptance'));
  const accepted = (snap.exists() ? (snap.data().accepted || {}) : {}) as Record<LegalDocKey, { version: string; acceptedAt?: unknown }>;
  const requiredDocs = Object.values(LEGAL_DOCS).filter((d) => d.required);
  const missingRequired = requiredDocs.filter((d) => !accepted[d.key]?.version);
  const outdatedRequired = requiredDocs.filter((d) => {
    const v = accepted[d.key]?.version;
    return Boolean(v && v !== d.version);
  });

  return {
    accepted,
    missingRequired,
    outdatedRequired,
    needsAcceptance: missingRequired.length > 0 || outdatedRequired.length > 0,
  };
}

export async function acceptLegalDocs(userId: string, keys: LegalDocKey[]): Promise<void> {
  const accepted = keys.reduce<Partial<Record<LegalDocKey, { version: string; acceptedAt: unknown }>>>((acc, key) => {
    acc[key] = { version: LEGAL_DOCS[key].version, acceptedAt: serverTimestamp() };
    return acc;
  }, {});

  await setDoc(doc(db, 'users', userId, 'compliance', 'legal_acceptance'), {
    accepted,
    acceptance_updated_at: serverTimestamp(),
    policy_bundle_version: `${LEGAL_DOCS.terms.version}|${LEGAL_DOCS.privacy.version}|${LEGAL_DOCS.community.version}`,
  }, { merge: true });

  await setDoc(doc(collection(db, 'legal_audit_events')), {
    user_id: userId,
    event: 'legal_acceptance',
    accepted_docs: keys,
    accepted_versions: keys.map((k) => `${k}:${LEGAL_DOCS[k].version}`),
    created_at: serverTimestamp(),
  });
}

export async function createPrivacyRequest(userId: string, type: 'deletion' | 'export', reason: string): Promise<void> {
  await setDoc(doc(collection(db, 'privacy_requests')), {
    user_id: userId,
    type,
    reason: reason.trim().slice(0, 600),
    state: 'requested',
    lifecycle: [{ state: 'requested', at: new Date().toISOString() }],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}
