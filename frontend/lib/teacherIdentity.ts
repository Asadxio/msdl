import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/context/AuthContext';
import { withTimeout } from '@/lib/errors';
import { createAdminLog } from '@/lib/adminLogs';

export const TEACHER_ID_PREFIX = 'TCH-';

export interface TeacherProfile {
  id: string; // Document ID: Canonical Firebase Auth UID
  user_uid: string; // Primary identity link: Firebase Auth UID
  teacher_id: string; // Institutional ID, e.g. 'TCH-0001'
  name: string;
  title: string;
  photo_url?: string;
  bio?: string;
  qualifications?: string[] | string;
  islamic_qualification?: string;
  specializations?: string[] | string;
  experience_years?: string | number;
  languages?: string[] | string;
  verification_status: 'approved' | 'pending' | 'verified';
  organization_id: string;
  assigned_courses: string[];
  courses?: string[];
  email?: string;
  phone?: string;
  status?: string;
  created_at?: any;
  updated_at?: any;
}

export type TeacherSelfUpdatePayload = Pick<
  TeacherProfile,
  | 'name'
  | 'title'
  | 'photo_url'
  | 'bio'
  | 'qualifications'
  | 'islamic_qualification'
  | 'specializations'
  | 'experience_years'
  | 'languages'
>;

export const TEACHER_SELF_EDITABLE_FIELDS: (keyof TeacherSelfUpdatePayload)[] = [
  'name',
  'title',
  'photo_url',
  'bio',
  'qualifications',
  'islamic_qualification',
  'specializations',
  'experience_years',
  'languages',
];

export const TEACHER_IMMUTABLE_FOR_SELF = [
  'id',
  'user_uid',
  'teacher_id',
  'role',
  'status',
  'verification_status',
  'organization_id',
  'assigned_courses',
  'courses',
  'created_at',
] as const;

/**
 * Validates that an institutional Teacher ID matches the canonical format 'TCH-XXXX'.
 */
export function isValidTeacherId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  return /^TCH-\d{4,}$/.test(id.trim());
}

/**
 * Generates the next sequential Teacher ID (e.g. TCH-0001, TCH-0002).
 * Scans existing IDs, finds the maximum numeric sequence, and increments safely.
 */
