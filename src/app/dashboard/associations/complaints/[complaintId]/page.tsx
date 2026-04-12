import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createComplaintStatusHistory, emitComplaintEvent } from "@/lib/data/complaints";

async function associationComplaintAction(formData: FormData) {
  "use server";

  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const complaintId = String(formData.get("complaint_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const supabase = await createServiceRoleSupabaseClient();
  const { data: complaint } = await supabase.from("complaints").select("id,status,association_id").eq("id", complaintId).maybeSingle();
  if (!complaint) redirect("/access-denied");
  if (ctx.role === "association_officer" && complaint.association_id !== ctx.linkedAssociationId) redirect("/access-denied");

  if (kind === "note") {
    const note = String(formData.get("note") ?? "").trim();
    if (note) {
      await supabase.from("complaint_messages").insert({ complaint_id: complaintId, author_user_id: ctx.appUserId, author_role: ctx.role, message: note, message_type: "follow_up", visibility: "internal" });
    }
  }

  if (kind === "status") {
    const status = String(formData.get("status") ?? "").trim();
    if (["association_follow_up", "under_review", "escalated"].includes(status)) {
      await supabase.from("complaints").update({ status }).eq("id", complaintId);
      await createComplaintStatusHistory({ complaintId, fromStatus: complaint.status, toStatus: status, changedByUserId: ctx.appUserId, changedByRole: ctx.role, note: "Association workflow update" });
      await emitComplaintEvent("complaint_status_changed", { complaintId, fromStatus: complaint.status, toStatus: status, actorRole: ctx.role });
    }
  }

  if (kind === "assign") {
    const handlerUserId = String(formData.get("handler_user_id") ?? "").trim() || null;
    await supabase.from("complaints").update({ assigned_association_user_id: handlerUserId }).eq("id", complaintId);
    await emitComplaintEvent("complaint_assigned", { complaintId, assignedAssociationUserId: handlerUserId, actorRole: ctx.role });
  }

  revalidatePath(`/dashboard/associations/complaints/${complaintId}`);
  revalidatePath("/dashboard/associations/complaints");
  redirect(`/dashboard/associations/complaints/${complaintId}?saved=1`);
}

export default async function AssociationComplaintDetailPage({ params, searchParams }: { params: Promise<{ complaintId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { complaintId } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: complaint } = await supabase.from("complaints").select("*").eq("id", complaintId).maybeSingle();
  if (!complaint) return <section className="rounded-xl border bg-white p-6">Complaint not found.</section>;
  if (ctx.role === "association_officer" && complaint.association_id !== ctx.linkedAssociationId) redirect("/access-denied");

  const [{ data: notes }, { data: history }] = await Promise.all([
    supabase.from("complaint_messages").select("*").eq("complaint_id", complaintId).eq("visibility", "internal").order("created_at", { ascending: false }),
    supabase.from("complaint_status_history").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: false }),
  ]);

  return (
    <section className="space-y-4">
      <article className="rounded-xl border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{complaint.complaint_reference ?? complaint.id}</p>
        <h1 className="mt-1 text-2xl font-semibold">{complaint.title ?? complaint.summary}</h1>
        <p className="mt-2 text-sm">Status: {complaint.status} • Priority: {complaint.priority ?? complaint.severity ?? "medium"}</p>
        <p className="mt-2 text-sm text-slate-700">{complaint.description}</p>
      </article>
      {query.saved === "1" && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Saved.</p>}
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Association action</h2>
        <form action={associationComplaintAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="kind" value="status" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <select name="status" className="rounded border px-2 py-2 text-sm"><option value="association_follow_up">Association follow-up</option><option value="under_review">Under review</option><option value="escalated">Escalated</option></select>
          <button className="rounded bg-indigo-700 px-3 py-2 text-sm text-white">Update status</button>
        </form>
        <form action={associationComplaintAction} className="mt-2 flex flex-wrap gap-2">
          <input type="hidden" name="kind" value="assign" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <input name="handler_user_id" placeholder="Internal handler user ID" className="rounded border px-2 py-2 text-sm" />
          <button className="rounded bg-slate-800 px-3 py-2 text-sm text-white">Assign handler</button>
        </form>
        <form action={associationComplaintAction} className="mt-2 space-y-2">
          <input type="hidden" name="kind" value="note" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <textarea name="note" className="min-h-24 w-full rounded border px-2 py-2 text-sm" placeholder="Internal follow-up note" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add internal note</button>
        </form>
      </article>
      <article className="rounded-xl border bg-white p-4 text-sm">
        <h2 className="font-semibold">Internal notes</h2>
        {(notes ?? []).map((n) => <p className="mt-2" key={n.id}>{new Date(n.created_at).toLocaleString()} • {n.message}</p>)}
        <h2 className="mt-4 font-semibold">Status history</h2>
        {(history ?? []).map((h) => <p className="mt-1" key={h.id}>{new Date(h.created_at).toLocaleString()} • {h.from_status ?? "-"} → {h.to_status}</p>)}
      </article>
    </section>
  );
}
