export type DelegationWindow = {
  starts_at: string;
  expires_at: string | null;
  status: string;
  delegator_id: string;
  delegate_id: string;
  organisation?: string | null;
};

export function isDelegationActive(delegation: DelegationWindow, now = new Date()) {
  if (delegation.status !== "active") return false;
  const startsAt = new Date(delegation.starts_at).getTime();
  if (Number.isNaN(startsAt) || startsAt > now.getTime()) return false;
  if (!delegation.expires_at) return true;
  const expiresAt = new Date(delegation.expires_at).getTime();
  return !Number.isNaN(expiresAt) && expiresAt > now.getTime();
}

export function assertDelegationIsSafe(delegation: DelegationWindow, now = new Date()) {
  if (delegation.delegator_id === delegation.delegate_id) throw new Error("Delegator and delegate must be different users.");
  if (!isDelegationActive(delegation, now)) throw new Error("Delegation is not active for the requested signing window.");
  return true;
}