export function getNextTeacherId(existingTeacherIds?: (string | undefined | null)[]): string {
  let maxSeq = 0;
  (existingTeacherIds || []).forEach((id) => {
    if (!id || typeof id !== 'string') return;
    const match = id.trim().match(/^TCH-(\d+)$/i);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  const nextSeq = maxSeq + 1;
  return `${TEACHER_ID_PREFIX}${String(nextSeq).padStart(4, '0')}`;
}

function parseStringOrArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === 'string') {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Deterministically reconciles teacher data with user identity.
 * Ensures doc ID is user UID and institutional teacher_id is assigned if missing.
 */
export function buildCanonicalTeacherProfile(params: {
  userUid?: string;
  user_uid?: string;
  name: string;
  email?: string;
  phone?: string;
  existingProfile?: Partial<TeacherProfile> | null;
  assignedTeacherId?: string;
  teacher_id?: string;
  organizationId?: string;
  organization_id?: string;
  qualifications?: string[] | string;
  islamic_qualification?: string;
  specializations?: string[] | string;
  experience_years?: string | number;
  languages?: string[] | string;
  verification_status?: 'approved' | 'pending' | 'verified';
  status?: string;
  assigned_courses?: string[];
  courses?: string[];
  title?: string;
  photo_url?: string;
  bio?: string;
}): TeacherProfile {
  const userUid = params.user_uid || params.userUid || params.existingProfile?.user_uid || params.existingProfile?.id || '';
  const teacherId = params.teacher_id || params.assignedTeacherId || params.existingProfile?.teacher_id || `${TEACHER_ID_PREFIX}0001`;

  const qualifications = params.qualifications !== undefined
    ? parseStringOrArray(params.qualifications)
    : parseStringOrArray(params.existingProfile?.qualifications);

  const specializations = params.specializations !== undefined
    ? parseStringOrArray(params.specializations)
    : parseStringOrArray(params.existingProfile?.specializations);

  const languages = params.languages !== undefined
    ? parseStringOrArray(params.languages)
    : (params.existingProfile?.languages ? parseStringOrArray(params.existingProfile.languages) : ['Urdu', 'English']);

  const assignedCourses = Array.isArray(params.assigned_courses)
    ? params.assigned_courses
    : (Array.isArray(params.courses)
      ? params.courses
      : (Array.isArray(params.existingProfile?.assigned_courses)
        ? params.existingProfile.assigned_courses
        : (Array.isArray(params.existingProfile?.courses) ? params.existingProfile.courses : [])));

  return {
    id: userUid,
    user_uid: userUid,
    teacher_id: teacherId,
    name: (params.name || params.existingProfile?.name || 'Faculty Member').trim(),
    title: (params.title || params.existingProfile?.title || 'Faculty • Madrasatu-s-Salikat').trim(),
    photo_url: params.photo_url || params.existingProfile?.photo_url || '',
    bio: params.bio || params.existingProfile?.bio || '',
    qualifications,
    islamic_qualification: params.islamic_qualification || params.existingProfile?.islamic_qualification || '',
    specializations,
    experience_years: params.experience_years != null ? params.experience_years : (params.existingProfile?.experience_years != null ? params.existingProfile.experience_years : ''),
    languages,
    verification_status: params.verification_status || params.existingProfile?.verification_status || 'pending',
    organization_id: params.organization_id || params.organizationId || params.existingProfile?.organization_id || 'mslb-main',
    assigned_courses: assignedCourses,
    courses: assignedCourses,
    email: params.email || params.existingProfile?.email || '',
    phone: params.phone || params.existingProfile?.phone || '',
    status: params.status || params.existingProfile?.status || 'approved',
  };
}

/**
 * Persists teacher profile changes made by an Admin.
 * Can update both identity, professional, and verification fields.
 */
export async function saveTeacherProfileAsAdmin(
  teacherData: TeacherProfile,
  actorProfile: UserProfile | null,
): Promise<void> {
  const uid = teacherData.user_uid || teacherData.id;
  if (!uid) {
    throw new Error('Teacher UID is required to save profile');
  }

  const payload = {
    user_uid: uid,
    teacher_id: teacherData.teacher_id,
    name: teacherData.name.trim(),
    title: teacherData.title.trim(),
    photo_url: teacherData.photo_url || '',
    bio: teacherData.bio || '',
    qualifications: teacherData.qualifications || [],
    islamic_qualification: teacherData.islamic_qualification || '',
    specializations: teacherData.specializations || [],
    experience_years: teacherData.experience_years != null ? teacherData.experience_years : '',
    languages: teacherData.languages || [],
    verification_status: teacherData.verification_status || 'pending',
    organization_id: teacherData.organization_id || 'mslb-main',
    assigned_courses: Array.isArray(teacherData.assigned_courses) ? teacherData.assigned_courses : [],
    courses: Array.isArray(teacherData.courses) ? teacherData.courses : [],
    email: teacherData.email || '',
    phone: teacherData.phone || '',
    status: teacherData.status || 'approved',
    updated_at: serverTimestamp(),
  };

  await withTimeout(
    setDoc(doc(db, 'teachers', uid), payload, { merge: true }),
    10000,
    'Saving teacher profile timed out',
  );

  // Sync basic display fields to users/{uid} for identity consistency
  await withTimeout(
    updateDoc(doc(db, 'users', uid), {
      name: teacherData.name.trim(),
      photo_url: teacherData.photo_url || '',
      teacher_id: teacherData.teacher_id,
      updated_at: serverTimestamp(),
    }).catch((err) => {
      console.warn('[teacherIdentity] Syncing name to users collection skipped:', err);
    }),
    5000,
    'Syncing teacher name to user record timed out',
  ).catch(() => {});

  await createAdminLog(actorProfile, {
    action: 'update_teacher_profile',
    performed_by: actorProfile?.email || actorProfile?.name || 'admin',
    target_id: uid,
    details: `Updated teacher ${teacherData.teacher_id} (${teacherData.name})`,
  }).catch(() => {});
}

/**
 * Persists teacher self-profile edits.
 * Enforces strict boundary: only self-editable fields are written.
 */
export async function saveTeacherProfileAsSelf(
  userUid: string,
  updates: TeacherSelfUpdatePayload,
): Promise<void> {
  if (!userUid) {
    throw new Error('User UID is required for self profile update');
  }

  // Filter payload strictly to allowed keys
  const safePayload: Record<string, any> = {
    updated_at: serverTimestamp(),
  };

  TEACHER_SELF_EDITABLE_FIELDS.forEach((field) => {
    if (updates[field] !== undefined) {
      safePayload[field] = updates[field];
    }
  });

  await withTimeout(
    setDoc(doc(db, 'teachers', userUid), safePayload, { merge: true }),
    10000,
    'Updating faculty profile timed out',
  );

  // If name or photo changed, sync to users/{uid}
  const userUpdates: Record<string, any> = { updated_at: serverTimestamp() };
  if (updates.name) userUpdates.name = updates.name.trim();
  if (updates.photo_url !== undefined) userUpdates.photo_url = updates.photo_url;

  if (Object.keys(userUpdates).length > 1) {
    await withTimeout(
      updateDoc(doc(db, 'users', userUid), userUpdates).catch(() => {}),
      5000,
      'Syncing faculty name to user record timed out',
    ).catch(() => {});
  }
}

/**
 * Queries all existing teacher documents to collect existing teacher IDs.
 */
export async function fetchExistingTeacherIds(): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    const ids: string[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.teacher_id) ids.push(String(data.teacher_id));
    });
    return ids;
  } catch (err) {
    console.warn('[teacherIdentity] Failed to fetch existing teacher IDs:', err);
    return [];
  }
}

