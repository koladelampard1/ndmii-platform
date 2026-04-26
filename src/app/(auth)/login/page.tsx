"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ShieldUser, Building2, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { inferRoleFromEmail, resolveOrCreateUserProfile } from "@/lib/auth/profile";
import { getDefaultDashboardRoute, normalizeUserRole } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

function LoginPageContent() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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

    let role: UserRole = "public";
    let appUserId: string | null = null;

    try {
      const profile = await resolveOrCreateUserProfile(supabase, {
        authUserId: signInData.user.id,
        email: signInData.user.email ?? email,
      });
      role = normalizeUserRole(profile?.role, "public");
      appUserId = profile?.id ?? null;
    } catch (profileError) {
      console.error("Unable to resolve user profile during login", profileError);
    }

    if (role === "public") {
      role = inferRoleFromEmail(signInData.user.email ?? email);
    }

    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, email: signInData.user.email ?? email, userId: signInData.user.id, appUserId }),
    });

    const targetRoute = role === "msme" ? "/dashboard/msme" : getDefaultDashboardRoute(role);
    if (process.env.NODE_ENV !== "production") {
      console.info("[login-role-resolution]", {
        authenticatedEmail: signInData.user.email ?? email,
        resolvedRole: role,
        authUserId: signInData.user.id,
        appUserId,
        targetRoute,
      });
    }

    setLoading(false);
    setMessage("Authentication successful. Redirecting to your dashboard...");
    router.replace(targetRoute);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Digital Business Identity Network (DBIN)
          </Link>
          <nav className="flex w-full flex-wrap items-center gap-2 text-xs text-slate-700 sm:w-auto sm:gap-4 sm:text-sm">
            <Link href="/marketplace" className="transition hover:text-emerald-700">Marketplace</Link>
            <Link href="/verify" className="transition hover:text-emerald-700">Verify Business ID</Link>
            <Link href="/resources" className="transition hover:text-emerald-700">Resources</Link>
            <Link href="/partners" className="transition hover:text-emerald-700">Partners</Link>
            <Link href="/about" className="transition hover:text-emerald-700">About</Link>
            <Link href="/contact" className="transition hover:text-emerald-700">Contact</Link>
            <Link href="/register">
              <Button size="sm" variant="secondary">Register</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-4 sm:px-6 sm:py-10 lg:grid-cols-12 lg:gap-0 lg:px-8 lg:py-12">
        <aside className="overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-6 text-emerald-50 shadow-lg lg:col-span-4 lg:rounded-r-none lg:p-10">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-200">DBIN</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
                Welcome to
                {" "}
                <span className="text-emerald-300">Digital Business Identity Network (DBIN)</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-100/90 sm:text-base">
                Your trusted platform for business identity verification, secure participation, and compliance-ready growth across Nigeria.
              </p>
            </div>

            <ul className="space-y-4 text-sm sm:text-base">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-emerald-500/20 p-2"><ShieldCheck className="h-4 w-4 text-emerald-200" /></span>
                <div>
                  <p className="font-semibold text-white">Secure &amp; Verified</p>
                  <p className="text-emerald-100/80">Industry-grade identity controls and data protection.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-emerald-500/20 p-2"><ShieldUser className="h-4 w-4 text-emerald-200" /></span>
                <div>
                  <p className="font-semibold text-white">Role-Based Access</p>
                  <p className="text-emerald-100/80">Dashboards and workflows tailored to each stakeholder role.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-emerald-500/20 p-2"><Building2 className="h-4 w-4 text-emerald-200" /></span>
                <div>
                  <p className="font-semibold text-white">Trusted Network</p>
                  <p className="text-emerald-100/80">Connect with verified businesses, institutions, and associations.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-emerald-500/20 p-2"><BadgeCheck className="h-4 w-4 text-emerald-200" /></span>
                <div>
                  <p className="font-semibold text-white">Compliance Ready</p>
                  <p className="text-emerald-100/80">Built to support transparent, regulator-aligned operations.</p>
                </div>
              </li>
            </ul>
          </div>
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:col-span-8 lg:rounded-l-none lg:p-12">
          <div className="mx-auto w-full max-w-2xl">
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Sign in to your account</h2>
            <p className="mt-2 text-slate-600">Access your dashboard and manage your business identity.</p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Email address</span>
                <span className="flex items-center rounded-md border border-slate-300 bg-white px-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <input
                    className="w-full border-0 bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none"
                    placeholder="Enter your email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </span>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <span className="flex items-center rounded-md border border-slate-300 bg-white px-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <input
                    className="w-full border-0 bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="text-slate-500 transition hover:text-slate-700"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="inline-flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  Remember me
                </label>
                <Link href="/reset-password" className="font-medium text-emerald-700 hover:underline">Forgot password?</Link>
              </div>

              {message && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
              {error && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}

              <Button className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              New to DBIN?
              {" "}
              <Link href="/register" className="font-semibold text-emerald-700 hover:underline">Start onboarding your business</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100" />}>
      <LoginPageContent />
    </Suspense>
  );
}
