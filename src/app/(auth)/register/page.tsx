"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { resolveOrCreateUserProfile } from "@/lib/auth/profile";

type FieldErrors = Partial<Record<"email" | "password" | "business_name" | "owner_name" | "state" | "sector", string>>;

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
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const businessName = String(form.get("business_name") ?? "").trim();
    const ownerName = String(form.get("owner_name") ?? "").trim();
    const state = String(form.get("state") ?? "").trim();
    const sector = String(form.get("sector") ?? "").trim();

    const nextFieldErrors: FieldErrors = {};
    if (!email) nextFieldErrors.email = "Email is required.";
    if (password.length < 8) nextFieldErrors.password = "Use at least 8 characters.";
    if (!businessName) nextFieldErrors.business_name = "Business name is required.";
    if (!ownerName) nextFieldErrors.owner_name = "Owner full name is required.";
    if (!state) nextFieldErrors.state = "State is required.";
    if (!sector) nextFieldErrors.sector = "Sector is required.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setLoading(false);
      setError("Please correct the highlighted fields.");
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message || "Unable to create account.");
      return;
    }

    if (!signUpData.user) {
      setLoading(false);
      setError("Account created but user session is unavailable. Please sign in.");
      return;
    }

    const authUserId = signUpData.user.id;
    const msmePublicId = generateMsmeId(state);
    const kycPayload = {
      NIN: String(form.get("nin") ?? ""),
      BVN: String(form.get("bvn") ?? ""),
      CAC: String(form.get("cac_number") ?? ""),
      TIN: String(form.get("tin") ?? ""),
    } as const;

    const { checks, overallStatus } = await runKycSimulation(kycPayload);

    const { data: existingUserByEmail, error: existingUserError } = await supabase
      .from("users")
      .select("id,role")
      .eq("email", email)
      .maybeSingle();

    if (existingUserError) {
      setLoading(false);
      setError(existingUserError.message || "Unable to verify existing user profile.");
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
        email,
      });

      if (profile?.id) {
        userRow = { id: profile.id };
      }

      if (profile && (profile.full_name !== ownerName || profile.role !== "msme")) {
        const { data: updatedProfile } = await supabase
          .from("users")
          .update({ full_name: ownerName, role: "msme", auth_user_id: authUserId })
          .eq("id", profile.id)
          .select("id")
          .single();

        if (updatedProfile?.id) {
          userRow = { id: updatedProfile.id };
        }
      }
    } catch (profileError) {
      setLoading(false);
      setError(profileError instanceof Error ? profileError.message : "Unable to create MSME user profile.");
      return;
    }

    if (!userRow?.id) {
      setLoading(false);
      setError("Unable to create MSME user profile.");
      return;
    }

    const payload = {
      msme_id: msmePublicId,
      business_name: businessName,
      owner_name: ownerName,
      state,
      sector,
      contact_email: email,
      contact_phone: String(form.get("contact_phone") ?? ""),
      lga: String(form.get("lga") ?? ""),
      address: String(form.get("address") ?? ""),
      business_type: String(form.get("business_type") ?? ""),
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
      setError(msmeError?.message || "Unable to save MSME registration.");
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
    setSuccess("Registration completed. Proceed to onboarding status.");
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
          <Button className="md:col-span-2" disabled={loading}>{loading ? "Creating secure MSME record..." : "Register MSME"}</Button>
        </form>
        <p className="text-sm text-slate-600">Already onboarded? <Link href="/login" className="text-emerald-700 hover:underline">Sign in</Link></p>
      </FormWrapper>
    </main>
  );
}
