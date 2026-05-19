import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileText, History, Lock, ShieldCheck } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

type ComplianceProfile = {
  overall_status: string | null;
  compliance_score: number | null;
  risk_level: string | null;
  total_required_count: number | null;
  approved_count: number | null;
  pending_count: number | null;
  under_review_count: number | null;
  changes_requested_count: number | null;
  rejected_count: number | null;
  expired_count: number | null;
  expiring_soon_count: number | null;
  suspended_count: number | null;
  revoked_count: number | null;
  last_reviewed_at: string | null;
  next_deadline_at: string | null;
  last_recalculated_at: string | null;
  metadata?: Record<string, unknown> | null;
};

type RequirementDefinition = {
  code?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  frequency?: string | null;
  is_mandatory?: boolean | null;
  compliance_regulators?: { code?: string | null; name?: string | null } | null;
};

type ComplianceItem = {
  id: string;
  status: string | null;
  reference_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  is_required: boolean | null;
  source: string | null;
  metadata?: Record<string, unknown> | null;
  compliance_requirement_definitions?: RequirementDefinition | RequirementDefinition[] | null;
};

type ComplianceEvent = {
  id: string;
  event_type: string | null;
  summary: string | null;
  to_status: string | null;
  created_at: string | null;
  actor_type: string | null;
  metadata?: Record<string, unknown> | null;
};

const statusLabel: Record<string, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  suspended: "Suspended",
  revoked: "Revoked",
  waived: "Waived",
  archived: "Archived",
};

