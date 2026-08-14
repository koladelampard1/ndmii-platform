import Link from "next/link";
import { createRepresentativeLetterAction } from "@/app/dashboard/correspondence/actions";
import { SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { counterpartyLabelForRepresentative, institutionLabelForRepresentative } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CreateCorrespondencePage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("create");
  const [snapshot, authority] = await Promise.all([
    getCorrespondenceWorkspaceSnapshot(supabase),
    ctx.appUserId ? getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : Promise.resolve(null),
  ]);
  const approvedTemplates = snapshot.templates.filter((template) => template.status === "approved");

  if (!authority) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <WorkspaceCard title="Representative authority required" description="New LCDBO letters now use the two-party representative workflow. Ask a correspondence administrator to assign RMRDC or Roseate representative authority to this account.">
          <p className="text-sm leading-6 text-slate-600">Legacy operational creation remains available only for compatibility while the transition is reviewed.</p>
          <Link href="/dashboard/correspondence/create/outgoing" className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-800">Open legacy outgoing form</Link>
        </WorkspaceCard>
        <WorkspaceCard title="Register incoming correspondence" description="Inbound correspondence registration remains available for records administrators and compatibility operations.">
          <Link href="/dashboard/correspondence/create/incoming" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Register incoming record</Link>
        </WorkspaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspaceCard
        title={`Create letter as ${institutionLabelForRepresentative(authority.representative_role)} Representative`}
        description={`Complete the letter, preview it, then apply the authorised ${institutionLabelForRepresentative(authority.representative_role)} institutional signature and send it to ${counterpartyLabelForRepresentative(authority.representative_role)} for countersignature.`}
      >
        <form action={createRepresentativeLetterAction} className="grid gap-5">
          <input type="hidden" name="redirect_to" value="/dashboard/correspondence/create" />
          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Step 1 — Recipient</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 md:col-span-2">Saved contact
                <select name="contact_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="">Use manual recipient details</option>
                  {snapshot.contacts.filter((contact) => contact.status === "active").map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.organisation ? ` · ${contact.organisation}` : ""}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Recipient organisation<input name="recipient_organisation" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Recipient name<input name="recipient_name" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Official title<input name="recipient_title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Email<input name="recipient_email" type="email" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700 md:col-span-2">Address<textarea name="recipient_address" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Step 2 — Letter</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Correspondence type
                <select name="correspondence_type" defaultValue="joint_letter" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="joint_letter">Joint official letter</option>
                  <option value="institution_letter">Institution-specific letter</option>
                  <option value="response_letter">Response letter</option>
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
              <label className="text-sm font-bold text-slate-700 md:col-span-2">Subject<input required name="subject" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700 md:col-span-2">Summary<textarea name="summary" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700 md:col-span-2">Body<textarea required name="body" rows={10} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="response_required" className="h-4 w-4 rounded border-slate-300" /> Response required</label>
              <label className="text-sm font-bold text-slate-700">Response deadline<input name="response_due_at" type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Step 3 — Review</p>
            <p className="mt-2 text-sm leading-6 text-emerald-950">The system will generate the reference, create version 1, and show a preview before signature. Protected signature assets are never returned to the browser.</p>
          </section>

          <div>
            <SubmitButton>Save draft letter</SubmitButton>
          </div>
        </form>
      </WorkspaceCard>
    </div>
  );
}
