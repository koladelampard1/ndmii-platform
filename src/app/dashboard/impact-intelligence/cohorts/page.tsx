import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { COHORT_MANAGE_ROLES, listImpactCohorts } from "@/lib/data/impact-intelligence";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { EmptyState, ImpactPageHeader, MetricTile, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ImpactCohortsPage() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let cohorts: Awaited<ReturnType<typeof listImpactCohorts>> = [];
  let loadError: string | null = null;
  try {
    ctx = await getCurrentUserContext();
    cohorts = await listImpactCohorts(ctx, { limit: 100 });
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Cohort records are temporarily unavailable.";
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/cohorts", operation: "cohort_list_load_failed", error });
  }
  const canManage = Boolean(ctx && !loadError && COHORT_MANAGE_ROLES.includes(ctx.role));
  const scopeEmptyMessage = ctx ? getProgrammeScopeEmptyMessage(ctx) : null;
  const totals = cohorts.reduce(
    (acc, cohort) => {
      acc.beneficiaries += cohort.member_count ?? cohort.current_beneficiaries ?? 0;
      if (cohort.status === "active") acc.active += 1;
      if (cohort.status === "recruiting") acc.recruiting += 1;
      return acc;
    },
    { beneficiaries: 0, active: 0, recruiting: 0 },
  );

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Beneficiary cohort management"
        title="Cohorts"
        description="Manage the primary enrolment layer between programmes and MSMEs before interventions, assessments, monitoring, evidence, indicators, and reports."
        badge={`${cohorts.length} cohorts`}
        actions={canManage ? [{ href: "/dashboard/impact-intelligence/cohorts/new", label: "New cohort", icon: Plus, variant: "primary" }] : []}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Total cohort beneficiaries" value={totals.beneficiaries.toLocaleString("en-NG")} icon={UsersRound} tone="emerald" />
        <MetricTile label="Active cohorts" value={totals.active} detail="Cohorts currently delivering beneficiary activity." />
        <MetricTile label="Recruiting cohorts" value={totals.recruiting} detail="Cohorts still accepting MSME enrolment." />
      </div>

      <SectionCard title="Cohort Registry" action={!loadError ? <QuickLink href="/dashboard/impact-intelligence/programmes">Programmes</QuickLink> : undefined}>
        {loadError ? (
          <EmptyState title="Cohort records could not load" description="The cohort source, current session, or role assignment is temporarily unavailable." icon={UsersRound} />
        ) : cohorts.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? (ctx?.role === "field_officer" ? "No assigned beneficiaries" : "No cohorts yet")}
            description={scopeEmptyMessage ?? (ctx?.role === "field_officer" ? "Assigned cohort beneficiaries will appear here after a programme officer assigns MSMEs to you." : "Create a cohort to enrol MSMEs against a programme before opening intervention and monitoring workflows.")}
            actionHref={canManage ? "/dashboard/impact-intelligence/cohorts/new" : undefined}
            actionLabel={canManage ? "Create cohort" : undefined}
            icon={UsersRound}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr>
                  <th className="px-4 py-3">Cohort</th>
                  <th className="px-4 py-3">Programme</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Beneficiaries</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timeline</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/cohorts/${cohort.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{cohort.name}</Link>
                      <p className="mt-1 text-xs text-slate-500">{cohort.description ?? "No description recorded"}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{cohort.impact_programmes?.name ?? "Unlinked"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{[cohort.lga, cohort.state].filter(Boolean).join(", ") || "National"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{cohort.sector ?? "All sectors"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      <span className="font-medium text-slate-800">{cohort.member_count ?? cohort.current_beneficiaries}</span>
                      <p className="mt-1 text-xs text-slate-500">Target {cohort.target_beneficiaries.toLocaleString("en-NG")}</p>
                    </td>
                    <td className={tableCellClassName}><StatusBadge value={cohort.status} /></td>
                    <td className={`${tableCellClassName} text-slate-600`}>{formatDate(cohort.start_date)} to {formatDate(cohort.end_date)}</td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/cohorts/${cohort.id}`}>Open</QuickLink></td>
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
