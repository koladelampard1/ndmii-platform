"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";
import { isValidEmailAddress, normalizeEmail } from "@/lib/auth/email-validation";

type ResetPasswordApiResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  debug?: Record<string, unknown>;
};

const isDev = process.env.NODE_ENV !== "production";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDebug(null);

    const normalizedEmail = normalizeEmail(email);
    const redirectTo = `${window.location.origin}/update-password`;

    if (!isValidEmailAddress(normalizedEmail)) {
      setLoading(false);
      setError(`Email address '${normalizedEmail}' is invalid.`);
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        redirectTo,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as ResetPasswordApiResponse;

    if (!response.ok || !result.ok) {
      setLoading(false);
      setError(result.error || "Unable to send password setup link. Please try again.");
      if (isDev && result.debug) {
        setDebug(result.debug);
      }
      return;
    }

    setLoading(false);
    setSuccess(result.message || "Password setup link sent. Check your inbox and follow the secure link.");
    if (isDev && result.debug) {
      setDebug(result.debug);
    }
    setEmail("");
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-6 py-16">
      <FormWrapper title="Set up or reset your password">
        <p className="text-sm text-slate-600">
          Enter the email used during MSME onboarding. We&apos;ll send a secure link so you can set your password.
        </p>

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {success && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p>}
          {error && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
          {isDev && debug && (
            <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              {JSON.stringify(debug, null, 2)}
            </pre>
          )}

          <Button className="w-full" disabled={loading}>
            {loading ? "Sending link..." : "Send password setup link"}
          </Button>
        </form>

        <p className="text-sm text-slate-600">
          Back to <Link href="/login" className="text-emerald-700 hover:underline">Sign in</Link>
        </p>
      </FormWrapper>
    </main>
  );
}
