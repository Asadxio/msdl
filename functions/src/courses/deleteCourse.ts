/**
 * MSLB Course Deletion Safety Service — Cloud Function
 * 
 * Server-side trusted course deletion enforcing zero academic dependency rules.
 * 
 * SECURITY & GOVERNANCE:
 * - Admin authorization verified server-side from Firestore user document.
 * - Multi-tenant isolation verified against organization_id.
 * - Comprehensive inspection across ALL 13 course-dependent collections.
 * - If ANY dependent record exists: deletion is DENIED (instructing admin to deactivate).
 * - If ZERO dependencies exist: course is deleted and immutable audit log is written.
 * - Direct client deletion is permanently blocked in firestore.rules.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db } from '../config/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdminUser } from '../auth/verifyAuth';
import {
  invalidArgumentError,
  notFoundError,
  permissionDeniedError,
  failedPreconditionError,
} from '../shared/errors';

export interface DeleteCourseRequest {
  courseId: string;
}

export interface DeleteCourseResponse {
  success: boolean;
  courseId: string;
  message: string;
}

export const deleteCourse = onCall(
  {
    region: 'us-central1',
    cpu: 'gcf_gen1',
    maxInstances: 10,
  },
  async (request: CallableRequest<DeleteCourseRequest>): Promise<DeleteCourseResponse> => {
    // 1. Require admin user (verified from Firestore server-side)
    const user = await requireAdminUser(request);
    const { courseId } = request.data ?? {};

    if (!courseId || typeof courseId !== 'string' || courseId.trim().length === 0) {
      throw invalidArgumentError('courseId is required');
    }

    const cleanCourseId = courseId.trim();
    logger.info(`[deleteCourse] Course delete requested: courseId=${cleanCourseId} by uid=${user.uid} (${user.email})`);

    // 2. Fetch the course document
    const courseRef = db.collection('courses').doc(cleanCourseId);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) {
      throw notFoundError(`Course "${cleanCourseId}" not found`);
    }

    const courseData = courseSnap.data()!;
    const courseOrg = courseData.organization_id || 'mslb-main';

    // 3. Organization isolation check
    if (user.role !== 'super_admin') {
      const userSnap = await db.collection('users').doc(user.uid).get();
      const userData = userSnap.data() || {};
      const userOrg = userData.organization_id || 'mslb-main';

      let isOrgAuthorized = userOrg === courseOrg;
      if (!isOrgAuthorized && courseOrg !== 'mslb-main') {
        const mSnap1 = await db.collection('organization_memberships').doc(`${courseOrg}:${user.uid}`).get();
        const mSnap2 = await db.collection('organization_memberships').doc(`${courseOrg}_${user.uid}`).get();
        const mData = mSnap1.exists ? mSnap1.data() : (mSnap2.exists ? mSnap2.data() : null);
        if (mData && (mData.role === 'admin' || mData.role === 'super_admin') && mData.status === 'active') {
          isOrgAuthorized = true;
        }
      }

      if (!isOrgAuthorized) {
        logger.warn(`[deleteCourse] Cross-tenant course deletion blocked: userOrg=${userOrg}, courseOrg=${courseOrg}, uid=${user.uid}`);
        throw permissionDeniedError('You do not have administrative authority over this course\'s organization.');
      }
    }

    // 4. Server-Side Inspection across ALL 13 Dependent Collections
    const dependentCollections = [
      { name: 'enrollments', label: 'Enrollments' },
      { name: 'modules', label: 'Curriculum Modules' },
      { name: 'lessons', label: 'Lessons' },
      { name: 'assignments', label: 'Assignments' },
      { name: 'submissions', label: 'Student Submissions' },
      { name: 'quiz_results', label: 'Quiz Results' },
      { name: 'quizzes', label: 'Quizzes' },
      { name: 'attendance', label: 'Attendance Records' },
      { name: 'live_classes', label: 'Live Classes' },
      { name: 'recordings', label: 'Recordings' },
      { name: 'certificates', label: 'Certificates' },
      { name: 'lesson_progress', label: 'Lesson Progress' },
      { name: 'payments', label: 'Payment Records' },
    ];

    const checks = await Promise.all(
      dependentCollections.map(async (col) => {
        try {
          const snap = await db.collection(col.name).where('course_id', '==', cleanCourseId).limit(1).get();
          return { name: col.name, label: col.label, count: snap.size };
        } catch (err) {
          logger.warn(`[deleteCourse] Dependency check failed for ${col.name}:`, err);
          // If a query fails, be conservative and treat as dependent to prevent data corruption
          return { name: col.name, label: col.label, count: 1 };
        }
      })
    );

    const foundDependencies = checks.filter((c) => c.count > 0).map((c) => c.label);

    if (foundDependencies.length > 0) {
      logger.warn(`[deleteCourse] Hard delete REJECTED for courseId=${cleanCourseId}. Found dependencies: ${foundDependencies.join(', ')}`);
      throw failedPreconditionError(
        `This course has academic history/content and cannot be permanently deleted. Please deactivate the course.`
      );
    }

    // 5. Zero dependencies verified: Perform deletion and write admin audit log
    const batch = db.batch();
    batch.delete(courseRef);

    const logRef = db.collection('admin_logs').doc();
    batch.set(logRef, {
      action: 'course_hard_delete',
      course_id: cleanCourseId,
      course_name: courseData.name || '',
      organization_id: courseOrg,
      performed_by_uid: user.uid,
      performed_by_email: user.email,
      performed_at: FieldValue.serverTimestamp(),
      performed_at_ms: Date.now(),
      details: `Permanently deleted empty course "${courseData.name || cleanCourseId}" after verifying zero academic history across 13 collections.`,
    });

    await batch.commit();

    logger.info(`[deleteCourse] SUCCESS: courseId=${cleanCourseId} permanently deleted by uid=${user.uid}`);

    return {
      success: true,
      courseId: cleanCourseId,
      message: `Course "${courseData.name || cleanCourseId}" permanently deleted.`,
    };
  }
);
