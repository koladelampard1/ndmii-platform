export type VerificationProvider = "NIN" | "BVN" | "CAC" | "TIN";
export type VerificationState = "verified" | "pending" | "failed" | "mismatch";

export type VerificationResult = {
  provider: VerificationProvider;
  identifier: string;
  status: VerificationState;
  message: string;
};

function deterministicStatus(identifier: string): VerificationState {
  if (!identifier || identifier.length < 6) return "failed";
  const seed = identifier.charCodeAt(identifier.length - 1) % 10;
  if (seed <= 4) return "verified";
  if (seed <= 6) return "pending";
  if (seed <= 8) return "mismatch";
  return "failed";
}

export async function verifyWithAdapter(provider: VerificationProvider, identifier: string): Promise<VerificationResult> {
  const status = deterministicStatus(identifier);
  return {
    provider,
    identifier,
    status,
    message:
      status === "verified"
        ? `${provider} simulation verified`
        : status === "pending"
          ? `${provider} check queued for review`
          : status === "mismatch"
            ? `${provider} details mismatch with submission`
            : `${provider} simulation failed`,
  };
}
