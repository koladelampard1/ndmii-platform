export type VerificationProvider = "NIN" | "BVN" | "CAC" | "TIN";
export type VerificationState = "verified" | "pending" | "failed" | "mismatch";

export type VerificationResult = {
  provider: VerificationProvider;
  identifier: string;
  status: VerificationState;
  message: string;
  summary: string;
  checkedAt: string;
};

function deterministicStatus(identifier: string): VerificationState {
  if (!identifier || identifier.length < 6) return "failed";
  const seed = identifier.charCodeAt(identifier.length - 1) % 10;
  if (seed <= 5) return "verified";
  if (seed === 6 || seed === 7) return "mismatch";
  if (seed === 8) return "pending";
  return "failed";
}

export async function verifyWithAdapter(provider: VerificationProvider, identifier: string): Promise<VerificationResult> {
  const status = deterministicStatus(identifier);

  const message =
    status === "verified"
      ? `${provider} simulation verified`
      : status === "pending"
        ? `${provider} validation queued for additional checks`
        : status === "mismatch"
          ? `${provider} submission details mismatch reference records`
          : `${provider} simulation failed due to insufficient data integrity`;

  return {
    provider,
    identifier,
    status,
    message,
    summary: `${provider}: ${status.toUpperCase()} - ${message}`,
    checkedAt: new Date().toISOString(),
  };
}
