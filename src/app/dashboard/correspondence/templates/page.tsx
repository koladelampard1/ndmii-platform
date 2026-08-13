import Link from "next/link";
import { saveCorrespondenceTemplateAction, transitionCorrespondenceTemplateAction } from "@/app/dashboard/correspondence/actions";
import { StatusBadge, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceTemplatesPage() {
  const { supabase, canAdminister } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return (
    <div className="space-y-6">
      {canAdminister ? (
        <WorkspaceCard title="Create template" description="Define governed LCDBO templates with explicit placeholders and signature expectations.">
          <form action={saveCorrespondenceTemplateAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/correspondence/templates" />
            <label className="text-sm font-bold text-slate-700">Template key<input name="template_key" required placeholder="official-letter-basic" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Name<input name="name" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Issuer<select name="issuer" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="JNT">Joint Secretariat</option><option value="RMRDC">RMRDC</option><option value="RFNL">Roseate Forte</option></select></label>
            <label className="text-sm font-bold text-slate-700">Version<input name="version" defaultValue="1.0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Type<input name="correspondence_type" defaultValue="official_letter" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Signature rule<select name="required_signatures" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="joint">Joint</option><option value="rmrdc_and_roseate">RMRDC + Roseate</option><option value="delegate">Approved delegate</option></select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Placeholder schema<textarea name="placeholder_schema" rows={3} defaultValue={'{"required":["reference","date","recipient_name","subject","body","signatory_block","verification_url"]}'} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Body template<textarea name="body_template" rows={7} required defaultValue={"Reference: {{reference}}\nDate: {{date}}\n\n{{recipient_name}}\n\nSubject: {{subject}}\n\n{{body}}\n\n{{signatory_block}}\n\nVerify this correspondence at {{verification_url}}."} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" /></label>
            <div className="md:col-span-3"><SubmitButton>Save draft template</SubmitButton></div>
          </form>
        </WorkspaceCard>
      ) : null}

      <WorkspaceCard title="Templates" description="Approved templates define official layout and required placeholders for issued correspondence.">
        <div className="grid gap-3 md:grid-cols-2">
          {snapshot.templates.map((template) => (
            <article key={template.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3"><h2 className="font-black text-slate-950"><Link href={`/dashboard/correspondence/templates/${template.id}`} className="hover:text-emerald-800">{template.name}</Link></h2><StatusBadge status={template.status} /></div>
              <p className="mt-2 text-sm text-slate-600">{template.issuer} · {template.correspondence_type} · v{template.version}</p>
              <p className="mt-3 line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-500">{template.body_template}</p>
              {canAdminister ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {["submit", "approve", "reject", "retire"].map((action) => (
                    <form key={action} action={transitionCorrespondenceTemplateAction}>
                      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/templates/${template.id}`} />
                      <input type="hidden" name="template_id" value={template.id} />
                      <input type="hidden" name="template_action" value={action} />
                      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black capitalize text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800">{action}</button>
                    </form>
                  ))}
                </div>
              ) : null}
              <Link href={`/dashboard/correspondence/templates/${template.id}`} className="mt-4 inline-flex text-xs font-black text-emerald-700">Open template detail →</Link>
            </article>
          ))}
        </div>
        {!snapshot.templates.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No templates have been configured yet.</div> : null}
      </WorkspaceCard>
    </div>
  );
}
