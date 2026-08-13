import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCorrespondenceTemplateAction, transitionCorrespondenceTemplateAction } from "@/app/dashboard/correspondence/actions";
import { StatusBadge, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceTemplate, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { renderTemplatePreview, validateTemplatePlaceholders } from "@/lib/lcdbo-correspondence/templates";

export default async function CorrespondenceTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, canAdminister } = await requireLcdboCorrespondenceAccess("view");
  const detail = await getCorrespondenceTemplate(id, supabase);
  if (!detail) notFound();
  const { template, versions } = detail;
  const validation = validateTemplatePlaceholders(template.body_template, template.placeholder_schema);
  const preview = renderTemplatePreview(template.body_template, {
    reference: "LCDBO/JNT/OUT/2026/0001",
    date: new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }),
    recipient_name: "Honourable Commissioner",
    subject: "LCDBO Programme Correspondence",
    body: "This preview shows how the approved letterhead template will populate governed placeholders before a record is issued.",
    signatory_block: "LCDBO Joint Secretariat",
    verification_url: "https://correspondence.dbin.ng/verify/example-token",
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/dashboard/correspondence/templates" className="text-sm font-black text-emerald-700">← Templates</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{template.template_key} · v{template.version}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{template.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{template.issuer} · {template.correspondence_type}</p>
          </div>
          <StatusBadge status={template.status} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <WorkspaceCard title="Template definition" description="Approved or retired templates are immutable; create a new version for material changes.">
          {canAdminister && !["approved", "retired"].includes(template.status) ? (
            <form action={saveCorrespondenceTemplateAction} className="grid gap-3 md:grid-cols-3">
              <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/templates/${template.id}`} />
              <input type="hidden" name="template_id" value={template.id} />
              <label className="text-sm font-bold text-slate-700">Template key<input name="template_key" defaultValue={template.template_key} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Name<input name="name" defaultValue={template.name} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Issuer<select name="issuer" defaultValue={template.issuer} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="JNT">Joint Secretariat</option><option value="RMRDC">RMRDC</option><option value="RFNL">Roseate Forte</option></select></label>
              <label className="text-sm font-bold text-slate-700">Version<input name="version" defaultValue={template.version} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Type<input name="correspondence_type" defaultValue={template.correspondence_type} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700">Signature rule<input name="required_signatures" defaultValue={String(template.signature_config?.required_signatures ?? "joint")} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="text-sm font-bold text-slate-700 md:col-span-3">Placeholder schema<textarea name="placeholder_schema" rows={3} defaultValue={JSON.stringify(template.placeholder_schema, null, 2)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" /></label>
              <label className="text-sm font-bold text-slate-700 md:col-span-3">Body template<textarea name="body_template" rows={8} required defaultValue={template.body_template} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" /></label>
              <div className="md:col-span-3"><SubmitButton>Save template changes</SubmitButton></div>
            </form>
          ) : (
            <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">{template.body_template}</pre>
          )}
        </WorkspaceCard>

        <aside className="space-y-6">
          <WorkspaceCard title="Placeholder feedback">
            <div className="space-y-3 text-sm">
              <StatusBadge status={validation.ok ? "valid" : "needs_attention"} />
              <Info label="Required" value={validation.required.join(", ") || "None"} />
              <Info label="Present" value={validation.present.join(", ") || "None"} />
              <Info label="Missing" value={validation.missing.join(", ") || "None"} />
            </div>
          </WorkspaceCard>

          <WorkspaceCard title="Lifecycle controls">
            {canAdminister ? (
              <div className="flex flex-wrap gap-2">
                {["submit", "approve", "reject", "retire"].map((action) => (
                  <form key={action} action={transitionCorrespondenceTemplateAction}>
                    <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/templates/${template.id}`} />
                    <input type="hidden" name="template_id" value={template.id} />
                    <input type="hidden" name="template_action" value={action} />
                    <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black capitalize text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800">{action}</button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Lifecycle changes require correspondence administration access.</p>
            )}
          </WorkspaceCard>
        </aside>
      </div>

      <WorkspaceCard title="Approved letterhead preview" description="Representative populated output. Exact issued PDFs retain the exact template version selected at record creation.">
        <pre className="whitespace-pre-wrap rounded-2xl bg-white p-5 text-sm leading-7 text-slate-800 ring-1 ring-slate-200">{preview}</pre>
      </WorkspaceCard>

      <WorkspaceCard title="Version history" description="Templates are versioned by key; approved and retired versions remain visible for audit and exact-version retention.">
        <div className="space-y-3">
          {versions.map((version) => (
            <article key={version.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/dashboard/correspondence/templates/${version.id}`} className="font-black text-slate-950 hover:text-emerald-800">v{version.version} · {version.name}</Link>
                  <p className="mt-1 text-xs text-slate-500">{new Date(version.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={version.status} />
              </div>
            </article>
          ))}
        </div>
      </WorkspaceCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 break-words font-bold text-slate-900">{value}</p></div>;
}