export interface ReconciliationResult {
  needsUpdate: boolean;
  canonicalId: string;
  teacherId: string;
  updates: Partial<TeacherProfile> | null;
}

/**
 * Safe reconciliation of existing teachers:
 * Identifies if an existing teacher doc matches a user UID or needs migration.
 */
export function reconcileExistingTeacherDoc(
  teacherDoc: Partial<TeacherProfile>,
  userUid: string,
  teacherId?: string,
): ReconciliationResult {
  const isCanonical =
    teacherDoc.user_uid === userUid &&
    Boolean(teacherDoc.teacher_id) &&
    isValidTeacherId(teacherDoc.teacher_id) &&
    (!teacherId || teacherDoc.teacher_id === teacherId) &&
    teacherDoc.status === 'approved' &&
    (teacherDoc.verification_status === 'approved' || teacherDoc.verification_status === 'verified' || teacherDoc.verification_status === 'pending');

  if (isCanonical) {
    return {
      needsUpdate: false,
      canonicalId: userUid,
      teacherId: teacherDoc.teacher_id!,
      updates: null,
    };
  }

  const resolvedTeacherId = (teacherDoc.teacher_id && isValidTeacherId(teacherDoc.teacher_id))
    ? teacherDoc.teacher_id
    : (teacherId || getNextTeacherId());

  const updates: Partial<TeacherProfile> = {
    ...teacherDoc,
    id: userUid,
    user_uid: userUid,
    teacher_id: resolvedTeacherId,
    status: teacherDoc.status || 'approved',
    verification_status: teacherDoc.verification_status || 'pending',
    organization_id: teacherDoc.organization_id || 'mslb-main',
    assigned_courses: Array.isArray(teacherDoc.assigned_courses)
      ? teacherDoc.assigned_courses
      : (Array.isArray(teacherDoc.courses) ? teacherDoc.courses : []),
    courses: Array.isArray(teacherDoc.courses)
      ? teacherDoc.courses
      : (Array.isArray(teacherDoc.assigned_courses) ? teacherDoc.assigned_courses : []),
  };

  return {
    needsUpdate: true,
    canonicalId: userUid,
    teacherId: resolvedTeacherId,
    updates,
  };
}

/**
 * Persists the reconciled teacher document to Firestore.
 */
export async function persistReconciledTeacherDoc(result: ReconciliationResult): Promise<void> {
  if (!result.needsUpdate || !result.updates) return;
  await withTimeout(
    setDoc(doc(db, 'teachers', result.canonicalId), {
      ...result.updates,
      updated_at: serverTimestamp(),
    }, { merge: true }),
    10000,
    'Persisting reconciled teacher doc timed out',
  );
}
