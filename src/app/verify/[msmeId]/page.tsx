import Link from "next/link";
import QRCode from "qrcode";
import { ChevronRight, Home } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicVerificationDetail } from "@/lib/data/public-verification";
import { VerificationStatusBadge } from "@/components/public/verification/VerificationStatusBadge";
import { BusinessSummaryCard } from "@/components/public/verification/BusinessSummaryCard";
import { ComplianceStatusPanel } from "@/components/public/verification/ComplianceStatusPanel";
import { VerificationMeaningCards } from "@/components/public/verification/VerificationMeaningCards";
import { QRCodeVerificationPanel } from "@/components/public/verification/QRCodeVerificationPanel";
import { ClaimBusinessBanner } from "@/components/public/verification/ClaimBusinessBanner";

const formatDate = (value?: string | null) => {
  if (!value) return "Not Available";

  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const toPublicStatus = (value?: string | null) => {
  if (!value) return "Not Available";

  const lower = value.toLowerCase();
  if (["verified", "active", "good standing", "approved", "valid"].some((status) => lower.includes(status))) {
    return "Verified";
  }

  if (["pending", "in progress", "initiated"].some((status) => lower.includes(status))) {
    return "Pending";
  }

  return "Not Available";
};

export default async function VerifyPage({ params }: { params: Promise<{ msmeId: string }> }) {
  const { msmeId } = await params;
  const detail = await getPublicVerificationDetail(msmeId);

  if (!detail) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold">Verification not found</h1>
        <p className="mt-2 text-slate-600">No business credential exists for ID {decodeURIComponent(msmeId)}.</p>
      </main>
    );
  }

  const { msme, digitalId, resolvedId } = detail;
  const supabase = await createServerSupabaseClient();

  const [{ data: association }, { data: validation }] = await Promise.all([
    supabase.from("associations").select("name").eq("id", msme.association_id ?? "").maybeSingle(),
    supabase.from("validation_results").select("cac_status,tin_status,validated_at").eq("msme_id", msme.id).maybeSingle(),
  ]);

  const verificationUrl = digitalId?.qr_code_ref ?? `https://bin.gov.ng/verify/${resolvedId}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);
  const issuedDate = formatDate(digitalId?.issued_at ?? msme.issued_at);
  const lastValidated = formatDate(validation?.validated_at ?? digitalId?.issued_at ?? msme.issued_at);
  const nextReview = validation?.validated_at
    ? formatDate(new Date(new Date(validation.validated_at).setFullYear(new Date(validation.validated_at).getFullYear() + 1)).toISOString())
    : "Not Available";

  const registryStatus = msme.suspended ? "Suspended" : msme.flagged ? "Flagged" : "Good Standing";

  return (
    <main className="bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-slate-700">
            <Home className="h-4 w-4" />
            Home
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/verify" className="hover:text-slate-700">Verify Business ID</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-emerald-700">Verification Result</span>
        </nav>

        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Public Business Identity Verification</h1>
          <p className="text-xl text-slate-600">Credential record on the Digital Business Identity Network (DBIN)</p>
          <p className="mx-auto max-w-3xl text-sm text-slate-500">
            This page confirms the registry status of a business identity credential issued within the DBIN verification network.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <VerificationStatusBadge description="This business identity credential exists on DBIN" />

              <BusinessSummaryCard
                businessName={msme.business_name}
                businessId={resolvedId}
                registryStatus={registryStatus}
                jurisdiction={msme.state}
                category={msme.sector}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Verification Summary</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registry Status</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{registryStatus}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credential Issue Date</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{issuedDate}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Validation Date</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{lastValidated}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Review Cycle</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{nextReview}</dd>
                  </div>
                </dl>
              </section>

              <ComplianceStatusPanel
                items={[
                  { label: "CAC Status", value: toPublicStatus(validation?.cac_status) },
                  { label: "TIN Status", value: toPublicStatus(validation?.tin_status) },
                  { label: "Association Membership Status", value: association?.name ? "Verified" : "Unlinked" },
                  {
                    label: "Validation Status",
                    value: validation?.validated_at || digitalId?.issued_at ? "Pending" : "Not Available",
                  },
                ]}
              />

              <section className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Sensitive registry-linked information is restricted. Full credential records are accessible only to authorized institutions.
              </section>
            </div>

            <QRCodeVerificationPanel
              qrDataUrl={qrDataUrl}
              verificationUrl={verificationUrl}
              issueDate={issuedDate}
              businessId={resolvedId}
            />
          </div>
        </section>

        <VerificationMeaningCards />

        <ClaimBusinessBanner />
      </div>
    </main>
  );
}
