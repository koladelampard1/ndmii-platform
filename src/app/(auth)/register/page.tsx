"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
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

    const { data: existingUserByEmail, error: existingUserError } = await supabase
      .from("users")
      .select("id,role")
      .eq("email", values.email)
      .maybeSingle();

    if (existingUserError) {
      setLoading(false);
      setError("Unable to sync user profile after signup. Please try again.");
      return;
    }

    if (existingUserByEmail?.role && existingUserByEmail.role !== "msme") {
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
        const { data: updatedProfile } = await supabase
          .from("users")
          .update({ full_name: values.owner_name, role: "msme", auth_user_id: authUserId })
          .eq("id", profile.id)
          .select("id")
          .single();

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

    const { data: existingMsme } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .eq("created_by", userRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: msme, error: msmeError } = existingMsme?.id
      ? await supabase.from("msmes").update(payload).eq("id", existingMsme.id).select("id,msme_id").single()
      : await supabase.from("msmes").insert(payload).select("id,msme_id").single();

    if (msmeError || !msme?.id) {
      setLoading(false);
      setError("Unable to complete MSME registration profile sync.");
      return;
    }

    await ensureWorkflowRecords(supabase, {
      msmeId: msme.id,
      overallStatus,
      checks,
    });

    await supabase.from("activity_logs").insert([
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
    ]);

    setLoading(false);
    setSuccess("Registration completed. Check your inbox to verify your email, then continue onboarding.");
    router.replace(`/register/status?msmeId=${encodeURIComponent(msme.msme_id)}&status=pending_review`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <FormWrapper title="MSME Registration & Onboarding">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <div>
            <input name="email" type="email" required className="w-full rounded border px-3 py-2" placeholder="Login email" />
            {fieldErrors.email && <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <input name="password" type="password" required className="w-full rounded border px-3 py-2" placeholder="Password (min 8 chars)" />
            {fieldErrors.password && <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>}
          </div>
          <div>
            <input name="business_name" required className="w-full rounded border px-3 py-2" placeholder="Business name" />
            {fieldErrors.business_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.business_name}</p>}
          </div>
          <div>
            <input name="owner_name" required className="w-full rounded border px-3 py-2" placeholder="Owner full name" />
            {fieldErrors.owner_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.owner_name}</p>}
          </div>
          <input name="business_type" className="rounded border px-3 py-2" placeholder="Business type" />
          <input name="contact_phone" className="rounded border px-3 py-2" placeholder="Contact phone" />
          <div>
            <input name="state" required className="w-full rounded border px-3 py-2" placeholder="State" />
            {fieldErrors.state && <p className="mt-1 text-xs text-rose-600">{fieldErrors.state}</p>}
          </div>
          <input name="lga" className="rounded border px-3 py-2" placeholder="LGA" />
          <div>
            <input name="sector" required className="w-full rounded border px-3 py-2" placeholder="Sector" />
            {fieldErrors.sector && <p className="mt-1 text-xs text-rose-600">{fieldErrors.sector}</p>}
          </div>
          <input name="address" className="rounded border px-3 py-2" placeholder="Business address" />
          <input name="nin" className="rounded border px-3 py-2" placeholder="NIN" />
          <input name="bvn" className="rounded border px-3 py-2" placeholder="BVN" />
          <input name="cac_number" className="rounded border px-3 py-2" placeholder="CAC Number" />
          <input name="tin" className="rounded border px-3 py-2" placeholder="TIN" />
          {success && <p className="md:col-span-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p>}
          {error && <p className="md:col-span-2 rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
          <Button className="md:col-span-2" disabled={loading}>
            {loading ? "Securing your MSME onboarding record..." : "Register MSME"}
          </Button>
        </form>
        <p className="text-sm text-slate-600">Already onboarded? <Link href="/login" className="text-emerald-700 hover:underline">Sign in</Link></p>
      </FormWrapper>
    </main>
  );
}
