export type VerificationProvider = "NIN" | "BVN" | "CAC" | "TIN";

export type VerificationResult = {
  provider: VerificationProvider;
  identifier: string;
  valid: boolean;
  message: string;
};

export async function verifyWithAdapter(provider: VerificationProvider, identifier: string): Promise<VerificationResult> {
  const valid = identifier.length >= 8;
  return {
    provider,
    identifier,
    valid,
    message: valid ? `${provider} simulation passed` : `${provider} simulation failed`,
  };
}
