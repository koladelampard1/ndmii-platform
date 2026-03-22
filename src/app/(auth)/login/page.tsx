"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DEMO_USERS = [
  { email: "admin@ndmii.gov.ng", role: "admin" },
  { email: "reviewer@ndmii.gov.ng", role: "reviewer" },
  { email: "officer@fccpc.gov.ng", role: "fccpc_officer" },
  { email: "officer@firs.gov.ng", role: "firs_officer" },
  { email: "assoc.lagos@ndmii.ng", role: "association_officer" },
  { email: "msme.demo@ndmii.ng", role: "msme" },
] as const;

const DEMO_PASSWORD = "Demo@123456";

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>(DEMO_USERS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(searchParams.get("message"));
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      setLoading(false);
      setError(signInError?.message || "Unable to sign in. Please verify your credentials.");
      return;
    }

    const { data: roleRow } = await supabase.from("users").select("id,role").eq("email", email).maybeSingle();
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleRow?.role ?? "public", email, userId: signInData.user.id, appUserId: roleRow?.id ?? null }),
    });

    setLoading(false);
    setMessage("Authentication successful. Redirecting to your dashboard...");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-6 py-16">
      <FormWrapper title="Sign in to NDMII">
        <form className="space-y-3" onSubmit={onSubmit}>
          <input className="w-full rounded border px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {message && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
        </form>
        <p className="text-sm text-slate-600">New MSME? <Link href="/register" className="text-emerald-700 hover:underline">Start onboarding</Link></p>
      </FormWrapper>

      {process.env.NODE_ENV !== "production" && (
        <section className="rounded-lg border bg-slate-50 p-4 text-xs">
          <p className="font-semibold text-slate-700">Developer Demo Credentials</p>
          <p className="mt-1 text-slate-500">Password for all demo users: <span className="font-mono">{DEMO_PASSWORD}</span></p>
          <ul className="mt-2 space-y-1 text-slate-700">
            {DEMO_USERS.map((user) => (
              <li key={user.email}><span className="font-mono">{user.email}</span> — {user.role}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
