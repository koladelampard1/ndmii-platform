import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { EVIDENCE_VERIFICATION_STATUSES, getEvidence, MONITORING_REVIEW_ROLES, verifyEvidence } from "@/lib/data/impact-intelligence";

async function verifyEvidenceAction(evidenceId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await verifyEvidence(ctx, evidenceId, formData);
  redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}`);
}

function statusClass(status: string | null | undefined) {
  if (status === "verified") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "needs_review") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default async function EvidenceDetailPage({ params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const ctx = await getCurrentUserContext();
  const { evidence, links } = await getEvidence(ctx, evidenceId);
  if (!evidence) notFound();

  const canReview = MONITORING_REVIEW_ROLES.includes(ctx.role);
  const verify = verifyEvidenceAction.bind(null, evidence.id);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{evidence.evidence_category ?? "evidence"}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{evidence.file_name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{evidence.description ?? "No evidence description has been recorded yet."}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(evidence.verification_status)}`}>{evidence.verification_status}</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">MSME</p><p className="mt-1 font-semibold text-slate-950">{evidence.msmes?.business_name ?? "Unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Programme</p><p className="mt-1 font-semibold text-slate-950">{evidence.impact_programmes?.name ?? "Unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Captured</p><p className="mt-1 font-semibold text-slate-950">{formatDateTime(evidence.captured_at)}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Uploaded</p><p className="mt-1 font-semibold text-slate-950">{formatDateTime(evidence.created_at)}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Preview placeholder</h2>
          <div className="mt-4 flex min-h-72 items-center justify-center rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <div>
              <p className="text-sm font-semibold text-slate-950">{evidence.file_type ?? evidence.evidence_type}</p>
              <p className="mt-2 text-sm text-slate-600">Storage integration is not enabled yet. This record is storage-ready through bucket/path and URL metadata.</p>
              {evidence.file_url && <a href={evidence.file_url} className="mt-4 inline-flex rounded-md border px-4 py-2 text-sm font-medium text-slate-700">Open placeholder URL</a>}
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Storage metadata</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-xs text-slate-500">Bucket</dt><dd className="text-slate-950">{evidence.storage_bucket ?? "Pending"}</dd></div>
              <div><dt className="text-xs text-slate-500">Path</dt><dd className="break-all text-slate-950">{evidence.storage_path ?? "Pending"}</dd></div>
              <div><dt className="text-xs text-slate-500">URL</dt><dd className="break-all text-slate-950">{evidence.file_url ?? "Pending"}</dd></div>
            </dl>
          </article>

          {canReview && (
            <form action={verify} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Verification</h2>
              <select name="verification_status" defaultValue={evidence.verification_status} className="mt-3 w-full rounded-md border px-3 py-2 text-sm">
                {EVIDENCE_VERIFICATION_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
              </select>
              <textarea name="review_note" rows={4} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Evidence review note" />
              <Button type="submit" className="mt-3 w-full">Update verification</Button>
            </form>
          )}
        </aside>
      </div>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Entity links</h2>
        {links.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No secondary links have been recorded for this evidence item.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {links.map((link) => (
              <div key={link.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium text-slate-950">{link.link_type}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {link.field_visit_id && <Link href={`/dashboard/impact-intelligence/monitoring/${link.field_visit_id}`} className="text-emerald-700">Field visit</Link>}
                  {link.assessment_id ? " • Assessment linked" : ""}
                  {link.intervention_id ? " • Intervention linked" : ""}
                  {link.programme_id ? " • Programme linked" : ""}
                  {link.msme_id ? " • MSME linked" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
