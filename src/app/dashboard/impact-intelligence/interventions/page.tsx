import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createImpactIntervention,
  getInterventionStage,
  IMPACT_WRITE_ROLES,
  INTERVENTION_STAGES,
  INTERVENTION_STATUSES,
  listImpactInterventions,
  listImpactProgrammes,
  listMsmePickerOptions,
} from "@/lib/data/impact-intelligence";

async function createInterventionAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const interventionId = await createImpactIntervention(ctx, formData);
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}`);
}

function formatCurrency(value: number | null) {
  if (!value) return "Not set";
  return `NGN ${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default async function ImpactInterventionsPage() {
  const ctx = await getCurrentUserContext();
  const [interventions, programmes, msmes] = await Promise.all([
    listImpactInterventions(ctx, { limit: 100 }),
    listImpactProgrammes(ctx, { limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
  ]);
  const canWrite = IMPACT_WRITE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">MSME intervention tracking</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Interventions</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Track MSME-level support, financing, advisory, and monitoring activities against BOI programmes.</p>
      </header>

      {canWrite && (
        <form action={createInterventionAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-3">
          <h2 className="font-semibold text-slate-950 lg:col-span-3">Create intervention</h2>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Title
            <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Working capital support" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Programme
            <select name="programme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Unassigned</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            MSME beneficiary
            <select required name="msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">Select MSME</option>
              {msmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name} ({msme.msme_id ?? msme.state ?? "DBIN"})</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Type
            <input name="intervention_type" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="finance, advisory, equipment" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Status
            <select name="status" defaultValue="planned" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {INTERVENTION_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Stage
            <select name="stage" defaultValue="intake" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {INTERVENTION_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Approved amount
            <input name="approved_amount" type="number" min="0" step="1000" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Disbursed amount
            <input name="disbursed_amount" type="number" min="0" step="1000" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Start date
            <input name="start_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
            Description
            <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
          </label>
          <div className="flex justify-end lg:col-span-3"><Button type="submit">Create intervention</Button></div>
        </form>
      )}

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {interventions.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No interventions yet</h2>
            <p className="mt-2 text-sm text-slate-600">Programme officers can create the first MSME intervention once a beneficiary is available.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Intervention</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th></tr></thead>
              <tbody className="divide-y">
                {interventions.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3"><Link href={`/dashboard/impact-intelligence/interventions/${item.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{item.title}</Link><p className="mt-1 text-xs text-slate-500">{item.intervention_type} • {getInterventionStage(item)}</p></td>
                    <td className="px-4 py-3 text-slate-600">{item.impact_programmes?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.msmes?.business_name ?? "Unlinked"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{item.status ?? "planned"}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(item.approved_amount)}</td>
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
