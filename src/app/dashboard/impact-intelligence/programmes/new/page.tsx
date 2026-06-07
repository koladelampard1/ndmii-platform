import { redirect, unstable_rethrow } from "next/navigation";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createImpactProgramme, IMPACT_WRITE_ROLES, PROGRAMME_STATUSES } from "@/lib/data/impact-intelligence";
import { EmptyState, SectionCard } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const EXPECTED_PROGRAMME_ERRORS = ["required", "valid", "already exists", "permission", "programme"];

async function createProgrammeAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let programmeId: string;
  try {
    programmeId = await createImpactProgramme(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/programmes/new", operation: "programme_create_failed", error });
    if (!(error instanceof Error) || !EXPECTED_PROGRAMME_ERRORS.some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirect(`/dashboard/impact-intelligence/programmes/new?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/impact-intelligence/programmes/${programmeId}`);
}

export default async function NewImpactProgrammePage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let loadError: string | null = null;
  try {
    ctx = await getCurrentUserContext();
    if (!IMPACT_WRITE_ROLES.includes(ctx.role)) redirect("/access-denied");
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Programme creation is temporarily unavailable.";
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/programmes/new", operation: "programme_create_page_load_failed", error });
  }

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Programme setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Create BOI Programme</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Register a programme record for intervention tracking, beneficiary linkage, and future impact reporting.
        </p>
      </header>

      {loadError ? (
        <SectionCard title="Programme Creation Unavailable">
          <EmptyState title="Programme creation could not load" description="The current session or programme source is temporarily unavailable. No programme data has been changed." icon={Flag} />
        </SectionCard>
      ) : (
      <>
      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
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
      </>
      )}
    </section>
  );
}
