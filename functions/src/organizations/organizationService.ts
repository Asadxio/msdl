/**
 * MSLB SaaS Multi-Tenant Organization Service
 * Server-side management for Organizations, Memberships, Invitations, and Bulk Ingestion.
 */
import { https, logger } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/admin";
import { requireAdminUser, requireAuthenticatedUser } from "../auth/verifyAuth";
import { invalidArgumentError, permissionDeniedError, notFoundError } from "../shared/errors";

export interface CreateOrganizationPayload {
  id?: string;
  name: string;
  slug?: string;
  tagline?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  status?: "active" | "trial";
  plan_id?: string;
  student_limit?: number;
  teacher_limit?: number;
  primary_color?: string;
  secondary_color?: string;
  starter_course_name?: string;
  is_demo?: boolean;
}

export interface UpdateOrgStatusPayload {
  organization_id: string;
  status: "active" | "trial" | "suspended" | "archived";
  reason?: string;
}

export interface BulkStudentRow {
  name: string;
  email?: string;
  phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  course_id?: string;
  course_name?: string;
}

export interface BulkImportPayload {
  organization_id: string;
  students: BulkStudentRow[];
}

export interface InviteUserPayload {
  organization_id: string;
  email?: string;
  phone?: string;
  name: string;
  role: "teacher" | "assistant_teacher" | "student" | "moderator" | "admin";
}

/**
 * 1. createOrganization
 * Allows an approved admin/founder to create a new institution workspace.
 * Automatically provisions owner membership with institutional admin role.
 */
export const createOrganization = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<CreateOrganizationPayload>) => {
    const caller = await requireAuthenticatedUser(request);
    logger.info(`[createOrganization] Called by uid=${caller.uid}, role=${caller.role}`);

    const payload = request.data;
    if (!payload?.name || typeof payload.name !== "string" || payload.name.trim().length === 0) {
      throw invalidArgumentError("Organization name is required.");
    }

    const cleanName = payload.name.trim();
    const generatedSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const orgId = (payload.id || payload.slug || generatedSlug).trim().toLowerCase();
    if (!orgId || orgId.length < 2) {
      throw invalidArgumentError("Invalid organization identifier or slug.");
    }

    const orgRef = db.collection("organizations").doc(orgId);
    const existing = await orgRef.get();
    if (existing.exists) {
      throw invalidArgumentError(`Organization '${orgId}' already exists. Please choose a different name or slug.`);
    }

    const isSuperAdmin = caller.role === "super_admin";
    const initialStatus = payload.status && isSuperAdmin ? payload.status : "trial";
    const initialPaymentStatus = isSuperAdmin && payload.status === "active" ? "received" : "pending";

    const newOrg = {
      id: orgId,
      name: cleanName,
      slug: (payload.slug || orgId).toLowerCase().trim(),
      tagline: payload.tagline || "",
      logo_url: payload.logo_url || "",
      phone: payload.phone || "",
      email: payload.email || "",
      address: payload.address || "",
      city: payload.city || "",
      state: payload.state || "",
      country: payload.country || "India",
      timezone: payload.timezone || "Asia/Kolkata",
      status: initialStatus,
      plan_id: payload.plan_id || "starter",
      subscription_status: initialStatus,
      payment_status: initialPaymentStatus,
      payment_reference: "",
      payment_confirmed_at: null,
      activated_by: isSuperAdmin && initialStatus === "active" ? caller.uid : null,
      student_limit: typeof payload.student_limit === "number" ? payload.student_limit : 200,
      teacher_limit: typeof payload.teacher_limit === "number" ? payload.teacher_limit : 20,
      primary_color: payload.primary_color || "#005F46",
      secondary_color: payload.secondary_color || "#C8A84E",
      setup_checklist_dismissed: false,
      is_demo: Boolean(payload.is_demo),
      created_by: caller.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await orgRef.set(newOrg);

    // Create Owner Membership (institution admin; platform super_admin retains super_admin)
    const membershipId = `${orgId}:${caller.uid}`;
    const assignedRole = caller.role === "super_admin" ? "super_admin" : "admin";
    await db.collection("organization_memberships").doc(membershipId).set({
      organization_id: orgId,
      user_id: caller.uid,
      role: assignedRole,
      status: "active",
      joined_at: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
    });

    // Optional: Auto-provision starter course if requested
    let createdCourseId: string | null = null;
    if (payload.starter_course_name && payload.starter_course_name.trim().length > 0) {
      const courseDoc = await db.collection("courses").add({
        name: payload.starter_course_name.trim(),
        organization_id: orgId,
        teacher_name: "Head Ustaadh",
        schedule: "Mon to Fri",
        class_time: "10:00 AM",
        description: `Foundation curriculum for ${cleanName}`,
        subjects: [],
        created_by: caller.uid,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      createdCourseId = courseDoc.id;
    }

    logger.info(`[createOrganization] Successfully created organization: ${orgId} with owner: ${caller.uid}`);
    return { success: true, organization: newOrg, starter_course_id: createdCourseId };
  }
);

/**
 * 2. updateOrganizationStatus
 * Super Admin authority to suspend, reactivate, or archive an institution.
 */
export const updateOrganizationStatus = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<UpdateOrgStatusPayload>) => {
    const caller = await requireAdminUser(request);
    if (caller.role !== "super_admin") {
      throw permissionDeniedError("Only Platform Super Admins can update organization status.");
    }

    const { organization_id, status, reason } = request.data;
    if (!organization_id || !status) {
      throw invalidArgumentError("organization_id and status are required.");
    }

    if (!["active", "trial", "suspended", "archived"].includes(status)) {
      throw invalidArgumentError("Invalid status value.");
    }

    const orgRef = db.collection("organizations").doc(organization_id);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw notFoundError(`Organization '${organization_id}' not found.`);
    }

    await orgRef.update({
      status,
      status_reason: reason || "",
      status_updated_by: caller.uid,
      updated_at: FieldValue.serverTimestamp(),
    });

    // Write audit log
    await db.collection("admin_logs").add({
      action: `org_status_${status}`,
      organization_id,
      performed_by: caller.email || caller.uid,
      reason: reason || "",
      created_at: FieldValue.serverTimestamp(),
    });

    logger.info(`[updateOrganizationStatus] Org ${organization_id} updated to ${status} by ${caller.uid}`);
    return { success: true, organization_id, status };
  }
);

