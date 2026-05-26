import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Database,
  Download,
  Filter,
  Flag,
  Landmark,
  LockKeyhole,
  Search,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/data/authorization-scope";
import {
  loadAdminMsmeRegistry,
  normalizeRegistryFilters,
  type AdminMsmeRegistryFilters,
  type AdminMsmeRegistryResult,
  type AdminMsmeRegistryRow,
  type AdminMsmeDistributionItem,
  type RegistrySourceState,
} from "@/lib/data/admin-msme-registry";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { AdminMsmeBulkActions } from "@/components/admin/admin-msme-bulk-actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Tone = "emerald" | "amber" | "rose" | "blue" | "slate" | "violet";

const toneClasses: Record<Tone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): AdminMsmeRegistryFilters {
  return normalizeRegistryFilters({
    q: firstParam(params.q),
    state: firstParam(params.state),
    sector: firstParam(params.sector),
    verificationStatus: firstParam(params.verificationStatus),
    reviewStatus: firstParam(params.reviewStatus),
    complianceStatus: firstParam(params.complianceStatus),
    digitalIdStatus: firstParam(params.digitalIdStatus),
    associationId: firstParam(params.associationId),
    flagged: firstParam(params.flagged),
    suspended: firstParam(params.suspended),
    createdFrom: firstParam(params.createdFrom),
    createdTo: firstParam(params.createdTo),
    page: Number(firstParam(params.page) ?? 1),
    pageSize: Number(firstParam(params.pageSize) ?? 25),
    selectedId: firstParam(params.selectedId),
  });
}

function buildHref(filters: AdminMsmeRegistryFilters, patch: Partial<AdminMsmeRegistryFilters>) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...patch };
  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  return `/dashboard/admin/msmes${params.size ? `?${params.toString()}` : ""}`;
}

function humanize(value: string | null | undefined, fallback = "Unavailable") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").toLowerCase();
  if (["verified", "approved", "active", "low"].includes(normalized)) return "emerald";
  if (["pending", "pending_review", "submitted", "under_review", "changes_requested", "medium", "draft"].includes(normalized)) return "amber";
  if (["rejected", "failed", "revoked", "suspended", "critical", "high", "expired"].includes(normalized)) return "rose";
  if (["not_started", "unavailable"].includes(normalized)) return "slate";
  return "blue";
}

