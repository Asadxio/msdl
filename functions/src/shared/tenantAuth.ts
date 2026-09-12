/**
 * MSLB Multi-Tenant Authorization Boundary Helpers
 * 
 * Enforces canonical security model:
 * AUTHENTICATED USER
 *         ↓
 * AUTHORITATIVE MEMBERSHIP (organization_memberships/{orgId}_{uid})
 *         ↓
 * TENANT ROLE
 *         ↓
 * ORGANIZATION STATUS (active | trial vs suspended | archived)
 *         ↓
 * RESOURCE OWNERSHIP
 *         ↓
 * ACTION
 */

import { db } from "../config/admin";
import { permissionDeniedError, notFoundError, unauthenticatedError } from "./errors";
import { logger } from "firebase-functions/v2";

export type TenantRole = "student" | "teacher" | "assistant_teacher" | "moderator" | "admin" | "super_admin";
export type OrgStatus = "trial" | "active" | "suspended" | "archived";

export interface TenantMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: TenantRole;
  status: "active" | "suspended";
  created_at?: any;
  updated_at?: any;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  status: OrgStatus;
  plan_id?: string;
  student_limit?: number;
  teacher_limit?: number;
}

/**
 * Super Admin check — platform level authority only
 */
export function isSuperAdminEmail(email?: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean === "sumraftm@gmail.com" || clean === "xioasad@gmail.com";
}

/**
 * Fetch and verify organization operational status.
 * Throws permissionDeniedError if suspended or archived.
 */
export async function assertOrgOperational(organizationId: string, allowReadOnlyIfSuspended: boolean = false): Promise<OrganizationRecord> {
  if (!organizationId) {
    throw permissionDeniedError("Missing organization identifier.");
  }

  const orgDoc = await db.collection("organizations").doc(organizationId).get();
  if (!orgDoc.exists) {
    if (organizationId === "mslb-main") {
      return { id: "mslb-main", name: "Madrasatu-s-Salikat Lil Banat", status: "active" };
    }
    throw notFoundError(`Organization '${organizationId}' not found.`);
  }

  const data = orgDoc.data() as OrganizationRecord;
  const status: OrgStatus = data.status || "active";

  if (status === "archived") {
    throw permissionDeniedError(`Organization '${organizationId}' is archived.`);
  }

  if (status === "suspended" && !allowReadOnlyIfSuspended) {
    throw permissionDeniedError(`Organization '${organizationId}' is suspended. Write mutations are blocked.`);
  }

  return data;
}

/**
 * Verifies that the caller has an active, authoritative membership in the target organization
 * and possesses one of the allowed roles.
 */
export async function assertTenantMember(
  callerUid: string,
  callerEmail: string | undefined,
  organizationId: string,
  allowedRoles: TenantRole[]
): Promise<TenantMembership> {
  if (!callerUid) {
    throw unauthenticatedError();
  }

  // Super Admin platform override
  if (isSuperAdminEmail(callerEmail)) {
    await assertOrgOperational(organizationId, true);
    return {
      id: `${organizationId}_${callerUid}`,
      organization_id: organizationId,
      user_id: callerUid,
      role: "super_admin",
      status: "active",
    };
  }

  // 1. Check organization operational status
  await assertOrgOperational(organizationId, false);

  // 2. Query authoritative membership
  const canonicalId = `${organizationId}_${callerUid}`;
  let memberDoc = await db.collection("organization_memberships").doc(canonicalId).get();

  if (!memberDoc.exists) {
    const legacyId = `${organizationId}:${callerUid}`;
    memberDoc = await db.collection("organization_memberships").doc(legacyId).get();
  }

  if (!memberDoc.exists) {
    // Fallback: If legacy user in mslb-main and has role in users/{uid}
    if (organizationId === "mslb-main") {
      const userSnap = await db.collection("users").doc(callerUid).get();
      if (userSnap.exists) {
        const uData = userSnap.data()!;
        const legacyRole = (uData.role || "student") as TenantRole;
        const legacyStatus = uData.status || "pending";
        if (legacyStatus === "approved" || legacyStatus === "active") {
          if (allowedRoles.includes(legacyRole) || (allowedRoles.includes("admin" as any) && legacyRole === "super_admin")) {
            return {
              id: canonicalId,
              organization_id: "mslb-main",
              user_id: callerUid,
              role: legacyRole,
              status: "active",
            };
          }
        }
      }
    }
    logger.warn(`[assertTenantMember] Denied: uid=${callerUid} not a member of org=${organizationId}`);
    throw permissionDeniedError(`You are not an active member of organization '${organizationId}'.`);
  }

  const membership = memberDoc.data() as TenantMembership;

  if (membership.status !== "active") {
    throw permissionDeniedError("Your membership in this organization is suspended or inactive.");
  }

  if (!allowedRoles.includes(membership.role)) {
    logger.warn(`[assertTenantMember] Denied: uid=${callerUid} role=${membership.role} not in [${allowedRoles.join(",")}]`);
    throw permissionDeniedError(`Insufficient organization role: requires [${allowedRoles.join(", ")}].`);
  }

  return membership;
}

/**
 * Asserts that a target resource belongs to the authoritative organization.
 */
export function assertTenantResourceOwnership(
  resource: { organization_id?: string },
  expectedOrgId: string
): void {
  const resourceOrgId = resource.organization_id || "mslb-main";
  if (resourceOrgId !== expectedOrgId) {
    throw permissionDeniedError(`Resource belongs to organization '${resourceOrgId}', not '${expectedOrgId}'.`);
  }
}
