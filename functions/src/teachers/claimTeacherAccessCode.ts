/**
 * MSLB Claim Teacher Access Code — Cloud Function
 * 
 * Allows a registered user to activate their Teacher role and link their account
 * to an official Faculty profile using an institutional Access Code or Teacher ID
 * (e.g. "TCH-0001", "TCH-SUMRA", "SUMRA786", etc.).
 * 
 * SECURITY & BEHAVIOR:
 * - Firebase Auth required.
 * - Searches `teachers` collection by:
 *     1. teacher_id (case-insensitive, e.g. TCH-0001)
 *     2. access_code (case-insensitive, e.g. SUMRA786 or TCH-SUMRA)
 *     3. document id (exact match)
 *     4. name-based code token (e.g. "SUMRA", "AFNAZ", "BAHAAR", "RESHMA")
 * - Prevents hijacking: If already linked to another distinct user UID, requires same email match or admin.
 * - Atomically updates:
 *     1. `teachers/{teacherDocId}`: user_uid = user.uid, email = user.email, status = 'approved', verification_status = 'verified'
 *     2. `users/{user.uid}`: role = 'teacher', status = 'approved', teacher_id = teacher.teacher_id, name = teacher.name
 *     3. Mirror doc at `teachers/{user.uid}` with assigned_courses (ensures direct UID lookup always succeeds)
 *     4. `courses`: updates assigned_teacher_id = user.uid for all courses belonging to this teacher
 *     5. `role_transition_audit_logs`: records activation event
 */
