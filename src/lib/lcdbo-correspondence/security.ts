import crypto from "node:crypto";

const CSV_FORMULA_PREFIX = /^[=+\-@]/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?234|0)[\s-]?[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/g;
const NIN_BVN = /\b(?:\d{11}|\d{10})\b/g;

export function sanitizePublicCorrespondenceText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(EMAIL, "[redacted email]")
    .replace(PHONE, "[redacted phone]")
    .replace(NIN_BVN, "[redacted identifier]")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeCsvValue(value: unknown) {
  const raw = String(value ?? "");
  const neutralized = CSV_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

export function sha256Hex(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createVerificationToken(reference: string, documentHash: string) {
  return crypto
    .createHash("sha256")
    .update(`${reference}:${documentHash}:${process.env.LCDBO_CORRESPONDENCE_VERIFICATION_SALT ?? "dbin-correspondence"}`)
    .digest("hex")
    .slice(0, 32);
}

export function normalizeVerificationInput(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .slice(0, 120);
}
