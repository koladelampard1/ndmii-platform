"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveOrCreateUserProfile } from "@/lib/auth/profile";
import { mapRegistrationErrorMessage } from "@/lib/auth/registration";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RegistrationPath = "existing_association_member" | "new_association_applicant" | "independent";

type FieldErrors = Partial<Record<"email" | "password" | "business_name" | "owner_name" | "state" | "sector" | "association_id", string>>;

type AssociationOption = {
  id: string;
  name: string;
  state: string | null;
  sector: string | null;
};

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
  registration_path: RegistrationPath;
  association_id: string;
  programme: string;
  source: string;
};

type ExistingUserByEmail = {
  id: string;
  email: string | null;
  role: string | null;
};

function getExistingUserRole(user: ExistingUserByEmail | null | unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const role = (user as ExistingUserByEmail).role;
  return typeof role === "string" ? role : null;
}

const REGISTRATION_MODE =
  process.env.NEXT_PUBLIC_REGISTRATION_MODE?.toLowerCase() === "production"
    ? "production"
    : "demo";

function normalizeRegistrationPath(value: string | null): RegistrationPath {
  if (value === "existing_association_member" || value === "new_association_applicant" || value === "independent") {
    return value;
  }
  return "independent";
}

function RegisterPageClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const registrationPath = normalizeRegistrationPath(searchParams.get("registration_path") ?? searchParams.get("path"));
  const programme = searchParams.get("programme")?.trim().toLowerCase() === "lcdbo" ? "lcdbo" : "";
  const source = programme === "lcdbo" ? searchParams.get("source")?.trim() || "lcdbo_public_site" : "";
  const requiresAssociation = registrationPath === "existing_association_member" || registrationPath === "new_association_applicant";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [associations, setAssociations] = useState<AssociationOption[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!requiresAssociation) return;

    fetch("/api/auth/register/associations")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load associations."))))
      .then((result) => {
        if (mounted) setAssociations(result.associations ?? []);
      })
      .catch(() => {
        if (mounted) setError("Unable to load associations. Please refresh and try again.");
      });

    return () => {
      mounted = false;
    };
  }, [requiresAssociation]);

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
      registration_path: normalizeRegistrationPath(String(form.get("registration_path") ?? "")),
      association_id: String(form.get("association_id") ?? "").trim(),
      programme: String(form.get("programme") ?? "").trim(),
      source: String(form.get("source") ?? "").trim(),
    };

    const nextFieldErrors: FieldErrors = {};
    if (!values.email) nextFieldErrors.email = "Email is required.";
    if (values.password.length < 8) nextFieldErrors.password = "Use at least 8 characters.";
    if (!values.business_name) nextFieldErrors.business_name = "Business name is required.";
    if (!values.owner_name) nextFieldErrors.owner_name = "Owner full name is required.";
    if (!values.state) nextFieldErrors.state = "State is required.";
    if (!values.sector) nextFieldErrors.sector = "Sector is required.";
    if (requiresAssociation && !values.association_id) nextFieldErrors.association_id = "Association selection is required.";

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
      router.replace(`/register/status?msmeId=${encodeURIComponent(result.msmeId)}&status=${encodeURIComponent(result.verificationStatus ?? "pending_dbin_verification")}`);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          role: "msme",
          owner_name: values.owner_name,
          programme: values.programme || null,
          registration_source: values.source || null,
        },
      },
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

    if (!signUpData.session) {
      const onboardingParams = new URLSearchParams();
      if (values.programme === "lcdbo") {
        onboardingParams.set("programme", "lcdbo");
        onboardingParams.set("source", values.source || "lcdbo_public_site");
      }
      const onboardingPath = `/dashboard/msme/onboarding${onboardingParams.size ? `?${onboardingParams.toString()}` : ""}`;
      const loginParams = new URLSearchParams({
        message: "Account created. Verify your email, then sign in to complete MSME onboarding.",
        returnTo: onboardingPath,
      });
      setLoading(false);
      setSuccess("Account created. Your programme registration context has been saved pending email verification.");
      router.replace(`/login?${loginParams.toString()}`);
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
      registration_path: values.registration_path,
      association_id: requiresAssociation ? values.association_id : null,
      verification_status: requiresAssociation ? "pending_association_approval" : "pending_dbin_verification",
      review_status: "pending_review",
      created_by: userRow.id,
      registration_context: values.programme === "lcdbo" ? { programme: "lcdbo", source: values.source || "lcdbo_public_site" } : {},
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

    if (requiresAssociation) {
      const membershipType = values.registration_path === "existing_association_member" ? "existing_member" : "join_request";
      const { error: membershipError } = await supabase.from("association_memberships").upsert(
        {
          association_id: values.association_id,
          msme_id: msme.id,
          user_id: userRow.id,
          membership_type: membershipType,
          approval_status: "pending",
          reviewed_by: null,
          reviewed_at: null,
        } as never,
        { onConflict: "association_id,msme_id" },
      );

      if (membershipError) {
        setLoading(false);
        setError("Registration was created, but association approval setup failed. Please contact support.");
        return;
      }
    }

    await ensureWorkflowRecords(supabase, {
      msmeId: msme.id,
      overallStatus,
      checks,
    });

    if (values.programme === "lcdbo") {
      const { error: enrolmentError } = await (supabase as any).rpc("request_lcdbo_enrolment", {
        target_msme_id: msme.id,
        registration_source: values.source || "lcdbo_public_site",
      });
      if (enrolmentError) {
        setLoading(false);
        setError("Your DBIN profile was created, but LCDBO enrolment could not be queued. Sign in and retry from the LCDBO workspace.");
        return;
      }
    }

    const activityLogEntries = [
      {
        actor_user_id: userRow.id,
        action: "msme_registered",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { msme_id: msme.msme_id, source: values.source || "canonical_register", programme: values.programme || null },
      },
      {
        actor_user_id: userRow.id,
        action: "msme_submitted",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { status: payload.verification_status, registration_path: values.registration_path },
      },
    ];

    await supabase.from("activity_logs").insert(activityLogEntries as never);

    setLoading(false);
    setSuccess("Registration completed. Check your inbox to verify your email, then continue onboarding.");
    router.replace(`/register/status?msmeId=${encodeURIComponent(msme.msme_id)}&status=${encodeURIComponent(payload.verification_status)}`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <aside className="rounded-2xl border border-emerald-900/30 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-6 text-emerald-50 shadow-xl lg:p-8">
          <h1 className="text-3xl font-semibold leading-tight">Join the Digital Business Identity Network (DBIN)</h1>
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
            DBIN is an independent business identity and verification network.
          </p>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 border-b border-slate-200 pb-5">
            <h2 className="text-3xl font-semibold text-slate-900">Create your DBIN profile</h2>
            <p className="mt-2 text-slate-600">Start your business verification and marketplace onboarding.</p>
            <p className="mt-3 text-sm font-medium text-emerald-700">Step 1 of 3 · Business Identity Setup</p>
            {programme === "lcdbo" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <strong>LCDBO programme registration:</strong> your programme request will be preserved and sent for review when this DBIN profile is created.
              </div>
            )}
            <p className="mt-2 text-sm text-slate-600">
              Registration path:{" "}
              <span className="font-semibold text-slate-900">
                {registrationPath === "existing_association_member"
                  ? "Existing association member"
                  : registrationPath === "new_association_applicant"
                    ? "New association applicant"
                    : "Independent registration"}
              </span>
              {" · "}
              <Link href="/register/start" className="font-medium text-emerald-700 hover:underline">
                Change
              </Link>
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <input type="hidden" name="registration_path" value={registrationPath} />
            <input type="hidden" name="programme" value={programme} />
            <input type="hidden" name="source" value={source} />
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
                {requiresAssociation && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="association_id">
                      MSME association
                    </label>
                    <select id="association_id" name="association_id" required className="w-full rounded-lg border border-slate-300 px-3 py-2">
                      <option value="">{associations.length === 0 ? "No associations available yet" : "Select your association"}</option>
                      {associations.map((association) => (
                        <option key={association.id} value={association.id}>
                          {association.name} ({association.state ?? "Nigeria"} · {association.sector ?? "General"})
                        </option>
                      ))}
                    </select>
                    {fieldErrors.association_id && <p className="mt-1 text-xs text-rose-600">{fieldErrors.association_id}</p>}
                  </div>
                )}
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
              {loading ? "Securing your MSME onboarding record..." : "Create DBIN Profile"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            Already have a DBIN profile?{" "}
            <Link href="/login" className="font-medium text-emerald-700 hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading registration...</div>}>
      <RegisterPageClient />
    </Suspense>
  );
}
