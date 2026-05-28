import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  Filter,
  KeyRound,
  Link2,
  QrCode,
  Search,
  ShieldAlert,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/data/authorization-scope";
import {
  loadAdminDigitalIdQueue,
  normalizeAdminDigitalIdFilters,
  type AdminDigitalIdFilters,
  type AdminDigitalIdQueueRow,
  type AdminDigitalIdSourceState,
} from "@/lib/data/admin-digital-ids";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

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

function parseFilters(params: Record<string, string | string[] | undefined>): AdminDigitalIdFilters {
  return normalizeAdminDigitalIdFilters({
    q: firstParam(params.q),
    credentialStatus: firstParam(params.credentialStatus),
    lifecycleState: firstParam(params.lifecycleState),
    msmeReviewStatus: firstParam(params.msmeReviewStatus),
    verificationReviewStatus: firstParam(params.verificationReviewStatus),
    tokenReadiness: firstParam(params.tokenReadiness),
    signatureReadiness: firstParam(params.signatureReadiness),
    qrReadiness: firstParam(params.qrReadiness),
    expiryState: firstParam(params.expiryState),
    attentionLevel: firstParam(params.attentionLevel),
    state: firstParam(params.state),
    sector: firstParam(params.sector),
    createdFrom: firstParam(params.createdFrom),
    createdTo: firstParam(params.createdTo),
    sort: firstParam(params.sort),
    page: Number(firstParam(params.page) ?? 1),
    pageSize: Number(firstParam(params.pageSize) ?? 25),
    selectedId: firstParam(params.selectedId),
  });
}

function buildHref(filters: AdminDigitalIdFilters, patch: Partial<AdminDigitalIdFilters>) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...patch };
  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  return `/dashboard/admin/digital-ids${params.size ? `?${params.toString()}` : ""}`;
}

function exportHref(filters: AdminDigitalIdFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || key === "selectedId") return;
    params.set(key, String(value));
  });
  return `/api/admin/digital-ids/export?${params.toString()}`;
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
  if (["active", "approved", "ready", "valid", "likely_valid", "normal", "absolute"].includes(normalized)) return "emerald";
  if (["pending", "watch", "relative", "expiring_soon"].includes(normalized)) return "amber";
  if (["suspended", "revoked", "expired", "missing", "likely_invalid", "critical", "elevated", "active_expired"].includes(normalized)) return "rose";
  if (["unavailable"].includes(normalized)) return "slate";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
  options: string[] | Array<{ value: string; label: string }>;
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

