import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/session";
import { submitBulkAssociationMemberAction } from "@/app/dashboard/admin/association-members/[id]/actions";
import { ASSOCIATION_MEMBER_ACTIVATION_STATES, ASSOCIATION_MEMBER_STATUSES, getAdminAssociationMembersWorkspace, type AdminAssociationMemberFilters } from "@/lib/data/admin-association-members";

export const dynamic = "force-dynamic";
type SearchParams = AdminAssociationMemberFilters & { success?: string; error?: string };
const metrics = [
  ["Imported Members", "imported"], ["Pending Review", "pendingReview"], ["Approved", "approved"], ["Duplicate Review", "duplicateReview"],
  ["Correction Requested", "correctionRequested"], ["Ready For Activation", "pendingActivation"], ["Assigned To Me", "assignedToMe"], ["Unassigned", "unassigned"],
] as const;
function metric(value: number | null) { return value == null ? "Unavailable" : value.toLocaleString(); }
function humanize(value: string | null) { return String(value ?? "Unavailable").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function when(value: string | null) { return value ? new Date(value).toLocaleString("en-NG") : "Unavailable"; }
function badge(value: string | null) {
  if (["approved", "active", "Ready"].includes(value ?? "")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["rejected", "Blocked"].includes(value ?? "")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}
function exportHref(params: SearchParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value && !["page", "pageSize", "success", "error"].includes(key)) query.set(key, String(value)); });
  return `/api/admin/associations/members/export?${query.toString()}`;
}

