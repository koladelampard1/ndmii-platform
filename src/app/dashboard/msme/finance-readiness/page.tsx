import { redirect } from "next/navigation";
import { FinanceReadinessSubmit } from "@/components/msme/finance-readiness-submit";
import { getCurrentUserContext } from "@/lib/auth/session";
import { FEATURE_FINANCE_READINESS, isFeatureEnabled } from "@/lib/feature-flags";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function FinanceReadinessPage() {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme") redirect("/dashboard");

  const enabled = isFeatureEnabled(FEATURE_FINANCE_READINESS);
  const supabase = await createServerSupabaseClient();

  const { data: latest } = await supabase
    .from("finance_readiness_assessments")
    .select("overall_score,readiness_level,submitted_at")
    .eq("msme_id", ctx.linkedMsmeId ?? "")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Access to Finance Readiness</h1>
        <p className="mt-2 text-sm text-slate-600">AFRI combines identity, financial, compliance, operations, and growth scores for lender-facing readiness.</p>
      </header>

      {latest ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Most recent submission</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{latest.overall_score}</p>
          <p className="text-sm text-slate-600">Level: {latest.readiness_level} • Submitted: {new Date(latest.submitted_at).toLocaleString("en-NG")}</p>
        </article>
      ) : null}

      <FinanceReadinessSubmit disabled={!enabled} />

      {!enabled ? <p className="text-sm text-amber-700">Feature flag disabled: set FEATURE_FINANCE_READINESS=true to enable this module.</p> : null}
    </section>
  );
}
