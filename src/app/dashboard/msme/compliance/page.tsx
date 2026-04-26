import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleHelp, Clock3, FileCheck2, FileText, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

type ComplianceRecord = {
  id: string;
  overall_status: string | null;
  nin_status: string | null;
  bvn_status: string | null;
  cac_status: string | null;
  tin_status: string | null;
  nin_checked_at: string | null;
  bvn_checked_at: string | null;
  cac_checked_at: string | null;
  tin_checked_at: string | null;
  admin_override_status: string | null;
  validation_overridden_at: string | null;
  validation_results?: {
    nin_status?: string | null;
    bvn_status?: string | null;
    cac_status?: string | null;
    tin_status?: string | null;
    confidence_score?: number | null;
    validated_at?: string | null;
    validation_summary?: string | null;
  } | null;
};

type RequirementStatus = "verified" | "pending" | "in review" | "missing";

function normalizeRequirementStatus(value: string | null | undefined): RequirementStatus {
  const normalized = (value ?? "").toLowerCase();
  if (["verified", "match", "approved", "compliant", "active", "success"].includes(normalized)) return "verified";
  if (["in review", "under review", "reviewing"].includes(normalized)) return "in review";
  if (["missing", "failed", "mismatch", "invalid", "rejected"].includes(normalized)) return "missing";
  return "pending";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleString();
}

