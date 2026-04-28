export function isFeatureEnabled(flagValue: string | undefined): boolean {
  if (!flagValue) return false;
  const normalized = flagValue.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}