function SourceBanner({ sources }: { sources: Record<string, AdminDigitalIdSourceState> }) {
  const unavailable = Object.entries(sources).filter(([, source]) => !source.available);
  if (!unavailable.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Some credential queue sources are unavailable: {unavailable.map(([name]) => name).join(", ")}. The queue is using available sources only.
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-slate-50 p-3">
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SignalChips({ row }: { row: AdminDigitalIdQueueRow }) {
  if (!row.attentionSignals.length) return <StatusPill value="normal" fallback="No attention signals" />;
  return (
    <div className="flex flex-wrap gap-1">
      {row.attentionSignals.slice(0, 3).map((signal) => (
        <span key={signal.code} className={`inline-flex max-w-[240px] rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[statusTone(signal.severity)]}`}>{signal.label}</span>
      ))}
    </div>
  );
}

function EventList({ row, limit }: { row: AdminDigitalIdQueueRow; limit: number }) {
  const events = row.eventTimeline.slice(0, limit);
  if (!events.length) return <p className="text-xs font-semibold text-slate-500">No credential event history available.</p>;
  return (
    <ol className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          <span className="font-black text-slate-800">{humanize(event.action)}</span>
          <span className="shrink-0 font-semibold text-slate-500">{formatDateTime(event.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}

function DetailPanel({ row }: { row: AdminDigitalIdQueueRow | null }) {
  if (!row) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-semibold text-slate-500">
        Select a credential to preview operational readiness.
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Credential lifecycle preview</p>
          <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">{row.businessName}</h2>
          <p className="mt-1 break-all text-xs font-bold text-slate-500">{row.ndmiiId}</p>
        </div>
        <StatusPill value={row.attentionLevel} />
      </div>

      <div className="mt-5 space-y-3">
        <PreviewSection title="Credential summary">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">BIN</dt><dd className="font-semibold text-slate-900">{row.msmeId}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Status</dt><dd><StatusPill value={row.credentialStatus} /></dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Lifecycle</dt><dd><StatusPill value={row.lifecycleState} /></dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Expiry</dt><dd><StatusPill value={row.expiryState} /></dd></div>
          </dl>
        </PreviewSection>

        <PreviewSection title="MSME summary">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">Owner</dt><dd className="font-semibold text-slate-900">{row.ownerName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">State</dt><dd className="font-semibold text-slate-900">{row.state ?? "Unavailable"}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Sector</dt><dd className="font-semibold text-slate-900">{row.sector ?? "Unavailable"}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Review</dt><dd><StatusPill value={row.msmeReviewStatus} /></dd></div>
          </dl>
        </PreviewSection>

        <PreviewSection title="Lifecycle timestamps">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">Issued</dt><dd className="font-semibold text-slate-900">{formatDateTime(row.issuedAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Approved</dt><dd className="font-semibold text-slate-900">{formatDateTime(row.approvedAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Suspended</dt><dd className="font-semibold text-slate-900">{formatDateTime(row.suspendedAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Revoked</dt><dd className="font-semibold text-slate-900">{formatDateTime(row.revokedAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Expires</dt><dd className="font-semibold text-slate-900">{formatDateTime(row.expiryAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Updated</dt><dd className="font-semibold text-slate-900">{formatDateTime(row.updatedAt)}</dd></div>
          </dl>
        </PreviewSection>

        <PreviewSection title="Token and public route readiness">
          <div className="flex flex-wrap gap-2">
            <StatusPill value={row.tokenReadiness} fallback="Token hash" />
            <StatusPill value={row.signatureReadiness} fallback="Signature" />
            <StatusPill value={row.qrReadiness} fallback="QR" />
            <StatusPill value={row.publicVerificationReadiness} />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{row.publicVerificationRoute ? "Public verification route is present. Raw token is hidden." : "No QR/public verification route available."}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{row.publicVerificationReason}</p>
          {row.safeTestHref ? (
            <Link href={row.safeTestHref} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Test public link
            </Link>
          ) : null}
          <Link href={`/dashboard/admin/digital-ids/${encodeURIComponent(row.credentialId)}`} className="mt-3 ml-2 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open lifecycle workspace
          </Link>
        </PreviewSection>

        <PreviewSection title="Latest credential events">
          <EventList row={row} limit={20} />
        </PreviewSection>

        <PreviewSection title="Verification and compliance">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">Verification review</dt><dd><StatusPill value={row.verificationReviewStatus} /></dd></div>
            <div><dt className="text-xs font-bold text-slate-500">MSME verification</dt><dd><StatusPill value={row.msmeVerificationStatus} /></dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Compliance</dt><dd><StatusPill value={row.complianceStatus} /></dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Score</dt><dd className="font-semibold text-slate-900">{row.complianceScore ?? "Unavailable"}</dd></div>
          </dl>
        </PreviewSection>

        <PreviewSection title="Complaints and attention">
          <p className="text-sm font-black text-slate-950">{row.complaintCount ?? "Unavailable"} complaint(s)</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Open: {row.openComplaintCount ?? "Unavailable"}</p>
          <div className="mt-2"><SignalChips row={row} /></div>
        </PreviewSection>

        <PreviewSection title="Recommended next operational focus">
          <p className="text-sm font-semibold leading-6 text-slate-800">{row.recommendedFocus}</p>
        </PreviewSection>
      </div>
    </aside>
  );
}

export default async function AdminDigitalIdsPage({ searchParams }: PageProps) {
  await requireRole(["admin", "super_admin", "reviewer", "fccpc_officer", "firs_officer"]);
  const params = await searchParams;
  const filters = parseFilters(params);

  let queue;
  try {
    const supabase = await createServiceRoleSupabaseClient();
    queue = await loadAdminDigitalIdQueue(supabase, filters);
  } catch (error) {
    console.info("[admin-digital-ids]", {
      operation: "load_admin_digital_id_queue",
      filtersUsed: { hasSearch: Boolean(filters.q), page: filters.page, pageSize: filters.pageSize },
      rowCount: 0,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to load digital ID queue",
    });

    return (
      <section className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Digital ID Credential Queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Read-only operational queue for credential visibility and readiness.</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          Digital ID queue data is unavailable. Confirm Supabase service-role configuration and try again.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1900px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Digital ID Credential Queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Governed operational queue for credential lifecycle, public verification readiness, QR health, expiry posture, and attention signals. Lifecycle mutations run from each credential workspace.</p>
        </div>
        <Link href={exportHref(filters)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-black text-white shadow-sm hover:bg-emerald-900">
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Link>
      </div>

      <SourceBanner sources={queue.sources} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <KpiCard icon={BadgeCheck} label="Total" value={queue.kpis.totalCredentials.toLocaleString()} tone="blue" />
        <KpiCard icon={CalendarClock} label="Pending" value={queue.kpis.pendingCredentials.toLocaleString()} tone="amber" />
        <KpiCard icon={CheckCircle2} label="Active" value={queue.kpis.activeCredentials.toLocaleString()} tone="emerald" />
        <KpiCard icon={ShieldAlert} label="Suspended" value={queue.kpis.suspendedCredentials.toLocaleString()} tone="rose" />
        <KpiCard icon={AlertTriangle} label="Revoked" value={queue.kpis.revokedCredentials.toLocaleString()} tone="rose" />
        <KpiCard icon={TimerReset} label="Expired" value={queue.kpis.expiredCredentials.toLocaleString()} tone="amber" />
        <KpiCard icon={KeyRound} label="Token/Signature Gaps" value={queue.kpis.missingValidSignatureOrTokenHash.toLocaleString()} tone="rose" />
        <KpiCard icon={Link2} label="Public Link Issues" value={queue.kpis.publicVerificationIssues.toLocaleString()} tone="rose" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
        <p className="text-sm font-black text-slate-950">Lifecycle summary</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {queue.lifecycleSummary.length ? queue.lifecycleSummary.map((item) => (
            <span key={item.label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${toneClasses[statusTone(item.label)]}`}>
              {humanize(item.label)}
              <span>{item.value.toLocaleString()}</span>
            </span>
          )) : <span className="text-sm font-semibold text-slate-500">No lifecycle data available.</span>}
        </div>
      </section>

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Filter className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          Queue filters
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-slate-500">Search</span>
            <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <input name="q" defaultValue={filters.q ?? ""} placeholder="Business, BIN, NDMII ID, owner, masked CAC/TIN" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
            </span>
          </label>
          <SelectFilter name="credentialStatus" label="Credential status" value={filters.credentialStatus} options={queue.options.credentialStatuses} />
          <SelectFilter name="lifecycleState" label="Lifecycle state" value={filters.lifecycleState} options={queue.options.lifecycleStates} />
          <SelectFilter name="msmeReviewStatus" label="MSME review" value={filters.msmeReviewStatus} options={queue.options.msmeReviewStatuses} />
          <SelectFilter name="verificationReviewStatus" label="Verification review" value={filters.verificationReviewStatus} options={queue.options.verificationReviewStatuses} />
          <SelectFilter name="tokenReadiness" label="Token hash" value={filters.tokenReadiness} options={queue.options.tokenReadiness} />
          <SelectFilter name="signatureReadiness" label="Signature" value={filters.signatureReadiness} options={queue.options.signatureReadiness} />
          <SelectFilter name="qrReadiness" label="QR readiness" value={filters.qrReadiness} options={queue.options.qrReadiness} />
          <SelectFilter name="expiryState" label="Expiry state" value={filters.expiryState} options={queue.options.expiryStates} />
          <SelectFilter name="attentionLevel" label="Attention" value={filters.attentionLevel} options={queue.options.attentionLevels} />
          <SelectFilter name="state" label="State" value={filters.state} options={queue.options.states} />
          <SelectFilter name="sector" label="Sector" value={filters.sector} options={queue.options.sectors} />
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Created from</span>
            <input type="date" name="createdFrom" defaultValue={filters.createdFrom ?? ""} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Created to</span>
            <input type="date" name="createdTo" defaultValue={filters.createdTo ?? ""} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" />
          </label>
          <SelectFilter name="sort" label="Sort" value={filters.sort ?? "attention"} options={queue.options.sortOptions} />
          <SelectFilter name="pageSize" label="Page size" value={String(filters.pageSize)} options={["25", "50", "100"]} />
          <input type="hidden" name="page" value="1" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white" type="submit">Apply filters</button>
          <Link href="/dashboard/admin/digital-ids" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">Reset</Link>
        </div>
      </form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-black text-slate-950">{queue.totalRows.toLocaleString()} credential{queue.totalRows === 1 ? "" : "s"}</p>
            <p className="text-xs font-bold text-slate-500">Page {queue.page} of {queue.totalPages}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[2200px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">MSME ID / BIN</th>
                  <th className="px-4 py-3">Credential status</th>
                  <th className="px-4 py-3">MSME review</th>
                  <th className="px-4 py-3">Verification review</th>
                  <th className="px-4 py-3">Lifecycle</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Approved</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Token/signature</th>
                  <th className="px-4 py-3">QR readiness</th>
                  <th className="px-4 py-3">Public verification</th>
                  <th className="px-4 py-3">Latest event</th>
                  <th className="px-4 py-3">Attention</th>
                  <th className="px-4 py-3">Event preview</th>
                </tr>
              </thead>
              <tbody>
                {queue.rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center">
                      <QrCode className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                      <p className="mt-3 text-sm font-black text-slate-600">No digital ID credentials match the current filters.</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Clear filters to review all available credential records.</p>
                    </td>
                  </tr>
                ) : queue.rows.map((row) => {
                  const active = queue.selectedRow?.id === row.id;
                  return (
                    <tr key={row.id} className={`border-t border-slate-100 align-top hover:bg-emerald-50/40 ${active ? "bg-emerald-50/60" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={buildHref(filters, { selectedId: row.id })} className="block focus-visible:outline-none">
                          <span className="block font-black text-slate-950">{row.businessName}</span>
                          <span className="mt-1 block break-all text-xs font-bold text-slate-500">{row.ndmiiId}</span>
                        </Link>
                        <Link href={`/dashboard/admin/digital-ids/${encodeURIComponent(row.credentialId)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-800 hover:text-emerald-950">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Lifecycle workspace
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.msmeId}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.ownerName}</p>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={row.credentialStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={row.msmeReviewStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={row.verificationReviewStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={row.lifecycleState} /></td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(row.issuedAt)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(row.approvedAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-700">{formatDate(row.expiryAt)}</p>
                        <StatusPill value={row.expiryState} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusPill value={row.tokenReadiness} fallback="Token hash" />
                          <StatusPill value={row.signatureReadiness} fallback="Signature" />
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={row.qrReadiness} /></td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.publicVerificationReadiness} />
                        <p className="mt-1 max-w-[260px] text-xs font-semibold text-slate-500">{row.publicVerificationReason}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-800">{humanize(row.latestCredentialEvent, "No event")}</p>
                        <p className="text-xs font-semibold text-slate-500">{formatDate(row.latestCredentialEventAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.attentionLevel} />
                        <div className="mt-2"><SignalChips row={row} /></div>
                      </td>
                      <td className="px-4 py-3">
                        <EventList row={row} limit={5} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <Link href={buildHref(filters, { page: Math.max(1, queue.page - 1), selectedId: undefined })} className={`rounded-lg border px-3 py-2 text-sm font-black ${queue.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Previous</Link>
            <p className="text-xs font-bold text-slate-500">Showing {queue.rows.length.toLocaleString()} of {queue.totalRows.toLocaleString()}</p>
            <Link href={buildHref(filters, { page: Math.min(queue.totalPages, queue.page + 1), selectedId: undefined })} className={`rounded-lg border px-3 py-2 text-sm font-black ${queue.page >= queue.totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Next</Link>
          </div>
        </div>

        <DetailPanel row={queue.selectedRow} />
      </section>
    </section>
  );
}