export default async function MsmeCompliancePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "msme") {
    redirect("/dashboard/compliance");
  }

  const { data } = await supabase
    .from("compliance_profiles")
    .select(
      "id,msme_id,overall_status,nin_status,bvn_status,cac_status,tin_status,nin_checked_at,bvn_checked_at,cac_checked_at,tin_checked_at,nin_response_summary,bvn_response_summary,cac_response_summary,tin_response_summary,admin_override_status,override_notes,validation_overridden_at,last_reviewed_at,created_at,updated_at,validation_results(nin_status,bvn_status,cac_status,tin_status,confidence_score,validated_at,validation_summary)",
    )
    .eq("msme_id", ctx.linkedMsmeId ?? "")
    .order("last_reviewed_at", { ascending: false });

  const row = ((data ?? []) as ComplianceRecord[])[0];
  const matrix = row?.validation_results ?? {};

  const verificationDimensions = [
    {
      title: "Business Registration",
      helper: "CAC registration verified",
      status: normalizeRequirementStatus(matrix.cac_status ?? row?.cac_status),
      checkedAt: row?.cac_checked_at,
    },
    {
      title: "Business Owner Identity",
      helper: "Identity document verified",
      status: normalizeRequirementStatus(matrix.nin_status ?? row?.nin_status),
      checkedAt: row?.nin_checked_at,
    },
    {
      title: "Business Address",
      helper: "Address verification completed",
      status: normalizeRequirementStatus(row?.overall_status === "verified" ? "verified" : "pending"),
      checkedAt: row?.validation_results?.validated_at ?? row?.validation_overridden_at,
    },
    {
      title: "Bank Account Verification",
      helper: "Bank account verification completed",
      status: normalizeRequirementStatus(matrix.bvn_status ?? row?.bvn_status),
      checkedAt: row?.bvn_checked_at,
    },
    {
      title: "Tax Identification",
      helper: "Tax identification number verified",
      status: normalizeRequirementStatus(matrix.tin_status ?? row?.tin_status),
      checkedAt: row?.tin_checked_at,
    },
    {
      title: "BVN Verification",
      helper: "BVN successfully verified",
      status: normalizeRequirementStatus(matrix.bvn_status ?? row?.bvn_status),
      checkedAt: row?.bvn_checked_at,
    },
    {
      title: "Compliance Agreement",
      helper: "NDMII compliance agreement accepted",
      status: normalizeRequirementStatus(row?.overall_status === "verified" ? "verified" : row?.overall_status ?? "pending"),
      checkedAt: row?.validation_results?.validated_at ?? row?.validation_overridden_at,
    },
  ];

  const verifiedCount = verificationDimensions.filter((item) => item.status === "verified").length;
  const totalCount = verificationDimensions.length;
  const verificationProgress = totalCount ? Math.round((verifiedCount / totalCount) * 100) : 0;
  const isVerified = (row?.overall_status ?? "").toLowerCase() === "verified";
  const complianceLevel = isVerified ? "High" : verificationProgress >= 70 ? "Medium" : "Low";
  const confidenceScore = matrix.confidence_score ?? verificationProgress;

  const reviewBaseDate = row?.validation_overridden_at ?? row?.validation_results?.validated_at ?? row?.tin_checked_at ?? row?.bvn_checked_at ?? row?.nin_checked_at ?? row?.cac_checked_at ?? null;
  const nextReviewDate = reviewBaseDate ? new Date(reviewBaseDate) : null;
  if (nextReviewDate) nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

  const activityCandidates = [
    row?.validation_results?.validated_at
      ? {
          title: "Business verification completed",
          text: matrix.validation_summary ?? "Your verification profile has been validated.",
          at: row.validation_results.validated_at,
          status: "verified" as const,
        }
      : null,
    row?.tin_checked_at
      ? { title: "Tax identification reviewed", text: `TIN status: ${(matrix.tin_status ?? row.tin_status ?? "pending").toLowerCase()}.`, at: row.tin_checked_at, status: normalizeRequirementStatus(matrix.tin_status ?? row.tin_status) }
      : null,
    row?.bvn_checked_at
      ? { title: "Bank account verified", text: `BVN status: ${(matrix.bvn_status ?? row.bvn_status ?? "pending").toLowerCase()}.`, at: row.bvn_checked_at, status: normalizeRequirementStatus(matrix.bvn_status ?? row.bvn_status) }
      : null,
    row?.nin_checked_at
      ? { title: "Identity check updated", text: `NIN status: ${(matrix.nin_status ?? row.nin_status ?? "pending").toLowerCase()}.`, at: row.nin_checked_at, status: normalizeRequirementStatus(matrix.nin_status ?? row.nin_status) }
      : null,
    row?.cac_checked_at
      ? { title: "Business registration reviewed", text: `CAC status: ${(matrix.cac_status ?? row.cac_status ?? "pending").toLowerCase()}.`, at: row.cac_checked_at, status: normalizeRequirementStatus(matrix.cac_status ?? row.cac_status) }
      : null,
    row?.validation_overridden_at
      ? { title: "Compliance status updated", text: `Current status: ${row.admin_override_status ?? row.overall_status ?? "pending"}.`, at: row.validation_overridden_at, status: normalizeRequirementStatus(row.admin_override_status ?? row.overall_status) }
      : null,
  ]
    .filter(Boolean)
    .sort((a, b) => new Date((b as any).at).getTime() - new Date((a as any).at).getTime())
    .slice(0, 5) as Array<{ title: string; text: string; at: string; status: RequirementStatus }>;

  const statusBadgeClasses: Record<RequirementStatus, string> = {
    verified: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    "in review": "bg-amber-100 text-amber-700",
    missing: "bg-slate-200 text-slate-700",
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My KYC &amp; Compliance</h1>
          <p className="mt-1 text-sm text-slate-600">Track your verification status, documents, and compliance requirements.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" type="button" className="border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50">
            Verify ID
          </Button>
          <Link href="/dashboard/msme/id-card" className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800">
            View My Business Identity Credential
          </Link>
        </div>
      </header>

      {params.saved && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">Override saved.</p>}

      <section className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${isVerified ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`mt-0.5 h-6 w-6 ${isVerified ? "text-emerald-700" : "text-amber-600"}`} />
          <div>
            <p className="text-base font-semibold text-slate-900">{isVerified ? "You are Verified" : "Verification in Progress"}</p>
            <p className="text-sm text-slate-600">
              {isVerified
                ? "Your account is fully verified and compliant with DBIN verification requirements."
                : `Your profile is ${verificationProgress}% complete. Complete pending checks to reach full compliance.`}
            </p>
          </div>
        </div>
        <Button variant="secondary" type="button" className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
          Learn more about verification
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-semibold text-slate-900">{verificationProgress}%</p>
          <p className="mt-1 text-sm font-medium text-slate-700">Verification Progress</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${verificationProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{verificationProgress === 100 ? "All requirements completed" : `${verifiedCount} of ${totalCount} requirements completed`}</p>
        </article>

        <article className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-semibold text-slate-900">
            {verifiedCount} / {totalCount}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">Documents Approved</p>
          <p className="mt-6 text-xs text-slate-500">{verifiedCount === totalCount ? "All documents verified" : `${totalCount - verifiedCount} document checks pending`}</p>
        </article>

        <article className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-semibold text-slate-900">{complianceLevel}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">Compliance Level</p>
          <p className="mt-6 text-xs text-slate-500">{isVerified ? "Low risk • Fully compliant" : `Confidence score ${confidenceScore}% • ${row?.overall_status ?? "pending"}`}</p>
        </article>

        <article className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-semibold text-slate-900">{nextReviewDate ? formatDate(nextReviewDate.toISOString()) : "TBD"}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">Next Review Date</p>
          <p className="mt-6 text-xs text-slate-500">{nextReviewDate ? "Review in 12 months" : "Review date will appear once verification is complete."}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article id="verification-details" className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-900">Verification Requirements</h2>
          <p className="mt-1 text-sm text-slate-600">{verificationProgress === 100 ? "All required verifications are complete." : "Some verification checks still need your attention."}</p>
          <ul className="mt-4 divide-y">
            {verificationDimensions.map((item) => (
              <li key={item.title} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-start gap-3">
                  {item.status === "verified" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <Clock3 className="mt-0.5 h-5 w-5 text-amber-500" />}
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.helper}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadgeClasses[item.status]}`}>{item.status}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </li>
            ))}
          </ul>
          <Link href="#verification-details" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
            View Verification Details
            <ChevronRight className="h-4 w-4" />
          </Link>
        </article>

        <article className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
              <p className="mt-1 text-sm text-slate-600">Latest updates to your verification status.</p>
            </div>
          </div>

          {activityCandidates.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No recent verification activity yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {activityCandidates.map((activity, index) => (
                <li key={`${activity.title}-${activity.at}-${index}`} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                  <div className="flex items-start gap-3">
                    {activity.status === "verified" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <FileText className="mt-0.5 h-5 w-5 text-blue-600" />}
                    <div>
                      <p className="font-medium text-slate-900">{activity.title}</p>
                      <p className="text-xs text-slate-500">{activity.text}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{formatDateTime(activity.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Why verification matters</h3>
              <p className="mt-1 text-sm text-slate-600">Complete verification unlocks more opportunities, builds trust with customers, and ensures compliance with NDMII standards.</p>
              <button type="button" className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
                Learn more about verification benefits
              </button>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Need help?</h3>
              <p className="mt-1 text-sm text-slate-600">Our support team is here to help you with your verification process.</p>
              <Link href="/dashboard/msme/settings" className="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100">
                Contact Support
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700">
        <Lock className="h-4 w-4 text-emerald-700" />
        <p>Your information is secure and encrypted. We follow strict security measures to protect your data.</p>
      </section>
    </section>
  );
}
