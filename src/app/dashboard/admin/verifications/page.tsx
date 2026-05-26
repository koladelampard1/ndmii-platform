import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Filter,
  Flag,
  KeyRound,
  Search,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/data/authorization-scope";
import {
  loadAdminVerificationQueue,
  normalizeAdminVerificationFilters,
  type AdminVerificationFilters,
  type AdminVerificationQueueRow,
  type AdminVerificationSourceState,
} from "@/lib/data/admin-verifications";
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

function parseFilters(params: Record<string, string | string[] | undefined>): AdminVerificationFilters {
  return normalizeAdminVerificationFilters({
    q: firstParam(params.q),
    verificationStatus: firstParam(params.verificationStatus),
    reviewStatus: firstParam(params.reviewStatus),
    kycStatus: firstParam(params.kycStatus),
    digitalIdStatus: firstParam(params.digitalIdStatus),
    state: firstParam(params.state),
    sector: firstParam(params.sector),
    attentionLevel: firstParam(params.attentionLevel),
    flagged: firstParam(params.flagged),
    suspended: firstParam(params.suspended),
    updatedFrom: firstParam(params.updatedFrom),
    updatedTo: firstParam(params.updatedTo),
    page: Number(firstParam(params.page) ?? 1),
    pageSize: Number(firstParam(params.pageSize) ?? 25),
    selectedId: firstParam(params.selectedId),
  });
}

function buildHref(filters: AdminVerificationFilters, patch: Partial<AdminVerificationFilters>) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...patch };
  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  return `/dashboard/admin/verifications${params.size ? `?${params.toString()}` : ""}`;
}

function exportHref(filters: AdminVerificationFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || key === "selectedId") return;
    params.set(key, String(value));
  });
  return `/api/admin/verifications/export?${params.toString()}`;
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
  if (["verified", "approved", "active", "passed", "low"].includes(normalized)) return "emerald";
  if (["pending", "pending_review", "submitted", "changes_requested", "incomplete", "watch", "missing"].includes(normalized)) return "amber";
  if (["failed", "rejected", "suspended", "revoked", "critical", "elevated", "expired"].includes(normalized)) return "rose";
  if (["unavailable", "not_started"].includes(normalized)) return "slate";
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