function StatusPill({ value, fallback = "Unavailable" }: { value: string | null | undefined; fallback?: string }) {
  const label = humanize(value, fallback);
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[statusTone(value ?? fallback)]}`}>{label}</span>;
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: Tone }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-lg border ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
      </div>
    </article>
  );
}

function IntelligenceCard({ label, value, detail, tone = "slate", href }: { label: string; value: string; detail: string; tone?: Tone; href?: string | null }) {
  const body = (
    <article className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 hover:border-emerald-200">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500" title={detail}>{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[tone]}`}>{detail}</p>
    </article>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function MiniBarList({ items, emptyText }: { items: AdminMsmeDistributionItem[]; emptyText: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const content = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-black text-slate-800">{item.label}</span>
              <span className="font-bold text-slate-500">{item.count.toLocaleString()}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(2, item.percent)}%` }} />
            </div>
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-emerald-50">{content}</Link>
        ) : (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">{content}</div>
        );
      })}
    </div>
  );
}

function InsightPanel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-600">
        <Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function AttentionList({ rows, emptyText }: { rows: AdminMsmeRegistryRow[]; emptyText: string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link key={row.id} href={`/dashboard/admin/msmes/${encodeURIComponent(row.id)}`} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-emerald-50">
          <span className="block text-sm font-black text-slate-950">{row.businessName}</span>
          <span className="mt-1 block text-xs font-bold text-slate-500">{row.msmeId} - {row.state ?? "State unavailable"}</span>
        </Link>
      ))}
    </div>
  );
}

function formatCoverage(metric: { percent: number | null; available: boolean }) {
  if (!metric.available || metric.percent === null) return "Unavailable";
  return `${metric.percent}%`;
}

function RegistryIntelligence({ registry }: { registry: AdminMsmeRegistryResult }) {
  const intel = registry.intelligence;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Registry intelligence</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Read-only decision support</h2>
        </div>
        <p className="max-w-2xl text-sm font-semibold text-slate-600">Rule-based summaries from available registry sources. No AI scoring, automated enforcement, auto-suspension, or duplicate merging is performed.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <IntelligenceCard label="Verification Coverage" value={formatCoverage(intel.verificationCoverage)} detail={`${intel.verificationCoverage.count ?? "Unavailable"} verified`} tone="blue" href="/dashboard/admin/msmes?verificationStatus=verified" />
        <IntelligenceCard label="Credential Coverage" value={formatCoverage(intel.credentialCoverage)} detail={intel.credentialCoverage.available ? `${intel.credentialCoverage.count} with credential` : "Source unavailable"} tone="violet" href="/dashboard/admin/msmes?digitalIdStatus=active" />
        <IntelligenceCard label="Compliance Readiness" value={formatCoverage(intel.complianceCoverage)} detail={intel.complianceCoverage.available ? `${intel.complianceCoverage.count} ready` : "Source unavailable"} tone="emerald" />
        <IntelligenceCard label="Open Complaint Density" value={intel.complaintDensity.per100Msmes === null ? "Unavailable" : `${intel.complaintDensity.per100Msmes}/100`} detail={intel.complaintDensity.available ? `${intel.complaintDensity.openComplaints} open complaints` : "Source unavailable"} tone="rose" />
        <IntelligenceCard label="Flagged MSMEs" value={intel.flaggedSuspendedDistribution.flagged.toLocaleString()} detail={`${intel.flaggedSuspendedDistribution.suspended} suspended MSMEs`} tone={intel.flaggedSuspendedDistribution.flagged ? "rose" : "slate"} href="/dashboard/admin/msmes?flagged=true" />
        <IntelligenceCard label="Possible Duplicate Signals" value={intel.duplicateSignalCount.toLocaleString()} detail="CAC, TIN, phone, email, or name match groups" tone={intel.duplicateSignalCount ? "amber" : "slate"} />
        <IntelligenceCard label="Top State" value={intel.topState?.label ?? "Unavailable"} detail={intel.topState ? `${intel.topState.count} MSMEs` : "No state data"} tone="blue" href={intel.topState?.href} />
        <IntelligenceCard label="Top Sector" value={intel.topSector?.label ?? "Unavailable"} detail={intel.topSector ? `${intel.topSector.count} MSMEs` : "No sector data"} tone="emerald" href={intel.topSector?.href} />
        <IntelligenceCard label="Top Association" value={intel.topAssociation?.label ?? "Unavailable"} detail={intel.topAssociation ? `${intel.topAssociation.count} MSMEs` : "No association data"} tone="violet" />
        <IntelligenceCard label="High Attention" value={intel.highAttentionMsmeCount.toLocaleString()} detail="Flagged, suspended, restricted credential, or rejected/expired compliance" tone={intel.highAttentionMsmeCount ? "rose" : "slate"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <InsightPanel title="Needs Attention" icon={ClipboardList}>
          <div className="grid gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Unverified with complaint</h3>
              <div className="mt-2"><AttentionList rows={intel.needsAttention.unverifiedWithComplaint} emptyText="No unverified MSMEs with open complaints." /></div>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Suspended credential</h3>
              <div className="mt-2"><AttentionList rows={intel.needsAttention.suspendedCredential} emptyText={registry.sources.digital_identity_credentials.available ? "No suspended credentials found." : "Digital credential source unavailable."} /></div>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Flagged MSME</h3>
              <div className="mt-2"><AttentionList rows={intel.needsAttention.flaggedMsmes} emptyText="No flagged MSMEs found." /></div>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Compliance rejected / expired</h3>
              <div className="mt-2"><AttentionList rows={intel.needsAttention.complianceRejectedOrExpired} emptyText="No rejected or expired compliance profiles found." /></div>
            </div>
          </div>
        </InsightPanel>

        <InsightPanel title="Data Quality" icon={Database}>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Missing Contact", intel.dataQuality.missingOwnerContact, "amber" as Tone],
              ["Missing CAC/TIN", intel.dataQuality.missingCacOrTin, "amber" as Tone],
              ["Duplicate Indicators", intel.dataQuality.duplicatePhoneEmailCacTin, "rose" as Tone],
              ["Incomplete Profile", intel.dataQuality.incompleteProfile, "slate" as Tone],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{Number(value).toLocaleString()}</p>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[tone as Tone]}`}>Signal count</span>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel title="Growth Distribution" icon={TrendingUp}>
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Onboarding trend</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Last 30 days: {intel.onboardingTrend.last30Days.toLocaleString()} / previous 30 days: {intel.onboardingTrend.previous30Days.toLocaleString()}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Change: {intel.onboardingTrend.changePercent === null ? "Unavailable" : `${intel.onboardingTrend.changePercent}%`}</p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">By state</h3>
              <div className="mt-2"><MiniBarList items={intel.stateDistribution.slice(0, 5)} emptyText="No state distribution available." /></div>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">By sector</h3>
              <div className="mt-2"><MiniBarList items={intel.sectorDistribution.slice(0, 5)} emptyText="No sector distribution available." /></div>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">By association</h3>
              <div className="mt-2"><MiniBarList items={intel.associationDistribution.slice(0, 5)} emptyText="No association distribution available." /></div>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">By registration path</h3>
              <div className="mt-2"><MiniBarList items={intel.registrationPathDistribution} emptyText="No registration path distribution available." /></div>
            </div>
          </div>
        </InsightPanel>
      </div>
    </section>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function SelectFilter({
  name,
  label,
  value,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  value?: string;
  options: Array<string | { value: string; label: string }>;
  allLabel?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
        <option value="">{allLabel}</option>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: humanize(option) } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

function SourceBanner({ sources }: { sources: Record<string, RegistrySourceState> }) {
  const unavailable = Object.entries(sources).filter(([, source]) => !source.available && source.message !== "Not used in Phase 1 list view");
  if (!unavailable.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Some summaries are unavailable: {unavailable.map(([name]) => name).join(", ")}. The registry is showing available MSME records only.
    </div>
  );
}

function RegistryDetailPreview({ row }: { row: AdminMsmeRegistryRow | null }) {
  if (!row) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-semibold text-slate-500">
        Select an MSME to preview registry details.
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Detail preview</p>
          <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">{row.businessName}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">{row.msmeId}</p>
        </div>
        <StatusPill value={row.reviewStatus} />
      </div>
      <Link href={`/dashboard/admin/msmes/${encodeURIComponent(row.id)}`} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800">
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Open workspace
      </Link>

      <div className="mt-5 space-y-4">
        <section>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Profile</h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">Owner</dt><dd className="font-semibold text-slate-900">{row.ownerName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Created</dt><dd className="font-semibold text-slate-900">{formatDate(row.createdAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Location</dt><dd className="font-semibold text-slate-900">{[row.state, row.lga].filter(Boolean).join(" / ") || "Unavailable"}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Sector</dt><dd className="font-semibold text-slate-900">{[row.sector, row.businessType].filter(Boolean).join(" / ") || "Unavailable"}</dd></div>
          </dl>
        </section>

        <section className="grid gap-2">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Operational status</h3>
          <div className="flex flex-wrap gap-2">
            <StatusPill value={row.verificationStatus} />
            <StatusPill value={row.complianceStatus} />
            <StatusPill value={row.digitalIdStatus} />
            {row.flagged ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}>Flagged</span> : null}
            {row.suspended ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}>Suspended</span> : null}
          </div>
        </section>

        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Compliance summary</h3>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {row.complianceStatus ? humanize(row.complianceStatus) : "Unavailable"}
            {row.complianceScore !== null ? ` • ${row.complianceScore}%` : ""}
            {row.complianceRiskLevel ? ` • ${humanize(row.complianceRiskLevel)} risk` : ""}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Items: {row.complianceItemsCount ?? "Unavailable"}</p>
        </section>

        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Digital ID</h3>
          <p className="mt-2 text-sm font-semibold text-slate-900">{row.digitalId ?? "Unavailable"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Status: {humanize(row.digitalIdStatus)} • Issued: {formatDate(row.digitalIdIssuedAt)}</p>
        </section>

        <section className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Complaints</p>
            <p className="mt-2 font-black text-slate-950">{row.complaintCount ?? "Unavailable"}</p>
            <p className="text-xs font-semibold text-slate-500">Open: {row.openComplaintCount ?? "Unavailable"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Association</p>
            <p className="mt-2 font-semibold text-slate-950">{row.associationName ?? "Not linked"}</p>
          </div>
        </section>
      </div>
    </aside>
  );
}

