import Link from "next/link";
import { Flag, Plus } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { IMPACT_WRITE_ROLES, listImpactProgrammes } from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ImpactProgrammesPage() {
  const ctx = await getCurrentUserContext();
  const programmes = await listImpactProgrammes(ctx, { limit: 100 });
  const canWrite = IMPACT_WRITE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="BOI programme management"
        title="Programmes"
        description="Manage programme records that anchor MSME interventions, beneficiary cohorts, assessments, monitoring evidence, and executive reporting."
        badge={`${programmes.length} records`}
        actions={canWrite ? [{ href: "/dashboard/impact-intelligence/programmes/new", label: "New programme", icon: Plus, variant: "primary" }] : []}
      />

      <SectionCard title="Programme Registry" action={<QuickLink href="/dashboard/impact-intelligence/executive">Executive view</QuickLink>}>
        {programmes.length === 0 ? (
          <EmptyState
            title="No programmes yet"
            description="Create the first BOI programme to start linking MSME interventions, assessment cycles, field monitoring, and evidence-backed reports."
            actionHref={canWrite ? "/dashboard/impact-intelligence/programmes/new" : undefined}
            actionLabel={canWrite ? "Create programme" : undefined}
            icon={Flag}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Sponsor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Timeline</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {programmes.map((programme) => (
                  <tr key={programme.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/programmes/${programme.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{programme.name}</Link>
                      <p className="mt-1 text-xs text-slate-500">{programme.programme_code ?? "No programme code"}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{programme.sponsor_name ?? "Pending"}</td>
                    <td className={tableCellClassName}><StatusBadge value={programme.status ?? "draft"} /></td>
                    <td className={`${tableCellClassName} text-slate-600`}>{formatDate(programme.start_date)} to {formatDate(programme.end_date)}</td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/programmes/${programme.id}`}>Open</QuickLink></td>
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
