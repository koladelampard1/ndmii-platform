export type PassportPhotoValueType = "storage_path" | "public_url" | "null";

export type PassportPhotoDiagnosticPayload = {
  msmeId?: string | null;
  persistedColumn?: "passport_photo_path" | "passport_photo_url" | "none";
  hasPassportValue: boolean;
  valueType: PassportPhotoValueType;
  signedUrlGenerated?: boolean;
  renderFallback?: boolean;
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
