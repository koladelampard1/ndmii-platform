import Link from "next/link";
import QRCode from "qrcode";
import { ChevronRight, Home } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicCredentialVerificationByToken } from "@/lib/data/public-verification";
import { credentialVerifyUrl } from "@/lib/data/credential-trust";
import { checkRateLimit } from "@/lib/http/rate-limit";
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

function VerificationFailed({ code, message }: { code: string; message: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Verification not valid</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Error code: {code}</p>
      <Link href="/verify" className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
        Search credentials
      </Link>
    </main>
  );
}

export default async function VerifyCredentialTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const rate = await checkRateLimit({ scope: "verify", limit: 60, windowMs: 60_000 });
  if (!rate.ok) {
    return <VerificationFailed code="rate_limited" message="Too many verification attempts. Please retry shortly." />;
  }

  const { token } = await params;
  const result = await getPublicCredentialVerificationByToken(decodeURIComponent(token));

  if (!result.ok) {
    return <VerificationFailed code={result.error.code} message={result.error.message} />;
  }

  const { msme, digitalId, resolvedId } = result.detail;
  const supabase = await createServerSupabaseClient();

  const [{ data: association }, { data: validation }] = await Promise.all([
    supabase.from("associations").select("name").eq("id", msme.association_id ?? "").maybeSingle(),
    supabase.from("validation_results").select("cac_status,tin_status,validated_at").eq("msme_id", msme.id).maybeSingle(),
  ]);

  const verificationUrl = credentialVerifyUrl(token);
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);
  const issuedDate = formatDate(digitalId?.issued_at ?? msme.issued_at);
  const lastValidated = formatDate(validation?.validated_at ?? digitalId?.issued_at ?? msme.issued_at);
  const nextReview = validation?.validated_at
    ? formatDate(new Date(new Date(validation.validated_at).setFullYear(new Date(validation.validated_at).getFullYear() + 1)).toISOString())
    : "Not Available";

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
            This page confirms an active, approved, unrevoked business identity credential.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <VerificationStatusBadge description="This active credential was validated from its signed public verification token." />

              <BusinessSummaryCard
                businessName={msme.business_name}
                businessId={resolvedId}
                registryStatus="Good Standing"
                jurisdiction={msme.state}
                category={msme.sector}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Verification Summary</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credential Status</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">Active</dd>
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
                  { label: "Validation Status", value: "Verified" },
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
              summaryUrl={`/api/verification-summary/c/${encodeURIComponent(token)}`}
            />
          </div>
        </section>

        <VerificationMeaningCards />

        <ClaimBusinessBanner />
      </div>
    </main>
  );
}
