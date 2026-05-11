import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { IMPACT_WRITE_ROLES, listImpactProgrammes } from "@/lib/data/impact-intelligence";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ImpactProgrammesPage() {
  const [ctx, programmes] = await Promise.all([getCurrentUserContext(), listImpactProgrammes({ limit: 100 })]);
  const canWrite = IMPACT_WRITE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">BOI programme management</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Programmes</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage programme records that anchor MSME interventions, beneficiary cohorts, and impact reporting.</p>
          </div>
          {canWrite && (
            <Link href="/dashboard/impact-intelligence/programmes/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
              <Plus className="h-4 w-4" /> New programme
            </Link>
          )}
        </div>
      </header>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {programmes.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No programmes yet</h2>
            <p className="mt-2 text-sm text-slate-600">Create the first BOI programme to start linking interventions and beneficiary MSMEs.</p>
            {canWrite && <Link href="/dashboard/impact-intelligence/programmes/new" className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create programme</Link>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Sponsor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Timeline</th></tr>
              </thead>
              <tbody className="divide-y">
                {programmes.map((programme) => (
                  <tr key={programme.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/impact-intelligence/programmes/${programme.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{programme.name}</Link>
                      <p className="mt-1 text-xs text-slate-500">{programme.programme_code ?? "No programme code"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{programme.sponsor_name ?? "Pending"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{programme.status ?? "draft"}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(programme.start_date)} to {formatDate(programme.end_date)}</td>
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
