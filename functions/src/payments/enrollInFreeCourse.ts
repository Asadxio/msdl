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

export const AUTHORITATIVE_FREE_COURSE_IDS: ReadonlySet<string> = new Set([
  'course_short',
]);

/**
 * Authoritatively determines whether a course is free.
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. Title alone is NEVER trusted to determine free status.
 * 2. Any positive fee (> 0) in course_fee, fee, or admission_fee strictly blocks free enrollment,
 *    even if the title is "Short Courses" or is_free is claimed.
 * 3. Conflicting fees (e.g. course_fee: 500, fee: 0) fail safely to NOT FREE.
 * 4. Malformed values (NaN, 'invalid') fail safely to NOT FREE.
 * 5. Missing, null, or empty string fees do NOT grant free enrollment.
 * 6. Free status requires EITHER an explicit numeric/string zero fee (0 or "0"),
 *    OR an explicit authoritative indicator (is_free === true) with no positive fee,
 *    OR an approved course ID under administrative control ('course_short').
 */
export function isAuthoritativelyFreeCourse(course: {
  id?: string;
  name?: string;
  course_fee?: any;
  fee?: any;
  admission_fee?: any;
  is_free?: any;
  isFree?: any;
} | null | undefined): boolean {
  if (!course) return false;

  const parseFee = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return Number(val.trim());
    return NaN;
  };

  const isMalformed = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return false;
      return isNaN(Number(trimmed));
    }
    if (typeof val === 'number') {
      return isNaN(val);
    }
    return true;
  };

  // 1. Any malformed fee field fails safely to NOT FREE
  if (isMalformed(course.course_fee) || isMalformed(course.fee) || isMalformed(course.admission_fee)) {
    return false;
  }

  const numCourseFee = parseFee(course.course_fee);
  const numFee = parseFee(course.fee);
  const numAdmissionFee = parseFee(course.admission_fee);

  // 2. A positive fee strictly prevents free enrollment
  const hasPositiveFee =
    (!isNaN(numCourseFee) && numCourseFee > 0) ||
    (!isNaN(numFee) && numFee > 0) ||
    (!isNaN(numAdmissionFee) && numAdmissionFee > 0);

  if (hasPositiveFee) {
    return false;
  }

  // 3. Explicit zero fee
  const isExplicitZero = (val: any): boolean => {
    if (val === 0) return true;
    if (typeof val === 'string' && val.trim() === '0') return true;
    return false;
  };

  const hasExplicitZeroFee = isExplicitZero(course.course_fee) || isExplicitZero(course.fee);
  if (hasExplicitZeroFee) {
    return true;
  }

  // 4. Explicit authoritative free indicator or approved free course ID (only if no positive fee)
  const isExplicitlyMarkedFree = course.is_free === true || course.isFree === true;
  const isApprovedFreeId = typeof course.id === 'string' && AUTHORITATIVE_FREE_COURSE_IDS.has(course.id.trim());

  if (isExplicitlyMarkedFree || isApprovedFreeId) {
    return true;
  }

  // 5. Title alone is NEVER trusted if fees are missing, null, or undefined
  return false;
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
    if (userProfile.status !== 'approved') {
      throw permissionDeniedError('Account is not eligible for course enrollment. Only approved students can enroll.');
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
    const isFree = isAuthoritativelyFreeCourse(courseData);

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
