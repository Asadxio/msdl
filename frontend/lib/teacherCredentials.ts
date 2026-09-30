/**
 * teacherCredentials.ts
 *
 * Secure teacher credential document system.
 *
 * Storage path : teacher_credentials/{teacherUid}/{documentId}
 * Firestore    : teacher_credential_docs/{teacherUid}/documents/{documentId}
 *
 * Access model:
 *   Teacher  — upload + view OWN credential files only
 *   Admin    — view + review ALL teacher credential files
 *   Student  — NO ACCESS (enforced at Storage + Firestore rules)
 *
 * Teachers CANNOT mark their own credentials as verified.
 * Verification is an explicit Admin-only action.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CredentialVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface TeacherCredentialDoc {
  document_id: string;
  teacher_uid: string;
  filename: string;
  content_type: string;
  /** Firestore document ID in teacher_credential_docs/{uid}/documents/ */
  firestore_id?: string;
  /** Download URL from Firebase Storage (resolved at read time) */
  download_url?: string;
  storage_path: string;
  uploaded_at: any; // Firestore Timestamp
  uploaded_by: string;
  verification_status: CredentialVerificationStatus;
  reviewed_by?: string;
  reviewed_at?: any;
  review_note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload a credential document (Teacher — own account only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads a credential file to Storage and creates the Firestore metadata doc.
 *
 * @param teacherUid  - The UID of the teacher uploading the document.
 * @param file        - A Blob/File selected from the device (from expo-document-picker or expo-image-picker).
 * @param filename    - Original filename to display in the UI.
 * @param contentType - MIME type (application/pdf | image/jpeg | image/png | ...).
 * @returns The Firestore document ID of the created metadata record.
 */
export async function uploadTeacherCredential(
  teacherUid: string,
  file: Blob,
  filename: string,
  contentType: string,
): Promise<string> {
  if (!teacherUid) throw new Error('teacherUid is required');
  if (!file)       throw new Error('File blob is required');
  if (!filename)   throw new Error('filename is required');

  // Sanitize: block unsafe types up-front (Storage rules also enforce this)
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`File type "${contentType}" is not allowed. Only PDF and images are accepted.`);
  }

  // Use a timestamp-based unique ID for the storage object
  const documentId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `teacher_credentials/${teacherUid}/${documentId}`;

  // 1. Upload file to Storage
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType });

  // 2. Create Firestore metadata document (verification_status always starts 'pending')
  const metadataColRef = collection(
    db,
    'teacher_credential_docs',
    teacherUid,
    'documents',
  );
  const metadataDoc: Omit<TeacherCredentialDoc, 'firestore_id' | 'download_url'> = {
    document_id: documentId,
    teacher_uid: teacherUid,
    filename,
    content_type: contentType,
    storage_path: storagePath,
    uploaded_at: serverTimestamp(),
    uploaded_by: teacherUid,
    verification_status: 'pending',
  };
  const ref2 = await addDoc(metadataColRef, metadataDoc);
  return ref2.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// List credential documents for a teacher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all credential documents for a teacher.
 * Resolves storage download URLs.
 *
 * @param teacherUid  - The UID of the teacher.
 */
export async function listTeacherCredentials(
  teacherUid: string,
): Promise<TeacherCredentialDoc[]> {
  if (!teacherUid) return [];

  const colRef = collection(db, 'teacher_credential_docs', teacherUid, 'documents');
  const snapshot = await getDocs(colRef);

  const results: TeacherCredentialDoc[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as TeacherCredentialDoc;
    let downloadUrl: string | undefined;
    try {
      const fileRef = ref(storage, data.storage_path);
      downloadUrl = await getDownloadURL(fileRef);
    } catch {
      downloadUrl = undefined; // File may have been removed
    }
    results.push({
      ...data,
      firestore_id: docSnap.id,
      download_url: downloadUrl,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: review a credential document
// ─────────────────────────────────────────────────────────────────────────────

export type CredentialReviewDecision = 'verified' | 'rejected';

/**
 * Admin marks a specific credential document as verified or rejected.
 *
 * @param teacherUid   - UID of the teacher who owns the document.
 * @param firestoreId  - The Firestore document ID within teacher_credential_docs/{uid}/documents/.
 * @param decision     - 'verified' or 'rejected'.
 * @param reviewerIdentity - Display identity of the reviewing admin (email/name).
 * @param reviewNote   - Optional note explaining the decision.
 */
export async function reviewTeacherCredential(
  teacherUid: string,
  firestoreId: string,
  decision: CredentialReviewDecision,
  reviewerIdentity: string,
  reviewNote?: string,
): Promise<void> {
  if (!teacherUid || !firestoreId) {
    throw new Error('teacherUid and firestoreId are required');
  }
  if (!['verified', 'rejected'].includes(decision)) {
    throw new Error('Invalid decision — must be "verified" or "rejected"');
  }

  const docRef = doc(db, 'teacher_credential_docs', teacherUid, 'documents', firestoreId);
  const update: Record<string, any> = {
    verification_status: decision,
    reviewed_by: reviewerIdentity,
    reviewed_at: serverTimestamp(),
  };
  if (reviewNote) {
    update.review_note = reviewNote;
  }
  await updateDoc(docRef, update);
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a credential document (owner-pending or Admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes a credential document from both Storage and Firestore.
 * Firestore rules enforce that only the owner (for pending docs) or Admin can delete.
 *
 * @param teacherUid  - UID of the teacher who owns the document.
 * @param firestoreId - The Firestore document ID.
 * @param storagePath - The full Storage path (teacher_credentials/{uid}/{docId}).
 */
export async function deleteTeacherCredential(
  teacherUid: string,
  firestoreId: string,
  storagePath: string,
): Promise<void> {
  // Delete from Storage first (non-fatal if already gone)
  try {
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch {
    // Storage object may already be gone — continue to clean Firestore
  }

  // Delete Firestore metadata
  const docRef = doc(db, 'teacher_credential_docs', teacherUid, 'documents', firestoreId);
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(docRef);
}