export interface RecordManualPaymentPayload {
  organization_id: string;
  payment_reference: string;
  payment_status?: "received" | "waived" | "not_required";
  plan_id?: string;
  student_limit?: number;
  teacher_limit?: number;
  activate_now?: boolean;
}

/**
 * 2b. recordManualPayment
 * Super Admin operational action to record manual/offline payment and activate institution.
 * NO online subscription billing or automated payment gateways.
 */
export const recordManualPayment = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<RecordManualPaymentPayload>) => {
    const caller = await requireAdminUser(request);
    if (caller.role !== "super_admin") {
      throw permissionDeniedError("Only Platform Super Admins can record manual payments and activate institutions.");
    }

    const {
      organization_id,
      payment_reference,
      payment_status = "received",
      plan_id,
      student_limit,
      teacher_limit,
      activate_now = true,
    } = request.data;

    if (!organization_id) {
      throw invalidArgumentError("organization_id is required.");
    }
    if (!payment_reference || typeof payment_reference !== "string" || payment_reference.trim().length === 0) {
      throw invalidArgumentError("payment_reference is required (e.g. 'NEFT-8849201', 'Cheque-1022', 'Cash-Receipt-45').");
    }

    const orgRef = db.collection("organizations").doc(organization_id);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw notFoundError(`Organization '${organization_id}' not found.`);
    }

    const updatePayload: Record<string, any> = {
      payment_status,
      payment_reference: payment_reference.trim(),
      payment_confirmed_at: FieldValue.serverTimestamp(),
      activated_by: caller.uid,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (activate_now) {
      updatePayload.status = "active";
      updatePayload.subscription_status = "active";
    }

    if (plan_id) {
      updatePayload.plan_id = plan_id;
    }
    if (typeof student_limit === "number" && student_limit > 0) {
      updatePayload.student_limit = student_limit;
    }
    if (typeof teacher_limit === "number" && teacher_limit > 0) {
      updatePayload.teacher_limit = teacher_limit;
    }

    await orgRef.update(updatePayload);

    // Audit log
    await db.collection("admin_logs").add({
      action: "record_manual_payment",
      organization_id,
      payment_reference: payment_reference.trim(),
      payment_status,
      activated_by: caller.email || caller.uid,
      created_at: FieldValue.serverTimestamp(),
    });

    logger.info(`[recordManualPayment] Recorded payment for org ${organization_id} ref=${payment_reference} by ${caller.uid}`);
    return { success: true, organization_id, payment_status, status: activate_now ? "active" : orgSnap.data()?.status };
  }
);

export interface UpdateOrgSettingsPayload {
  organization_id: string;
  name?: string;
  tagline?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  primary_color?: string;
  secondary_color?: string;
  setup_checklist_dismissed?: boolean;
}

/**
 * 2c. updateOrganizationSettings
 * Allows an institutional Admin to update their own madrasa profile/branding.
 * Strictly prevents modification of platform quotas, status, and payment state.
 */
