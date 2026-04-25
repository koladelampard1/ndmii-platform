"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveOrCreateUserProfile } from "@/lib/auth/profile";
import { mapRegistrationErrorMessage } from "@/lib/auth/registration";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FieldErrors = Partial<Record<"email" | "password" | "business_name" | "owner_name" | "state" | "sector", string>>;

type RegistrationFormValues = {
  email: string;
  password: string;
  business_name: string;
  owner_name: string;
  state: string;
  sector: string;
  business_type: string;
  contact_phone: string;
  lga: string;
  address: string;
  nin: string;
  bvn: string;
  cac_number: string;
  tin: string;
};

type ExistingUserByEmail = {
  id: string;
  email: string | null;
  role: string | null;
};

type ExistingUserRecord = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

function getExistingUserRole(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const role = (user as ExistingUserRecord).role;
  return typeof role === "string" ? role : null;
}

const REGISTRATION_MODE =
  process.env.NEXT_PUBLIC_REGISTRATION_MODE?.toLowerCase() === "production"
    ? "production"
    : "demo";

export default function RegisterPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const values: RegistrationFormValues = {
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      password: String(form.get("password") ?? ""),
      business_name: String(form.get("business_name") ?? "").trim(),
      owner_name: String(form.get("owner_name") ?? "").trim(),
      state: String(form.get("state") ?? "").trim(),
      sector: String(form.get("sector") ?? "").trim(),
      business_type: String(form.get("business_type") ?? "").trim(),
      contact_phone: String(form.get("contact_phone") ?? "").trim(),
      lga: String(form.get("lga") ?? "").trim(),
      address: String(form.get("address") ?? "").trim(),
      nin: String(form.get("nin") ?? "").trim(),
      bvn: String(form.get("bvn") ?? "").trim(),
      cac_number: String(form.get("cac_number") ?? "").trim(),
      tin: String(form.get("tin") ?? "").trim(),
    };

    const nextFieldErrors: FieldErrors = {};
    if (!values.email) nextFieldErrors.email = "Email is required.";
    if (values.password.length < 8) nextFieldErrors.password = "Use at least 8 characters.";
    if (!values.business_name) nextFieldErrors.business_name = "Business name is required.";
    if (!values.owner_name) nextFieldErrors.owner_name = "Owner full name is required.";
    if (!values.state) nextFieldErrors.state = "State is required.";
    if (!values.sector) nextFieldErrors.sector = "Sector is required.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setLoading(false);
      setError("Please correct the highlighted fields.");
      return;
    }

    if (REGISTRATION_MODE === "demo") {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        setLoading(false);
        setError(result?.error || "Unable to create demo registration.");
        return;
      }

      setLoading(false);
      setSuccess(result.message || "Registration successful.");
      router.replace(`/register/status?msmeId=${encodeURIComponent(result.msmeId)}&status=pending_review`);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (signUpError) {
      setLoading(false);
      setError(mapRegistrationErrorMessage(signUpError.message || "Unable to create account."));
      return;
    }

    if (!signUpData.user) {
      setLoading(false);
      setError("Account created but user session is unavailable. Please sign in after email verification.");
      return;
    }

    const authUserId = signUpData.user.id;
    const msmePublicId = generateMsmeId(values.state);
    const kycPayload = {
      NIN: values.nin,
      BVN: values.bvn,
      CAC: values.cac_number,
      TIN: values.tin,
    } as const;

    const { checks, overallStatus } = await runKycSimulation(kycPayload);

    let existingUserByEmail: ExistingUserByEmail | null = null;

    const { data: existingUserData, error: existingUserError } = await supabase
      .from("users")
      .select("id,email,role")
      .eq("email", values.email)
      .maybeSingle<ExistingUserByEmail>();

    existingUserByEmail = existingUserData ?? null;

    if (existingUserError) {
      setLoading(false);
      setError("Unable to sync user profile after signup. Please try again.");
      return;
    }

    const existingRole = getExistingUserRole(existingUserByEmail);

    if (existingRole && existingRole !== "msme") {
      setLoading(false);
      setError("This email is already linked to a non-MSME account. Please use a different email.");
      return;
    }

    let userRow: { id: string } | null = null;
    try {
      const profile = await resolveOrCreateUserProfile(supabase, {
        authUserId,
        email: values.email,
      });

      if (profile?.id) {
        userRow = { id: profile.id };
      }

      if (profile && (profile.full_name !== values.owner_name || profile.role !== "msme")) {
        const profileUpdate = {
          full_name: values.owner_name,
          role: "msme",
          auth_user_id: authUserId,
        };

        const { data: updatedProfileRaw } = await supabase
          .from("users")
          .update(profileUpdate as never)
          .eq("id", profile.id)
          .select("id")
          .single();

        const updatedProfile = updatedProfileRaw as { id?: string } | null;

        if (updatedProfile?.id) {
          userRow = { id: updatedProfile.id };
        }
      }
    } catch {
      setLoading(false);
      setError("Account created, but profile sync failed. Please contact support for quick recovery.");
      return;
    }

    if (!userRow?.id) {
      setLoading(false);
      setError("Account created, but profile sync failed. Please contact support for quick recovery.");
      return;
    }

    const payload = {
      msme_id: msmePublicId,
      business_name: values.business_name,
      owner_name: values.owner_name,
      state: values.state,
      sector: values.sector,
      contact_email: values.email,
      contact_phone: values.contact_phone,
      lga: values.lga,
      address: values.address,
      business_type: values.business_type,
      nin: kycPayload.NIN,
      bvn: kycPayload.BVN,
      cac_number: kycPayload.CAC,
      tin: kycPayload.TIN,
      verification_status: "pending_review",
      review_status: "pending_review",
      created_by: userRow.id,
    };

    const { data: existingMsmeRaw } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .eq("created_by", userRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingMsme = existingMsmeRaw as { id?: string; msme_id?: string } | null;

    const { data: msmeRaw, error: msmeError } = existingMsme?.id
      ? await supabase.from("msmes").update(payload as never).eq("id", existingMsme.id).select("id,msme_id").single()
      : await supabase.from("msmes").insert(payload as never).select("id,msme_id").single();

    const msme = msmeRaw as { id?: string; msme_id?: string } | null;

    if (msmeError || !msme?.id || !msme.msme_id) {
      setLoading(false);
      setError("Unable to complete MSME registration profile sync.");
      return;
    }

    await ensureWorkflowRecords(supabase, {
      msmeId: msme.id,
      overallStatus,
      checks,
    });

    const activityLogEntries = [
      {
        actor_user_id: userRow.id,
        action: "msme_registered",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { msme_id: msme.msme_id, source: "canonical_register" },
      },
      {
        actor_user_id: userRow.id,
        action: "msme_submitted",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { status: "pending_review" },
      },
    ];

    await supabase.from("activity_logs").insert(activityLogEntries as never);

    setLoading(false);
    setSuccess("Registration completed. Check your inbox to verify your email, then continue onboarding.");
    router.replace(`/register/status?msmeId=${encodeURIComponent(msme.msme_id)}&status=pending_review`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <aside className="rounded-2xl border border-emerald-900/30 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-6 text-emerald-50 shadow-xl lg:p-8">
          <h1 className="text-3xl font-semibold leading-tight">Join the Business Identity Network</h1>
          <p className="mt-4 text-sm leading-6 text-emerald-100">
            Create a verified business identity, unlock marketplace visibility, and become discoverable by partners, buyers,
            lenders, and associations.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            {[
              "Get a Business Identity Number",
              "Build trust with verified buyers and partners",
              "Access marketplace visibility",
              "Prepare for finance and procurement opportunities",
            ].map((benefit) => (
              <li className="flex items-start gap-3" key={benefit}>
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 rounded-xl border border-emerald-700/60 bg-emerald-900/40 px-4 py-3 text-sm text-emerald-100">
            BIN is an independent business identity and verification network.
          </p>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 border-b border-slate-200 pb-5">
            <h2 className="text-3xl font-semibold text-slate-900">Create your BIN profile</h2>
            <p className="mt-2 text-slate-600">Start your business verification and marketplace onboarding.</p>
            <p className="mt-3 text-sm font-medium text-emerald-700">Step 1 of 3 · Business Identity Setup</p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">1. Account Access</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                    Email address
                  </label>
                  <input id="email" name="email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter your email address" />
                  {fieldErrors.email && <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <input id="password" name="password" type="password" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Create a strong password" />
                  {fieldErrors.password && <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">2. Business Details</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_name">
                    Business name
                  </label>
                  <input id="business_name" name="business_name" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter business name" />
                  {fieldErrors.business_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.business_name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_type">
                    Business type
                  </label>
                  <input id="business_type" name="business_type" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter business type" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sector">
                    Sector
                  </label>
                  <input id="sector" name="sector" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter sector" />
                  {fieldErrors.sector && <p className="mt-1 text-xs text-rose-600">{fieldErrors.sector}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="state">
                    State
                  </label>
                  <input id="state" name="state" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter state" />
                  {fieldErrors.state && <p className="mt-1 text-xs text-rose-600">{fieldErrors.state}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="lga">
                    LGA
                  </label>
                  <input id="lga" name="lga" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter LGA" />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="address">
                    Business address
                  </label>
                  <input id="address" name="address" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter business address" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">3. Owner &amp; Compliance</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="owner_name">
                    Owner full name
                  </label>
                  <input id="owner_name" name="owner_name" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter owner full name" />
                  {fieldErrors.owner_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.owner_name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="contact_phone">
                    Contact phone
                  </label>
                  <input id="contact_phone" name="contact_phone" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter contact phone" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="cac_number">
                    CAC number
                  </label>
                  <input id="cac_number" name="cac_number" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter CAC number" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tin">
                    TIN
                  </label>
                  <input id="tin" name="tin" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter TIN" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nin">
                    NIN
                  </label>
                  <input id="nin" name="nin" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter NIN" />
                  <p className="mt-1 text-xs text-slate-500">Used only for verification checks. Not displayed publicly.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="bvn">
                    BVN
                  </label>
                  <input id="bvn" name="bvn" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Enter BVN" />
                  <p className="mt-1 text-xs text-slate-500">Used only for verification checks. Not displayed publicly.</p>
                </div>
              </div>
            </div>

            {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

            <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={loading}>
              {loading ? "Securing your MSME onboarding record..." : "Create BIN Profile"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            Already have a BIN profile?{" "}
            <Link href="/login" className="font-medium text-emerald-700 hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
