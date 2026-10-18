export const INSTITUTION_MEMBER_ROLES = [
  "institution_admin",
  "institution_officer",
  "institution_reviewer",
  "institution_agent",
] as const;
export type InstitutionMemberRole = (typeof INSTITUTION_MEMBER_ROLES)[number];
export const INSTITUTION_TYPES = [
  "federal_agency", "state_government", "lga", "association", "private_company",
  "development_finance_institution", "microfinance_bank", "finance_company", "investor",
  "technical_partner", "programme_secretariat", "regulator",
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function canManageMember(input: {
  platformAdmin: boolean;
  actorRole: string | null;
  targetRole: string;
  actorUserId: string;
  targetUserId: string;
  action: "invite" | "revoke" | "suspend" | "reactivate";
}) {
  if (!input.platformAdmin && input.actorRole !== "institution_admin") return false;
  if (!INSTITUTION_MEMBER_ROLES.includes(input.targetRole as InstitutionMemberRole)) return false;
  if (!input.platformAdmin && input.targetRole === "institution_admin") return false;
  if (input.actorUserId === input.targetUserId && input.action !== "invite") return false;
  return true;
}

export function canSeeAgentQueue(input: {
  role: string;
  membershipStatus: string;
  expiresAt: string | null;
  profileInstitutionId: string | null;
  institutionId: string;
  now?: number;
}) {
  return input.role === "institution_agent" &&
    input.membershipStatus === "active" &&
    (!input.expiresAt || Date.parse(input.expiresAt) > (input.now ?? Date.now())) &&
    input.profileInstitutionId === input.institutionId;
}

export function parseServiceStates(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 37) return null;
  const states = value.map((state) => typeof state === "string" ? state.trim() : "");
  if (states.some((state) => !/^[A-Za-z][A-Za-z\s-]{1,79}$/.test(state))) return null;
  return [...new Set(states)];
}
