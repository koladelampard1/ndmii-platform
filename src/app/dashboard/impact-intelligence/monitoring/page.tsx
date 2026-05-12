import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createFieldVisit,
  FIELD_VISIT_STATUSES,
  listFieldVisits,
  listImpactAssessments,
  listImpactInterventions,
  listImpactProgrammes,
  listMsmePickerOptions,
  listUserPickerOptions,
  MONITORING_MANAGE_ROLES,
} from "@/lib/data/impact-intelligence";

const DEFAULT_CHECKLIST = [
  "Confirm business location | verification | yes",
  "Capture facility photo placeholder | evidence | yes",
  "Validate intervention usage | monitoring | yes",
  "Record follow-up needs | follow_up | no",
].join("\n");

async function createVisitAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const visitId = await createFieldVisit(ctx, formData);
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function statusClass(status: string | null) {
  if (status === "reviewed") return "bg-emerald-100 text-emerald-700";
  if (status === "completed") return "bg-blue-100 text-blue-700";
  if (status === "assigned" || status === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function MonitoringPage() {
  const ctx = await getCurrentUserContext();
  const [visits, programmes, interventions, assessments, msmes, fieldOfficers] = await Promise.all([
    listFieldVisits(ctx, { limit: 100 }),
    listImpactProgrammes({ limit: 100 }),
    listImpactInterventions({ limit: 100 }),
    listImpactAssessments({ limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
    listUserPickerOptions("field_officer"),
  ]);
  const canManage = MONITORING_MANAGE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">BOI field monitoring</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Monitoring</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Assign field visits, track monitoring lifecycle, capture notes, and connect evidence to BOI intervention records.</p>
          </div>
          <Link href="/dashboard/impact-intelligence/evidence" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <CalendarCheck className="h-4 w-4" /> Evidence repository
          </Link>
        </div>
      </header>

      {canManage && (
        <form action={createVisitAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-3">
          <h2 className="font-semibold text-slate-950 lg:col-span-3">Create monitoring task</h2>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Visit title
            <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Post-disbursement monitoring visit" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            MSME
            <select required name="msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Select MSME</option>
              {msmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name} ({msme.msme_id ?? msme.state ?? "DBIN"})</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Field officer
            <select name="assigned_to_user_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Assign later</option>
              {fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? "Field officer"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Programme
            <select name="programme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Intervention
            <select name="intervention_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {interventions.map((intervention) => <option key={intervention.id} value={intervention.id}>{intervention.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Assessment
            <select name="assessment_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title ?? assessment.assessment_type ?? "Assessment"}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Scheduled date
            <input name="visit_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Status
            <select name="status" defaultValue="pending" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {FIELD_VISIT_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Location
            <input name="location_text" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Ikeja, Lagos" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
            Checklist
            <textarea name="checklist_blueprint" rows={4} defaultValue={DEFAULT_CHECKLIST} className="w-full rounded-md border px-3 py-2 font-mono text-xs font-normal" />
          </label>
          <div className="flex justify-end lg:col-span-3">
            <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Create task</Button>
          </div>
        </form>
      )}

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {visits.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No monitoring visits yet</h2>
            <p className="mt-2 text-sm text-slate-600">{canManage ? "Create the first monitoring task and assign it to a field officer." : "Assigned monitoring tasks will appear here."}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Visit</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Scheduled</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {visits.map((visit) => (
                  <tr key={visit.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/impact-intelligence/monitoring/${visit.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{visit.title ?? "Field visit"}</Link>
                      <p className="mt-1 text-xs text-slate-500">{visit.location_text ?? "Location pending"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{visit.msmes?.business_name ?? "Unlinked"}</td>
                    <td className="px-4 py-3 text-slate-600">{visit.impact_programmes?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(visit.visit_date)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(visit.status)}`}>{visit.status ?? "pending"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
