export type InstitutionMembership = {
  institution_id: string;
  user_id: string;
  role: string;
  status: string;
  expires_at: string | null;
};

export type InstitutionAccessDecision =
  | { allowed: true; role: string }
  | { allowed: false; reason: "missing_membership" | "inactive_membership" | "expired_membership" | "role_denied" };

/** An institution role is never inferred from a user's global DBIN role. */
export function decideInstitutionAccess(input: {
  institutionId: string;
  userId: string;
  membership: InstitutionMembership | null;
  allowedRoles: readonly string[];
  now?: Date;
}): InstitutionAccessDecision {
  const { institutionId, userId, membership, allowedRoles, now = new Date() } = input;
  if (!membership || membership.institution_id !== institutionId || membership.user_id !== userId) {
    return { allowed: false, reason: "missing_membership" };
  }
  if (membership.status !== "active") return { allowed: false, reason: "inactive_membership" };
  if (membership.expires_at && (!Number.isFinite(Date.parse(membership.expires_at)) || Date.parse(membership.expires_at) <= now.getTime())) {
    return { allowed: false, reason: "expired_membership" };
  }
  if (!allowedRoles.includes(membership.role)) return { allowed: false, reason: "role_denied" };
  return { allowed: true, role: membership.role };
}
