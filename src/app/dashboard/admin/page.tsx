import { redirect } from "next/navigation";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getDefaultDashboardRoute } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { normalizeReviewStatus } from "@/lib/data/msme-workflow";
import { loadAdminWorkQueues, type AdminWorkQueues } from "@/lib/data/admin-work-queues";
import Link from "next/link";

function StatusPill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "emerald" | "amber" | "rose" | "slate" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function SummaryCard({
  title,
  children,
  href,
  unavailable,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  unavailable?: boolean;
}) {
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {href && !unavailable ? (
          <Link href={href} className="text-xs font-semibold text-emerald-700 hover:underline">Open</Link>
        ) : (
          <StatusPill>Not yet available</StatusPill>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-600">{children}</div>
    </article>
  );
}

function formatQueueDate(value: string | null | undefined) {
  if (!value) return "Date not recorded";
  return new Date(value).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function formatOldestAge(value: string | null | undefined) {
  if (!value) return "No pending age";
  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "New";
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function labelText(value: string | null | undefined) {
  return String(value ?? "unknown").replaceAll("_", " ");
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "emerald" | "amber" | "rose" | "blue" | "slate" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return <span className={`rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${tones[tone]}`}>{children}</span>;
}

function statusTone(value: string | null | undefined): "emerald" | "amber" | "rose" | "blue" | "slate" {
  const normalized = String(value ?? "").toLowerCase();
  if (["active", "approved", "resolved", "closed"].includes(normalized)) return "emerald";
  if (["critical", "high", "suspended", "revoked", "rejected", "escalated"].includes(normalized)) return "rose";
  if (["pending", "pending_review", "submitted", "resubmitted", "under_review", "medium"].includes(normalized)) return "amber";
  if (["low", "open", "in_progress", "regulator_review"].includes(normalized)) return "blue";
  return "slate";
}

function QueueCard<T>({
  title,
  emptyText,
  queue,
  href,
  ctaLabel = "View queue",
  unavailableCtaLabel = "Workspace pending",
  renderRecord,
}: {
  title: string;
  emptyText: string;
  queue: { records: T[]; count: number; oldestAt: string | null; unavailable: boolean };
  href?: string;
  ctaLabel?: string;
  unavailableCtaLabel?: string;
  renderRecord: (record: T) => React.ReactNode;
}) {
  const hasLink = Boolean(href) && !queue.unavailable;

  return (
    <article className="flex min-h-[320px] flex-col rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">Oldest: {formatOldestAge(queue.oldestAt)}</p>
        </div>
        <div className="rounded-lg bg-slate-950 px-3 py-2 text-right text-white">
          <p className="text-xl font-semibold">{queue.count.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-300">items</p>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-2">
        {queue.unavailable ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">Queue source unavailable.</p>
        ) : queue.records.length ? (
          queue.records.map((record, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {renderRecord(record)}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">{emptyText}</p>
        )}
      </div>

      {hasLink ? (
        <Link href={href as string} className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          {ctaLabel}
        </Link>
      ) : (
        <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-500">
          {queue.unavailable ? "Source unavailable" : unavailableCtaLabel}
        </span>
      )}
    </article>
  );
}

export default async function DashboardPage() {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") {
    console.info("[admin-dashboard-role-guard]", {
      resolvedRole: ctx.role,
      expectedRole: "admin",
      redirectReason: "admin_dashboard_role_mismatch",
      currentPathname: "/dashboard/admin",
    });
    redirect(getDefaultDashboardRoute(ctx.role));
  }
  console.info("[admin-dashboard-role-guard]", {
    resolvedRole: ctx.role,
    expectedRole: "admin",
    redirectReason: null,
    currentPathname: "/dashboard/admin",
  });

  const supabase = await createServiceRoleSupabaseClient();
  const [
    { data: msmes },
    { data: complaints },
    { data: payments },
    { data: kyc },
    { data: associations },
    { count: manufacturerCount },
    { count: riskAlerts },
    workQueues,
  ] = await Promise.all([
    supabase.from("msmes").select("id,state,sector,verification_status,review_status,suspended,created_at"),
    supabase.from("complaints").select("severity,status,created_at"),
    supabase.from("payments").select("amount,status,created_at"),
    supabase.from("compliance_profiles").select("msme_id,overall_status,created_at"),
    supabase.from("association_members").select("association_id"),
    supabase.from("manufacturer_profiles").select("*", { count: "exact", head: true }),
    supabase.from("manufacturer_profiles").select("*", { count: "exact", head: true }).eq("counterfeit_risk_flag", true),
    loadAdminWorkQueues(supabase),
  ]);

  const msmeRows = msmes ?? [];
  const totalMsmes = msmeRows.length;
  const verifiedMsmes = msmeRows.filter((row) => row.verification_status === "verified").length;
  const pendingReviews = msmeRows.filter((row) => ["pending_review", "submitted", "changes_requested"].includes(normalizeReviewStatus(row.verification_status, row.review_status))).length;
  const suspendedMsmes = msmeRows.filter((row) => row.suspended).length;

  const complaintBySeverity = Object.entries((complaints ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.severity ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}));

  const kycRows = kyc ?? [];
  const kycRate = kycRows.length ? Math.round((kycRows.filter((k) => k.overall_status === "verified").length / kycRows.length) * 100) : 0;
  const recordedPayments = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const topStates = Object.entries(msmeRows.reduce<Record<string, number>>((acc, row) => { acc[row.state] = (acc[row.state] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topSectors = Object.entries(msmeRows.reduce<Record<string, number>>((acc, row) => { acc[row.sector] = (acc[row.sector] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topAssociations = Object.entries((associations ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.association_id] = (acc[row.association_id] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-900 p-7 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200">
          Operational view of the platform records currently available to admins. This dashboard reports recorded counts and routes to working admin tools where those tools exist.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/dashboard/admin/digital-ids" className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Digital IDs</Link>
          <Link href="/dashboard/admin/associations" className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Associations</Link>
          <Link href="/dashboard/admin/association-upload" className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Bulk upload</Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Operational Work Queues</h2>
            <p className="mt-1 text-sm text-slate-600">Actionable admin queues from current platform records. Empty states mean no matching records were returned.</p>
          </div>
          <StatusPill tone="amber">Service-role reads after admin validation</StatusPill>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          <QueueCard
            title="Pending Digital ID Approvals"
            emptyText="No pending digital ID approvals"
            queue={workQueues.pendingDigitalIdApprovals}
            href="/dashboard/admin/digital-ids"
            renderRecord={(record: AdminWorkQueues["pendingDigitalIdApprovals"]["records"][number]) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{record.businessName}</p>
                    <p className="text-xs text-slate-500">{record.msmeId}</p>
                  </div>
                  <Badge tone={statusTone(record.credentialStatus)}>{labelText(record.credentialStatus)}</Badge>
                </div>
                <p className="text-xs text-slate-500">Submitted {formatQueueDate(record.submittedAt)}</p>
              </div>
            )}
          />

          <QueueCard
            title="Pending Compliance Reviews"
            emptyText="No compliance reviews awaiting action"
            queue={workQueues.pendingComplianceReviews}
            href="/dashboard/reviews/compliance"
            renderRecord={(record: AdminWorkQueues["pendingComplianceReviews"]["records"][number]) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{record.businessName}</p>
                    <p className="text-xs text-slate-500">{record.requirement}</p>
                  </div>
                  <Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{record.regulator}</span>
                  <span>{record.evidenceCount} evidence file{record.evidenceCount === 1 ? "" : "s"}</span>
                  <span>Submitted {formatQueueDate(record.submittedAt)}</span>
                </div>
              </div>
            )}
          />

          <QueueCard
            title="Open Complaints"
            emptyText="No open complaints"
            queue={workQueues.openComplaints}
            href="/dashboard/fccpc"
            renderRecord={(record: AdminWorkQueues["openComplaints"]["records"][number]) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{record.complaintReference}</p>
                    <p className="text-xs text-slate-500">{record.businessName}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge tone={statusTone(record.severity)}>{labelText(record.severity)}</Badge>
                    <Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Submitted {formatQueueDate(record.submittedAt)}</span>
                  <Link href={`/dashboard/fccpc/${record.id}`} className="font-semibold text-emerald-700 hover:underline">Open workspace</Link>
                </div>
              </div>
            )}
          />

          <QueueCard
            title="Flagged MSMEs"
            emptyText="No flagged MSMEs"
            queue={workQueues.flaggedMsmes}
            unavailableCtaLabel="Workspace pending"
            renderRecord={(record: AdminWorkQueues["flaggedMsmes"]["records"][number]) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{record.businessName}</p>
                    <p className="text-xs text-slate-500">{record.msmeId}</p>
                  </div>
                  <Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>
                </div>
                <p className="text-xs text-slate-500">{record.reason}</p>
              </div>
            )}
          />

          <QueueCard
            title="Suspended Credentials"
            emptyText="No suspended credentials"
            queue={workQueues.suspendedCredentials}
            href="/dashboard/admin/digital-ids"
            renderRecord={(record: AdminWorkQueues["suspendedCredentials"]["records"][number]) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{record.businessName}</p>
                    <p className="text-xs text-slate-500">{record.msmeId}</p>
                  </div>
                  <Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>
                </div>
                <p className="text-xs text-slate-500">Suspended {formatQueueDate(record.suspendedAt)}</p>
                <p className="text-xs text-slate-500">{record.reason}</p>
              </div>
            )}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total registered MSMEs" value={totalMsmes.toLocaleString()} unavailable definition="Total MSME records visible to the admin dashboard. The full admin registry page is not available yet." />
        <DashboardCard title="Verified businesses" value={verifiedMsmes.toLocaleString()} unavailable definition="MSME records with verification_status set to verified." />
        <DashboardCard title="Pending MSME reviews" value={pendingReviews.toLocaleString()} unavailable definition="MSME records normalized to pending_review, submitted, or changes_requested." />
        <DashboardCard title="Suspended MSMEs" value={suspendedMsmes.toLocaleString()} unavailable definition="MSME records where the suspended field is true." />
        <DashboardCard title="Recorded platform payments" value={`₦${recordedPayments.toLocaleString()}`} unavailable definition="Sum of amounts recorded in the payments table. This is not reported as tax revenue unless the payment records are confirmed tax-related." />
        <DashboardCard title="KYC verification rate" value={`${kycRate}%`} unavailable definition="Share of compliance_profiles rows where overall_status is verified." />
        <DashboardCard title="Manufacturer profiles" value={(manufacturerCount ?? 0).toLocaleString()} unavailable definition="Count of manufacturer profile records. Admin traceability workspace is not available yet." />
        <DashboardCard title="Product risk alerts" value={(riskAlerts ?? 0).toLocaleString()} unavailable definition="Manufacturer profiles where counterfeit_risk_flag is true." />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Complaints by severity" unavailable>
          {complaintBySeverity.length ? complaintBySeverity.map(([severity, count]) => (
            <div key={severity} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="capitalize">{severity}</span>
              <span className="font-semibold text-slate-950">{count}</span>
            </div>
          )) : <p>No complaint severity records yet.</p>}
        </SummaryCard>
        <SummaryCard title="Top states by registration" unavailable>
          {topStates.length ? topStates.map(([state, count]) => (
            <div key={state} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{state || "Unknown state"}</span>
              <span className="font-semibold text-slate-950">{count}</span>
            </div>
          )) : <p>No state records yet.</p>}
        </SummaryCard>
        <SummaryCard title="Top sectors by registration" unavailable>
          {topSectors.length ? topSectors.map(([sector, count]) => (
            <div key={sector} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{sector || "Unknown sector"}</span>
              <span className="font-semibold text-slate-950">{count}</span>
            </div>
          )) : <p>No sector records yet.</p>}
        </SummaryCard>
      </div>

      <SummaryCard title="Association member concentration" href="/dashboard/admin/associations">
        {topAssociations.length ? topAssociations.map(([id, total]) => (
          <div key={id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="font-mono text-xs text-slate-500">{id ? `${id.slice(0, 8)}...` : "Unassigned"}</span>
            <span className="font-semibold text-slate-950">{total} member records</span>
          </div>
        )) : <p>No association member records yet.</p>}
        <p className="text-xs text-slate-500">This summary uses association member record counts only; member approval workflow detail is not available on this dashboard yet.</p>
      </SummaryCard>
    </section>
  );
}
