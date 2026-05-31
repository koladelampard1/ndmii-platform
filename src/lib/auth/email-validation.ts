const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const INVISIBLE_EMAIL_FORMAT_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/gu;

export function normalizeEmail(rawEmail: string) {
  return rawEmail.replace(INVISIBLE_EMAIL_FORMAT_CHARACTERS, "").trim().toLowerCase();
}

export function isValidEmailAddress(rawEmail: string) {
  const email = normalizeEmail(rawEmail);

  if (!email || email.length > 254) return false;
  if (email.startsWith(".") || email.endsWith(".")) return false;

  return SIMPLE_EMAIL_PATTERN.test(email);
}
