import Link from "next/link";
import { redirect } from "next/navigation";
import { FileArchive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createEvidenceRecord,
  EVIDENCE_CATEGORIES,
  listEvidence,
  listFieldVisits,
  listImpactAssessments,
  listImpactInterventions,
  listImpactProgrammes,
  listMsmePickerOptions,
} from "@/lib/data/impact-intelligence";

async function createEvidenceAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const evidenceId = await createEvidenceRecord(ctx, formData);
  redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}`);
}

function statusClass(status: string | null | undefined) {
  if (status === "verified") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "needs_review") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not captured";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function EvidencePage() {
  const ctx = await getCurrentUserContext();
  const [evidence, programmes, interventions, assessments, visits, msmes] = await Promise.all([
    listEvidence(ctx, { limit: 100 }),
    listImpactProgrammes({ limit: 100 }),
    listImpactInterventions({ limit: 100 }),
    listImpactAssessments({ limit: 100 }),
    listFieldVisits(ctx, { limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
  ]);
  const canCreate = ["admin", "programme_officer", "assessment_officer", "field_officer"].includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Evidence intelligence</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Evidence Repository</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Track storage-ready evidence placeholders linked to MSMEs, programmes, interventions, assessments, and field visits.</p>
          </div>
          <Link href="/dashboard/impact-intelligence/monitoring" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FileArchive className="h-4 w-4" /> Monitoring
          </Link>
        </div>
      </header>

      {canCreate && (
        <form action={createEvidenceAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-3">
          <h2 className="font-semibold text-slate-950 lg:col-span-3">Create evidence placeholder</h2>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            File name
            <input required name="file_name" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="signed-form-001.pdf" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Category
            <select name="evidence_category" defaultValue="other" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Placeholder URL
            <input name="file_url" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Optional URL or future storage path" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            MSME
            <select name="msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unlinked</option>
              {msmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Programme
            <select name="programme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unlinked</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Intervention
            <select name="intervention_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unlinked</option>
              {interventions.map((intervention) => <option key={intervention.id} value={intervention.id}>{intervention.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Assessment
            <select name="assessment_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unlinked</option>
              {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title ?? assessment.assessment_type ?? "Assessment"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Field visit
            <select name="field_visit_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unlinked</option>
              {visits.map((visit) => <option key={visit.id} value={visit.id}>{visit.title ?? "Field visit"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Captured date
            <input name="captured_at" type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
            Description
            <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <div className="flex justify-end lg:col-span-3">
            <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Create evidence</Button>
          </div>
        </form>
      )}

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {evidence.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No evidence yet</h2>
            <p className="mt-2 text-sm text-slate-600">Evidence placeholders will appear after field officers or programme teams record files for monitoring and impact validation.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {evidence.map((item) => (
              <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold uppercase text-slate-500">
                    {(item.file_type ?? item.evidence_type ?? "file").slice(0, 3)}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.verification_status)}`}>{item.verification_status}</span>
                </div>
                <h2 className="mt-3 font-semibold text-slate-950">{item.file_name}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.description ?? "No description recorded."}</p>
                <p className="mt-3 text-xs text-slate-500">{item.evidence_category ?? "other"} • {item.msmes?.business_name ?? "Unlinked MSME"} • {formatDate(item.captured_at ?? item.created_at)}</p>
              </Link>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