const statusClasses: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  waived: "bg-emerald-50 text-emerald-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-blue-100 text-blue-700",
  changes_requested: "bg-amber-100 text-amber-700",
  not_started: "bg-slate-100 text-slate-700",
  draft: "bg-slate-100 text-slate-700",
  rejected: "bg-rose-100 text-rose-700",
  expired: "bg-rose-100 text-rose-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  revoked: "bg-rose-100 text-rose-700",
  archived: "bg-slate-200 text-slate-700",
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatStatus(value: string | null | undefined) {
  return statusLabel[value ?? ""] ?? (value ? value.replaceAll("_", " ") : "Not started");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function isMigrated(metadata: Record<string, unknown> | null | undefined, source?: string | null) {
  return source === "legacy_migration" || metadata?.demo_or_migration_derived === true || metadata?.source === "legacy_migration_recalculation";
}

function itemSortValue(item: ComplianceItem) {
  const requirement = relationOne(item.compliance_requirement_definitions);
  if (item.is_required) return `0-${requirement?.code ?? item.id}`;
  return `1-${requirement?.code ?? item.id}`;
}

export default async function MsmeCompliancePage() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "msme") {
    redirect("/dashboard/compliance");
  }

  if (!ctx.linkedMsmeId) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Compliance</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Complete MSME onboarding before compliance requirements can be generated for your business.
        </div>
      </section>
    );
  }

  const [{ data: profile }, { data: itemRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("msme_compliance_profiles")
      .select(
        "overall_status,compliance_score,risk_level,total_required_count,approved_count,pending_count,under_review_count,changes_requested_count,rejected_count,expired_count,expiring_soon_count,suspended_count,revoked_count,last_reviewed_at,next_deadline_at,last_recalculated_at,metadata",
      )
      .eq("msme_id", ctx.linkedMsmeId)
      .maybeSingle(),
    supabase
      .from("msme_compliance_items")
      .select(
        "id,status,reference_number,issued_at,expires_at,approved_at,rejected_at,is_required,source,metadata,compliance_requirement_definitions(code,title,description,category,frequency,is_mandatory,compliance_regulators(code,name))",
      )
      .eq("msme_id", ctx.linkedMsmeId),
    supabase
      .from("compliance_events")
      .select("id,event_type,summary,to_status,created_at,actor_type,metadata")
      .eq("msme_id", ctx.linkedMsmeId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const complianceProfile = profile as ComplianceProfile | null;
  const items = ((itemRows ?? []) as ComplianceItem[]).sort((a, b) => itemSortValue(a).localeCompare(itemSortValue(b)));
  const events = (eventRows ?? []) as ComplianceEvent[];
  const migratedProfile = isMigrated(complianceProfile?.metadata ?? null);
  const totalRequired = complianceProfile?.total_required_count ?? items.filter((item) => item.is_required).length;
  const approvedRequired = complianceProfile?.approved_count ?? items.filter((item) => item.is_required && item.status === "approved").length;
  const score = complianceProfile?.compliance_score ?? (totalRequired ? Math.round((approvedRequired / totalRequired) * 100) : 0);
  const overallStatus = complianceProfile?.overall_status ?? (items.length ? "not_started" : "not_started");

  const summaryCards = [
    { label: "Compliance score", value: `${score}%`, detail: migratedProfile ? "Recalculated from migrated Phase 1 items" : "Calculated from active compliance items" },
    { label: "Approved required", value: `${approvedRequired} / ${totalRequired}`, detail: "Required requirements approved" },
    { label: "Needs attention", value: String((complianceProfile?.changes_requested_count ?? 0) + (complianceProfile?.rejected_count ?? 0) + (complianceProfile?.expired_count ?? 0)), detail: "Changes, rejected, or expired items" },
    { label: "Next deadline", value: complianceProfile?.next_deadline_at ? formatDate(complianceProfile.next_deadline_at) : "Not set", detail: "Expiry engine is deferred from Phase 1" },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Compliance</h1>
          <p className="mt-1 text-sm text-slate-600">Phase 1 compliance foundation: regulator requirements, statuses, and migration audit trail.</p>
        </div>
        <Link href="/dashboard/msme/id-card" className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800">
          View Business Identity Credential
        </Link>
      </header>

      <section className={`rounded-2xl border p-5 ${overallStatus === "approved" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`mt-0.5 h-6 w-6 ${overallStatus === "approved" ? "text-emerald-700" : "text-amber-700"}`} />
          <div>
            <p className="text-base font-semibold text-slate-900">Overall status: {formatStatus(overallStatus)}</p>
            <p className="mt-1 text-sm text-slate-700">
              {items.length
                ? "These records come from the new compliance foundation tables. Migration-derived items are clearly marked until reviewed through future phases."
                : "No Phase 1 compliance items exist for this MSME yet. They will appear after migration/backfill or future requirement generation."}
            </p>
            {migratedProfile ? (
              <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-700">
                Migrated/unreviewed: legacy scores were not treated as certified truth.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-2xl border bg-white p-4">
            <p className="text-3xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{card.label}</p>
            <p className="mt-4 text-xs text-slate-500">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Regulatory Requirements</h2>
              <p className="mt-1 text-sm text-slate-600">Phase 1 is read-only: evidence uploads, review actions, reminders, and expiry automation are intentionally deferred.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No compliance requirements have been generated for this MSME.</p>
          ) : (
            <ul className="mt-4 divide-y">
              {items.map((item) => {
                const requirement = relationOne(item.compliance_requirement_definitions);
                const regulator = requirement?.compliance_regulators;
                const migrated = isMigrated(item.metadata ?? null, item.source);
                const status = item.status ?? "not_started";

                return (
                  <li key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {status === "approved" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : status === "rejected" || status === "expired" ? <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" /> : <Clock3 className="mt-0.5 h-5 w-5 text-amber-500" />}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{requirement?.title ?? requirement?.code ?? "Compliance requirement"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {regulator?.code ?? "REG"} • {requirement?.category?.replaceAll("_", " ") ?? "compliance"} • {item.is_required ? "Required" : "Optional"}
                          </p>
                          {requirement?.description ? <p className="mt-1 text-sm text-slate-600">{requirement.description}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            {item.reference_number ? <span className="rounded bg-slate-100 px-2 py-1">Ref: {item.reference_number}</span> : null}
                            {item.approved_at ? <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Approved {formatDate(item.approved_at)}</span> : null}
                            {item.rejected_at ? <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">Rejected {formatDate(item.rejected_at)}</span> : null}
                            {item.expires_at ? <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Expires {formatDate(item.expires_at)}</span> : null}
                            {migrated ? <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Migrated/unreviewed</span> : null}
                          </div>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[status] ?? "bg-slate-100 text-slate-700"}`}>{formatStatus(status)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><History className="h-5 w-5 text-slate-500" /> Recent compliance events</h2>
            {events.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No Phase 1 compliance events yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium text-slate-900">{event.summary ?? formatStatus(event.to_status)}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.event_type?.replaceAll("_", " ")} • {event.actor_type ?? "system"} • {formatDateTime(event.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Phase 1 scope</h3>
                <p className="mt-1 text-sm text-slate-600">This screen now reads the production foundation tables. Uploads, previews, reminders, notifications, expiry automation, and regulator actions are deferred to later phases.</p>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700">
        <Lock className="h-4 w-4 text-emerald-700" />
        <p>Compliance records are private by default and scoped to your MSME ownership model.</p>
      </section>
    </section>
  );
}
