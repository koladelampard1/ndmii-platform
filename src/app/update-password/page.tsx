"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function UpdatePasswordPageContent() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstLogin = searchParams.get("firstLogin") === "1";
  const requestedWorkspace = searchParams.get("workspace");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data: currentUserData } = await supabase.auth.getUser();
    const existingMetadata = currentUserData.user?.user_metadata ?? {};
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        ...existingMetadata,
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      setLoading(false);
      setError(
        updateError.message ||
          "Unable to update password. Please use the latest link from your email and try again.",
      );
      return;
    }

    await supabase.auth.signOut();

    setLoading(false);
    setSuccess("Password updated successfully. You can now sign in with your new password.");

    setTimeout(() => {
      const loginParams = new URLSearchParams({ message: "Password updated. Please sign in." });
      if (requestedWorkspace) loginParams.set("workspace", requestedWorkspace);
      const returnTo = searchParams.get("returnTo");
      const next = searchParams.get("next");
      if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) loginParams.set("returnTo", returnTo);
      if (next?.startsWith("/") && !next.startsWith("//")) loginParams.set("next", next);
      router.replace(`/login?${loginParams.toString()}`);
      router.refresh();
    }, 1200);
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-6 py-16">
      <FormWrapper title="Create your new password">
        <p className="text-sm text-slate-600">
          {firstLogin
            ? "For security, replace your temporary UAT password before entering the workspace."
            : "This page is opened from your secure email link. Set a strong password to activate account access."}
        </p>

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="New password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Confirm new password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {success && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p>}
          {error && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}

          <Button className="w-full" disabled={loading}>
            {loading ? "Updating password..." : "Update password"}
          </Button>
        </form>

        <p className="text-sm text-slate-600">
          Need another link? <Link href="/reset-password" className="text-emerald-700 hover:underline">Request password setup</Link>
        </p>
      </FormWrapper>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16 text-sm text-slate-600">Preparing secure password setup…</main>}>
      <UpdatePasswordPageContent />
    </Suspense>
  );
}
