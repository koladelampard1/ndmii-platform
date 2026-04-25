import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";
import { getCurrentUserContext } from "@/lib/auth/session";

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
  msmes?: { msme_id?: string | null; business_name?: string | null } | null;
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

async function fetchComplaintQueue(role: string, params: Record<string, string | undefined>) {
  const querySource = role === "admin" ? "dashboard/fccpc (admin_all)" : "dashboard/fccpc (fccpc_routed)";
  let queue: ComplaintQueueRow[] = [];
  let schemaMismatchError: string | null = null;
  let queryError: string | null = null;

  const { data, error } = await supabase
    .from("complaints")
    .select("*,msmes(msme_id,business_name)")
    .order("created_at", { ascending: false });

  if (error) {
    queryError = error.message;
    schemaMismatchError = error.message;
  } else {
    queue = (data ?? []) as ComplaintQueueRow[];
  }

  if (params.status) queue = queue.filter((row) => (row.status ?? "open") === params.status);
  if (params.state) queue = queue.filter((row) => (row.state ?? "") === params.state);
  if (params.sector) queue = queue.filter((row) => (row.sector ?? "") === params.sector);
  if (params.severity) queue = queue.filter((row) => (row.severity ?? "") === params.severity);
  if (params.assigned) {
    queue = queue.filter((row) => (row.assigned_officer_user_id ?? row.assigned_officer_id ?? "") === params.assigned);
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
  const ctx = await getCurrentUserContext();
  if (!["fccpc_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  const complaintId = String(formData.get("complaint_id"));
  const kind = String(formData.get("kind"));

  if (kind === "assign") {
    const assignedOfficer = String(formData.get("assigned_officer_user_id") ?? "");
    await supabase.from("complaints").update({ assigned_officer_user_id: assignedOfficer || null }).eq("id", complaintId);
    await logActivity("fccpc_assign_complaint", "complaint", complaintId, { assignedOfficer });
  }

  if (kind === "status") {
    const status = String(formData.get("status") ?? "open");
    await supabase.from("complaints").update({ status, closed_at: status === "closed" ? new Date().toISOString() : null }).eq("id", complaintId);
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

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-semibold">FCCPC Complaint & Enforcement Workspace</h1>
        <p className="mt-2 text-sm text-slate-200">Operational queue for consumer protection investigations and enforcement actions.</p>
      </header>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Complaint action saved successfully.</p>}
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <input name="status" placeholder="status" defaultValue={params.status} className="rounded border px-2 py-2 text-sm" />
        <input name="state" placeholder="state" defaultValue={params.state} className="rounded border px-2 py-2 text-sm" />
        <input name="sector" placeholder="sector" defaultValue={params.sector} className="rounded border px-2 py-2 text-sm" />
        <input name="severity" placeholder="severity" defaultValue={params.severity} className="rounded border px-2 py-2 text-sm" />
        <input name="assigned" placeholder="assigned officer id" defaultValue={params.assigned} className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Filter Queue</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2">Complaint</th>
              <th className="px-3 py-2">MSME</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(complaints ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No complaints found. Queue is currently clear.</td></tr>
            )}
            {(complaints ?? []).map((row) => (
              (() => {
                const complaintId = String(row.id ?? "").trim();
                const providerRecord = providerById.get((row.provider_profile_id ?? row.provider_id) as string);
                const providerDisplayName =
                  typeof providerRecord?.display_name === "string" ? providerRecord.display_name : "Not linked";
                const assignedOfficerName = (() => {
                  const officer = officers.find((x) => x.id === (row.assigned_officer_user_id ?? row.assigned_officer_id));
                  return typeof officer?.full_name === "string" ? officer.full_name : "Unassigned";
                })();

                devQueueLog("workspace_link_prepared", {
                  clickedComplaintId: complaintId || null,
                  queueRowStatus: row.status ?? "open",
                });

                return (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <p className="font-medium">{row.complaint_type ?? "marketplace_report"}</p>
                  <p className="text-xs text-slate-500">{row.summary ?? row.description ?? "Complaint submitted for regulator review."}</p>
                  <p className="text-xs text-slate-500">{row.state} • {row.sector}</p>
                  <p className="text-xs text-slate-500">
                    Source: {querySource} • Target: {(row.regulator_target ?? "fccpc").toUpperCase()}
                  </p>
                </td>
                <td className="px-3 py-3">
                  {(row.msmes as any)?.business_name ?? row.provider_business_name ?? "Unknown business"}
                  <p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id ?? "MSME pending linkage"}</p>
                  <p className="text-xs text-slate-500">
                    Provider: {providerDisplayName}
                  </p>
                </td>
                <td className="px-3 py-3"><StatusBadge status={row.severity === "critical" ? "critical" : row.severity === "high" ? "warning" : "active"} label={row.severity ?? "medium"} /></td>
                <td className="px-3 py-3 text-xs text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "Unknown date"}</td>
                <td className="px-3 py-3">{row.status ?? "open"}</td>
                <td className="px-3 py-3">{assignedOfficerName}</td>
                <td className="space-y-2 px-3 py-3">
                  <form action={complaintAction} className="flex gap-2">
                    <input type="hidden" name="complaint_id" value={complaintId} />
                    <input type="hidden" name="kind" value="assign" />
                    <select name="assigned_officer_user_id" className="rounded border px-2 py-1 text-xs">
                      <option value="">Unassigned</option>
                      {(officers ?? []).map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name}</option>)}
                    </select>
                    <button className="rounded border px-2 py-1 text-xs">Assign</button>
                  </form>
                  <form action={complaintAction} className="flex gap-2">
                    <input type="hidden" name="complaint_id" value={complaintId} />
                    <input type="hidden" name="kind" value="status" />
                    <select name="status" className="rounded border px-2 py-1 text-xs">
                      <option value="open">open</option><option value="investigating">investigating</option><option value="enforcement">enforcement</option><option value="closed">closed</option>
                    </select>
                    <button className="rounded border px-2 py-1 text-xs">Update</button>
                  </form>
                  {complaintId ? (
                    <Link
                      href={`/dashboard/fccpc/${complaintId}?qid=${encodeURIComponent(complaintId)}`}
                      className="inline-block text-xs text-emerald-700 hover:underline"
                    >
                      Open complaint workspace →
                    </Link>
                  ) : (
                    <span className="inline-block text-xs text-rose-700">Complaint ID unavailable</span>
                  )}
                </td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
