import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { Download, Eye, FileWarning, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import {
  IMPACT_EVIDENCE_CREATE_ROLES,
  IMPACT_EVIDENCE_REVIEW_ROLES,
  type ImpactEvidenceEvent,
  type ImpactEvidenceRecord,
  getImpactEvidence,
  logImpactEvidenceDiagnostic,
  transitionImpactEvidence,
} from "@/lib/data/impact-evidence";
import { EmptyState, SectionCard, StatusBadge } from "../../_components";

const EXPECTED_ACTION_ERRORS = [
  "permission to",
  "Only uploaded or returned",
  "Only submitted",
  "must be under review",
  "valid evidence review decision",
  "review note is required",
  "requires a stored file",
  "stored evidence file could not be confirmed",
  "assigned visits or beneficiaries",
  "status changed",
  "record was not found",
  "already archived",
];

function isExpectedActionError(error: unknown) {
  return error instanceof Error && EXPECTED_ACTION_ERRORS.some((message) => error.message.includes(message));
}

async function evidenceTransitionAction(evidenceId: string, action: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await transitionImpactEvidence(ctx, evidenceId, action, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    const params = new URLSearchParams({ error: error instanceof Error ? error.message : "Evidence action could not be completed." });
    redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}?${params}`);
  }
  redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}?success=Evidence%20status%20updated`);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function formatBytes(value: number | null | undefined) {
  if (!value) return "Not available";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function EvidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ evidenceId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const { evidenceId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let evidence: ImpactEvidenceRecord | null = null;
  let events: ImpactEvidenceEvent[] = [];
  let loadError: string | null = null;

  try {
    ctx = await getCurrentUserContext();
    const detail = await getImpactEvidence(ctx, evidenceId);
    evidence = detail.evidence;
    events = detail.events;
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Evidence detail is temporarily unavailable.";
    logImpactEvidenceDiagnostic({
      operation: "evidence_detail_load_failed",
      evidenceId,
      actorRole: ctx?.role ?? null,
      errorMessage: loadError,
      success: false,
    });
  }

  if (loadError || !evidence) {
    return (
      <section className="space-y-6">
        <SectionCard title="Evidence Unavailable">
          <EmptyState
            title={loadError ? "Evidence detail could not load" : "Evidence record was not found"}
            description={loadError?.includes("assigned") || loadError?.includes("permission") ? "This record is outside your assigned evidence scope." : "The evidence record is missing or its source is temporarily unavailable."}
            icon={FileWarning}
          />
        </SectionCard>
      </section>
    );
  }

  const canSubmit = Boolean(ctx && (IMPACT_EVIDENCE_CREATE_ROLES as readonly string[]).includes(ctx.role) && ["uploaded", "returned"].includes(evidence.status));
  const canReview = Boolean(ctx && (IMPACT_EVIDENCE_REVIEW_ROLES as readonly string[]).includes(ctx.role));
  const hasStoredFile = Boolean(evidence.storage_bucket && evidence.storage_path && evidence.original_filename);
  const transition = (action: string) => evidenceTransitionAction.bind(null, evidence.id, action);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{evidence.evidence_category?.replaceAll("_", " ") ?? "programme evidence"}</p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-slate-950">{evidence.original_filename ?? evidence.file_name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{evidence.description ?? "No evidence context note has been recorded."}</p>
          </div>
          <StatusBadge value={evidence.status ?? "draft"} />
        </div>
      </header>

      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {query.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}

      {!hasStoredFile && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Legacy placeholder:</span> this record has no private storage object and cannot be previewed, downloaded, submitted, or verified as evidence.
        </div>
      )}
      {evidence.status === "returned" && evidence.return_reason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Returned for correction:</span> {evidence.return_reason}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Programme</p><p className="mt-1 font-semibold text-slate-950">{evidence.impact_programmes?.name ?? "Legacy/unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Cohort</p><p className="mt-1 font-semibold text-slate-950">{evidence.impact_beneficiary_cohorts?.name ?? "Legacy/unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Beneficiary</p><p className="mt-1 font-semibold text-slate-950">{evidence.msmes?.business_name ?? "Legacy/unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Uploaded</p><p className="mt-1 font-semibold text-slate-950">{formatDateTime(evidence.uploaded_at)}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Secure file access</h2>
              <p className="mt-1 text-sm text-slate-600">Links are authorized server-side and redirect to a five-minute signed Storage URL.</p>
            </div>
            {hasStoredFile && (
              <div className="flex gap-2">
                <a href={`/api/impact-intelligence/evidence/${evidence.id}?disposition=inline`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> Preview</a>
                <a href={`/api/impact-intelligence/evidence/${evidence.id}?disposition=attachment`} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"><Download className="h-4 w-4" /> Download</a>
              </div>
            )}
          </div>
          <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Original filename</dt><dd className="mt-1 break-words font-medium text-slate-950">{evidence.original_filename ?? evidence.file_name}</dd></div>
            <div><dt className="text-xs text-slate-500">Storage bucket</dt><dd className="mt-1 break-words font-medium text-slate-950">{evidence.storage_bucket ?? "Not available"}</dd></div>
            <div><dt className="text-xs text-slate-500">Storage path</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{evidence.storage_path ?? "Not available"}</dd></div>
            <div><dt className="text-xs text-slate-500">MIME type</dt><dd className="mt-1 font-medium text-slate-950">{evidence.mime_type ?? "Not available"}</dd></div>
            <div><dt className="text-xs text-slate-500">File size</dt><dd className="mt-1 font-medium text-slate-950">{formatBytes(evidence.file_size_bytes)}</dd></div>
            <div><dt className="text-xs text-slate-500">SHA-256</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{evidence.checksum_sha256 ?? "Not available"}</dd></div>
            <div><dt className="text-xs text-slate-500">Uploaded at</dt><dd className="mt-1 font-medium text-slate-950">{formatDateTime(evidence.uploaded_at)}</dd></div>
            <div><dt className="text-xs text-slate-500">Submitted at</dt><dd className="mt-1 font-medium text-slate-950">{formatDateTime(evidence.submitted_at)}</dd></div>
            <div><dt className="text-xs text-slate-500">Reviewed at</dt><dd className="mt-1 font-medium text-slate-950">{formatDateTime(evidence.reviewed_at)}</dd></div>
            <div><dt className="text-xs text-slate-500">Archived at</dt><dd className="mt-1 font-medium text-slate-950">{formatDateTime(evidence.archived_at)}</dd></div>
            <div><dt className="text-xs text-slate-500">Uploaded by</dt><dd className="mt-1 font-medium text-slate-950">{evidence.uploaded_by?.full_name ?? evidence.uploaded_by?.email ?? "Unknown user"}</dd></div>
            <div><dt className="text-xs text-slate-500">Reviewed by</dt><dd className="mt-1 font-medium text-slate-950">{evidence.reviewed_by?.full_name ?? evidence.reviewed_by?.email ?? "Not reviewed"}</dd></div>
          </dl>
        </article>

        <aside className="space-y-4">
          {canSubmit && hasStoredFile && (
            <form action={transition("submit")} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">{evidence.status === "returned" ? "Resubmit evidence" : "Submit for review"}</h2>
              <p className="mt-2 text-sm text-slate-600">Submission locks this upload into the reviewer workflow.</p>
              <Button type="submit" className="mt-3 w-full">{evidence.status === "returned" ? "Resubmit" : "Submit evidence"}</Button>
            </form>
          )}

          {canReview && evidence.status === "submitted" && (
            <form action={transition("start_review")} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Begin review</h2>
              <p className="mt-2 text-sm text-slate-600">Move this submitted file into active review before recording a decision.</p>
              <Button type="submit" className="mt-3 w-full">Start review</Button>
            </form>
          )}

          {canReview && evidence.status === "under_review" && (
            <article className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Review decision</h2>
              <form action={transition("verified")} className="mt-3">
                <textarea name="review_note" rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Verification note (optional)" />
                <Button type="submit" className="mt-2 w-full gap-2"><ShieldCheck className="h-4 w-4" /> Verify evidence</Button>
              </form>
              <form action={transition("returned")} className="mt-4 border-t pt-4">
                <textarea required name="review_note" rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Correction required" />
                <Button type="submit" variant="secondary" className="mt-2 w-full">Return for correction</Button>
              </form>
              <form action={transition("rejected")} className="mt-4 border-t pt-4">
                <textarea required name="review_note" rows={3} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Rejection reason" />
                <Button type="submit" className="mt-2 w-full bg-red-700 hover:bg-red-800">Reject evidence</Button>
              </form>
            </article>
          )}

          {canReview && evidence.status !== "archived" && (
            <form action={transition("archive")} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Archive record</h2>
              <p className="mt-2 text-sm text-slate-600">Archive removes this evidence from active workflow while preserving its file and audit history.</p>
              <Button type="submit" variant="secondary" className="mt-3 w-full">Archive evidence</Button>
            </form>
          )}
        </aside>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Context chain</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border p-3"><span className="text-slate-500">Programme:</span> {evidence.programme_id ? <Link href={`/dashboard/impact-intelligence/programmes/${evidence.programme_id}`} className="font-medium text-emerald-700">{evidence.impact_programmes?.name ?? "Open programme"}</Link> : "Unlinked"}</div>
            <div className="rounded-lg border p-3"><span className="text-slate-500">Cohort:</span> {evidence.cohort_id ? <Link href={`/dashboard/impact-intelligence/cohorts/${evidence.cohort_id}`} className="font-medium text-emerald-700">{evidence.impact_beneficiary_cohorts?.name ?? "Open cohort"}</Link> : "Unlinked"}</div>
            <div className="rounded-lg border p-3"><span className="text-slate-500">Intervention:</span> {evidence.intervention_id ? <Link href={`/dashboard/impact-intelligence/interventions/${evidence.intervention_id}`} className="font-medium text-emerald-700">{evidence.impact_interventions?.title ?? "Open intervention"}</Link> : "Not linked"}</div>
            <div className="rounded-lg border p-3"><span className="text-slate-500">Assessment:</span> {evidence.assessment_id ? <Link href={`/dashboard/impact-intelligence/assessments/${evidence.assessment_id}`} className="font-medium text-emerald-700">{evidence.impact_assessments?.title ?? "Open assessment"}</Link> : "Not linked"}</div>
            <div className="rounded-lg border p-3"><span className="text-slate-500">Field visit:</span> {evidence.field_visit_id ? <Link href={`/dashboard/impact-intelligence/monitoring/${evidence.field_visit_id}`} className="font-medium text-emerald-700">{evidence.impact_field_visits?.title ?? "Open visit"}</Link> : "Not linked"}</div>
          </div>
        </article>

        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Evidence history</h2>
          {events.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No Phase 1 evidence events have been recorded. Legacy records may predate this audit trail.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium capitalize text-slate-950">{event.event_type.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{event.actor_role ?? "system"} · {event.from_status ?? "none"} to {event.to_status ?? event.from_status ?? "none"}</p>
                  {event.note && <p className="mt-2 text-sm text-slate-700">{event.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
}
