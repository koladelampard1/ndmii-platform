import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminAssociationMembersWorkspace } from "@/lib/data/admin-associations";
import { getCurrentUserContext } from "@/lib/auth/session";

function metricValue(value: number | null | undefined) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminAssociationMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const workspace = await getAdminAssociationMembersWorkspace(params.association ?? null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Association Member Data Snapshot</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Phase 1 read-only view. This page shows currently available member linkage and pending request data;
            approvals, transfers, activation management, and member remediation are not operational here yet.
          </p>
        </div>
        <Link href="/dashboard/admin/associations" className="rounded border px-3 py-2 text-sm">Back to associations</Link>
      </div>

      {!params.association && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Select an association from the admin association directory to view a scoped snapshot.
        </p>
      )}

      {params.association && !workspace.association && (
        <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Association not found or association source unavailable.
        </p>
      )}

      {workspace.association && (
        <article className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{workspace.association.name}</h2>
              <p className="text-sm text-slate-600">
                {workspace.association.sector ?? "Sector unavailable"} • {workspace.association.state ?? "State unavailable"} • {workspace.association.status ?? "Status unavailable"}
              </p>
              <p className="text-xs text-slate-500">
                Officer: {workspace.association.officerName ?? "Officer not assigned"} • Created: {formatDate(workspace.association.createdAt)}
              </p>
            </div>
            <Link href={`/dashboard/admin/association-upload`} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
              Record/import-validate upload
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <article className="rounded border p-3"><p className="text-xs uppercase text-slate-500">Operational members</p><p className="text-xl font-semibold">{metricValue(workspace.association.linkedMembersCount)}</p></article>
            <article className="rounded border p-3"><p className="text-xs uppercase text-slate-500">Pending requests</p><p className="text-xl font-semibold">{metricValue(workspace.association.pendingMembershipCount)}</p></article>
            <article className="rounded border p-3"><p className="text-xs uppercase text-slate-500">Linked MSMEs</p><p className="text-xl font-semibold">{metricValue(workspace.association.msmesLinkedCount)}</p></article>
            <article className="rounded border p-3"><p className="text-xs uppercase text-slate-500">Import jobs</p><p className="text-xl font-semibold">{metricValue(workspace.association.importJobsCount)}</p></article>
          </div>
        </article>
      )}

      <details className="rounded-xl border bg-white p-4 text-sm text-slate-700" open>
        <summary className="cursor-pointer font-semibold">What this page can and cannot do</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {workspace.canonicalStrategy.map((item) => <li key={item}>{item}</li>)}
          <li>Member approvals, duplicate resolution, association transfer handling, and activation operations are pending future phases.</li>
        </ul>
      </details>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Operational member preview</h2>
        <p className="text-xs text-slate-600">Source: association_members. Limited to 25 rows. Contact values are masked.</p>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">MSME ID</th>
                <th className="px-3 py-2">Member status</th>
                <th className="px-3 py-2">Invite status</th>
                <th className="px-3 py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {workspace.memberPreview.map((member) => (
                <tr key={member.id} className="border-t">
                  <td className="px-3 py-2">{member.businessName ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{member.msmeId ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{member.status ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{member.inviteStatus ?? "Unavailable"}</td>
                  <td className="px-3 py-2">
                    <p>{member.email ?? "Email unavailable"}</p>
                    <p className="text-xs text-slate-500">{member.phone ?? "Phone unavailable"}</p>
                  </td>
                </tr>
              ))}
              {workspace.memberPreview.length === 0 && (
                <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No operational member records available for this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Pending membership request preview</h2>
        <p className="text-xs text-slate-600">Source: association_memberships. This is an onboarding/join-request source, not the operational member table.</p>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">MSME ID</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {workspace.pendingMembershipPreview.map((membership) => (
                <tr key={membership.id} className="border-t">
                  <td className="px-3 py-2">{membership.businessName ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{membership.msmeId ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{membership.membershipType ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{membership.approvalStatus ?? "Unavailable"}</td>
                  <td className="px-3 py-2">{formatDate(membership.createdAt)}</td>
                </tr>
              ))}
              {workspace.pendingMembershipPreview.length === 0 && (
                <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No pending membership request records available for this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Import history for selection</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-3 py-2">Valid</th>
                <th className="px-3 py-2">Failed</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {workspace.imports.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.fileName ?? item.id}</td>
                  <td className="px-3 py-2">{metricValue(item.totalRows)}</td>
                  <td className="px-3 py-2">{metricValue(item.successRows)}</td>
                  <td className="px-3 py-2">{metricValue(item.failedRows)}</td>
                  <td className="px-3 py-2">{item.status ?? "Unavailable"}</td>
                </tr>
              ))}
              {workspace.imports.length === 0 && (
                <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No import records available for this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <details className="rounded-xl border bg-white p-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Source availability</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(workspace.sources).map(([source, state]) => (
            <p key={source}>
              <span className={state.available ? "text-emerald-700" : "text-rose-700"}>{state.available ? "Available" : "Unavailable"}</span>
              {" "}{source}{state.message ? `: ${state.message}` : ""}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
