import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ASSOCIATION_MEMBER_STATUSES,
  getAdminAssociationMembersWorkspace,
  type AdminAssociationMemberFilters,
} from "@/lib/data/admin-association-members";
import { getCurrentUserContext } from "@/lib/auth/session";

type SearchParams = AdminAssociationMemberFilters;

export const dynamic = "force-dynamic";

function metricValue(value: number | null | undefined) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function buildHref(params: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    query.set(key, String(value));
  }
  query.set("page", String(page));
  return `/dashboard/admin/association-members?${query.toString()}`;
}

function exportHref(params: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || key === "page" || key === "pageSize") continue;
    query.set(key, String(value));
  }
  return `/api/admin/associations/members/export?${query.toString()}`;
}

export default async function AdminAssociationMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const workspace = await getAdminAssociationMembersWorkspace(params);
  const hasPrevious = workspace.pagination.page > 1;
  const hasNext =
    workspace.pagination.totalPages == null || workspace.pagination.page < workspace.pagination.totalPages;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Association Member Operations</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Operational member records created from association uploads. Members still require activation/onboarding;
            duplicate signals are review cues only and credentials are never issued automatically here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={exportHref(params)} className="rounded border px-3 py-2 text-sm">Export CSV</Link>
          <Link href="/dashboard/admin/association-upload" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            Upload members
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Operational records</p>
          <p className="text-2xl font-semibold">{metricValue(workspace.counts.total)}</p>
        </article>
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Pending activation</p>
          <p className="text-2xl font-semibold">{metricValue(workspace.counts.pendingActivation)}</p>
        </article>
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Duplicate signals</p>
          <p className="text-2xl font-semibold">{metricValue(workspace.counts.duplicateReview)}</p>
        </article>
        <article className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Active</p>
          <p className="text-2xl font-semibold">{metricValue(workspace.counts.active)}</p>
        </article>
      </div>

      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <select name="association" defaultValue={workspace.filters.association} className="rounded border px-2 py-2 text-sm">
          <option value="">All associations</option>
          {workspace.associations.map((association) => (
            <option key={association.id} value={association.id}>
              {association.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={workspace.filters.status} className="rounded border px-2 py-2 text-sm">
          <option value="">All statuses</option>
          {ASSOCIATION_MEMBER_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select name="duplicate" defaultValue={workspace.filters.duplicate} className="rounded border px-2 py-2 text-sm">
          <option value="">Duplicate signal: all</option>
          <option value="yes">Duplicates only</option>
          <option value="no">No duplicate signal</option>
        </select>
        <input
          name="q"
          defaultValue={workspace.filters.q}
          placeholder="Search member, business, phone, email, LGA"
          className="rounded border px-2 py-2 text-sm md:col-span-2"
        />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      </form>

      <article className="rounded-xl border bg-amber-50 p-3 text-sm text-amber-900">
        Uploads record members for onboarding workflow only. Human review is required for duplicate signals, activation,
        rejection, and any future credential issuance.
      </article>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Association</th>
              <th className="px-3 py-2">Import source</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Activation</th>
              <th className="px-3 py-2">Linked MSME</th>
            </tr>
          </thead>
          <tbody>
            {workspace.rows.map((member) => (
              <tr key={member.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <p className="font-medium">{member.fullName ?? "Unavailable"}</p>
                  <p className="text-xs text-slate-500">LGA: {member.lga ?? "Unavailable"}</p>
                </td>
                <td className="px-3 py-3">
                  <p>{member.businessName ?? "Unavailable"}</p>
                  <p className="text-xs text-slate-500">{member.tradeType ?? "Trade unavailable"}</p>
                </td>
                <td className="px-3 py-3">
                  <p>{member.phone ?? "Phone unavailable"}</p>
                  <p className="text-xs text-slate-500">{member.email ?? "Email unavailable"}</p>
                </td>
                <td className="px-3 py-3">{member.associationName ?? "Unavailable"}</td>
                <td className="px-3 py-3">{member.importSource ?? "Manual/legacy"}</td>
                <td className="px-3 py-3">
                  <p>{member.status ?? "Unavailable"}</p>
                  {member.duplicateSignal && (
                    <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      Duplicate: {member.duplicateReasons.join(", ") || "signal"}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3">
                  <p>{member.activationState ?? "Unavailable"}</p>
                  <p className="text-xs text-slate-500">Invite flow pending</p>
                </td>
                <td className="px-3 py-3">{member.linkedMsme ?? "Not linked"}</td>
              </tr>
            ))}
            {workspace.rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                  No operational member records found for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          Page {workspace.pagination.page} of {workspace.pagination.totalPages ?? "Unavailable"} •{" "}
          {workspace.pagination.total == null ? "Unavailable total" : `${workspace.pagination.total.toLocaleString()} total`}
        </p>
        <div className="flex gap-2">
          <Link
            aria-disabled={!hasPrevious}
            className={`rounded border px-3 py-1 ${hasPrevious ? "" : "pointer-events-none opacity-50"}`}
            href={buildHref(params, Math.max(1, workspace.filters.page - 1))}
          >
            Previous
          </Link>
          <Link
            aria-disabled={!hasNext}
            className={`rounded border px-3 py-1 ${hasNext ? "" : "pointer-events-none opacity-50"}`}
            href={buildHref(params, workspace.filters.page + 1)}
          >
            Next
          </Link>
        </div>
      </div>

      <details className="rounded-xl border bg-white p-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Source availability</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(workspace.sources).map(([source, state]) => (
            <p key={source}>
              <span className={state.available ? "text-emerald-700" : "text-rose-700"}>
                {state.available ? "Available" : "Unavailable"}
              </span>{" "}
              {source}
              {state.message ? `: ${state.message}` : ""}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