export const updateOrganizationSettings = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<UpdateOrgSettingsPayload>) => {
    const caller = await requireAuthenticatedUser(request);
    const { organization_id, ...settings } = request.data;

    if (!organization_id) {
      throw invalidArgumentError("organization_id is required.");
    }

    // Verify caller is admin of this organization OR super_admin
    if (caller.role !== "super_admin") {
      const membershipSnap = await db
        .collection("organization_memberships")
        .doc(`${organization_id}:${caller.uid}`)
        .get();

      if (!membershipSnap.exists) {
        throw permissionDeniedError("You are not a member of this organization.");
      }
      const mData = membershipSnap.data();
      if (!mData || (mData.role !== "admin" && mData.role !== "super_admin") || mData.status !== "active") {
        throw permissionDeniedError("Only active administrators of this madrasa can update settings.");
      }
    }

    const orgRef = db.collection("organizations").doc(organization_id);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw notFoundError(`Organization '${organization_id}' not found.`);
    }

    const allowedUpdates: Record<string, any> = {
      updated_at: FieldValue.serverTimestamp(),
    };

    if (typeof settings.name === "string" && settings.name.trim().length > 0) allowedUpdates.name = settings.name.trim();
    if (typeof settings.tagline === "string") allowedUpdates.tagline = settings.tagline.trim();
    if (typeof settings.logo_url === "string") allowedUpdates.logo_url = settings.logo_url.trim();
    if (typeof settings.phone === "string") allowedUpdates.phone = settings.phone.trim();
    if (typeof settings.email === "string") allowedUpdates.email = settings.email.trim();
    if (typeof settings.address === "string") allowedUpdates.address = settings.address.trim();
    if (typeof settings.city === "string") allowedUpdates.city = settings.city.trim();
    if (typeof settings.state === "string") allowedUpdates.state = settings.state.trim();
    if (typeof settings.country === "string") allowedUpdates.country = settings.country.trim();
    if (typeof settings.timezone === "string") allowedUpdates.timezone = settings.timezone.trim();
    if (typeof settings.primary_color === "string") allowedUpdates.primary_color = settings.primary_color.trim();
    if (typeof settings.secondary_color === "string") allowedUpdates.secondary_color = settings.secondary_color.trim();
    if (typeof settings.setup_checklist_dismissed === "boolean") allowedUpdates.setup_checklist_dismissed = settings.setup_checklist_dismissed;

    await orgRef.update(allowedUpdates);

    logger.info(`[updateOrganizationSettings] Org ${organization_id} settings updated by ${caller.uid}`);
    return { success: true, organization_id, updated: allowedUpdates };
  }
);

/**
 * 3. bulkImportStudents
 * Server-side validated bulk intake for student rosters.
 * Performs strict validation on format, uniqueness, and org membership.
 */