function SourceBanner({ sources }: { sources: Record<string, AdminVerificationSourceState> }) {
  const unavailable = Object.entries(sources).filter(([, source]) => !source.available);
  if (!unavailable.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Some verification summaries are unavailable: {unavailable.map(([name]) => name).join(", ")}. The queue is using available sources only.
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

function VerificationPreview({ row }: { row: AdminVerificationQueueRow | null }) {
  if (!row) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-semibold text-slate-500">
        Select a queue item to preview verification signals.
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Read-only preview</p>
          <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">{row.businessName}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">{row.msmeId}</p>
        </div>
        <StatusPill value={row.attentionLevel} />
      </div>

      <div className="mt-5 space-y-3">
        <PreviewSection title="Profile summary">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-bold text-slate-500">Owner</dt><dd className="font-semibold text-slate-900">{row.ownerName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Location</dt><dd className="font-semibold text-slate-900">{[row.state, row.lga].filter(Boolean).join(" / ") || "Unavailable"}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Sector</dt><dd className="font-semibold text-slate-900">{row.sector ?? "Unavailable"}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Last updated</dt><dd className="font-semibold text-slate-900">{formatDate(row.lastUpdatedAt)}</dd></div>
          </dl>
        </PreviewSection>

        <PreviewSection title="KYC summary">
          <div className="flex flex-wrap gap-2">
            <StatusPill value={row.kyc.nin} fallback="NIN unavailable" />
            <StatusPill value={row.kyc.bvn} fallback="BVN unavailable" />
            <StatusPill value={row.kyc.cac} fallback="CAC unavailable" />
            <StatusPill value={row.kyc.tin} fallback="TIN unavailable" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">CAC: {row.cacMasked ?? "Unavailable"} · TIN: {row.tinMasked ?? "Unavailable"}</p>
        </PreviewSection>

        <PreviewSection title="Digital credential">
          <p className="text-sm font-semibold text-slate-900">{row.digitalCredentialId ?? "No active credential shown"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Status: {humanize(row.digitalCredentialStatus)}</p>
        </PreviewSection>

        <PreviewSection title="Complaints">
          <p className="text-sm font-black text-slate-950">{row.complaintCount ?? "Unavailable"} total</p>
          <p className="text-xs font-semibold text-slate-500">Open: {row.openComplaintCount ?? "Unavailable"}</p>
        </PreviewSection>

        <PreviewSection title="Why this is queued">
          <ul className="space-y-2">
            {row.reasons.map((reason) => (
              <li key={reason.code} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-800">{reason.label}</span>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${toneClasses[statusTone(reason.severity)]}`}>{humanize(reason.severity)}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>

        <PreviewSection title="Suggested next action">
          <p className="text-sm font-semibold leading-6 text-slate-800">{row.suggestedNextAction}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">No approve/reject actions are available in this phase.</p>
        </PreviewSection>
      </div>
    </aside>
  );
}

export default async function AdminVerificationsPage({ searchParams }: PageProps) {
  await requireRole(["admin", "reviewer"]);
  const params = await searchParams;
  const filters = parseFilters(params);

  let queue;
  try {
    const supabase = await createServiceRoleSupabaseClient();
    queue = await loadAdminVerificationQueue(supabase, filters);
  } catch (error) {
    console.info("[admin-verifications]", {
      operation: "load_admin_verification_queue",
      filtersUsed: { hasSearch: Boolean(filters.q), page: filters.page, pageSize: filters.pageSize },
      rowCount: 0,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to load verification queue",
    });

    return (
      <section className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Verification Queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Read-only operational queue for MSME verification attention.</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          Verification queue data is unavailable. Confirm Supabase service-role configuration and try again.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1800px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Verification Queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Read-first operational view of MSMEs requiring verification attention. This page does not approve, reject, enforce, or verify documents.</p>
        </div>
        <Link href={exportHref(filters)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-black text-white shadow-sm hover:bg-emerald-900">
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Link>
      </div>

      <SourceBanner sources={queue.sources} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={ShieldAlert} label="Total Queue" value={queue.kpis.totalQueue.toLocaleString()} tone="blue" />
        <KpiCard icon={CalendarClock} label="Pending Review" value={queue.kpis.pendingReview.toLocaleString()} tone="amber" />
        <KpiCard icon={AlertTriangle} label="Failed Checks" value={queue.kpis.failedChecks.toLocaleString()} tone="rose" />
        <KpiCard icon={KeyRound} label="Missing Credentials" value={queue.kpis.missingCredentials.toLocaleString()} tone="violet" />
        <KpiCard icon={Flag} label="Flagged/Suspended" value={queue.kpis.flaggedOrSuspended.toLocaleString()} tone="rose" />
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
              <input name="q" defaultValue={filters.q ?? ""} placeholder="Business, BIN, owner, CAC, TIN, phone, email" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
            </span>
          </label>
          <SelectFilter name="verificationStatus" label="Verification" value={filters.verificationStatus} options={queue.options.verificationStatuses} />
          <SelectFilter name="reviewStatus" label="Review" value={filters.reviewStatus} options={queue.options.reviewStatuses} />
          <SelectFilter name="kycStatus" label="KYC checks" value={filters.kycStatus} options={queue.options.kycStatuses} />
          <SelectFilter name="digitalIdStatus" label="Digital ID" value={filters.digitalIdStatus} options={queue.options.digitalIdStatuses} />
          <SelectFilter name="state" label="State" value={filters.state} options={queue.options.states} />
          <SelectFilter name="sector" label="Sector" value={filters.sector} options={queue.options.sectors} />
          <SelectFilter name="attentionLevel" label="Attention" value={filters.attentionLevel} options={queue.options.attentionLevels} />
          <SelectFilter name="flagged" label="Flagged" value={filters.flagged} options={[{ value: "true", label: "Flagged" }, { value: "false", label: "Not flagged" }]} />
          <SelectFilter name="suspended" label="Suspended" value={filters.suspended} options={[{ value: "true", label: "Suspended" }, { value: "false", label: "Not suspended" }]} />
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Updated from</span>
            <input type="date" name="updatedFrom" defaultValue={filters.updatedFrom ?? ""} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Updated to</span>
            <input type="date" name="updatedTo" defaultValue={filters.updatedTo ?? ""} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" />
          </label>
          <SelectFilter name="pageSize" label="Page size" value={String(filters.pageSize)} options={["25", "50", "100"]} />
          <input type="hidden" name="page" value="1" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white" type="submit">Apply filters</button>
          <Link href="/dashboard/admin/verifications" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">Reset</Link>
        </div>
      </form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-black text-slate-950">{queue.totalRows.toLocaleString()} queue item{queue.totalRows === 1 ? "" : "s"}</p>
            <p className="text-xs font-bold text-slate-500">Page {queue.page} of {queue.totalPages}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1420px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">KYC Checks</th>
                  <th className="px-4 py-3">Digital ID</th>
                  <th className="px-4 py-3">Complaints</th>
                  <th className="px-4 py-3">Attention</th>
                  <th className="px-4 py-3">Oldest Age</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Flags</th>
                </tr>
              </thead>
              <tbody>
                {queue.rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                      <p className="mt-3 text-sm font-black text-slate-600">No verification queue items match the current filters.</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Clear filters to review all available operational signals.</p>
                    </td>
                  </tr>
                ) : queue.rows.map((row) => {
                  const active = queue.selectedRow?.id === row.id;
                  return (
                    <tr key={row.id} className={`border-t border-slate-100 align-top hover:bg-emerald-50/40 ${active ? "bg-emerald-50/60" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={buildHref(filters, { selectedId: row.id })} className="block focus-visible:outline-none">
                          <span className="block font-black text-slate-950">{row.businessName}</span>
                          <span className="mt-1 block text-xs font-bold text-slate-500">{row.msmeId}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.ownerName}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{row.state ?? "Unavailable"}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.lga ?? "LGA unavailable"}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.sector ?? "Unavailable"}</td>
                      <td className="px-4 py-3"><StatusPill value={row.verificationStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={row.reviewStatus} /></td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.kyc.overall} />
                        <p className="mt-1 text-xs font-semibold text-slate-500">NIN {humanize(row.kyc.nin)} · BVN {humanize(row.kyc.bvn)}</p>
                        <p className="text-xs font-semibold text-slate-500">CAC {humanize(row.kyc.cac)} · TIN {humanize(row.kyc.tin)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.digitalCredentialStatus} />
                        <p className="mt-1 text-xs font-bold text-slate-500">{row.digitalCredentialId ?? "No active credential"}</p>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-800">
                        {row.complaintCount ?? "Unavailable"}
                        <p className="text-xs font-semibold text-slate-500">Open: {row.openComplaintCount ?? "Unavailable"}</p>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={row.attentionLevel} /></td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.oldestPendingAgeDays === null ? "Unavailable" : `${row.oldestPendingAgeDays}d`}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(row.lastUpdatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.flagged ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}><Flag className="h-3 w-3" />Flagged</span> : null}
                          {row.suspended ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}>Suspended</span> : null}
                          {!row.flagged && !row.suspended ? <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.slate}`}>Clear</span> : null}
                        </div>
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

        <VerificationPreview row={queue.selectedRow} />
      </section>
    </section>
  );
}
