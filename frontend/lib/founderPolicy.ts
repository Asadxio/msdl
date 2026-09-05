// Permanent founder emails for the MSDL platform.
// This helper ONLY exempts founders from the Pending Approval and Email Verification screens.
// It NEVER overwrites Firestore roles. Firestore remains the single source of truth.

export const OWNER_EMAIL = 'sumraftm@gmail.com';

export const FOUNDER_EMAILS = [
  'sumraftm@gmail.com',
  'xioasad@gmail.com',
];

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL;
}

export function isFounderEmail(email?: string | null): boolean {
  if (!email) return false;
  return FOUNDER_EMAILS.includes(email.trim().toLowerCase());
}
