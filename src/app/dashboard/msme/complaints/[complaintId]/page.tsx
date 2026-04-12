import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createComplaintStatusHistory, emitComplaintEvent } from "@/lib/data/complaints";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getCurrentUserContext } from "@/lib/auth/session";

async function msmeComplaintAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();

  const complaintId = String(formData.get("complaint_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();

  const { data: complaint } = await supabase
    .from("complaints")
    .select("id,status,provider_profile_id")
    .eq("id", complaintId)
    .maybeSingle();

  const ownsComplaint = Boolean(complaint?.provider_profile_id && complaint.provider_profile_id === workspace.provider.id);
  console.info("[complaints] msme_workspace_ownership_check", {
    complaintId,
    providerProfileId: complaint?.provider_profile_id ?? null,
    workspaceProviderId: workspace.provider.id,
    ownsComplaint,
  });

  if (!complaint || !ownsComplaint) {
    redirect("/access-denied");
  }

  if (kind === "respond") {
    const message = String(formData.get("message") ?? "").trim();
    const attachmentUrl = String(formData.get("attachment_url") ?? "").trim() || null;
    if (message) {
      await supabase.from("complaint_messages").insert({
        complaint_id: complaintId,
        author_user_id: ctx.appUserId,
        author_role: ctx.role,
        message,
        message_type: "response",
        visibility: "shared",
        attachment_url: attachmentUrl,
      });
      console.info("[complaints] response_insertion_event", { complaintId, hasAttachment: Boolean(attachmentUrl) });
      await emitComplaintEvent("complaint_responded", { complaintId, authorRole: ctx.role });
    }
  }

  if (kind === "status") {
    const nextStatus = String(formData.get("status") ?? "").trim();
    if (["awaiting_complainant_response", "resolved"].includes(nextStatus)) {
      await supabase.from("complaints").update({ status: nextStatus, resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null }).eq("id", complaintId);
      await createComplaintStatusHistory({
        complaintId,
        fromStatus: complaint.status,
        toStatus: nextStatus,
        changedByUserId: ctx.appUserId,
        changedByRole: ctx.role,
        note: "MSME status update",
      });
      console.info("[complaints] status_change_event", { complaintId, from: complaint.status, to: nextStatus, actorRole: ctx.role });
      await emitComplaintEvent("complaint_status_changed", { complaintId, fromStatus: complaint.status, toStatus: nextStatus, actorRole: ctx.role });
    }
  }

  revalidatePath(`/dashboard/msme/complaints/${complaintId}`);
  revalidatePath("/dashboard/msme/complaints");
  redirect(`/dashboard/msme/complaints/${complaintId}?saved=1`);
}

export default async function MsmeComplaintDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ complaintId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { complaintId } = await params;
  const query = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data: complaint } = await supabase
    .from("complaints")
    .select("*")
    .eq("id", complaintId)
    .or(`provider_profile_id.eq.${workspace.provider.id},provider_id.eq.${workspace.provider.id}`)
    .maybeSingle();

  if (!complaint) return <section className="rounded-xl border bg-white p-6">Complaint not found for this provider workspace.</section>;

  const [{ data: messages }, { data: history }] = await Promise.all([
    supabase.from("complaint_messages").select("*").eq("complaint_id", complaintId).eq("visibility", "shared").order("created_at", { ascending: true }),
    supabase.from("complaint_status_history").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: true }),
  ]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{complaint.complaint_reference ?? complaint.id}</p>
        <h1 className="mt-1 text-2xl font-semibold">{complaint.title ?? complaint.summary ?? "Complaint"}</h1>
        <p className="mt-2 text-sm text-slate-600">Status: {complaint.status} • Priority: {complaint.priority ?? complaint.severity ?? "medium"}</p>
        <p className="mt-2 text-sm text-slate-700">{complaint.description}</p>
      </header>

      {query.saved === "1" && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Complaint action saved.</p>}

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Conversation</h2>
        <div className="mt-3 space-y-2">
          {(messages ?? []).map((msg) => (
            <div key={msg.id} className="rounded border p-2 text-sm">
              <p className="text-xs text-slate-500">{msg.author_role ?? "system"} • {new Date(msg.created_at).toLocaleString()}</p>
              <p className="mt-1">{msg.message}</p>
              {msg.attachment_url && <a href={msg.attachment_url} className="mt-1 inline-block text-xs text-indigo-700 hover:underline">Attachment</a>}
            </div>
          ))}
          {(!messages || messages.length === 0) && <p className="text-sm text-slate-500">No responses yet.</p>}
        </div>
        <form action={msmeComplaintAction} className="mt-4 space-y-2">
          <input type="hidden" name="kind" value="respond" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <textarea name="message" required className="min-h-24 w-full rounded border px-3 py-2 text-sm" placeholder="Provide a response to the complaint" />
          <input name="attachment_url" className="w-full rounded border px-3 py-2 text-sm" placeholder="Evidence URL (optional)" />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Post response</button>
        </form>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Status workflow</h2>
        <form action={msmeComplaintAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value="status" />
          <input type="hidden" name="complaint_id" value={complaint.id} />
          <select name="status" className="rounded border px-2 py-2 text-sm">
            <option value="awaiting_complainant_response">Awaiting complainant response</option>
            <option value="resolved">Resolved</option>
          </select>
          <button className="rounded bg-indigo-700 px-3 py-2 text-sm text-white">Update status</button>
        </form>
        <div className="mt-3 space-y-1 text-sm">
          {(history ?? []).map((item) => (
            <p key={item.id} className="text-slate-600">{new Date(item.created_at).toLocaleString()} • {item.from_status ?? "-"} → {item.to_status} ({item.changed_by_role ?? "system"})</p>
          ))}
        </div>
      </article>
    </section>
  );
}
