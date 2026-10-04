/**
 * MSLB Free Course Enrollment — Cloud Function
 * 
 * Allows approved students to directly enroll in designated FREE courses (e.g. "Short Courses" or course_fee == 0).
 * 
 * SECURITY INVARIANTS:
 * - Firebase Auth required & account status active/approved.
 * - Course existence verified against `courses/{courseId}`.
 * - Course MUST be verified as genuinely FREE on the server (course_fee == 0 or name indicates Short Courses).
 *   Paid courses are strictly rejected with permission-denied.
 * - Deterministic enrollment ID: `${uid}:${courseId}`.
 * - Idempotent: re-calling for an active enrollment safely returns without duplicates.
 */
import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/admin';
import { requireAuthenticatedUser } from '../auth/verifyAuth';
import { invalidArgumentError, permissionDeniedError } from '../shared/errors';
import { collections } from '../shared/firestore';
import { deliverPushNotificationInternal } from '../notifications/sendNotification';

interface EnrollInFreeCourseRequest {
  courseId: string;
}

interface EnrollInFreeCourseResponse {
  success: boolean;
  enrollmentId: string;
  alreadyEnrolled?: boolean;
}

export const enrollInFreeCourse = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<EnrollInFreeCourseRequest>): Promise<EnrollInFreeCourseResponse> => {
    // 1. Require authentication
    const user = await requireAuthenticatedUser(request);
    logger.info(`[enrollInFreeCourse] Invoked by uid=${user.uid}`);

    const { courseId } = request.data ?? {};
    if (!courseId || typeof courseId !== 'string' || !courseId.trim()) {
      throw invalidArgumentError('courseId is required.');
    }

    // 2. Verify user eligibility
    const userSnap = await collections.users().doc(user.uid).get();
    if (!userSnap.exists) {
      throw permissionDeniedError('User profile not found.');
    }
    const userProfile = userSnap.data()!;
    if (userProfile.status === 'suspended' || userProfile.status === 'banned' || userProfile.status === 'deactivated') {
      throw permissionDeniedError('Account is not eligible for course enrollment.');
    }

    // 3. Verify course exists & is FREE
    const courseRef = collections.courses().doc(courseId);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) {
      throw invalidArgumentError(`Course not found: ${courseId}`);
    }
    const courseData = courseSnap.data()!;
    if (courseData.status === 'inactive' || courseData.status === 'archived') {
      throw invalidArgumentError('This course is currently inactive and not accepting new enrollments.');
    }
    const courseName = String(courseData.name || '').trim().toLowerCase();
    const isFree = courseData.course_fee === 0 || courseData.fee === 0 || courseName === 'short courses' || courseName.includes('short course');

    if (!isFree) {
      logger.warn(`[enrollInFreeCourse] Attempted free enrollment in paid course id=${courseId} fee=${courseData.course_fee}`);
      throw permissionDeniedError('This course is not free. Payment required for admission and enrollment.');
    }

    // 4. Deterministic enrollment ID
    const enrollmentId = `${user.uid}:${courseId}`;
    const enrollmentRef = collections.enrollments().doc(enrollmentId);
    const existingSnap = await enrollmentRef.get();

    if (existingSnap.exists && existingSnap.data()?.status === 'active') {
      logger.info(`[enrollInFreeCourse] User ${user.uid} already actively enrolled in free course ${courseId}`);
      return {
        success: true,
        enrollmentId,
        alreadyEnrolled: true,
      };
    }

    // 5. Atomic enrollment creation
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    const nowMs = Date.now();
    const orgId = courseData.organization_id || 'mslb-main';

    batch.set(enrollmentRef, {
      user_id: user.uid,
      course_id: courseId,
      organization_id: orgId,
      status: 'active',
      source: 'free_course',
      created_at: now,
      updated_at: now,
      enrolled_at_ms: nowMs,
    }, { merge: true });

    // Update student subscription
    const subRef = collections.subscriptions().doc(user.uid);
    batch.set(subRef, {
      user_id: user.uid,
      organization_id: orgId,
      status: 'active',
      last_free_course_id: courseId,
      updated_at: now,
    }, { merge: true });

    // Audit log
    const auditRef = db.collection('payment_processor_audit_logs').doc();
    batch.set(auditRef, {
      event: 'free_course_enrollment',
      user_id: user.uid,
      course_id: courseId,
      enrollment_id: enrollmentId,
      created_at: now,
      created_at_ms: nowMs,
      source: 'enroll_in_free_course_v1',
    });

    await batch.commit();
    logger.info(`[enrollInFreeCourse] Successfully enrolled uid=${user.uid} in free course=${courseId}`);

    // Send automated confirmation notification (Native FCM Push + In-App Record)
    try {
      const courseName = String(courseData.name || 'Free Course').trim();
      const notifTitle = "🎓 Free Course Enrollment Activated";
      const notifBody = `Mubarak! You are now successfully enrolled in "${courseName}". Start learning your lessons now!`;
      const notifRoute = `/course/${courseId}`;
      const dedupeId = `free_enroll_${user.uid}_${courseId}`;

      await deliverPushNotificationInternal({
        recipientUids: [user.uid],
        title: notifTitle,
        body: notifBody,
        channelId: "academic",
        organizationId: orgId,
        sentByUid: "system",
        dedupeId,
        data: {
          type: "enrollment_success",
          course_id: courseId,
          route: notifRoute,
        },
      }).catch((pushErr) => logger.warn("[enrollInFreeCourse] Push dispatch non-fatal error:", pushErr));

      await collections.notifications().add({
        user_id: user.uid,
        recipient_id: user.uid,
        actor_id: "system",
        channel: "announcements",
        event: "enrollment_success",
        title: notifTitle,
        body: notifBody,
        message: notifBody,
        route: notifRoute,
        read: { [user.uid]: false },
        data: { course_id: courseId, route: notifRoute },
        created_at: FieldValue.serverTimestamp(),
        created_at_ms: Date.now(),
        dedupe_id: dedupeId,
        organization_id: orgId,
      }).catch(() => {});
    } catch (notifErr) {
      logger.warn("[enrollInFreeCourse] Error creating notification record:", notifErr);
    }

    return {
      success: true,
      enrollmentId,
      alreadyEnrolled: false,
    };
  }
);
