import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  appendImpactInterventionNote,
  getImpactInterventionDetail,
  getInterventionStage,
  IMPACT_WRITE_ROLES,
  INTERVENTION_STAGES,
  INTERVENTION_STATUSES,
  updateImpactInterventionStatus,
} from "@/lib/data/impact-intelligence";

async function updateProgressAction(interventionId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await updateImpactInterventionStatus(ctx, interventionId, formData);
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}`);
}

async function addNoteAction(interventionId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await appendImpactInterventionNote(ctx, interventionId, formData);
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}`);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function formatCurrency(value: number | null) {
  if (!value) return "Not set";
  return `NGN ${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default async function ImpactInterventionDetailPage({ params }: { params: Promise<{ interventionId: string }> }) {
  const { interventionId } = await params;
  const [ctx, detail] = await Promise.all([getCurrentUserContext(), getImpactInterventionDetail(interventionId)]);
  const { intervention, events } = detail;
  if (!intervention) notFound();
  const canWrite = IMPACT_WRITE_ROLES.includes(ctx.role);
  const updateProgress = updateProgressAction.bind(null, intervention.id);
  const addNote = addNoteAction.bind(null, intervention.id);
  const stage = getInterventionStage(intervention);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{intervention.impact_programmes?.name ?? "Unassigned programme"}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{intervention.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{intervention.description ?? "No intervention description has been recorded yet."}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{intervention.status ?? "planned"}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{stage}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">MSME</p><p className="mt-1 font-semibold text-slate-950">{intervention.msmes?.business_name ?? "Unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Public ID</p><p className="mt-1 font-semibold text-slate-950">{intervention.msmes?.msme_id ?? "Not available"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Approved</p><p className="mt-1 font-semibold text-slate-950">{formatCurrency(intervention.approved_amount)}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Disbursed</p><p className="mt-1 font-semibold text-slate-950">{formatCurrency(intervention.disbursed_amount)}</p></div>
      </div>

      {canWrite && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={updateProgress} className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Update status and stage</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-700">Status<select name="status" defaultValue={intervention.status ?? "planned"} className="w-full rounded-md border px-3 py-2 text-sm font-normal">{INTERVENTION_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select></label>
              <label className="space-y-1 text-sm font-medium text-slate-700">Stage<select name="stage" defaultValue={stage} className="w-full rounded-md border px-3 py-2 text-sm font-normal">{INTERVENTION_STAGES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <textarea name="note" rows={3} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Progress note" />
            <div className="mt-3 flex justify-end"><Button type="submit">Update progress</Button></div>
          </form>
          <form action={addNote} className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Append timeline event</h2>
            <input name="title" className="mt-4 w-full rounded-md border px-3 py-2 text-sm" placeholder="Event title" />
            <textarea required name="note" rows={4} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Timeline note" />
            <div className="mt-3 flex justify-end"><Button type="submit">Add event</Button></div>
          </form>
        </div>
      )}

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Timeline</h2>
        {events.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No timeline events have been recorded yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{event.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{event.note ?? `${event.from_status ?? "-"} to ${event.to_status ?? "-"}`}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">{event.event_type} • {event.actor_role ?? "system"}</p>
              </li>
            ))}
          </ol>
        )}
      </article>
    </section>
  );
}
