const ENABLED_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

export function isFeatureEnabled(flagName: string, fallback = false): boolean {
  const rawValue = process.env[flagName];
  if (typeof rawValue !== "string") {
    return fallback;
  }

  return ENABLED_VALUES.has(rawValue.trim().toLowerCase());
}
