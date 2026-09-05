import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type LegalDocKey = 'terms' | 'privacy' | 'community';
export type LegalDocDefinition = {
  key: LegalDocKey;
  title: string;
  arabicTitle: string;
  version: string;
  effectiveAt: string;
  summary: string;
  required: boolean;
};

export const LEGAL_DOCS: Record<LegalDocKey, LegalDocDefinition> = {
  terms: {
    key: 'terms',
    title: 'Terms & Conditions',
    arabicTitle: 'الشُّرُوطُ وَالأَحْكَام',
    version: '2026.09.01',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    summary: 'Defines acceptable use, Islamic classroom adab, live Purdah classes, fees, and institutional regulations.',
    required: true,
  },
  privacy: {
    key: 'privacy',
    title: 'Privacy Policy',
    arabicTitle: 'سِيَاسَةُ الخُصُوصِيَّة',
    version: '2026.09.01',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    summary: 'Explains protection of student/teacher personal data, audio recordings, fee records, and privacy safeguards.',
    required: true,
  },
  community: {
    key: 'community',
    title: 'Community Guidelines',
    arabicTitle: 'إِرْشَادَاتُ المُجْتَمَعِ الإِسْلَامِيّ',
    version: '2026.09.01',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    summary: 'Islamic safety standards, Purdah sanctity, anti-harassment, respectful speech, and moderation rules.',
    required: true,
  },
};

export type ConsentStatus = {
  accepted: Record<LegalDocKey, { version: string; acceptedAt?: unknown }>;
  missingRequired: LegalDocDefinition[];
  outdatedRequired: LegalDocDefinition[];
  needsAcceptance: boolean;
};

const consentCache = new Map<string, ConsentStatus>();

export function invalidateConsentCache(userId?: string) {
  if (userId) consentCache.delete(userId);
  else consentCache.clear();
}

export async function getConsentStatus(userId: string): Promise<ConsentStatus> {
  const cached = consentCache.get(userId);
  if (cached && !cached.needsAcceptance) {
    return cached;
  }

  const snap = await getDoc(doc(db, 'users', userId, 'compliance', 'legal_acceptance'));
  const accepted = (snap.exists() ? (snap.data().accepted || {}) : {}) as Record<LegalDocKey, { version: string; acceptedAt?: unknown }>;
  const requiredDocs = Object.values(LEGAL_DOCS).filter((d) => d.required);
  const missingRequired = requiredDocs.filter((d) => !accepted[d.key]?.version);
  const outdatedRequired = requiredDocs.filter((d) => {
    const v = accepted[d.key]?.version;
    return Boolean(v && v !== d.version);
  });

  const result: ConsentStatus = {
    accepted,
    missingRequired,
    outdatedRequired,
    needsAcceptance: missingRequired.length > 0 || outdatedRequired.length > 0,
  };
  consentCache.set(userId, result);
  return result;
}

export async function acceptLegalDocs(userId: string, keys: LegalDocKey[]): Promise<void> {
  invalidateConsentCache(userId);
  const accepted = keys.reduce<Partial<Record<LegalDocKey, { version: string; acceptedAt: unknown }>>>((acc, key) => {
    acc[key] = { version: LEGAL_DOCS[key].version, acceptedAt: serverTimestamp() };
    return acc;
  }, {});

  await setDoc(doc(db, 'users', userId, 'compliance', 'legal_acceptance'), {
    accepted,
    acceptance_updated_at: serverTimestamp(),
    policy_bundle_version: `${LEGAL_DOCS.terms.version}|${LEGAL_DOCS.privacy.version}|${LEGAL_DOCS.community.version}`,
  }, { merge: true });

  try {
    await setDoc(doc(collection(db, 'legal_audit_events')), {
      user_id: userId,
      event: 'legal_acceptance',
      accepted_docs: keys,
      accepted_versions: keys.map((k) => `${k}:${LEGAL_DOCS[k].version}`),
      created_at: serverTimestamp(),
    });
  } catch (auditErr) {
    console.warn('[legal] Non-fatal: legal_audit_events write skipped or failed:', auditErr);
  }
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
