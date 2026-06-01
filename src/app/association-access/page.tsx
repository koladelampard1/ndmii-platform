"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Summary = { fullName: string | null; businessName: string | null; tradeType: string | null; lga: string | null; associationName: string | null };

export default function AssociationAccessPage() {
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loginEmailAvailable, setLoginEmailAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  async function continueWithPin(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/association-access/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, pin }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "Unable to continue.");
    setSetupToken(data.setupToken); setSummary(data.member);
  }

  async function createPassword(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirmPassword) return setError("The two passwords do not match.");
    setLoading(true);
    const response = await fetch("/api/association-access/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupToken, password }) });
    const data = await response.json();
    if (!response.ok) { setLoading(false); return setError(data.error ?? "Unable to create your password."); }
    const supabase = createSupabaseBrowserClient();
    const credentials = identifier.trim().includes("@")
      ? { email: identifier.trim().toLowerCase(), password }
      : { phone: identifier.trim(), password };
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
    if (!signInError && signInData.session) {
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accessToken: signInData.session.access_token,
          refreshToken: signInData.session.refresh_token,
          expiresAt: signInData.session.expires_at ?? null,
        }),
      });
      if (sessionResponse.ok) {
        window.location.assign(data.redirectTo ?? "/dashboard/msme");
        return;
      }
    }
    setLoading(false);
    setLoginEmailAvailable(Boolean(data.loginEmailAvailable)); setDone(true);
  }

  return <main className="min-h-screen bg-slate-100 px-4 py-8"><section className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-8"><Link href="/"><DbinBrandLogo textClassName="text-slate-900" /></Link>
    <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Association member access</p>
    {done ? <><h1 className="mt-2 text-3xl font-black">Your account is ready</h1><p className="mt-3 text-slate-600">{loginEmailAvailable ? "Your password has been saved. Sign in to open your dashboard." : "Your password has been saved. Contact the DBIN support team if you need help signing in."}</p><Link href="/login" className="mt-6 block rounded-xl bg-emerald-700 px-4 py-4 text-center text-lg font-black text-white">Go to sign in</Link></> :
    summary ? <><h1 className="mt-2 text-3xl font-black">Create your password</h1><p className="mt-3 text-slate-600">Check your details, then choose a password only you know.</p><div className="mt-5 space-y-2 rounded-xl bg-emerald-50 p-4 text-sm"><p><strong>Name:</strong> {summary.fullName}</p><p><strong>Business:</strong> {summary.businessName}</p><p><strong>Trade:</strong> {summary.tradeType}</p><p><strong>Association:</strong> {summary.associationName}</p></div><form onSubmit={createPassword} className="mt-5 space-y-4"><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className="w-full rounded-xl border px-4 py-4 text-lg" /><input type="password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type the password again" className="w-full rounded-xl border px-4 py-4 text-lg" /><button disabled={loading} className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-black text-white disabled:opacity-50">{loading ? "Please wait..." : "Save my password"}</button></form></> :
    <><h1 className="mt-2 text-3xl font-black">Open your account</h1><p className="mt-3 text-slate-600">Enter your phone number or email and the 6-digit PIN given to you.</p><form onSubmit={continueWithPin} className="mt-6 space-y-4"><input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Phone number or email" className="w-full rounded-xl border px-4 py-4 text-lg" /><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\\D/g, ""))} placeholder="6-digit PIN" className="w-full rounded-xl border px-4 py-4 text-lg tracking-[0.35em]" /><button disabled={loading} className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-black text-white disabled:opacity-50">{loading ? "Checking..." : "Continue"}</button></form></>}
    {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</p>}
    <p className="mt-6 text-sm text-slate-500">Need help? Ask your association officer or the DBIN support team.</p>
  </section></main>;
}
