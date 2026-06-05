import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  assignFieldVisit,
  completeFieldVisit,
  createEvidenceRecord,
  EVIDENCE_CATEGORIES,
  getFieldVisit,
  listUserPickerOptions,
  MONITORING_MANAGE_ROLES,
  MONITORING_REVIEW_ROLES,
} from "@/lib/data/impact-intelligence";

async function assignVisitAction(visitId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const assignedTo = String(formData.get("assigned_to_user_id") ?? "");
  try {
    if (assignedTo) await assignFieldVisit(ctx, visitId, assignedTo);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedMonitoringActionError(error)) throw error;
    redirectWithMonitoringError(visitId, error);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

async function completeVisitAction(visitId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await completeFieldVisit(ctx, visitId, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedMonitoringActionError(error)) throw error;
    redirectWithMonitoringError(visitId, error);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

async function createEvidenceAction(visitId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  formData.set("field_visit_id", visitId);
  try {
    await createEvidenceRecord(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedMonitoringActionError(error)) throw error;
    redirectWithMonitoringError(visitId, error);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

const EXPECTED_MONITORING_ACTION_ERRORS = [
  "Selected field officer does not exist.",
  "Selected assignee must have field_officer role.",
  "You do not have permission to manage field monitoring.",
  "You do not have permission to complete this field visit.",
  "You can only access field visits assigned to you.",
  "Evidence file name is required.",
  "You do not have permission to create evidence records.",
];

function isExpectedMonitoringActionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return EXPECTED_MONITORING_ACTION_ERRORS.some((message) => error.message.includes(message));
}

function redirectWithMonitoringError(visitId: string, error: unknown): never {
  const params = new URLSearchParams();
  params.set("error", error instanceof Error ? error.message : "Monitoring action could not be completed.");
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}?${params.toString()}`);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status: string | null) {
  if (status === "reviewed") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-blue-100 text-blue-700";
  if (status === "assigned" || status === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function MonitoringDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitId: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { visitId } = await params;
  const query = (await searchParams) ?? {};
  const ctx = await getCurrentUserContext();
  const [detail, fieldOfficers] = await Promise.all([getFieldVisit(ctx, visitId), listUserPickerOptions("field_officer")]);
  const { visit, assignments, checklist, notes, evidence } = detail;
  if (!visit) notFound();

  const canManage = MONITORING_MANAGE_ROLES.includes(ctx.role);
  const canReview = MONITORING_REVIEW_ROLES.includes(ctx.role);
  const canComplete = ctx.role === "field_officer" || canManage;
  const assignVisit = assignVisitAction.bind(null, visit.id);
  const completeVisit = completeVisitAction.bind(null, visit.id);
  const createEvidence = createEvidenceAction.bind(null, visit.id);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{visit.impact_programmes?.name ?? "Field monitoring"}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{visit.title ?? "Field visit"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{visit.msmes?.business_name ?? "Unlinked MSME"} • {visit.location_text ?? "Location pending"} • {formatDateTime(visit.scheduled_at ?? visit.visit_date)}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(visit.status)}`}>{visit.status ?? "pending"}</span>
        </div>
      </header>

      {query.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {query.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Programme</p><p className="mt-1 font-semibold text-slate-950">{visit.impact_programmes?.name ?? "Unassigned"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Cohort</p><p className="mt-1 font-semibold text-slate-950">{visit.impact_beneficiary_cohorts?.name ?? "Unanchored"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Intervention</p><p className="mt-1 font-semibold text-slate-950">{visit.impact_interventions?.title ?? "Unassigned"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Assessment</p><p className="mt-1 font-semibold text-slate-950">{visit.impact_assessments?.title ?? "Unassigned"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Checklist</p><p className="mt-1 font-semibold text-slate-950">{checklist.filter((item) => item.is_completed).length}/{checklist.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Evidence</p><p className="mt-1 font-semibold text-slate-950">{evidence.length}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <form action={completeVisit} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950">Monitoring checklist</h2>
            {canComplete && visit.status !== "reviewed" && <Button type="submit">Complete visit</Button>}
          </div>
          {checklist.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No checklist items have been added to this visit.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm text-slate-700">
                  <input name={`checklist_${item.id}`} type="checkbox" defaultChecked={item.is_completed} disabled={!canComplete || visit.status === "reviewed"} className="mt-1" />
                  <span>
                    <span className="font-medium text-slate-950">{item.checklist_item}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.item_category ?? "general"} • {item.is_required ? "required" : "optional"}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3">
            <textarea name="findings" rows={4} defaultValue={visit.findings ?? ""} disabled={!canComplete || visit.status === "reviewed"} className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-slate-50" placeholder="Field findings" />
            <textarea name="recommendations" rows={3} defaultValue={visit.recommendations ?? ""} disabled={!canComplete || visit.status === "reviewed"} className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-slate-50" placeholder="Recommendations or follow-up needs" />
            <textarea name="note" rows={3} disabled={!canComplete || visit.status === "reviewed"} className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-slate-50" placeholder="Monitoring note" />
          </div>
        </form>

        <aside className="space-y-4">
          {canManage && (
            <form action={assignVisit} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Assignment</h2>
              <select name="assigned_to_user_id" defaultValue={visit.assigned_to_user_id ?? ""} className="mt-3 w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select field officer</option>
                {fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? "Field officer"}</option>)}
              </select>
              <Button type="submit" className="mt-3 w-full">Assign visit</Button>
              <p className="mt-3 text-xs text-slate-500">{assignments[0] ? `Last assigned ${formatDateTime(assignments[0].assigned_at)}` : "No assignment history yet."}</p>
            </form>
          )}

          <form action={createEvidence} className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Add evidence placeholder</h2>
            <input required name="file_name" className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="facility-photo-001.jpg" />
            <select name="evidence_category" defaultValue="monitoring_photo" className="mt-3 w-full rounded-md border px-3 py-2 text-sm">
              {EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
            </select>
            <input name="file_url" className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Optional placeholder URL" />
            <input type="hidden" name="programme_id" value={visit.programme_id ?? ""} />
            <input type="hidden" name="intervention_id" value={visit.intervention_id ?? ""} />
            <input type="hidden" name="assessment_id" value={visit.assessment_id ?? ""} />
            <input type="hidden" name="msme_id" value={visit.msme_id ?? ""} />
            <textarea name="description" rows={3} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Evidence description" />
            <Button type="submit" className="mt-3 w-full">Create evidence</Button>
          </form>

          {canReview && visit.status === "completed" && (
            <form action={completeVisit} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Review monitoring</h2>
              <input type="hidden" name="review_action" value="reviewed" />
              <textarea name="review_note" rows={4} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Review note" />
              <Button type="submit" className="mt-3 w-full">Mark reviewed</Button>
            </form>
          )}
        </aside>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Evidence</h2>
          {evidence.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No evidence has been linked to this visit.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {evidence.map((item) => (
                <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`} className="block rounded-lg border p-3 hover:border-emerald-200 hover:bg-emerald-50/40">
                  <p className="font-medium text-slate-950">{item.file_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.evidence_category ?? "other"} • {item.verification_status}</p>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Monitoring notes</h2>
          {notes.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No monitoring notes have been captured yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border p-3">
                  <p className="font-medium text-slate-950">{note.title ?? note.note_type}</p>
                  <p className="mt-1 text-sm text-slate-600">{note.note}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(note.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
