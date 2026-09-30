/**
 * MSLB Teacher Access Code Client Service
 * 
 * Allows users to claim their faculty profile using an access code or teacher ID
 * provided by the Madrasa administration.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { withTimeout } from '@/lib/errors';

export interface ClaimTeacherRequest {
  code: string;
}

export interface ClaimTeacherResponse {
  success: boolean;
  teacherName: string;
  teacherId: string;
  teacherDocId: string;
  assignedCoursesCount: number;
  assignedCourseNames: string[];
}

/**
 * Validates and claims a teacher profile using an institutional Access Code.
 * 
 * Server-side function binds:
 * 1. teachers/{docId}.user_uid = currentUser.uid
 * 2. users/{uid}.role = 'teacher'
 * 3. Links all assigned courses immediately
 */
export async function claimTeacherAccessCode(code: string): Promise<ClaimTeacherResponse> {
  const cleanCode = (code || '').trim();
  if (!cleanCode) {
    throw new Error('Please enter a valid Teacher Code.');
  }

  const fn = httpsCallable<ClaimTeacherRequest, ClaimTeacherResponse>(
    functions,
    'claimTeacherAccessCode'
  );

  const result = await withTimeout(
    fn({ code: cleanCode }),
    20000,
    'Teacher code verification timed out. Please check your internet connection.'
  );

  return result.data;
}
