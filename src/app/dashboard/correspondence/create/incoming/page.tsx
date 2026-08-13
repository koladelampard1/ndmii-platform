import { createCorrespondenceAction } from "@/app/dashboard/correspondence/actions";
import { SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function RegisterIncomingCorrespondencePage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("create");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return (
    <WorkspaceCard title="Register incoming correspondence" description="Inbound items enter the register with ownership, response obligation and audit history.">
      <form action={createCorrespondenceAction} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="redirect_to" value="/dashboard/correspondence/create/incoming" />
        <input type="hidden" name="direction" value="IN" />
        <label className="text-sm font-bold text-slate-700">Receiving issuer
          <select name="issuer" defaultValue="JNT" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="JNT">Joint LCDBO Secretariat</option>
            <option value="RMRDC">RMRDC</option>
            <option value="RFNL">Roseate Forte Nigeria Limited</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">Sender organisation
          <input name="recipient_organisation" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Saved sender contact
          <select name="contact_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Use manual sender details</option>
            {snapshot.contacts.filter((contact) => contact.status === "active").map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.organisation ? ` · ${contact.organisation}` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Subject
          <input required name="subject" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Summary
          <textarea name="summary" required rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700">Response due date
          <input type="date" name="response_due_at" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm font-bold text-slate-700">
          <input type="checkbox" name="response_required" className="h-4 w-4 rounded border-slate-300" /> Response required
        </label>
        <div className="md:col-span-2"><SubmitButton>Register incoming correspondence</SubmitButton></div>
      </form>
    </WorkspaceCard>
  );
}
