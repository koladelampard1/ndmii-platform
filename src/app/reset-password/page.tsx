"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const redirectTo = `${window.location.origin}/update-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    if (resetError) {
      setLoading(false);
      setError(resetError.message || "Unable to send password setup link. Please try again.");
      return;
    }

    setLoading(false);
    setSuccess(
      "Password setup link sent. Check your inbox and follow the secure link to complete account setup.",
    );
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