import { onCall, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/admin";
import { requireAuthenticatedUser } from "../auth/verifyAuth";
import { invalidArgumentError, notFoundError, permissionDeniedError } from "../shared/errors";
import { collections } from "../shared/firestore";

interface ClaimTeacherRequest {
  code: string;
}

interface ClaimTeacherResponse {
  success: boolean;
  teacherName: string;
  teacherId: string;
  teacherDocId: string;
  assignedCoursesCount: number;
  assignedCourseNames: string[];
}

export const claimTeacherAccessCode = onCall(
  { region: "us-central1" },
  async (request: CallableRequest<ClaimTeacherRequest>): Promise<ClaimTeacherResponse> => {
    // 1. Authenticate user
    const user = await requireAuthenticatedUser(request);
    logger.info(`[claimTeacherAccessCode] Invoked by uid=${user.uid} email=${user.email}`);

    const rawCode = (request.data?.code || "").trim();
    if (!rawCode) {
      throw invalidArgumentError("Teacher code is required.");
    }

    const cleanCode = rawCode.toUpperCase().replace(/\s+/g, "");

    // 2. Fetch all teacher documents to find the matching faculty profile
    const teachersSnap = await collections.teachers().get();
    let targetDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (const docSnap of teachersSnap.docs) {
      const data = docSnap.data();
      const docId = docSnap.id;
      const instId = (data.teacher_id || "").trim().toUpperCase();
      const accessCode = (data.access_code || "").trim().toUpperCase();
      const teacherName = (data.name || "").trim().toUpperCase();

      // Check matches
      const matchDocId = docId.toUpperCase() === cleanCode;
      const matchInstId = instId && instId === cleanCode;
      const matchAccessCode = accessCode && accessCode === cleanCode;
      
      // Also match easy prefix (e.g. "SUMRA" matches "Sumra Fatma" or "TCH-SUMRA")
      const firstName = teacherName.split(" ")[0] || "";
      const matchNameToken = (
        (firstName && cleanCode === firstName) ||
        (cleanCode === `TCH-${firstName}`) ||
        (cleanCode === `${firstName}786`) ||
        (cleanCode === `${firstName}123`)
      );

      if (matchDocId || matchInstId || matchAccessCode || matchNameToken) {
        targetDoc = docSnap;
        break;
      }
    }

    if (!targetDoc) {
      logger.warn(`[claimTeacherAccessCode] Invalid code attempted: "${rawCode}" by uid=${user.uid}`);
      throw notFoundError("Invalid Teacher Code. Please check the code provided by the administrator.");
    }

    const teacherDocId = targetDoc.id;
    const teacherData = targetDoc.data();
    const teacherName = teacherData.name || "Faculty Member";
    const teacherId = teacherData.teacher_id || "TCH-0001";

    logger.info(`[claimTeacherAccessCode] Found faculty profile: "${teacherName}" (docId=${teacherDocId}, instId=${teacherId})`);

    // 3. Hijack Prevention
    const existingUid = teacherData.user_uid;
    const existingEmail = (teacherData.email || "").toLowerCase().trim();
    const callerEmail = (user.email || "").toLowerCase().trim();

    if (existingUid && existingUid !== user.uid) {
      // If the email matches or user is admin, allow re-linking
      const isSameEmail = existingEmail && existingEmail === callerEmail;
      const isAdminCaller = user.role === "super_admin" || user.role === "admin";

      if (!isSameEmail && !isAdminCaller) {
        logger.warn(`[claimTeacherAccessCode] Code "${rawCode}" already claimed by uid=${existingUid} (caller uid=${user.uid})`);
        throw permissionDeniedError("This teacher code has already been linked to another account. Please contact the administrator.");
      }
    }

    // 4. Resolve assigned courses
    const assignedCoursesList: string[] = Array.isArray(teacherData.assigned_courses)
      ? teacherData.assigned_courses
      : (Array.isArray(teacherData.courses) ? teacherData.courses : []);

    const coursesSnap = await collections.courses().get();
    const matchedCourses: Array<{ id: string; name: string }> = [];

    coursesSnap.forEach((cSnap) => {
      const cData = cSnap.data();
      const cId = cSnap.id;
      const cName = cData.title || cData.name || "";
      const cTeacherId = cData.teacher_id || "";
      const cTeacherName = (cData.teacher_name || "").toLowerCase();
      const normTName = teacherName.toLowerCase();

      const isDirectIdMatch = cTeacherId === teacherDocId || cTeacherId === teacherId;
      const isNameMatch = normTName && (cTeacherName.includes(normTName) || normTName.includes(cTeacherName));
      const isInAssignedList = assignedCoursesList.some(
        (a) => a === cId || a.toLowerCase() === cName.toLowerCase()
      );

      if (isDirectIdMatch || isNameMatch || isInAssignedList) {
        matchedCourses.push({ id: cId, name: cName });
      }
    });

    const matchedCourseIds = matchedCourses.map((c) => c.id);
    const matchedCourseNames = matchedCourses.map((c) => c.name);

    logger.info(`[claimTeacherAccessCode] Matching courses found: ${matchedCourses.length} (${matchedCourseNames.join(", ")})`);

    // Combine any existing assigned courses with matched course IDs and names
    const finalAssignedCourses = Array.from(
      new Set([...assignedCoursesList, ...matchedCourseIds, ...matchedCourseNames])
    );

    // 5. Atomic Batch Execution
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    // 5a. Update the canonical teacher document
    batch.update(targetDoc.ref, {
      user_uid: user.uid,
      email: callerEmail || existingEmail,
      status: "approved",
      verification_status: "verified",
      assigned_courses: finalAssignedCourses,
      courses: finalAssignedCourses,
      updated_at: now,
      claimed_at: now,
    });

    // 5b. Update the user's document
    const userRef = collections.users().doc(user.uid);
    batch.update(userRef, {
      role: "teacher",
      status: "approved",
      teacher_id: teacherId,
      name: teacherName,
      updated_at: now,
    });

    // 5c. Mirror to teachers/{user.uid} if different from teacherDocId
    // This ensures fast lookups by Auth UID always have all profile & course fields
    if (user.uid !== teacherDocId) {
      const mirrorRef = collections.teachers().doc(user.uid);
      batch.set(mirrorRef, {
        id: user.uid,
        user_uid: user.uid,
        teacher_id: teacherId,
        canonical_teacher_doc_id: teacherDocId,
        name: teacherName,
        email: callerEmail || existingEmail,
        status: "approved",
        verification_status: "verified",
        assigned_courses: finalAssignedCourses,
        courses: finalAssignedCourses,
        organization_id: teacherData.organization_id || "mslb-main",
        updated_at: now,
        claimed_at: now,
      }, { merge: true });
    }

    // 5d. Update all matched courses with assigned_teacher_id
    matchedCourses.forEach((c) => {
      const cRef = collections.courses().doc(c.id);
      batch.update(cRef, {
        assigned_teacher_id: user.uid,
        teacher_id: teacherDocId,
        teacher_name: teacherName,
        updated_at: now,
      });
    });

    // 5e. Log audit entry
    const auditRef = db.collection("role_transition_audit_logs").doc();
    batch.set(auditRef, {
      action: "teacher_code_claimed",
      user_uid: user.uid,
      user_email: callerEmail,
      teacher_name: teacherName,
      teacher_id: teacherId,
      teacher_doc_id: teacherDocId,
      code_used: cleanCode,
      courses_assigned: matchedCourseNames,
      created_at: now,
    });

    await batch.commit();

    logger.info(`[claimTeacherAccessCode] SUCCESS! uid=${user.uid} is now Teacher "${teacherName}" with ${matchedCourses.length} courses`);

    return {
      success: true,
      teacherName,
      teacherId,
      teacherDocId,
      assignedCoursesCount: matchedCourses.length,
      assignedCourseNames: matchedCourseNames,
    };
  }
);
