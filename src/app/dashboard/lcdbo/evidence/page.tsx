import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";
import { getLcdboSprint3Snapshot } from "@/lib/data/lcdbo-delivery-intelligence";
import { linkLcdboEvidenceAction, reviewLcdboEvidenceAction } from "@/app/dashboard/lcdbo/executive-actions";

export const dynamic = "force-dynamic";

export default async function LcdboEvidencePage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; target?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboSprint3Snapshot({ client: access.supabase });
  const options = snapshot.evidenceTargets;
  const selectedTarget = options.some((item) => item.key === params.target) ? params.target : "";

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Evidence linkage"
        title="Programme evidence and verification"
        description="Link approved documents, safe external references and structured notes to delivery records without duplicating document binaries or exposing private storage paths."
        classification={{ classification: "operational", label: "Programme evidence" }}
        disclosure="Evidence links preserve existing document access rules. Unsafe URL schemes are rejected and submitters cannot verify their own evidence."
      />
      {params.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Evidence action completed.</div> : null}
      {params.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">Evidence action could not be completed.</div> : null}
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <WorkspaceSection title="Link evidence" description="Programme officers and institution administrators can link governed evidence to the operational record that explains it.">
          {access.canManage ? (
            <form action={linkLcdboEvidenceAction} className="space-y-4">
              <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/evidence" />
              <label className="block text-sm font-bold text-slate-700">Related record
                <select name="related_entity" defaultValue={selectedTarget} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required>
                  <option value="">Select a record</option>
                  {options.map((item) => <option key={item.key} value={`${item.type}:${item.id}`}>{item.label} ({item.evidenceCount} evidence)</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">Evidence type
                <select name="evidence_type" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="reference_note">Reference note</option>
                  <option value="external_link">Safe external link</option>
                  <option value="approved_document">Approved document reference</option>
                  <option value="document_submission">Document submission reference</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">Reference title<input name="reference_title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" required /></label>
              <label className="block text-sm font-bold text-slate-700">Safe URL<input name="safe_url" type="url" placeholder="https://…" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="block text-sm font-bold text-slate-700">Reference note<textarea name="reference_note" rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="block text-sm font-bold text-slate-700">Classification
                <select name="data_classification" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="operational">Operational</option>
                  <option value="reference">Reference</option>
                  <option value="external">External</option>
                  <option value="test_uat">Test/UAT</option>
                </select>
              </label>
              <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Link evidence</button>
            </form>
          ) : <WorkspaceState type="unauthorized" title="Read-only evidence access" description="Your current LCDBO role can inspect evidence lineage but cannot link or verify evidence." />}
        </WorkspaceSection>
        <WorkspaceSection title="Evidence register" description={`${snapshot.evidence.length} governed evidence link(s).`}>
          {snapshot.evidence.length ? (
            <div className="space-y-3">
              {snapshot.evidence.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-black text-slate-900">{item.reference_title}</p><p className="mt-1 text-xs text-slate-500">{item.related_entity_type} · {item.evidence_type} · {item.data_classification}</p></div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{item.status}</span>
                  </div>
                  {item.reference_note ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.reference_note}</p> : null}
                  {item.safe_url ? <a href={item.safe_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-emerald-700">Open safe link<ExternalLink className="h-4 w-4" /></a> : null}
                  {access.canManage ? (
                    <form action={reviewLcdboEvidenceAction} className="mt-4 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/evidence" />
                      <input type="hidden" name="evidence_id" value={item.id} />
                      <select name="status" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                        <option value="under_review">Under review</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="superseded">Superseded</option>
                      </select>
                      <input name="verification_note" placeholder="Reviewer note" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                      <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white">Save review</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : <WorkspaceState type="empty" title="No evidence linked yet" description="Evidence links will appear once programme officers connect documents, safe URLs or reference notes to delivery records." />}
        </WorkspaceSection>
      </div>
      <WorkspaceSection title="Evidence governance rules">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">Context coverage</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Evidence can now be initiated from workstreams, milestones/deliverables, RAID items, decisions, state/LGA/cluster plans, activities, progress updates and pilot-readiness contexts through one governed evidence model.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mb-3 h-5 w-5" />Existing LCDBO document access rules remain authoritative.</div>
          <div className="rounded-2xl bg-sky-50 p-4 text-sm leading-6 text-sky-950"><FileText className="mb-3 h-5 w-5" />No document binaries are duplicated by this evidence layer.</div>
          <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><CheckCircle2 className="mb-3 h-5 w-5" />Verification history is append-only through evidence review records.</div>
        </div>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
