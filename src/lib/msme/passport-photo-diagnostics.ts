export type PassportPhotoValueType = "storage_path" | "public_url" | "null";

export type PassportPhotoDiagnosticPayload = {
  route?: string;
  msmeId?: string | null;
  persistedColumn?: "passport_photo_path" | "passport_photo_url" | "none";
  hasPassportPath?: boolean;
  hasPassportValue: boolean;
  valueType: PassportPhotoValueType;
  signedUrlGenerated?: boolean;
  passportPhotoUrlPassed?: boolean;
  renderFallback?: boolean;
  imageComponentReceivedUrl?: boolean;
  supabaseError?: {
    code?: string | null;
    message?: string | null;
  } | null;
};

export function classifyPassportPhotoValue(value: string | null | undefined): PassportPhotoValueType {
  const normalized = value?.trim();
  if (!normalized) return "null";
  if (/^https?:\/\//i.test(normalized)) return "public_url";
  return "storage_path";
}

export function logPassportPhotoDiagnostic(event: string, payload: PassportPhotoDiagnosticPayload) {
  console.info(`[msme-passport-photo][${event}]`, payload);
}
