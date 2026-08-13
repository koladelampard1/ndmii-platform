import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCorrespondenceContactAction, transitionCorrespondenceContactAction } from "@/app/dashboard/correspondence/actions";
import { CorrespondenceTable, StatusBadge, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceContact, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, canAdminister } = await requireLcdboCorrespondenceAccess("view");
  const detail = await getCorrespondenceContact(id, supabase);
  if (!detail) notFound();
  const { contact, history } = detail;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/dashboard/correspondence/contacts" className="text-sm font-black text-emerald-700">← Contacts</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{contact.contact_type.replaceAll("_", " ")}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{contact.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{[contact.organisation, contact.role_title, contact.state].filter(Boolean).join(" · ") || "Programme contact"}</p>
          </div>
          <StatusBadge status={contact.status} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <WorkspaceCard title="Contact profile" description="Edit the governed contact record. Historical correspondence remains preserved when a contact is archived.">
          {canAdminister ? (
            <form action={saveCorrespondenceContactAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/contacts/${contact.id}`} />
              <input type="hidden" name="contact_id" value={contact.id} />
              <label className="text-sm font-bold text-slate-700">Contact name<input name="name" defaultValue={contact.name} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Organisation<input name="organisation" defaultValue={contact.organisation ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Role/title<input name="role_title" defaultValue={contact.role_title ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Type<select name="contact_type" defaultValue={contact.contact_type} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="external">External stakeholder</option><option value="internal">Internal</option><option value="rmrdc">RMRDC</option><option value="roseate_forte">Roseate Forte</option><option value="partner">Partner</option><option value="government">Government</option></select></label>
              <label className="text-sm font-bold text-slate-700">Email<input name="email" type="email" defaultValue={contact.email ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Phone<input name="phone" defaultValue={contact.phone ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">State<input name="state" defaultValue={contact.state ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={contact.status} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
              <label className="text-sm font-bold text-slate-700 md:col-span-2">Address<input name="address" defaultValue={contact.address ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <div className="md:col-span-2"><SubmitButton>Save contact changes</SubmitButton></div>
            </form>
          ) : (
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Info label="Email" value={contact.email ?? "Not recorded"} />
              <Info label="Phone" value={contact.phone ?? "Not recorded"} />
              <Info label="Country" value={contact.country ?? "Nigeria"} />
              <Info label="Updated" value={new Date(contact.updated_at).toLocaleString()} />
            </div>
          )}
        </WorkspaceCard>

        <aside className="space-y-6">
          <WorkspaceCard title="Lifecycle controls" description="Archive requires explicit confirmation. No historical correspondence is deleted.">
            {canAdminister ? (
              <div className="space-y-3">
                <StatusForm contactId={contact.id} status="active" label="Activate contact" />
                <StatusForm contactId={contact.id} status="inactive" label="Deactivate contact" />
                <form action={transitionCorrespondenceContactAction} className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3">
                  <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/contacts/${contact.id}`} />
                  <input type="hidden" name="contact_id" value={contact.id} />
                  <input type="hidden" name="contact_status" value="archived" />
                  <label className="flex gap-2 text-xs font-bold text-rose-900"><input type="checkbox" name="confirm_archive" required /> Confirm archive; retain correspondence history.</label>
                  <textarea name="note" rows={2} placeholder="Archive note" className="mt-2 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm" />
                  <div className="mt-2"><SubmitButton>Archive contact</SubmitButton></div>
                </form>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Lifecycle changes require correspondence administration access.</p>
            )}
          </WorkspaceCard>
        </aside>
      </div>

      <WorkspaceCard title="Correspondence history" description="Records created from this contact keep the original contact snapshot for audit continuity.">
        <CorrespondenceTable records={history} />
      </WorkspaceCard>
    </div>
  );
}

function StatusForm({ contactId, status, label }: { contactId: string; status: "active" | "inactive"; label: string }) {
  return (
    <form action={transitionCorrespondenceContactAction} className="rounded-2xl border border-slate-200 p-3">
      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/contacts/${contactId}`} />
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="contact_status" value={status} />
      <textarea name="note" rows={2} placeholder="Optional lifecycle note" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      <div className="mt-2"><SubmitButton>{label}</SubmitButton></div>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>;
}