export const bulkImportStudents = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<BulkImportPayload>) => {
    const caller = await requireAuthenticatedUser(request);
    const { organization_id, students } = request.data;

    if (!organization_id || !Array.isArray(students) || students.length === 0) {
      throw invalidArgumentError("organization_id and a non-empty students list are required.");
    }

    // Verify caller is admin of this organization OR super_admin
    if (caller.role !== "super_admin") {
      const membershipSnap = await db
        .collection("organization_memberships")
        .doc(`${organization_id}:${caller.uid}`)
        .get();

      if (!membershipSnap.exists) {
        throw permissionDeniedError("You are not a member of this organization.");
      }
      const mData = membershipSnap.data();
      if (!mData || (mData.role !== "admin" && mData.role !== "super_admin") || mData.status !== "active") {
        throw permissionDeniedError("You must be an active administrator of this institution.");
      }
    }

    // Verify Organization is active
    const orgSnap = await db.collection("organizations").doc(organization_id).get();
    if (!orgSnap.exists) {
      throw notFoundError(`Organization '${organization_id}' not found.`);
    }
    const orgData = orgSnap.data();
    if (orgData?.status === "suspended" || orgData?.status === "archived") {
      throw permissionDeniedError(`Cannot import into ${orgData?.status} organization.`);
    }

    logger.info(`[bulkImportStudents] Importing ${students.length} rows for org=${organization_id} by=${caller.uid}`);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{7,15}$/;

    const rowErrors: Array<{ row: number; name: string; error: string }> = [];
    const validRows: BulkStudentRow[] = [];
    const seenIdentifiers = new Set<string>();

    for (let i = 0; i < students.length; i++) {
      const rowNum = i + 1;
      const row = students[i];

      if (!row.name || typeof row.name !== "string" || row.name.trim().length === 0) {
        rowErrors.push({ row: rowNum, name: "", error: "Missing required student name." });
        continue;
      }

      const cleanName = row.name.trim();
      const cleanEmail = row.email ? row.email.trim().toLowerCase() : "";
      const cleanPhone = row.phone ? row.phone.trim().replace(/[\s-]/g, "") : "";

      if (!cleanEmail && !cleanPhone) {
        rowErrors.push({ row: rowNum, name: cleanName, error: "At least one contact method (email or phone) is required." });
        continue;
      }

      if (cleanEmail && !emailRegex.test(cleanEmail)) {
        rowErrors.push({ row: rowNum, name: cleanName, error: `Invalid email format: '${cleanEmail}'.` });
        continue;
      }

      if (cleanPhone && !phoneRegex.test(cleanPhone)) {
        rowErrors.push({ row: rowNum, name: cleanName, error: `Invalid phone format: '${cleanPhone}'. Expected 7-15 digits.` });
        continue;
      }

      const identifierKey = cleanEmail || cleanPhone;
      if (seenIdentifiers.has(identifierKey)) {
        rowErrors.push({ row: rowNum, name: cleanName, error: `Duplicate in import file: '${identifierKey}'.` });
        continue;
      }
      seenIdentifiers.add(identifierKey);

      validRows.push({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        guardian_name: row.guardian_name ? row.guardian_name.trim() : "",
        guardian_phone: row.guardian_phone ? row.guardian_phone.trim() : "",
        course_id: row.course_id ? row.course_id.trim() : "",
        course_name: row.course_name ? row.course_name.trim() : "",
      });
    }

    // Process valid rows in batched chunks
    let importedCount = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const student of chunk) {
        // Deterministic synthetic student id for roster tracking
        const idSeed = (student.email || student.phone || `${Date.now()}_${Math.random()}`).replace(/[^a-z0-9]/gi, "_");
        const studentDocId = `student_${organization_id}_${idSeed}`;
        const studentRef = db.collection("users").doc(studentDocId);

        batch.set(
          studentRef,
          {
            uid: studentDocId,
            name: student.name,
            email: student.email || "",
            phone: student.phone || "",
            guardian_name: student.guardian_name || "",
            guardian_phone: student.guardian_phone || "",
            role: "student",
            status: "approved",
            organization_id,
            imported_by: caller.uid,
            imported_at: FieldValue.serverTimestamp(),
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Provision organization membership
        const membershipRef = db.collection("organization_memberships").doc(`${organization_id}:${studentDocId}`);
        batch.set(
          membershipRef,
          {
            organization_id,
            user_id: studentDocId,
            role: "student",
            status: "active",
            joined_at: FieldValue.serverTimestamp(),
            created_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Optional class enrollment
        if (student.course_id) {
          const enrollmentRef = db.collection("enrollments").doc(`${studentDocId}:${student.course_id}`);
          batch.set(
            enrollmentRef,
            {
              user_id: studentDocId,
              course_id: student.course_id,
              organization_id,
              status: "active",
              user_name: student.name,
              user_email: student.email || "",
              course_name: student.course_name || "",
              enrolled_at: FieldValue.serverTimestamp(),
              created_at: FieldValue.serverTimestamp(),
              updated_at: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        importedCount++;
      }

      await batch.commit();
    }

    logger.info(`[bulkImportStudents] Completed org=${organization_id}: total=${students.length} imported=${importedCount} errors=${rowErrors.length}`);

    return {
      success: true,
      total_rows: students.length,
      imported_count: importedCount,
      failed_count: rowErrors.length,
      errors: rowErrors,
    };
  }
);

/**
 * 4. inviteUserToOrganization
 * Securely generate an institutional invitation link or record.
 */
export const inviteUserToOrganization = onCall(
  { region: "us-central1" },
  async (request: https.CallableRequest<InviteUserPayload>) => {
    const caller = await requireAuthenticatedUser(request);
    const { organization_id, email, phone, name, role } = request.data;

    if (!organization_id || !name || !role) {
      throw invalidArgumentError("organization_id, name, and role are required.");
    }

    if (!email && !phone) {
      throw invalidArgumentError("Either email or phone is required for invitation.");
    }

    // Role safety: caller cannot create super_admin via invitation
    if ((role as string) === "super_admin") {
      throw permissionDeniedError("Cannot invite platform super_admins.");
    }


    // Verify caller is admin of this organization OR super_admin
    if (caller.role !== "super_admin") {
      const membershipSnap = await db
        .collection("organization_memberships")
        .doc(`${organization_id}:${caller.uid}`)
        .get();

      if (!membershipSnap.exists || membershipSnap.data()?.role !== "admin") {
        throw permissionDeniedError("Only organization admins can issue invitations.");
      }
    }

    const inviteRef = await db.collection("organization_invitations").add({
      organization_id,
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : "",
      phone: phone ? phone.trim() : "",
      role,
      status: "pending",
      invited_by: caller.uid,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      created_at: FieldValue.serverTimestamp(),
    });

    logger.info(`[inviteUserToOrganization] Created invite ${inviteRef.id} for ${email || phone} to org ${organization_id}`);
    return { success: true, invite_id: inviteRef.id, organization_id, role };
  }
);
