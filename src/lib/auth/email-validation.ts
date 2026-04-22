const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeEmail(rawEmail: string) {
  return rawEmail.trim().toLowerCase();
}

export function isValidEmailAddress(rawEmail: string) {
  const email = normalizeEmail(rawEmail);

  if (!email || email.length > 254) return false;
  if (email.startsWith(".") || email.endsWith(".")) return false;

  return SIMPLE_EMAIL_PATTERN.test(email);
}
