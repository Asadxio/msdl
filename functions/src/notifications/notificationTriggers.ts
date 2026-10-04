/**
 * MSLB Automated Event Notification Triggers — Cloud Functions v2
 *
 * Automatically triggers server-authoritative push & in-app notifications on:
 * 1. User Approval (onDocumentUpdated users/{userId}):
 *    When status becomes 'approved', notifies the student.
 * 2. Assignment Submission & Review (onDocumentWritten submissions/{submissionId}):
 *    - On create: notifies the assigned course teacher.
 *    - On review: notifies the student with grade & feedback.
 * 3. Live Class Started (onDocumentWritten live_classes/{classId}):
 *    - When status transitions to 'live', notifies all enrolled students.
 */
import { logger } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "../shared/firestore";
import { deliverPushNotificationInternal } from "./sendNotification";

// ─────────────────────────────────────────────────────────────────────────────
// Trigger 1: User Approval Trigger
// ─────────────────────────────────────────────────────────────────────────────
export const onUserApprovalTrigger = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const beforeData = event.data?.before.data() || {};
    const afterData = event.data?.after.data() || {};
    const userId = event.params.userId;

    // Detect status transition to 'approved'
    if (beforeData.status !== "approved" && afterData.status === "approved") {
      logger.info(`[onUserApprovalTrigger] User ${userId} approved. Dispatching approval notification.`);

      const studentName = String(afterData.name || afterData.display_name || "طالبہ").trim();
      const title = "🌸 اکاؤنٹ منظور ہو گیا (Account Approved)";
      const body = `السلام علیکم ${studentName}! Your account has been approved. You can now access all features, courses, and classes.`;
      const route = "/(tabs)/courses";
      const dedupeId = `approval_push_${userId}`;
      const orgId = afterData.organization_id || "mslb-main";

      // 1. Deliver native FCM push
      await deliverPushNotificationInternal({
        recipientUids: [userId],
        title,
        body,
        channelId: "announcements",
        organizationId: orgId,
        sentByUid: "system",
        dedupeId,
        data: {
          type: "approval",
          route,
          user_id: userId,
        },
      }).catch((err) => logger.warn(`[onUserApprovalTrigger] Push delivery error:`, err));

      // 2. Write in-app notification doc
      try {
        await collections.notifications().add({
          recipient_id: userId,
          user_id: userId,
          actor_id: "system",
          channel: "announcements",
          event: "account_approved",
          title,
          body,
          message: body,
          route,
          read: { [userId]: false },
          data: { route, type: "approval" },
          dedupe_id: dedupeId,
          organization_id: orgId,
          created_at: FieldValue.serverTimestamp(),
          created_at_ms: Date.now(),
        });
      } catch (err) {
        logger.warn(`[onUserApprovalTrigger] Failed to write in-app notification:`, err);
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Trigger 2: Assignment Submission & Review Trigger
// ─────────────────────────────────────────────────────────────────────────────
export const onSubmissionWrittenTrigger = onDocumentWritten(
  {
    document: "submissions/{submissionId}",
    region: "us-central1",
  },
  async (event) => {
    const beforeData = event.data?.before.exists ? event.data.before.data() : null;
    const afterData = event.data?.after.exists ? event.data.after.data() : null;
    const submissionId = event.params.submissionId;

    if (!afterData) return; // Deleted submission, no action

    // Event A: New Submission Created
    if (!beforeData) {
      const studentUid = afterData.user_id;
      const assignmentId = afterData.assignment_id;
      logger.info(`[onSubmissionWrittenTrigger] New submission ${submissionId} by student ${studentUid}`);

      try {
        // Resolve assignment & course
        const assignSnap = await collections.assignments().doc(assignmentId).get();
        if (!assignSnap.exists) return;
        const assignData = assignSnap.data()!;
        const courseId = assignData.course_id;

        // Resolve teacher(s)
        const courseSnap = await collections.courses().doc(courseId).get();
        if (!courseSnap.exists) return;
        const courseData = courseSnap.data()!;
        const teacherIds: string[] = [];
        if (courseData.teacher_id) teacherIds.push(courseData.teacher_id);
        if (Array.isArray(courseData.teachers)) {
          courseData.teachers.forEach((t: any) => {
            const tid = typeof t === "string" ? t : t?.id || t?.uid;
            if (tid && !teacherIds.includes(tid)) teacherIds.push(tid);
          });
        }

        if (teacherIds.length === 0) return;

        // Fetch student name
        const studentSnap = await collections.users().doc(studentUid).get();
        const studentName = studentSnap.exists ? studentSnap.data()?.name || "A student" : "A student";

        const title = "📝 New Assignment Submitted";
        const body = `${studentName} has submitted an assignment for "${courseData.name || 'Course'}".`;
        const route = `/course/${courseId}`;
        const dedupeId = `sub_created_${submissionId}`;

        // Deliver push to teacher(s)
        await deliverPushNotificationInternal({
          recipientUids: teacherIds,
          title,
          body,
          channelId: "academic",
          organizationId: courseData.organization_id || "mslb-main",
          sentByUid: studentUid,
          dedupeId,
          data: {
            type: "assignment_submitted",
            submission_id: submissionId,
            assignment_id: assignmentId,
            course_id: courseId,
            route,
          },
        });

        // Write in-app notification doc for each teacher
        await Promise.allSettled(
          teacherIds.map((tid) =>
            collections.notifications().add({
              recipient_id: tid,
              user_id: tid,
              actor_id: studentUid,
              channel: "assignments",
              event: "assignment_submitted",
              title,
              body,
              message: body,
              route,
              read: { [tid]: false },
              data: { submission_id: submissionId, course_id: courseId, route },
              dedupe_id: `${dedupeId}_${tid}`,
              created_at: FieldValue.serverTimestamp(),
              created_at_ms: Date.now(),
            })
          )
        );
      } catch (err) {
        logger.error(`[onSubmissionWrittenTrigger] Error notifying teacher on submission:`, err);
      }
    }

    // Event B: Submission Reviewed / Graded
    if (beforeData && beforeData.status !== "reviewed" && afterData.status === "reviewed") {
      const studentUid = afterData.user_id;
      logger.info(`[onSubmissionWrittenTrigger] Submission ${submissionId} reviewed for student ${studentUid}`);

      try {
        const title = "🌟 Assignment Reviewed (سبق کا معائنہ)";
        const gradeStr = afterData.grade ? ` Marks: ${afterData.grade}.` : "";
        const body = `Your assignment has been reviewed by your Ustadha.${gradeStr} Open your lesson to see the feedback.`;
        const assignmentSnap = await collections.assignments().doc(afterData.assignment_id).get();
        const courseId = assignmentSnap.exists ? assignmentSnap.data()?.course_id : "";
        const route = courseId ? `/course/${courseId}` : "/(tabs)/courses";
        const dedupeId = `sub_reviewed_${submissionId}`;

        // Deliver push to student
        await deliverPushNotificationInternal({
          recipientUids: [studentUid],
          title,
          body,
          channelId: "academic",
          sentByUid: afterData.reviewer_id || "teacher",
          dedupeId,
          data: {
            type: "assignment_reviewed",
            submission_id: submissionId,
            grade: String(afterData.grade || ""),
            route,
            ...(courseId ? { course_id: courseId } : {}),
          },
        });

        // Write in-app notification doc
        await collections.notifications().add({
          recipient_id: studentUid,
          user_id: studentUid,
          actor_id: afterData.reviewer_id || "teacher",
          channel: "assignments",
          event: "assignment_reviewed",
          title,
          body,
          message: body,
          route,
          read: { [studentUid]: false },
          data: { submission_id: submissionId, course_id: courseId, route },
          dedupe_id: dedupeId,
          created_at: FieldValue.serverTimestamp(),
          created_at_ms: Date.now(),
        });
      } catch (err) {
        logger.error(`[onSubmissionWrittenTrigger] Error notifying student on review:`, err);
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Trigger 3: Live Class Started Trigger
// ─────────────────────────────────────────────────────────────────────────────
export const onLiveClassWrittenTrigger = onDocumentWritten(
  {
    document: "live_classes/{classId}",
    region: "us-central1",
  },
  async (event) => {
    const beforeData = event.data?.before.exists ? event.data.before.data() : null;
    const afterData = event.data?.after.exists ? event.data.after.data() : null;
    const classId = event.params.classId;

    if (!afterData) return;

    // Detect when class goes live
    if ((!beforeData || beforeData.status !== "live") && afterData.status === "live") {
      logger.info(`[onLiveClassWrittenTrigger] Class ${classId} is now LIVE. Dispatching to enrolled students.`);

      const courseId = afterData.course_id;
      if (!courseId) return;

      try {
        // Query active enrollments for this course
        const enrollmentsSnap = await collections.enrollments()
          .where("course_id", "==", courseId)
          .where("status", "==", "active")
          .limit(500)
          .get();

        const studentUids = enrollmentsSnap.docs.map((d) => d.data().user_id).filter(Boolean);
        if (studentUids.length === 0) return;

        const classTitle = afterData.title || "Live Dars";
        const title = `🔴 لائیو کلاس شروع ہو چکی ہے (Class is LIVE!)`;
        const body = `"${classTitle}" has started! Tap to join your Ustadha in the classroom now.`;
        const route = `/live-class/${classId}`;
        const dedupeId = `live_start_${classId}_${Date.now().toString().slice(0, 8)}`;

        // Deliver native FCM push to enrolled students
        await deliverPushNotificationInternal({
          recipientUids: studentUids,
          title,
          body,
          channelId: "calls",
          organizationId: afterData.organization_id || "mslb-main",
          sentByUid: afterData.teacher_id || "teacher",
          dedupeId,
          data: {
            type: "live_class_started",
            live_class_id: classId,
            course_id: courseId,
            route,
          },
        });

        // Write broadcast/in-app notification record
        await collections.notifications().add({
          recipient_id: "enrolled_students",
          user_id: "role_targeted",
          target_user_ids: studentUids,
          actor_id: afterData.teacher_id || "teacher",
          channel: "live_classes",
          event: "live_class_started",
          title,
          body,
          message: body,
          route,
          data: { live_class_id: classId, course_id: courseId, route },
          dedupe_id: dedupeId,
          created_at: FieldValue.serverTimestamp(),
          created_at_ms: Date.now(),
        });
      } catch (err) {
        logger.error(`[onLiveClassWrittenTrigger] Error dispatching live class push:`, err);
      }
    }
  }
);
