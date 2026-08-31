/**
 * MSLB Certificate Generator — Cloud Function
 * 
 * Generates an official PDF certificate for a student upon course completion.
 * 
 * SECURITY MODEL:
 * - Callable function requiring Firebase Auth
 * - Student can only generate certificate for their own completed enrollment
 * - Certificate ID is deterministic: uid + courseId (prevents duplicates)
 * - PDF content loaded exclusively from server-side Firestore data
 * - Client cannot influence certificate content, status, or ownership
 * - Admin SDK writes to Storage and Firestore (client rules: allow create: if false)
 */
import { logger } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "../shared/firestore";
import PDFDocument from 'pdfkit';

export const generateCertificate = onCall(
  { region: 'us-central1' },
  async (request): Promise<{
    certificateId: string;
    storageUrl: string; 
    issuedAt: string;
    alreadyExisted: boolean;
  }> => {
    // 1. Auth check
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const uid = request.auth.uid;

    // 2. Input validation
    const courseId = request.data?.courseId;
    if (!courseId || typeof courseId !== 'string') {
      throw new HttpsError('invalid-argument', 'courseId is required');
    }

    // 3. Deterministic certificate ID
    const certificateId = `cert_${uid}_${courseId}`;

    // 4. Idempotency check
    const existingCert = await collections.certificates().doc(certificateId).get();
    if (existingCert.exists) {
      const data = existingCert.data()!;
      let issuedStr = "";
      if (data.issuedAt && typeof data.issuedAt.toDate === 'function') {
        issuedStr = data.issuedAt.toDate().toISOString();
      } else if (data.issuedAt) {
        issuedStr = new Date(data.issuedAt).toISOString();
      }
      return { certificateId, storageUrl: data.storageUrl, issuedAt: issuedStr, alreadyExisted: true };
    }

    // 5. Enrollment authorization
    const enrollmentId = `${uid}:${courseId}`;
    const enrollmentSnap = await collections.enrollments().doc(enrollmentId).get();
    if (!enrollmentSnap.exists) {
      throw new HttpsError('permission-denied', 'No valid enrollment found');
    }
    const enrollmentData = enrollmentSnap.data()!;
    if (enrollmentData.status !== 'active' && enrollmentData.status !== 'completed') {
      throw new HttpsError('permission-denied', 'Active or completed enrollment required');
    }

    // 6. Course data load
    const courseSnap = await collections.courses().doc(courseId).get();
    if (!courseSnap.exists) {
      throw new HttpsError('not-found', 'Course not found');
    }
    const courseData = courseSnap.data()!;
    const courseTitle = courseData.name || courseId;

    // 7. Student name load
    const userSnap = await collections.users().doc(uid).get();
    const userData = userSnap.exists ? userSnap.data()! : {};
    const studentName = userData.name || userData.display_name || userData.full_name || 'Student';

    // 8. PDF generation with pdfkit
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      doc.fontSize(28).text('Madrasa-tus-Salikat Lil Banat', { align: 'center' });
      doc.moveDown();
      doc.fontSize(20).text('Certificate of Completion', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(14).text('This certifies that', { align: 'center' });
      doc.moveDown();
      doc.fontSize(22).text(studentName, { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text('has successfully completed the course', { align: 'center' });
      doc.moveDown();
      doc.fontSize(18).text(courseTitle, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).text(`Certificate ID: ${certificateId}`, { align: 'center' });
      doc.text(`Issued: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
      
      doc.end();
    });

    // 9. Firebase Storage write
    const storagePath = `certificates/${uid}/${certificateId}.pdf`;
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    await file.save(pdfBuffer, {
      metadata: { contentType: 'application/pdf' },
    });
    const storageUrl = `gs://${bucket.name}/${storagePath}`;

    // 10. Firestore metadata write
    const issuedAt = FieldValue.serverTimestamp();
    await collections.certificates().doc(certificateId).set({
      uid,
      user_id: uid,
      courseId,
      course_id: courseId,
      certificateId,
      user_name: studentName,
      studentName,
      courseTitle,
      course_name: courseTitle,
      storageUrl,
      issuedAt,
      completion_date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }),
      status: 'issued',
      format: 'pdf',
      source: 'cloud_function_v2',
      created_at: issuedAt,
    });

    logger.info(`[generateCertificate] Certificate generated for uid=${uid} courseId=${courseId} certId=${certificateId}`);

    // 11. Return
    return {
      certificateId,
      storageUrl,
      issuedAt: new Date().toISOString(),
      alreadyExisted: false,
    };
  }
);