export default async function AdminMsmesPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin", "reviewer", "fccpc_officer", "firs_officer"]);
  const params = await searchParams;
  const filters = parseFilters(params);

  let registry;
  try {
    const supabase = await createServiceRoleSupabaseClient();
    registry = await loadAdminMsmeRegistry(supabase, filters);
  } catch (error) {
    console.info("[admin-msme-registry]", {
      operation: "load_admin_msme_registry",
      filtersUsed: { hasSearch: Boolean(filters.q), page: filters.page, pageSize: filters.pageSize },
      rowCount: 0,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to load registry",
    });

    return (
      <section className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">MSME Registry</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Operational registry of MSME identity, compliance, and complaint signals.</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          Registry data is unavailable. Confirm Supabase service-role configuration and try again.
        </div>
      </section>
    );
  }

  const exportHref = `/api/admin/msmes/export?${new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString()}`;

  return (
    <section className="mx-auto max-w-[1800px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">MSME Registry</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Federal registry view across identity, compliance, association, complaint, and operational signals.</p>
        </div>
        <Link href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-black text-white shadow-sm hover:bg-emerald-900">
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Link>
      </div>

      <SourceBanner sources={registry.sources} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard icon={Building2} label="Total MSMEs" value={registry.kpis.totalMsmes.toLocaleString()} tone="emerald" />
        <KpiCard icon={BadgeCheck} label="Verified MSMEs" value={registry.kpis.verifiedMsmes.toLocaleString()} tone="blue" />
        <KpiCard icon={CalendarDays} label="Pending Review" value={registry.kpis.pendingReview.toLocaleString()} tone="amber" />
        <KpiCard icon={Flag} label="Flagged/Suspended" value={registry.kpis.flaggedOrSuspended.toLocaleString()} tone="rose" />
        <KpiCard icon={ShieldCheck} label="Active Credentials" value={registry.kpis.activeCredentials === null ? "Unavailable" : registry.kpis.activeCredentials.toLocaleString()} tone="violet" />
        <KpiCard icon={AlertCircle} label="Open Complaints" value={registry.kpis.openComplaints === null ? "Unavailable" : registry.kpis.openComplaints.toLocaleString()} tone="rose" />
      </section>

      <RegistryIntelligence registry={registry} />

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Filter className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          Registry filters
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-slate-500">Search</span>
            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <input name="q" defaultValue={filters.q ?? ""} placeholder="Business, BIN, owner, CAC, TIN, phone, email" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
            </span>
          </label>
          <SelectFilter name="state" label="State" value={filters.state} options={registry.options.states} />
          <SelectFilter name="sector" label="Sector" value={filters.sector} options={registry.options.sectors} />
          <SelectFilter name="verificationStatus" label="Verification" value={filters.verificationStatus} options={registry.options.verificationStatuses} />
          <SelectFilter name="reviewStatus" label="Review" value={filters.reviewStatus} options={registry.options.reviewStatuses} />
          <SelectFilter name="complianceStatus" label="Compliance" value={filters.complianceStatus} options={registry.options.complianceStatuses} />
          <SelectFilter name="digitalIdStatus" label="Digital ID" value={filters.digitalIdStatus} options={registry.options.digitalIdStatuses} />
          <SelectFilter name="associationId" label="Association" value={filters.associationId} options={registry.options.associations} />
          <SelectFilter name="flagged" label="Flagged" value={filters.flagged} options={[{ value: "true", label: "Flagged" }, { value: "false", label: "Not flagged" }]} />
          <SelectFilter name="suspended" label="Suspended" value={filters.suspended} options={[{ value: "true", label: "Suspended" }, { value: "false", label: "Not suspended" }]} />
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Created from</span>
            <input type="date" name="createdFrom" defaultValue={filters.createdFrom ?? ""} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Created to</span>
            <input type="date" name="createdTo" defaultValue={filters.createdTo ?? ""} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" />
          </label>
          <SelectFilter name="pageSize" label="Page size" value={String(filters.pageSize)} options={["25", "50", "100"]} />
          <input type="hidden" name="page" value="1" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white" type="submit">Apply filters</button>
          <Link href="/dashboard/admin/msmes" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">Reset</Link>
        </div>
      </form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-black text-slate-950">
              {registry.totalRows.toLocaleString()} result{registry.totalRows === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {ctx.role === "admin" ? <AdminMsmeBulkActions exportHref={exportHref} /> : null}
              <p className="text-xs font-bold text-slate-500">Page {registry.page} of {registry.totalPages}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  {ctx.role === "admin" ? <th className="px-4 py-3">Select</th> : null}
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">Compliance</th>
                  <th className="px-4 py-3">Digital ID</th>
                  <th className="px-4 py-3">Complaints</th>
                  <th className="px-4 py-3">Association</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3">Last action</th>
                </tr>
              </thead>
              <tbody>
                {registry.rows.length === 0 ? (
                  <tr>
                    <td colSpan={ctx.role === "admin" ? 14 : 13} className="px-4 py-12 text-center">
                      <Landmark className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                      <p className="mt-3 text-sm font-black text-slate-600">No MSMEs match the current filters.</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Adjust filters or clear search to expand the registry view.</p>
                    </td>
                  </tr>
                ) : registry.rows.map((row) => {
                  const active = registry.selectedRow?.id === row.id;
                  return (
                    <tr key={row.id} className={`border-t border-slate-100 align-top hover:bg-emerald-50/40 ${active ? "bg-emerald-50/60" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/admin/msmes/${encodeURIComponent(row.id)}`} className="block focus-visible:outline-none">
                          <span className="block font-black text-slate-950">{row.businessName}</span>
                          <span className="mt-1 block text-xs font-bold text-slate-500">{row.msmeId}</span>
                        </Link>
                      </td>
                      {ctx.role === "admin" ? (
                        <td className="px-4 py-3">
                          <input data-msme-bulk-checkbox type="checkbox" value={row.id} aria-label={`Select ${row.businessName}`} className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
                        </td>
                      ) : null}
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.ownerName}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.state ?? "Unavailable"}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.lga ?? "LGA unavailable"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.sector ?? "Unavailable"}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.businessType ?? "Type unavailable"}</p>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={row.verificationStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={row.reviewStatus} /></td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.complianceStatus} />
                        {row.complianceScore !== null ? <p className="mt-1 text-xs font-bold text-slate-500">{row.complianceScore}% score</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.digitalIdStatus} />
                        <p className="mt-1 text-xs font-bold text-slate-500">{row.digitalId ?? "No credential"}</p>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-800">
                        {row.complaintCount ?? "Unavailable"}
                        <p className="text-xs font-semibold text-slate-500">Open: {row.openComplaintCount ?? "Unavailable"}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.associationName ?? "Not linked"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.flagged ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}><Flag className="h-3 w-3" />Flagged</span> : null}
                          {row.suspended ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}><LockKeyhole className="h-3 w-3" />Suspended</span> : null}
                          {row.escalated ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.violet}`}>Escalated</span> : null}
                          {row.reviewRequested ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.blue}`}>Review requested</span> : null}
                          {!row.flagged && !row.suspended && !row.escalated && !row.reviewRequested ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.slate}`}>Clear</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{humanize(row.latestAdminAction, "No action")}</p>
                        <p className="text-xs font-semibold text-slate-500">{formatDate(row.latestAdminActionAt)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <Link href={buildHref(filters, { page: Math.max(1, registry.page - 1) })} className={`rounded-lg border px-3 py-2 text-sm font-black ${registry.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Previous</Link>
            <p className="text-xs font-bold text-slate-500">Showing {registry.rows.length.toLocaleString()} of {registry.totalRows.toLocaleString()}</p>
            <Link href={buildHref(filters, { page: Math.min(registry.totalPages, registry.page + 1) })} className={`rounded-lg border px-3 py-2 text-sm font-black ${registry.page >= registry.totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Next</Link>
          </div>
        </div>

        <RegistryDetailPreview row={registry.selectedRow} />
      </section>
    </section>
  );
}