export default async function AdminAssociationMembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  const workspace = await getAdminAssociationMembersWorkspace(params, ctx.appUserId);
  const canReview = ["admin", "reviewer"].includes(ctx.role);
  const queueSource = workspace.sources.association_members;
  const importSource = workspace.sources.association_member_imports;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Association operations</p><h1 className="text-2xl font-black">Membership Review Command Center</h1><p className="mt-1 text-sm text-slate-600">Imported members enter a controlled human review queue. No MSME, credential, or activation is created here.</p></div>
      <div className="flex gap-2">{ctx.role === "admin" && <Link href={exportHref(params)} className="rounded-lg border px-3 py-2 text-sm font-bold">Export CSV</Link>}{ctx.role === "admin" && <Link href="/dashboard/admin/association-upload" className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white">Upload members</Link>}</div>
    </div>
    {(params.success || params.error) && <p className={`rounded-lg border p-3 text-sm font-bold ${params.error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{params.error ?? params.success}</p>}
    {!queueSource.available && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">Member queue source unavailable. {queueSource.message ?? "Unable to load association members."}</p>}
    {!importSource.available && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">Import source unavailable. Member rows are still available.</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, key]) => <article key={key} className="rounded-xl border bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{metric(workspace.counts[key])}</p></article>)}</div>
    <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4 lg:grid-cols-6">
      <input name="q" defaultValue={workspace.filters.q} placeholder="Name, phone, email, business, membership no." className="rounded border px-2 py-2 text-sm lg:col-span-2" />
      <select name="association" defaultValue={workspace.filters.association} className="rounded border px-2 py-2 text-sm"><option value="">All associations</option>{workspace.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select name="status" defaultValue={workspace.filters.status} className="rounded border px-2 py-2 text-sm"><option value="">All statuses</option>{ASSOCIATION_MEMBER_STATUSES.map((v) => <option key={v}>{v}</option>)}</select>
      <select name="activation" defaultValue={workspace.filters.activation} className="rounded border px-2 py-2 text-sm"><option value="">All activation states</option>{ASSOCIATION_MEMBER_ACTIVATION_STATES.map((v) => <option key={v}>{v}</option>)}</select>
      <select name="invite" defaultValue={workspace.filters.invite} className="rounded border px-2 py-2 text-sm"><option value="">All invites</option><option value="none">No invite generated</option><option value="generated">Generated</option><option value="sent">Sent</option><option value="opened">Opened</option><option value="expired">Expired invite</option></select>
      <select name="duplicate" defaultValue={workspace.filters.duplicate} className="rounded border px-2 py-2 text-sm"><option value="">All duplicate signals</option><option value="yes">Duplicate signal</option><option value="no">No duplicate signal</option></select>
      <select name="lga" defaultValue={workspace.filters.lga} className="rounded border px-2 py-2 text-sm"><option value="">All LGAs</option>{workspace.lgas.map((v) => <option key={v}>{v}</option>)}</select>
      <select name="tradeType" defaultValue={workspace.filters.tradeType} className="rounded border px-2 py-2 text-sm"><option value="">All trades</option>{workspace.tradeTypes.map((v) => <option key={v}>{v}</option>)}</select>
      <select name="reviewer" defaultValue={workspace.filters.reviewer} className="rounded border px-2 py-2 text-sm"><option value="">All reviewers</option><option value="unassigned">Unassigned</option>{workspace.reviewers.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
      <input type="date" name="importedFrom" defaultValue={workspace.filters.importedFrom} className="rounded border px-2 py-2 text-sm" title="Imported from" />
      <input type="date" name="importedTo" defaultValue={workspace.filters.importedTo} className="rounded border px-2 py-2 text-sm" title="Imported to" />
      <button className="rounded bg-slate-950 px-3 py-2 text-sm font-bold text-white">Apply filters</button>
    </form>
    <form action={submitBulkAssociationMemberAction} className="space-y-3">
      {canReview && <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm"><strong>Bulk actions</strong><input name="reason" placeholder="Reason required for reject or reassignment" className="min-w-64 flex-1 rounded border px-2 py-2" /><select name="assigned_reviewer_id" className="rounded border px-2 py-2"><option value="">Reviewer</option>{workspace.reviewers.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select><button name="action" value="approve" className="rounded border px-3 py-2 font-bold">Approve</button><button name="action" value="reject" className="rounded border px-3 py-2 font-bold">Reject</button>{ctx.role === "admin" && <button name="action" value="assign_reviewer" className="rounded border px-3 py-2 font-bold">Assign reviewer</button>}{ctx.role === "admin" && <button name="action" value="generate_invite" className="rounded border px-3 py-2 font-bold">Generate invites</button>}{ctx.role === "admin" && <button name="action" value="mark_invite_sent" className="rounded border px-3 py-2 font-bold">Mark sent</button>}{ctx.role === "admin" && <button name="action" value="export_invite_links" className="rounded border px-3 py-2 font-bold">Export one-time links</button>}{ctx.role === "admin" && <button name="action" value="export" className="rounded border px-3 py-2 font-bold">Export selected</button>}</div>}
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600"><tr><th className="px-3 py-2"></th><th className="px-3 py-2">Member</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">Association</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Activation</th><th className="px-3 py-2">Invite</th><th className="px-3 py-2">Onboarding</th><th className="px-3 py-2">Reviewer</th><th className="px-3 py-2"></th></tr></thead><tbody>
        {workspace.rows.map((row) => <tr key={row.id} className="border-t align-top"><td className="px-3 py-3">{canReview && <input type="checkbox" name="member_id" value={row.id} />}</td><td className="px-3 py-3"><p className="font-bold">{row.fullName ?? "Unavailable"}</p><p className="text-xs text-slate-500">{row.phone ?? "No phone"} · {row.email ?? "No email"}</p></td><td className="px-3 py-3"><p>{row.businessName ?? "Unavailable"}</p><p className="text-xs text-slate-500">{row.tradeType ?? "Trade unavailable"} · {row.lga ?? "LGA unavailable"}</p></td><td className="px-3 py-3">{row.associationName ?? "Unavailable"}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${badge(row.status)}`}>{humanize(row.status)}</span></td><td className="px-3 py-3">{humanize(row.activationState)}</td><td className="px-3 py-3"><p>{humanize(row.inviteStatus)}</p><p className="text-xs text-slate-500">{row.inviteExpiry ? `Expires ${when(row.inviteExpiry)}` : "No invite"}</p></td><td className="px-3 py-3">{humanize(row.activationState)}</td><td className="px-3 py-3">{row.assignedReviewerName ?? "Unassigned"}</td><td className="px-3 py-3"><Link href={`/dashboard/admin/association-members/${row.id}`} className="font-black text-emerald-800">Review</Link></td></tr>)}
        {!workspace.rows.length && queueSource.available && <tr><td colSpan={10} className="px-3 py-10 text-center text-slate-500">No members match the current queue filters.</td></tr>}
        {!workspace.rows.length && !queueSource.available && <tr><td colSpan={10} className="px-3 py-10 text-center text-rose-700">Member queue is unavailable.</td></tr>}
      </tbody></table></div>
    </form>
  </section>;
}
