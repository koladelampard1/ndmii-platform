import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Filter,
  Flag,
  Gavel,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { logActivity } from "@/lib/data/operations";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createComplaintStatusHistory } from "@/lib/data/complaints";
import { FCCPC_STATUS_OPTIONS, fccpcStatusLabel, normalizeFccpcStatus } from "@/lib/data/fccpc-complaints";

type ComplaintQueueRow = {
  id: string;
  msme_id?: string | null;
  complaint_type?: string | null;
  description?: string | null;
  summary?: string | null;
  status?: string | null;
  created_at?: string | null;
  regulator_target?: string | null;
  provider_business_name?: string | null;
  severity?: string | null;
  assigned_officer_id?: string | null;
  assigned_officer_user_id?: string | null;
  provider_profile_id?: string | null;
  provider_id?: string | null;
  state?: string | null;
  sector?: string | null;
  closed_at?: string | null;
  msmes?: { msme_id?: string | null; business_name?: string | null; is_verified?: boolean | null } | null;
};

type OfficerRow = {
  id: string;
  full_name: string | null;
};

function devQueueLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ndmii][complaint-queue] ${message}`, payload ?? {});
  }
}

function getCaseAge(createdAt?: string | null) {
  if (!createdAt) return { days: null as number | null, label: "Unknown age" };
  const created = new Date(createdAt);
  const diffMs = Date.now() - created.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const label = days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
  return { days, label };
}

function statusTone(status?: string | null) {
  const normalized = normalizeFccpcStatus(status);
  const raw = String(status ?? "").toLowerCase();
  if (normalized === "submitted") {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  if (normalized === "under_review") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  if (normalized === "regulator_review" || raw.includes("investig")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (normalized === "escalated" || raw.includes("enforcement")) {
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (normalized === "closed" || normalized === "resolved") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (raw.includes("suspend")) {
    return "bg-rose-200 text-rose-900 border-rose-300";
  }
  switch (normalized) {
    case "dismissed":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function severityTone(severity?: string | null) {
  if (severity === "critical" || severity === "high") return "bg-red-100 text-red-700 border-red-200";
  if (severity === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

async function fetchComplaintQueue(role: string, params: Record<string, string | undefined>) {
  const supabase = await createServiceRoleSupabaseClient();
  const querySource = role === "admin" ? "dashboard/fccpc (admin_all)" : "dashboard/fccpc (fccpc_routed)";
  let queue: ComplaintQueueRow[] = [];
  let schemaMismatchError: string | null = null;
  let queryError: string | null = null;

  const { data, error } = await supabase
    .from("complaints")
    .select("*,msmes(msme_id,business_name,is_verified)")
    .order("created_at", { ascending: false });

  if (error) {
    queryError = error.message;
    schemaMismatchError = error.message;
  } else {
    queue = (data ?? []) as ComplaintQueueRow[];
  }

  const cleanParam = (value?: string) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return "";
    const normalized = trimmed.toLowerCase();
    if (["all statuses", "all severities", "all officers", "all sectors", "all states", "all"].includes(normalized)) {
      return "";
    }
    return trimmed;
  };

  const statusParam = cleanParam(params.status);
  const stateParam = cleanParam(params.state);
  const sectorParam = cleanParam(params.sector);
  const severityParam = cleanParam(params.severity);
  const assignedParam = cleanParam(params.assigned);

  if (statusParam) {
    const requestedStatus = normalizeFccpcStatus(statusParam);
    queue = queue.filter((row) => normalizeFccpcStatus(row.status) === requestedStatus);
  }
  if (stateParam) queue = queue.filter((row) => (row.state ?? "") === stateParam);
  if (sectorParam) queue = queue.filter((row) => (row.sector ?? "") === sectorParam);
  if (severityParam) queue = queue.filter((row) => (row.severity ?? "") === severityParam);
  if (assignedParam) {
    queue = queue.filter((row) => (row.assigned_officer_user_id ?? row.assigned_officer_id ?? "") === assignedParam);
  }

  if (role !== "admin") {
    queue = queue.filter((row) => {
      const target = (row.regulator_target ?? "fccpc").toLowerCase();
      return target === "fccpc";
    });
  }

  devQueueLog("retrieval", {
    querySource,
    complaintsReturned: queue.length,
    schemaMismatchError,
    queryError,
  });

  return { queue, querySource };
}

async function complaintAction(formData: FormData) {
  "use server";
  const supabase = await createServiceRoleSupabaseClient();
  const ctx = await getCurrentUserContext();
  if (!["fccpc_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  const complaintId = String(formData.get("complaint_id"));
  const kind = String(formData.get("kind"));

  if (kind === "assign") {
    const assignedOfficer = String(formData.get("assigned_officer_user_id") ?? "");
    const { data: currentRow } = await supabase.from("complaints").select("status").eq("id", complaintId).maybeSingle();
    await supabase.from("complaints").update({ assigned_officer_user_id: assignedOfficer || null }).eq("id", complaintId);
    await createComplaintStatusHistory({
      complaintId,
      fromStatus: normalizeFccpcStatus(currentRow?.status ?? null),
      toStatus: normalizeFccpcStatus(currentRow?.status ?? null),
      changedByUserId: ctx.appUserId,
      changedByRole: ctx.role,
      note: assignedOfficer ? "Complaint assigned to FCCPC officer." : "Complaint assignment cleared.",
      metadata: { action: "assign", assigned_officer_user_id: assignedOfficer || null },
    });
    await logActivity("fccpc_assign_complaint", "complaint", complaintId, { assignedOfficer });
  }

  if (kind === "status") {
    const { data: currentRow } = await supabase.from("complaints").select("status").eq("id", complaintId).maybeSingle();
    const status = normalizeFccpcStatus(String(formData.get("status") ?? "submitted"));
    const currentStatus = normalizeFccpcStatus(currentRow?.status ?? null);
    await supabase.from("complaints").update({ status, closed_at: status === "closed" ? new Date().toISOString() : null }).eq("id", complaintId);
    await createComplaintStatusHistory({
      complaintId,
      fromStatus: currentStatus,
      toStatus: status,
      changedByUserId: ctx.appUserId,
      changedByRole: ctx.role,
      note: "FCCPC status updated from queue.",
      metadata: { action: "status_update" },
    });
    await logActivity("fccpc_update_status", "complaint", complaintId, { status });
  }

  redirect("/dashboard/fccpc?saved=1");
}

export default async function FccpcPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; state?: string; sector?: string; severity?: string; assigned?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();
  if (!["fccpc_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  const { data: officerData } = await supabase
    .from("users")
    .select("id,full_name")
    .eq("role", "fccpc_officer");
  const officers = (officerData ?? []) as OfficerRow[];

  const { queue: complaints, querySource } = await fetchComplaintQueue(ctx.role, params);
  const providerIds = (complaints ?? []).map((item) => item.provider_profile_id ?? item.provider_id).filter(Boolean);
  const { data: providerRows } = await supabase
    .from("provider_profiles")
    .select("id,display_name,msme_id")
    .in("id", providerIds.length ? providerIds : ["00000000-0000-0000-0000-000000000000"]);
  const providerById = new Map((providerRows ?? []).map((row) => [row.id, row]));

  const openCases = complaints.filter((row) => normalizeFccpcStatus(row.status) !== "closed").length;
  const underInvestigation = complaints.filter((row) => {
    const normalized = normalizeFccpcStatus(row.status);
    const raw = String(row.status ?? "").toLowerCase();
    return normalized === "regulator_review" || raw.includes("investig");
  }).length;
  const enforcementActive = complaints.filter((row) => {
    const normalized = normalizeFccpcStatus(row.status);
    const raw = String(row.status ?? "").toLowerCase();
    return normalized === "escalated" || raw.includes("enforcement");
  }).length;
  const suspendedBusinesses = complaints.filter((row) => String(row.status ?? "").toLowerCase().includes("suspend")).length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const closedThisWeek = complaints.filter((row) => normalizeFccpcStatus(row.status) === "closed" && row.closed_at && new Date(row.closed_at).getTime() >= sevenDaysAgo).length;

  const kpis = [
    { label: "Open Cases", value: openCases, icon: ClipboardList, tone: "text-emerald-700 bg-emerald-100" },
    { label: "Under Investigation", value: underInvestigation, icon: FileSearch, tone: "text-amber-700 bg-amber-100" },
    { label: "Enforcement Active", value: enforcementActive, icon: Gavel, tone: "text-red-700 bg-red-100" },
    { label: "Suspended MSMEs", value: suspendedBusinesses, icon: ShieldAlert, tone: "text-rose-800 bg-rose-100" },
    { label: "Closed This Week", value: closedThisWeek, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
    { label: "Total Complaints", value: complaints.length, icon: Users, tone: "text-violet-700 bg-violet-100" },
  ];

  return (
    <section className="w-full max-w-none min-w-0 space-y-4 overflow-x-hidden pb-6">
      <header className="w-full min-w-0 overflow-hidden rounded-2xl border border-emerald-900/20 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-4 py-5 text-white shadow-sm md:px-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">FCCPC Workspace</p>
            <h1 className="mt-1 text-xl font-semibold md:text-2xl">FCCPC Enforcement Intelligence Console</h1>
            <p className="mt-1 max-w-3xl text-sm text-emerald-100">
              Operational oversight for consumer complaints, investigations and regulatory actions.
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/20 bg-white/10 p-2.5 text-xs text-emerald-50">
            <p className="truncate font-medium">Query Source: {querySource}</p>
            <p className="mt-1">Regulatory workflow console</p>
          </div>
        </div>
      </header>

      {params.saved && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Complaint action saved successfully.</p>
      )}

      <div className="grid min-w-0 gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="truncate text-xs font-medium text-slate-600 sm:text-sm">{label}</p>
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </div>

      <form className="w-full min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4" method="GET">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4 text-emerald-700" />
          Structured Filters
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Search MSME / Complaint ID
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input name="q" placeholder="Search MSME, Complaint ID..." className="w-full min-w-0 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
            </div>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Status
            <select name="status" defaultValue={params.status ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All Statuses</option>
              {FCCPC_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{fccpcStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Severity
            <select name="severity" defaultValue={params.severity ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Sector
            <input name="sector" defaultValue={params.sector ?? ""} placeholder="All Sectors" className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            State
            <input name="state" defaultValue={params.state ?? ""} placeholder="All States" className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Assigned Officer
            <select name="assigned" defaultValue={params.assigned ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All Officers</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>{officer.full_name ?? "Unnamed Officer"}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Complaint Type
            <input name="complaint_type" placeholder="All Types" className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            MSME Verification Status
            <select name="verification" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Enforcement Flagged
            <select name="enforcement_flagged" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="yes">Flagged</option>
              <option value="no">Not Flagged</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-2">
            Date Range
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input type="date" name="date_from" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
              </div>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input type="date" name="date_to" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
              </div>
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/dashboard/fccpc" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Clear Filters
          </Link>
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">Apply Filters</button>
        </div>
      </form>

      <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Complaints ({complaints.length})</h2>
            <p className="text-xs text-slate-500">Regulatory case-management queue</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
              <ArrowUpRight className="h-4 w-4" /> Export
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4" /> Bulk Actions
            </button>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" /></th>
                <th className="px-3 py-3">Case / Complaint</th>
                <th className="px-3 py-3">MSME &amp; Provider</th>
                <th className="px-3 py-3">Severity</th>
                <th className="px-3 py-3">Compliance Snapshot</th>
                <th className="px-3 py-3">Case Age</th>
                <th className="px-3 py-3">Assigned Officer</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">No complaints found. Queue is currently clear.</td>
                </tr>
              )}
              {complaints.map((row) => {
                const complaintId = String(row.id ?? "").trim();
                const providerRecord = providerById.get((row.provider_profile_id ?? row.provider_id) as string);
                const providerDisplayName = typeof providerRecord?.display_name === "string" ? providerRecord.display_name : "Not linked";
                const assignedOfficerName = (() => {
                  const officer = officers.find((x) => x.id === (row.assigned_officer_user_id ?? row.assigned_officer_id));
                  return typeof officer?.full_name === "string" ? officer.full_name : "Unassigned";
                })();
                const verificationStatus = row.msmes?.is_verified ? "Verified" : "Unverified";
                const normalizedSeverity = row.severity ?? "medium";
                const riskLabel = normalizedSeverity === "critical" || normalizedSeverity === "high" ? "High" : normalizedSeverity === "medium" ? "Medium" : "Low";
                const age = getCaseAge(row.created_at);

                devQueueLog("workspace_link_prepared", {
                  clickedComplaintId: complaintId || null,
                  queueRowStatus: normalizeFccpcStatus(row.status),
                });

                return (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" /></td>
                    <td className="space-y-1 px-3 py-3 min-w-0">
                      <p className="line-clamp-2 break-words font-semibold text-slate-900">{row.summary ?? row.description ?? "Complaint submitted for regulatory review."}</p>
                      <p className="text-xs font-medium text-blue-600">{row.complaint_type ?? "General Complaint"}</p>
                      <p className="text-xs text-slate-500 break-words">{row.state ?? "Unknown State"} • ID: {complaintId || "Unavailable"}</p>
                      <p className="text-xs text-slate-500">Submitted: {row.created_at ? new Date(row.created_at).toLocaleDateString() : "Unknown date"}</p>
                    </td>
                    <td className="space-y-1 px-3 py-3 min-w-0">
                      <p className="font-medium text-slate-900 break-words">{(row.msmes as any)?.business_name ?? row.provider_business_name ?? "Unknown business"}</p>
                      <p className="text-xs text-slate-500 truncate">{(row.msmes as any)?.msme_id ?? "MSME pending linkage"}</p>
                      <p className="text-xs">
                        <span className={`rounded-full border px-2 py-0.5 ${verificationStatus === "Verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                          {verificationStatus}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">Provider: {providerDisplayName}</p>
                    </td>
                    <td className="space-y-1 px-3 py-3">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium capitalize ${severityTone(row.severity)}`}>{normalizedSeverity}</span>
                      <p className="text-xs text-slate-600">Risk: {riskLabel}</p>
                    </td>
                    <td className="space-y-1 px-3 py-3 text-xs text-slate-600">
                      <p>Compliance Score: N/A</p>
                      <p>Tax Status: N/A</p>
                      <p>Verification: {verificationStatus}</p>
                      <p>
                        Flags:{" "}
                        {normalizeFccpcStatus(row.status) === "escalated" || String(row.status ?? "").toLowerCase().includes("suspend")
                          ? "Flagged"
                          : "None"}
                      </p>
                    </td>
                    <td className="space-y-1 px-3 py-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-900">{age.label}</p>
                      <p>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "Unknown"}</p>
                      {typeof age.days === "number" && age.days > 14 && <p className="text-red-600">Overdue</p>}
                    </td>
                    <td className="space-y-1 px-3 py-3">
                      <p className="text-sm font-medium text-slate-900">{assignedOfficerName}</p>
                      <p className="text-xs text-slate-500">FCCPC Officer</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(row.status)}`}>
                        {fccpcStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="space-y-2 px-3 py-3 min-w-0">
                      <form action={complaintAction} className="flex min-w-0 items-center gap-2">
                        <input type="hidden" name="complaint_id" value={complaintId} />
                        <input type="hidden" name="kind" value="assign" />
                        <select name="assigned_officer_user_id" className="min-w-0 rounded-lg border border-slate-300 px-2 py-1 text-xs">
                          <option value="">Unassigned</option>
                          {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name}</option>)}
                        </select>
                        <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">
                          <UserRound className="h-3.5 w-3.5" /> Assign Officer
                        </button>
                      </form>
                      <form action={complaintAction} className="flex min-w-0 items-center gap-2">
                        <input type="hidden" name="complaint_id" value={complaintId} />
                        <input type="hidden" name="kind" value="status" />
                        <select name="status" className="min-w-0 rounded-lg border border-slate-300 px-2 py-1 text-xs" defaultValue={normalizeFccpcStatus(row.status)}>
                          {FCCPC_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{fccpcStatusLabel(status)}</option>
                          ))}
                        </select>
                        <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Update Status
                        </button>
                      </form>
                      {complaintId ? (
                        <Link
                          href={`/dashboard/fccpc/${complaintId}?qid=${encodeURIComponent(complaintId)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                        >
                          <Flag className="h-3.5 w-3.5" /> View / Open Case
                        </Link>
                      ) : (
                        <span className="inline-block text-xs text-rose-700">Complaint ID unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {complaints.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              No complaints found. Queue is currently clear.
            </div>
          )}
          {complaints.map((row) => {
            const complaintId = String(row.id ?? "").trim();
            const providerRecord = providerById.get((row.provider_profile_id ?? row.provider_id) as string);
            const providerDisplayName = typeof providerRecord?.display_name === "string" ? providerRecord.display_name : "Not linked";
            const assignedOfficerName = (() => {
              const officer = officers.find((x) => x.id === (row.assigned_officer_user_id ?? row.assigned_officer_id));
              return typeof officer?.full_name === "string" ? officer.full_name : "Unassigned";
            })();
            const age = getCaseAge(row.created_at);

            return (
              <article key={`mobile-${row.id}`} className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900">{row.summary ?? row.description ?? "Complaint submitted for regulatory review."}</p>
                <p className="text-xs text-slate-500 break-words">ID: {complaintId || "Unavailable"} • {row.state ?? "Unknown State"}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 ${severityTone(row.severity)}`}>{row.severity ?? "medium"}</span>
                  <span className={`rounded-full border px-2 py-0.5 ${statusTone(row.status)}`}>{fccpcStatusLabel(row.status)}</span>
                </div>
                <p className="text-xs text-slate-600">MSME: {(row.msmes as any)?.msme_id ?? "Pending linkage"}</p>
                <p className="text-xs text-slate-600 truncate">Provider: {providerDisplayName}</p>
                <p className="text-xs text-slate-600">Assigned: {assignedOfficerName}</p>
                <p className="text-xs text-slate-600">Case age: {age.label}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <form action={complaintAction} className="flex min-w-0 items-center gap-2">
                    <input type="hidden" name="complaint_id" value={complaintId} />
                    <input type="hidden" name="kind" value="status" />
                    <select name="status" className="max-w-[11rem] rounded-lg border border-slate-300 px-2 py-1 text-xs" defaultValue={normalizeFccpcStatus(row.status)}>
                      {FCCPC_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{fccpcStatusLabel(status)}</option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">Update</button>
                  </form>
                  {complaintId && (
                    <Link
                      href={`/dashboard/fccpc/${complaintId}?qid=${encodeURIComponent(complaintId)}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      <Flag className="h-3.5 w-3.5" /> Open Case
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
