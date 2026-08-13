import Link from "next/link";
import { saveCorrespondenceContactAction } from "@/app/dashboard/correspondence/actions";
import { SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceContactsPage() {
  const { supabase, canAdminister } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return (
    <div className="space-y-6">
      {canAdminister ? (
        <WorkspaceCard title="Add programme contact" description="Maintain governed recipient and stakeholder records for official correspondence.">
          <form action={saveCorrespondenceContactAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/correspondence/contacts" />
            <label className="text-sm font-bold text-slate-700">Contact name<input name="name" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Organisation<input name="organisation" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Role/title<input name="role_title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Email<input name="email" type="email" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Phone<input name="phone" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Type<select name="contact_type" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="external">External stakeholder</option><option value="internal">Internal</option><option value="rmrdc">RMRDC</option><option value="roseate_forte">Roseate Forte</option><option value="partner">Partner</option><option value="government">Government</option></select></label>
            <label className="text-sm font-bold text-slate-700">State<input name="state" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Address<input name="address" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><SubmitButton>Save contact</SubmitButton></div>
          </form>
        </WorkspaceCard>
      ) : null}

      <WorkspaceCard title="Contacts" description="Programme contacts support recipient selection, inbound registration and correspondence history.">
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Duplicate protection checks matching contact name and email before creation. If a warning appears, open the existing contact, update it, or archive the obsolete record instead of creating a competing recipient identity.
        </div>
        {snapshot.contacts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.contacts.map((contact) => (
              <article key={contact.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-slate-950"><Link href={`/dashboard/correspondence/contacts/${contact.id}`} className="hover:text-emerald-800">{contact.name}</Link></h2>
                    <p className="mt-1 text-sm text-slate-600">{contact.organisation ?? "Institutional contact"} {contact.role_title ? `· ${contact.role_title}` : ""}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800">{contact.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{[contact.email, contact.phone, contact.state].filter(Boolean).join(" · ")}</p>
                <Link href={`/dashboard/correspondence/contacts/${contact.id}`} className="mt-4 inline-flex text-xs font-black text-emerald-700">Open governed contact →</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No contacts have been added yet.</div>
        )}
      </WorkspaceCard>
    </div>
  );
}
