import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleDashed, ShieldCheck, UserMinus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  COHORT_MANAGE_ROLES,
  COHORT_MEMBER_STATUSES,
  enrollImpactCohortMembers,
  getImpactCohortDetail,
  listMsmePickerOptions,
  listUserPickerOptions,
  updateImpactCohortMemberStatus,
} from "@/lib/data/impact-intelligence";
import { ImpactPageHeader, MetricTile, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../../_components";

type PageProps = {
  params: Promise<{ cohortId: string }>;
  searchParams?: Promise<{ state?: string; sector?: string; q?: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

async function enrollMembersAction(cohortId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await enrollImpactCohortMembers(ctx, cohortId, formData);
  revalidatePath(`/dashboard/impact-intelligence/cohorts/${cohortId}`);
  revalidatePath("/dashboard/impact-intelligence/cohorts");
}

async function updateMemberStatusAction(cohortId: string, memberId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await updateImpactCohortMemberStatus(ctx, memberId, formData);
  revalidatePath(`/dashboard/impact-intelligence/cohorts/${cohortId}`);
  revalidatePath("/dashboard/impact-intelligence/cohorts");
}

function DistributionList({ items }: { items: Array<{ label: string; value: number }> }) {
  if (items.length === 0) return <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No distribution data yet.</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="text-slate-500">{item.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ImpactCohortDetailPage({ params, searchParams }: PageProps) {
  const { cohortId } = await params;
  const filters = (await searchParams) ?? {};
  const ctx = await getCurrentUserContext();
  const [{ cohort, members, dashboard }, registryMsmes, fieldOfficers] = await Promise.all([
    getImpactCohortDetail(ctx, cohortId),
    listMsmePickerOptions({ limit: 150, state: filters.state, sector: filters.sector, search: filters.q }),
    listUserPickerOptions("field_officer"),
  ]);

  if (!cohort) notFound();
  const canManage = COHORT_MANAGE_ROLES.includes(ctx.role);
  const officerById = new Map(fieldOfficers.map((officer) => [officer.id, officer]));
  const memberIds = new Set(members.map((member) => member.msme_id));
  const availableMsmes = registryMsmes.filter((msme) => !memberIds.has(msme.id));
  const enrolAction = enrollMembersAction.bind(null, cohortId);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow={cohort.impact_programmes?.programme_code ?? "Beneficiary cohort"}
        title={cohort.name}
        description={cohort.description ?? "No cohort description has been recorded yet."}
        badge={cohort.status}
        actions={[{ href: "/dashboard/impact-intelligence/cohorts", label: "All cohorts", variant: "secondary" }]}
      >
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-4">
          <div><span className="font-medium text-slate-800">Programme:</span> {cohort.impact_programmes?.name ?? "Unlinked"}</div>
          <div><span className="font-medium text-slate-800">Location:</span> {[cohort.lga, cohort.state].filter(Boolean).join(", ") || "National"}</div>
          <div><span className="font-medium text-slate-800">Sector:</span> {cohort.sector ?? "All sectors"}</div>
          <div><span className="font-medium text-slate-800">Timeline:</span> {formatDate(cohort.start_date)} to {formatDate(cohort.end_date)}</div>
        </div>
      </ImpactPageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Total beneficiaries" value={dashboard.totalBeneficiaries.toLocaleString("en-NG")} detail={`Target ${cohort.target_beneficiaries.toLocaleString("en-NG")}`} icon={UsersRound} tone="emerald" />
        <MetricTile label="Active beneficiaries" value={dashboard.activeBeneficiaries.toLocaleString("en-NG")} icon={CircleDashed} tone="blue" />
        <MetricTile label="Completed beneficiaries" value={dashboard.completedBeneficiaries.toLocaleString("en-NG")} icon={CheckCircle2} tone="emerald" />
        <MetricTile label="Dropped beneficiaries" value={dashboard.droppedBeneficiaries.toLocaleString("en-NG")} icon={UserMinus} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="State Distribution">
          <DistributionList items={dashboard.stateDistribution} />
        </SectionCard>
        <SectionCard title="Sector Distribution">
          <DistributionList items={dashboard.sectorDistribution} />
        </SectionCard>
        <SectionCard title="Verification Coverage">
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span>
              <div>
                <p className="text-2xl font-semibold text-slate-950">{dashboard.verificationCoverage}%</p>
                <p className="text-sm text-slate-600">Beneficiaries with verified MSME posture.</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {canManage && (
        <SectionCard title="Enroll MSMEs">
          <form method="get" className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-4">
            <input name="state" defaultValue={filters.state ?? ""} className="rounded-md border px-3 py-2 text-sm" placeholder="Filter state" />
            <input name="sector" defaultValue={filters.sector ?? ""} className="rounded-md border px-3 py-2 text-sm" placeholder="Filter sector" />
            <input name="q" defaultValue={filters.q ?? ""} className="rounded-md border px-3 py-2 text-sm" placeholder="Business name or MSME ID" />
            <Button type="submit" variant="secondary">Apply registry filters</Button>
          </form>

          <form action={enrolAction} className="mt-4 grid gap-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Individual MSME
                <select name="selected_msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
                  <option value="">No individual selection</option>
                  {availableMsmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name} ({msme.msme_id ?? msme.state ?? "DBIN"})</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Member status
                <select name="member_status" defaultValue="enrolled" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
                  {COHORT_MEMBER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Assign field officer
                <select name="assigned_to_user_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
                  <option value="">Unassigned</option>
                  {fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              CSV upload
              <input name="csv_file" type="file" accept=".csv,text/csv,text/plain" className="w-full rounded-md border px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white" />
            </label>

            <div className="rounded-lg border">
              <div className="border-b bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Filtered registry selection</p>
                <p className="mt-1 text-xs text-slate-500">{availableMsmes.length} available MSMEs from the current filter. Select multiple rows to bulk enrol.</p>
              </div>
              <div className="max-h-80 overflow-auto p-2">
                {availableMsmes.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-slate-600">No available registry matches. Adjust filters or upload a CSV.</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {availableMsmes.map((msme) => (
                      <label key={msme.id} className="flex items-start gap-3 rounded-md border bg-white p-3 text-sm">
                        <input name="msme_ids" value={msme.id} type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" />
                        <span>
                          <span className="font-medium text-slate-900">{msme.business_name}</span>
                          <span className="mt-1 block text-xs text-slate-500">{msme.msme_id ?? "No MSME ID"} • {msme.state ?? "No state"} • {msme.sector ?? "No sector"}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end"><Button type="submit">Enroll selected MSMEs</Button></div>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Cohort Members" action={<QuickLink href={`/dashboard/impact-intelligence/programmes/${cohort.programme_id}`}>Programme detail</QuickLink>}>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No beneficiaries have been enrolled in this cohort yet.</p>
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">MSME</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Member status</th><th className="px-4 py-3">Assigned officer</th><th className="px-4 py-3">Enrolled</th></tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const updateAction = updateMemberStatusAction.bind(null, cohortId, member.id);
                  return (
                    <tr key={member.id} className={tableRowClassName}>
                      <td className={tableCellClassName}>
                        <span className="font-medium text-slate-950">{member.msmes?.business_name ?? "Unknown MSME"}</span>
                        <p className="mt-1 text-xs text-slate-500">{member.msmes?.msme_id ?? member.msme_id}</p>
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>{member.msmes?.state ?? "Not set"}</td>
                      <td className={`${tableCellClassName} text-slate-600`}>{member.msmes?.sector ?? "Not set"}</td>
                      <td className={tableCellClassName}><StatusBadge value={member.msmes?.verification_status ?? "pending"} /></td>
                      <td className={tableCellClassName}>
                        {canManage ? (
                          <form action={updateAction} className="flex min-w-[260px] gap-2">
                            <select name="member_status" defaultValue={member.member_status} className="h-9 rounded-md border px-2 text-sm">
                              {COHORT_MEMBER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                            </select>
                            <select name="assigned_to_user_id" defaultValue={member.assigned_to_user_id ?? ""} className="h-9 rounded-md border px-2 text-sm">
                              <option value="">Unassigned</option>
                              {fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}
                            </select>
                            <Button type="submit" size="sm">Save</Button>
                          </form>
                        ) : (
                          <StatusBadge value={member.member_status} />
                        )}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {member.assigned_to_user_id ? (officerById.get(member.assigned_to_user_id)?.full_name ?? officerById.get(member.assigned_to_user_id)?.email ?? member.assigned_to_user_id) : "Unassigned"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>{formatDate(member.enrolled_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>
    </section>
  );
}
