// MSLB Certificate Firebase helper
// Stage E activation: import generateCertificate from here instead of FastAPI fetch
// DO NOT import this from certificate.tsx until Stage E is confirmed

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export const generateCertificateCallable = httpsCallable<
  { courseId: string },
  { certificateId: string; storageUrl: string; issuedAt: string; alreadyExisted: boolean }
>(functions, 'generateCertificate');

export async function getCertificate(courseId: string) {
  const result = await generateCertificateCallable({ courseId });
  return result.data;
}
