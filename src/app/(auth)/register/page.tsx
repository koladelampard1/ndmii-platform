"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormWrapper } from "@/components/dashboard/form-wrapper";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";

export default function RegisterPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const businessName = String(form.get("business_name") ?? "").trim();
    const ownerName = String(form.get("owner_name") ?? "").trim();
    const state = String(form.get("state") ?? "").trim();
    const sector = String(form.get("sector") ?? "").trim();

    if (!email || !password || !businessName || !ownerName || !state || !sector) {
      setLoading(false);
      setError("Please fill all required fields before continuing.");
      return;
    }

    if (password.length < 8) {
      setLoading(false);
      setError("Password must be at least 8 characters.");
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

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .insert({
        email,
        full_name: ownerName,
        role: "msme",
        auth_user_id: authUserId,
      })
      .select("id")
      .single();

    if (userError || !userRow?.id) {
      setLoading(false);
      setError(userError?.message || "Unable to create MSME user profile.");
      return;
    }

    const { data: msme, error: msmeError } = await supabase
      .from("msmes")
      .insert({
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
        created_by: userRow.id,
      })
      .select("id")
      .single();

    if (msmeError || !msme?.id) {
      setLoading(false);
      setError(msmeError?.message || "Unable to save MSME registration.");
      return;
    }

    await supabase.from("compliance_profiles").insert({
      msme_id: msme.id,
      score: overallStatus === "verified" ? 90 : overallStatus === "pending" ? 65 : 45,
      risk_level: overallStatus === "failed" ? "high" : "medium",
      overall_status: overallStatus,
      nin_status: checks.find((x) => x.provider === "NIN")?.status ?? "pending",
      bvn_status: checks.find((x) => x.provider === "BVN")?.status ?? "pending",
      cac_status: checks.find((x) => x.provider === "CAC")?.status ?? "pending",
      tin_status: checks.find((x) => x.provider === "TIN")?.status ?? "pending",
    });

    await supabase.from("tax_profiles").insert({
      msme_id: msme.id,
      tax_category: "SME_STANDARD",
      vat_applicable: true,
      estimated_monthly_obligation: 110000,
      outstanding_amount: 50000,
      compliance_status: "pending",
    });

    await supabase.from("activity_logs").insert([
      {
        action: "msme_registered",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { msme_id: msmePublicId, source: "public_register" },
      },
      {
        action: "msme_submitted",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { status: "pending_review" },
      },
    ]);

    setLoading(false);
    setSuccess("Registration completed. Your MSME is now in reviewer queue.");
    router.replace(`/login?message=${encodeURIComponent("Registration successful. Please sign in with your new MSME credentials.")}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <FormWrapper title="MSME Registration & Onboarding">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <input name="email" type="email" required className="rounded border px-3 py-2" placeholder="Login email" />
          <input name="password" type="password" required className="rounded border px-3 py-2" placeholder="Password (min 8 chars)" />
          <input name="business_name" required className="rounded border px-3 py-2" placeholder="Business name" />
          <input name="owner_name" required className="rounded border px-3 py-2" placeholder="Owner full name" />
          <input name="business_type" className="rounded border px-3 py-2" placeholder="Business type" />
          <input name="contact_phone" className="rounded border px-3 py-2" placeholder="Contact phone" />
          <input name="state" required className="rounded border px-3 py-2" placeholder="State" />
          <input name="lga" className="rounded border px-3 py-2" placeholder="LGA" />
          <input name="sector" required className="rounded border px-3 py-2" placeholder="Sector" />
          <input name="address" className="rounded border px-3 py-2" placeholder="Business address" />
          <input name="nin" className="rounded border px-3 py-2" placeholder="NIN" />
          <input name="bvn" className="rounded border px-3 py-2" placeholder="BVN" />
          <input name="cac_number" className="rounded border px-3 py-2" placeholder="CAC Number" />
          <input name="tin" className="rounded border px-3 py-2" placeholder="TIN" />
          {success && <p className="md:col-span-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p>}
          {error && <p className="md:col-span-2 rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
          <Button className="md:col-span-2" disabled={loading}>{loading ? "Submitting..." : "Register MSME"}</Button>
        </form>
        <p className="text-sm text-slate-600">Already onboarded? <Link href="/login" className="text-emerald-700 hover:underline">Sign in</Link></p>
      </FormWrapper>
    </main>
  );
}
