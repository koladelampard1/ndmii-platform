import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";
import { getCurrentUserContext } from "@/lib/auth/session";

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
  const { data: officers } = await supabase.from("users").select("id,full_name").eq("role", "fccpc_officer");

  let query = supabase
    .from("complaints")
    .select("id,summary,status,severity,state,sector,assigned_officer_user_id,regulator_target,complaint_category,provider_profile_id,provider_id,msmes(msme_id,business_name)")
    .or("regulator_target.eq.fccpc,regulator_target.is.null")
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.state) query = query.eq("state", params.state);
  if (params.sector) query = query.eq("sector", params.sector);
  if (params.severity) query = query.eq("severity", params.severity);
  if (params.assigned) query = query.eq("assigned_officer_user_id", params.assigned);

  const { data: complaints } = await query;
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
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(complaints ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No complaints found. Queue is currently clear.</td></tr>
            )}
            {(complaints ?? []).map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <p className="font-medium">{row.summary}</p>
                  <p className="text-xs text-slate-500">{row.state} • {row.sector}</p>
                  <p className="text-xs text-slate-500">
                    Category: {row.complaint_category ?? "marketplace_report"} • Target: {(row.regulator_target ?? "fccpc").toUpperCase()}
                  </p>
                </td>
                <td className="px-3 py-3">
                  {(row.msmes as any)?.business_name}
                  <p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id ?? "MSME pending linkage"}</p>
                  <p className="text-xs text-slate-500">
                    Provider: {providerById.get((row.provider_profile_id ?? row.provider_id) as string)?.display_name ?? "Not linked"}
                  </p>
                </td>
                <td className="px-3 py-3"><StatusBadge status={row.severity === "critical" ? "critical" : row.severity === "high" ? "warning" : "active"} label={row.severity} /></td>
                <td className="px-3 py-3">{row.status}</td>
                <td className="px-3 py-3">{officers?.find((x) => x.id === row.assigned_officer_user_id)?.full_name ?? "Unassigned"}</td>
                <td className="space-y-2 px-3 py-3">
                  <form action={complaintAction} className="flex gap-2">
                    <input type="hidden" name="complaint_id" value={row.id} />
                    <input type="hidden" name="kind" value="assign" />
                    <select name="assigned_officer_user_id" className="rounded border px-2 py-1 text-xs">
                      <option value="">Unassigned</option>
                      {(officers ?? []).map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name}</option>)}
                    </select>
                    <button className="rounded border px-2 py-1 text-xs">Assign</button>
                  </form>
                  <form action={complaintAction} className="flex gap-2">
                    <input type="hidden" name="complaint_id" value={row.id} />
                    <input type="hidden" name="kind" value="status" />
                    <select name="status" className="rounded border px-2 py-1 text-xs">
                      <option value="open">open</option><option value="investigating">investigating</option><option value="enforcement">enforcement</option><option value="closed">closed</option>
                    </select>
                    <button className="rounded border px-2 py-1 text-xs">Update</button>
                  </form>
                  <Link href={`/dashboard/fccpc/${row.id}`} className="inline-block text-xs text-emerald-700 hover:underline">Open complaint workspace →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
