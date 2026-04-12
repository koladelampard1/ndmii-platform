import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createComplaintStatusHistory, emitComplaintEvent } from "@/lib/data/complaints";

async function adminComplaintAction(formData: FormData) {
  "use server";

  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const complaintId = String(formData.get("complaint_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const supabase = await createServiceRoleSupabaseClient();
  const { data: complaint } = await supabase.from("complaints").select("id,status").eq("id", complaintId).maybeSingle();
  if (!complaint) redirect("/dashboard/executive/complaints");

  if (kind === "assign") {
    const assignedAdmin = String(formData.get("assigned_admin_user_id") ?? "").trim() || null;
    const assignedRegulator = String(formData.get("assigned_regulator_user_id") ?? "").trim() || null;
    await supabase.from("complaints").update({ assigned_admin_user_id: assignedAdmin, assigned_regulator_user_id: assignedRegulator }).eq("id", complaintId);
    await emitComplaintEvent("complaint_assigned", { complaintId, assignedAdmin, assignedRegulator, actorRole: ctx.role });
  }

  if (kind === "status") {
    const status = String(formData.get("status") ?? "").trim();
    await supabase
      .from("complaints")
      .update({
        status,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
        closed_at: status === "closed" ? new Date().toISOString() : null,
      })
      .eq("id", complaintId);
    await createComplaintStatusHistory({ complaintId, fromStatus: complaint.status, toStatus: status, changedByUserId: ctx.appUserId, changedByRole: ctx.role, note: "Admin status update" });
    await emitComplaintEvent("complaint_status_changed", { complaintId, fromStatus: complaint.status, toStatus: status, actorRole: ctx.role });
  }

  if (kind === "note") {
    const note = String(formData.get("note") ?? "").trim();
    if (note) {
      await supabase.from("complaint_messages").insert({ complaint_id: complaintId, author_user_id: ctx.appUserId, author_role: ctx.role, message: note, message_type: "admin_note", visibility: "internal" });
    }
  }

  revalidatePath(`/dashboard/executive/complaints/${complaintId}`);
  revalidatePath("/dashboard/executive/complaints");
  redirect(`/dashboard/executive/complaints/${complaintId}?saved=1`);
}

export default async function AdminComplaintDetailPage({ params, searchParams }: { params: Promise<{ complaintId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { complaintId } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServiceRoleSupabaseClient();
  const [{ data: complaint }, { data: messages }, { data: history }] = await Promise.all([
    supabase.from("complaints").select("*").eq("id", complaintId).maybeSingle(),
    supabase.from("complaint_messages").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: false }),
    supabase.from("complaint_status_history").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: false }),
  ]);

  if (!complaint) return <section className="rounded-xl border bg-white p-6">Complaint not found.</section>;

  return (
    <section className="space-y-4">
      <article className="rounded-xl border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{complaint.complaint_reference ?? complaint.id}</p>
        <h1 className="mt-1 text-2xl font-semibold">{complaint.title ?? complaint.summary}</h1>
        <p className="mt-2 text-sm text-slate-600">Status: {complaint.status} • Priority: {complaint.priority ?? "medium"}</p>
        <p className="mt-2 text-sm">Provider: {complaint.provider_business_name ?? "Provider"}</p>
        <p className="mt-1 text-sm">Association: {complaint.association_id ?? "Unlinked"}</p>
      </article>
      {query.saved === "1" && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Saved.</p>}
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Assignment and status</h2>
        <form action={adminComplaintAction} className="mt-3 grid gap-2 md:grid-cols-3">
          <input type="hidden" name="kind" value="assign" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <input name="assigned_admin_user_id" defaultValue={complaint.assigned_admin_user_id ?? ""} placeholder="Assigned admin user ID" className="rounded border px-2 py-2 text-sm" />
          <input name="assigned_regulator_user_id" defaultValue={complaint.assigned_regulator_user_id ?? ""} placeholder="Assigned regulator user ID" className="rounded border px-2 py-2 text-sm" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save assignment</button>
        </form>
        <form action={adminComplaintAction} className="mt-2 flex flex-wrap gap-2">
          <input type="hidden" name="kind" value="status" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <select name="status" defaultValue={complaint.status} className="rounded border px-2 py-2 text-sm">
            <option value="submitted">submitted</option><option value="under_review">under_review</option><option value="awaiting_msme_response">awaiting_msme_response</option><option value="awaiting_complainant_response">awaiting_complainant_response</option><option value="association_follow_up">association_follow_up</option><option value="regulator_review">regulator_review</option><option value="resolved">resolved</option><option value="closed">closed</option><option value="escalated">escalated</option><option value="dismissed">dismissed</option>
          </select>
          <button className="rounded bg-indigo-700 px-3 py-2 text-sm text-white">Update status</button>
        </form>
      </article>
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Internal notes</h2>
        <form action={adminComplaintAction} className="mt-2 space-y-2">
          <input type="hidden" name="kind" value="note" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <textarea name="note" className="min-h-24 w-full rounded border px-2 py-2 text-sm" placeholder="Add admin note" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add note</button>
        </form>
        <div className="mt-3 space-y-1 text-sm">
          {(messages ?? []).map((m) => <p key={m.id}>{new Date(m.created_at).toLocaleString()} • {m.author_role ?? "system"} • {m.visibility} • {m.message}</p>)}
        </div>
      </article>
      <article className="rounded-xl border bg-white p-4 text-sm">
        <h2 className="font-semibold">Status history</h2>
        {(history ?? []).map((h) => <p className="mt-1" key={h.id}>{new Date(h.created_at).toLocaleString()} • {h.from_status ?? "-"} → {h.to_status}</p>)}
      </article>
    </section>
  );
}
