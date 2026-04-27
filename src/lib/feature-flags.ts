export const FEATURE_FINANCE_READINESS = "FEATURE_FINANCE_READINESS" as const;

function resolveFlag(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on", "enabled"].includes(value.toLowerCase());
}

export function isFeatureEnabled(flag: string) {
  return resolveFlag(process.env[flag]);
}
