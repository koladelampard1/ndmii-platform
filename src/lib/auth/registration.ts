export type RegistrationMode = "demo" | "production";

export function getRegistrationMode(): RegistrationMode {
  const configuredMode = (
    process.env.NDMII_REGISTRATION_MODE
    ?? process.env.NEXT_PUBLIC_REGISTRATION_MODE
    ?? ""
  )
    .trim()
    .toLowerCase();

  if (configuredMode === "demo" || configuredMode === "local") {
    return "demo";
  }

  if (configuredMode === "production") {
    return "production";
  }

  return process.env.NODE_ENV === "production" ? "production" : "demo";
}

export function mapRegistrationErrorMessage(rawMessage: string) {
  const message = rawMessage.toLowerCase();

  if (
    message.includes("already registered")
    || message.includes("user already registered")
    || message.includes("duplicate key")
    || message.includes("already linked")
  ) {
    return "This email is already registered. Sign in or use a different email address.";
  }

  if (message.includes("password") && (message.includes("weak") || message.includes("6 characters") || message.includes("8 characters"))) {
    return "Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.";
  }

  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("over_email_send_rate_limit")) {
    return "Too many registration attempts. Please wait a moment and try again.";
  }

  if (message.includes("smtp") || message.includes("email") || message.includes("confirmation")) {
    return "Unable to deliver verification email right now. Please retry shortly or contact support.";
  }

  if (message.includes("profile") || message.includes("users")) {
    return "Account created, but profile sync failed. Please contact support for quick recovery.";
  }

  return "We could not complete registration right now. Please try again.";
}
