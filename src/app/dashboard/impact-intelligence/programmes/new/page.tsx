import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createImpactProgramme, IMPACT_WRITE_ROLES, PROGRAMME_STATUSES } from "@/lib/data/impact-intelligence";

async function createProgrammeAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const programmeId = await createImpactProgramme(ctx, formData);
  redirect(`/dashboard/impact-intelligence/programmes/${programmeId}`);
}

export default async function NewImpactProgrammePage() {
  const ctx = await getCurrentUserContext();
  if (!IMPACT_WRITE_ROLES.includes(ctx.role)) redirect("/access-denied");

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Programme setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Create BOI Programme</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Register a programme record for intervention tracking, beneficiary linkage, and future impact reporting.
        </p>
      </header>

      <form action={createProgrammeAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Programme name
          <input required name="name" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="BOI Women Enterprise Support Facility" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Programme code
          <input name="programme_code" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="BOI-WESF-2026" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Sponsor
          <input name="sponsor_name" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Bank of Industry" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Status
          <select name="status" defaultValue="draft" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
            {PROGRAMME_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Start date
          <input name="start_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          End date
          <input name="end_date" type="date" className="w-full rounded-md border px-3 py-2 text-sm font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Description
          <textarea name="description" rows={5} className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Programme objective, target segment, governance notes, and reporting expectations." />
        </label>
        <div className="flex justify-end lg:col-span-2">
          <Button type="submit">Create programme</Button>
        </div>
      </form>
    </section>
  );
}
