import { createCorrespondenceAction } from "@/app/dashboard/correspondence/actions";
import { SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CreateOutgoingCorrespondencePage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("create");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const approvedTemplates = snapshot.templates.filter((template) => template.status === "approved");
  return (
    <WorkspaceCard title="Create outgoing correspondence" description="The system generates the official reference when the record is saved.">
      <form action={createCorrespondenceAction} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="redirect_to" value="/dashboard/correspondence/create/outgoing" />
        <input type="hidden" name="direction" value="OUT" />
        <label className="text-sm font-bold text-slate-700">Issuer
          <select name="issuer" defaultValue="JNT" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="JNT">Joint LCDBO Secretariat</option>
            <option value="RMRDC">RMRDC</option>
            <option value="RFNL">Roseate Forte Nigeria Limited</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">Sensitivity
          <select name="sensitivity" defaultValue="internal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Approved template
          <select name="template_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="">No template</option>
            {approvedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.issuer} · v{template.version}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Subject
          <input required name="subject" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Saved contact
          <select name="contact_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Use manual recipient details</option>
            {snapshot.contacts.filter((contact) => contact.status === "active").map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.organisation ? ` · ${contact.organisation}` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">Recipient name
          <input name="recipient_name" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700">Recipient organisation
          <input name="recipient_organisation" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Summary
          <textarea name="summary" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">Draft body
          <textarea name="body" rows={8} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 md:col-span-2">
          <input type="checkbox" name="response_required" className="h-4 w-4 rounded border-slate-300" /> Response required
        </label>
        <div className="md:col-span-2"><SubmitButton>Save correspondence</SubmitButton></div>
      </form>
    </WorkspaceCard>
  );
}
