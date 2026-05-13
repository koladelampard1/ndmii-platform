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
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";

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

export default async function MonitoringPage() {
  const ctx = await getCurrentUserContext();
  const [visits, programmes, interventions, assessments, msmes, fieldOfficers] = await Promise.all([
    listFieldVisits(ctx, { limit: 100 }),
    listImpactProgrammes(ctx, { limit: 100 }),
    listImpactInterventions(ctx, { limit: 100 }),
    listImpactAssessments(ctx, { limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
    listUserPickerOptions("field_officer"),
  ]);
  const canManage = MONITORING_MANAGE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="BOI field monitoring"
        title="Monitoring"
        description="Assign field visits, track monitoring lifecycle, capture notes, and connect field evidence to BOI intervention records."
        badge={`${visits.length} visits`}
        actions={[{ href: "/dashboard/impact-intelligence/evidence", label: "Evidence repository", icon: CalendarCheck }]}
      />

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

      <SectionCard title="Field Monitoring Queue" action={<QuickLink href="/dashboard/impact-intelligence/evidence">Evidence</QuickLink>}>
        {visits.length === 0 ? (
          <EmptyState
            title="No monitoring visits yet"
            description={canManage ? "Create the first monitoring task and assign it to a field officer so findings and evidence can be linked back to interventions." : "Assigned monitoring tasks will appear here."}
            icon={CalendarCheck}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">Visit</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Scheduled</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/monitoring/${visit.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{visit.title ?? "Field visit"}</Link>
                      <p className="mt-1 text-xs text-slate-500">{visit.location_text ?? "Location pending"}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{visit.msmes?.business_name ?? "Unlinked"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{visit.impact_programmes?.name ?? "Unassigned"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{formatDate(visit.visit_date)}</td>
                    <td className={tableCellClassName}><StatusBadge value={visit.status ?? "pending"} /></td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/monitoring/${visit.id}`}>Open</QuickLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>
    </section>
  );
}
