import { PublicPageShell } from "@/components/public/public-page-shell";

export default function CookiesPage() {
  return (
    <PublicPageShell
      eyebrow="Cookie Notice"
      title="Cookie and session use on BIN"
      description="BIN uses essential cookies to keep users signed in, route them to the correct role dashboard, and protect route access with middleware controls."
      primaryCta={{ label: "Open verification portal", href: "/verify" }}
      secondaryCta={{ label: "Back to homepage", href: "/" }}
      highlights={[
        "Essential session cookies help preserve authentication state and role-specific access decisions.",
        "Security-focused middleware checks route permissions on each request before serving protected pages.",
        "Analytics cookies may be used to understand navigation patterns and improve civic-tech usability.",
        "Users can clear non-essential cookies in browser settings without affecting publicly available pages.",
      ]}
    />
  );
}
