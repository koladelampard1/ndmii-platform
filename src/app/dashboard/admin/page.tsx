import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  FileClock,
  FileText,
  Factory,
  Flag,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getDefaultDashboardRoute, isPlatformAdmin } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { normalizeReviewStatus } from "@/lib/data/msme-workflow";
import { loadAdminWorkQueues, type AdminWorkQueues } from "@/lib/data/admin-work-queues";

type Tone = "emerald" | "blue" | "amber" | "rose" | "violet" | "slate";

type QueueShape<T> = {
  records: T[];
  count: number;
  oldestAt: string | null;
  unavailable: boolean;
};

const toneStyles: Record<Tone, { icon: string; badge: string; button: string; soft: string }> = {
  emerald: {
    icon: "bg-emerald-50 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
    soft: "bg-emerald-50 text-emerald-700",
  },
  blue: {
    icon: "bg-blue-50 text-blue-700",
    badge: "bg-blue-50 text-blue-700",
    button: "bg-blue-700 text-white hover:bg-blue-800",
    soft: "bg-blue-50 text-blue-700",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-800",
    button: "bg-amber-600 text-white hover:bg-amber-700",
    soft: "bg-amber-50 text-amber-800",
  },
  rose: {
    icon: "bg-rose-50 text-rose-700",
    badge: "bg-rose-50 text-rose-700",
    button: "bg-red-700 text-white hover:bg-red-800",
    soft: "bg-rose-50 text-rose-700",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700",
    badge: "bg-violet-50 text-violet-700",
    button: "bg-violet-700 text-white hover:bg-violet-800",
    soft: "bg-violet-50 text-violet-700",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600",
    badge: "bg-slate-100 text-slate-600",
    button: "bg-slate-900 text-white hover:bg-slate-800",
    soft: "bg-slate-100 text-slate-600",
  },
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatOldestAge(value: string | null | undefined) {
  if (!value) return "-";
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

function statusTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").toLowerCase();
  if (["active", "approved", "resolved", "closed", "verified", "healthy"].includes(normalized)) return "emerald";
  if (["critical", "high", "suspended", "revoked", "rejected", "escalated"].includes(normalized)) return "rose";
  if (["pending", "pending_review", "submitted", "resubmitted", "under_review", "medium", "changes_requested"].includes(normalized)) return "amber";
  if (["low", "open", "in_progress", "regulator_review"].includes(normalized)) return "blue";
  return "slate";
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold capitalize ${toneStyles[tone].badge}`}>{children}</span>;
}

function KpiCard({ title, value, definition, icon: Icon, tone }: { title: string; value: string; definition: string; icon: LucideIcon; tone: Tone }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start gap-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneStyles[tone].icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-600">{title}</h3>
          <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
            {definition}
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </p>
        </div>
      </div>
    </article>
  );
}

function SystemIndicator({ icon: Icon, label, value, tone = "slate" }: { icon: LucideIcon; label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex min-w-[170px] items-center gap-3 border-slate-200 py-2 md:border-r md:pr-8 last:border-r-0">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneStyles[tone].icon}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function QueueCard<T>({
  title,
  icon: Icon,
  tone,
  queue,
  emptyText,
  href,
  ctaLabel,
  pendingWorkspace,
  renderRecord,
}: {
  title: string;
  icon: LucideIcon;
  tone: Tone;
  queue: QueueShape<T>;
  emptyText: string;
  href?: string;
  ctaLabel: string;
  pendingWorkspace?: boolean;
  renderRecord: (record: T) => ReactNode;
}) {
  const canOpen = Boolean(href) && !pendingWorkspace && !queue.unavailable;
  const records = queue.records.slice(0, 3);

  return (
    <article className="flex min-h-[356px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneStyles[tone].icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black leading-snug text-slate-950">{title}</h3>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-3xl font-black tracking-tight text-slate-950">{queue.count.toLocaleString()}</p>
        <p className="text-sm font-bold text-slate-500">Items</p>
      </div>

      <div className="mt-3">
        <Badge tone={queue.unavailable ? "slate" : tone}>Oldest: {queue.unavailable ? "Source unavailable" : formatOldestAge(queue.oldestAt)}</Badge>
      </div>

      <div className="mt-4 flex-1 space-y-2">
        {queue.unavailable ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">Queue source unavailable.</div>
        ) : records.length ? (
          records.map((record, index) => (
            <div key={index} className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
              {renderRecord(record)}
            </div>
          ))
        ) : (
          <div className="grid min-h-[128px] place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <div>
              <LockKeyhole className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-slate-500">{emptyText}</p>
            </div>
          </div>
        )}
      </div>

      {canOpen ? (
        <Link href={href as string} className={`mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${toneStyles[tone].button}`}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-black text-slate-500">
          {queue.unavailable ? "Source unavailable" : "Workspace pending"}
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </article>
  );
}

function QueueRecordLine({
  title,
  subtitle,
  age,
  badge,
}: {
  title: string;
  subtitle: string;
  age?: string | null;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        {badge}
        {age ? <p className="mt-1 text-xs font-black text-slate-500">{formatOldestAge(age)}</p> : null}
      </div>
    </div>
  );
}

function InsightItem({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: Tone }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-slate-200 py-2 md:border-r md:pr-6 last:border-r-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneStyles[tone].icon}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function getTopEntry(rows: [string, number][], emptyLabel: string) {
  const [label, count] = rows[0] ?? [emptyLabel, 0];
  return `${label || emptyLabel} (${count.toLocaleString()} MSME${count === 1 ? "" : "s"})`;
}

export default async function DashboardPage() {
  const ctx = await getCurrentUserContext();
  if (!isPlatformAdmin(ctx.role)) {
    console.info("[admin-dashboard-role-guard]", {
      resolvedRole: ctx.role,
      expectedRole: "admin,super_admin",
      redirectReason: "admin_dashboard_role_mismatch",
      currentPathname: "/dashboard/admin",
    });
    redirect(getDefaultDashboardRoute(ctx.role));
  }
  console.info("[admin-dashboard-role-guard]", {
    resolvedRole: ctx.role,
    expectedRole: "admin,super_admin",
    redirectReason: null,
    currentPathname: "/dashboard/admin",
  });

  const supabase = await createServiceRoleSupabaseClient();
  const [
    { data: msmes },
    { data: complaints },
    { data: kyc },
    { count: totalAdmins },
    workQueues,
  ] = await Promise.all([
    supabase.from("msmes").select("id,state,sector,verification_status,review_status,suspended,created_at"),
    supabase.from("complaints").select("status,created_at"),
    supabase.from("compliance_profiles").select("msme_id,overall_status,created_at"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "admin"),
    loadAdminWorkQueues(supabase),
  ]);

  const msmeRows = msmes ?? [];
  const complaintRows = complaints ?? [];
  const kycRows = kyc ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const totalMsmes = msmeRows.length;
  const verifiedMsmes = msmeRows.filter((row) => row.verification_status === "verified").length;
  const pendingReviews = msmeRows.filter((row) =>
    ["pending_review", "submitted", "changes_requested"].includes(normalizeReviewStatus(row.verification_status, row.review_status)),
  ).length;
  const kycRate = kycRows.length ? Math.round((kycRows.filter((row) => row.overall_status === "verified").length / kycRows.length) * 100) : 0;
  const recentRegistrations = msmeRows.filter((row) => row.created_at && new Date(row.created_at).getTime() >= monthStart).length;
  const newComplaints = complaintRows.filter((row) => row.created_at && new Date(row.created_at).getTime() >= monthStart).length;

  const topStates = Object.entries(
    msmeRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.state || "State unavailable";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const topSectors = Object.entries(
    msmeRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.sector || "Sector unavailable";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mx-auto max-w-[1680px] space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Welcome back, Admin</h2>
              <CheckCircle2 className="h-5 w-5 fill-emerald-100 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">Operational overview of platform records and admin work queues.</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs font-bold text-slate-500">Last updated: {formatDateTime(now)}</p>
            <Link href="/dashboard/admin" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SystemIndicator icon={Clock3} label="Platform uptime" value="Not connected" />
          <SystemIndicator icon={Users} label="Total admins" value={totalAdmins === null ? "Unavailable" : totalAdmins.toLocaleString()} />
          <SystemIndicator icon={ShieldCheck} label="Active sessions" value="Unavailable" />
          <SystemIndicator icon={CheckCircle2} label="System status" value="Healthy" tone="emerald" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total MSMEs" value={totalMsmes.toLocaleString()} definition="Registered on platform" icon={Building2} tone="emerald" />
        <KpiCard title="Verified MSMEs" value={verifiedMsmes.toLocaleString()} definition="Verification complete" icon={BadgeCheck} tone="blue" />
        <KpiCard title="Pending Reviews" value={pendingReviews.toLocaleString()} definition="Awaiting action" icon={FileClock} tone="amber" />
        <KpiCard title="Open Complaints" value={workQueues.openComplaints.count.toLocaleString()} definition="Require attention" icon={AlertCircle} tone="rose" />
        <KpiCard title="Suspended Credentials" value={workQueues.suspendedCredentials.count.toLocaleString()} definition="Currently suspended" icon={LockKeyhole} tone="violet" />
      </section>

      <Link href="/dashboard/lcdbo" className="group flex flex-col gap-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-950 to-emerald-800 p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><Factory className="h-6 w-6 text-emerald-200" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Programme Operations</p>
          <h2 className="mt-1 text-xl font-black">LCDBO Programme Operations</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-emerald-50/85">Review enrolments, manage cluster interests, assign officers, track readiness, request documents and export participation data.</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-black text-white">Open workspace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Operational Work Queues</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Actionable admin queues from current platform records.</p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
            View all queues
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
          <QueueCard
            title="Pending Digital ID Approvals"
            icon={BadgeCheck}
            tone="emerald"
            queue={workQueues.pendingDigitalIdApprovals}
            emptyText="No pending digital ID approvals"
            href="/dashboard/admin/digital-ids"
            ctaLabel="View Digital IDs"
            renderRecord={(record: AdminWorkQueues["pendingDigitalIdApprovals"]["records"][number]) => (
              <QueueRecordLine title={record.businessName} subtitle={record.msmeId} age={record.submittedAt} badge={<Badge tone={statusTone(record.credentialStatus)}>{labelText(record.credentialStatus)}</Badge>} />
            )}
          />

          <QueueCard
            title="Pending Compliance Reviews"
            icon={ShieldCheck}
            tone="blue"
            queue={workQueues.pendingComplianceReviews}
            emptyText="No compliance reviews awaiting action"
            href="/dashboard/reviews/compliance"
            ctaLabel="View Compliance Reviews"
            renderRecord={(record: AdminWorkQueues["pendingComplianceReviews"]["records"][number]) => (
              <QueueRecordLine title={record.businessName} subtitle={`${record.regulator} - ${record.requirement}`} age={record.submittedAt} badge={<Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>} />
            )}
          />

          <QueueCard
            title="Open Complaints"
            icon={AlertCircle}
            tone="rose"
            queue={workQueues.openComplaints}
            emptyText="No open complaints"
            href="/dashboard/fccpc"
            ctaLabel="View Complaints"
            renderRecord={(record: AdminWorkQueues["openComplaints"]["records"][number]) => (
              <QueueRecordLine title={record.complaintReference} subtitle={record.businessName} age={record.submittedAt} badge={<Badge tone={statusTone(record.severity)}>{labelText(record.severity)}</Badge>} />
            )}
          />

          <QueueCard
            title="Flagged MSMEs"
            icon={Flag}
            tone="amber"
            queue={workQueues.flaggedMsmes}
            emptyText="No flagged MSMEs"
            ctaLabel="Workspace pending"
            pendingWorkspace
            renderRecord={(record: AdminWorkQueues["flaggedMsmes"]["records"][number]) => (
              <QueueRecordLine title={record.businessName} subtitle={record.reason} age={record.createdAt} badge={<Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>} />
            )}
          />

          <QueueCard
            title="Suspended Credentials"
            icon={LockKeyhole}
            tone="violet"
            queue={workQueues.suspendedCredentials}
            emptyText="No suspended credentials"
            href="/dashboard/admin/digital-ids"
            ctaLabel="View Digital IDs"
            renderRecord={(record: AdminWorkQueues["suspendedCredentials"]["records"][number]) => (
              <QueueRecordLine title={record.businessName} subtitle={record.msmeId} age={record.suspendedAt} badge={<Badge tone={statusTone(record.status)}>{labelText(record.status)}</Badge>} />
            )}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div>
          <h2 className="text-lg font-black text-slate-950">Platform Insights</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Quick insights from platform data.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <InsightItem icon={Building2} label="Top Registration State" value={getTopEntry(topStates, "State unavailable")} tone="emerald" />
          <InsightItem icon={FileText} label="Top Sector" value={getTopEntry(topSectors, "Sector unavailable")} tone="blue" />
          <InsightItem icon={CheckCircle2} label="Verification Rate" value={`KYC verified: ${kycRate}%`} tone="emerald" />
          <InsightItem icon={Users} label="Recent Registrations" value={`This month: ${recentRegistrations.toLocaleString()}`} tone="violet" />
          <InsightItem icon={AlertCircle} label="New Complaints" value={`This month: ${newComplaints.toLocaleString()}`} tone="rose" />
        </div>
      </section>
    </section>
  );
}
