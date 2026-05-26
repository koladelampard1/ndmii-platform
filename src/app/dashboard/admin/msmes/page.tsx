import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarDays,
  Download,
  Filter,
  Flag,
  Landmark,
  LockKeyhole,
  Search,
  ExternalLink,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/data/authorization-scope";
import {
  loadAdminMsmeRegistry,
  normalizeRegistryFilters,
  type AdminMsmeRegistryFilters,
  type AdminMsmeRegistryRow,
  type RegistrySourceState,
} from "@/lib/data/admin-msme-registry";
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
  await requireRole(["admin"]);
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
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Read-only federal registry view across identity, compliance, association, and complaint signals.</p>
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
            <p className="text-xs font-bold text-slate-500">Page {registry.page} of {registry.totalPages}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Business</th>
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
                </tr>
              </thead>
              <tbody>
                {registry.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
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
