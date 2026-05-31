import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getAdminAssociationMemberDetail } from "@/lib/data/admin-association-members";
import { submitAssociationMemberAction } from "./actions";
import { CopyInviteLink } from "./copy-invite-link";

export const dynamic = "force-dynamic";
function humanize(value: string | null) { return String(value ?? "Unavailable").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function when(value: string | null) { return value ? new Date(value).toLocaleString("en-NG") : "Unavailable"; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border bg-white p-4"><h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2><div className="mt-3 space-y-2 text-sm">{children}</div></section>; }
function Row({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex justify-between gap-4 border-b border-slate-100 pb-2"><span className="text-slate-500">{label}</span><span className="text-right font-bold text-slate-800">{value}</span></div>; }

export default async function AssociationMemberDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string; invite_link?: string }> }) {
  const [{ id }, query, ctx] = await Promise.all([params, searchParams, getCurrentUserContext()]);
  const workspace = await getAdminAssociationMemberDetail(id);
  if (!workspace) notFound();
  const { member } = workspace;
  const canReview = ["admin", "reviewer"].includes(ctx.role);
  const admin = ctx.role === "admin";
  const action = (value: string, label: string, reason = false) => <form action={submitAssociationMemberAction} className="rounded-lg border bg-slate-50 p-3"><input type="hidden" name="member_id" value={member.id} /><input type="hidden" name="action" value={value} />{reason && <textarea required name="reason" placeholder="Required reason" className="mb-2 w-full rounded border px-2 py-2 text-sm" rows={2} />}<button className="w-full rounded bg-slate-950 px-3 py-2 text-sm font-black text-white">{label}</button></form>;
  return <section className="space-y-4">
    <Link href="/dashboard/admin/association-members" className="text-sm font-black text-emerald-800">← Back to member queue</Link>
    {(query.success || query.error) && <p className={`rounded-lg border p-3 text-sm font-bold ${query.error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{query.error ?? query.success}</p>}
    {query.invite_link && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-black">One-time invitation link</p><p className="mt-1 break-all font-mono text-xs">{query.invite_link}</p><p className="mt-1 text-xs">Copy this link now. Only its hash is stored, so it cannot be recovered later.</p><CopyInviteLink inviteLink={query.invite_link} /></div>}
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Member review workspace</p><h1 className="text-2xl font-black">{member.fullName ?? "Unnamed imported member"}</h1><p className="mt-1 text-sm text-slate-600">Controlled membership review only. Raw NIN and BVN are never displayed.</p></div>
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Profile summary"><Row label="Business" value={member.businessName ?? "Unavailable"} /><Row label="Trade type" value={member.tradeType ?? "Unavailable"} /><Row label="Phone" value={member.phone ?? "Unavailable"} /><Row label="Email" value={member.email ?? "Unavailable"} /><Row label="WhatsApp" value={member.whatsapp ?? "Unavailable"} /><Row label="Workshop" value={member.workshopAddress ?? "Unavailable"} /></Card>
        <Card title="Association details"><Row label="Association" value={member.associationName ?? "Unavailable"} /><Row label="Membership no." value={member.membershipNumber ?? "Unavailable"} /><Row label="Position" value={member.position ?? "Unavailable"} /><Row label="LGA" value={member.lga ?? "Unavailable"} /><Row label="Reviewer" value={member.assignedReviewerName ?? "Unassigned"} /></Card>
        <Card title="Import source"><Row label="Source" value={member.importSource ?? "Manual / legacy"} /><Row label="Imported" value={when(member.createdAt)} /><Row label="CAC" value={member.cac ?? "Unavailable"} /><Row label="TIN" value={member.tin ?? "Unavailable"} /></Card>
        <Card title="Validation results">{workspace.validationResults.map((item) => <p key={item} className="rounded bg-slate-50 px-3 py-2 font-bold">{item}</p>)}</Card>
        <Card title="Duplicate signals"><Row label="Flagged" value={member.duplicateSignal ? "Yes" : "No"} /><Row label="Signals" value={member.duplicateReasons.join(", ") || "No duplicate signals"} /></Card>
        <Card title="Activation readiness"><Row label="Readiness" value={member.readiness.label} />{[...member.readiness.blockers, ...member.readiness.attention].map((item) => <p key={item} className="rounded bg-amber-50 px-3 py-2 font-bold text-amber-800">{item}</p>)}</Card>
        <Card title="Invitation status"><Row label="Status" value={humanize(workspace.invitation?.status ?? null)} /><Row label="Last invite" value={when(workspace.invitation?.lastInvite ?? null)} /><Row label="Expiry" value={when(workspace.invitation?.expiry ?? null)} /><Row label="Channel" value={humanize(workspace.invitation?.sentChannel ?? null)} /><Row label="Masked destination" value={workspace.invitation?.sentToMasked ?? "Unavailable"} /></Card>
        <Card title="Internal notes"><p className="whitespace-pre-wrap">{member.internalNotes ?? "No internal notes recorded."}</p>{canReview && <form action={submitAssociationMemberAction}><input type="hidden" name="member_id" value={member.id} /><input type="hidden" name="action" value="save_notes" /><textarea name="notes" defaultValue={member.internalNotes ?? ""} rows={4} className="w-full rounded border px-2 py-2" /><button className="mt-2 rounded border px-3 py-2 font-bold">Save notes</button></form>}</Card>
        <Card title="Review history">{workspace.events.length ? workspace.events.map((event) => <div key={event.id} className="border-b pb-2"><p className="font-black">{humanize(event.eventType)}</p><p className="text-xs text-slate-500">{humanize(event.actorRole)} · {when(event.createdAt)}</p>{event.reason && <p className="mt-1">{event.reason}</p>}</div>) : <p>No review history is available.</p>}</Card>
      </div>
      <aside className="space-y-3 rounded-xl border bg-white p-4 xl:sticky xl:top-24 xl:self-start">
        <div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Decision panel</p><h2 className="mt-1 text-lg font-black">{humanize(member.status)}</h2><p className="text-xs text-slate-500">Activation state: {humanize(member.activationState)}</p></div>
        {!canReview && <p className="rounded bg-slate-100 p-3 text-sm font-bold text-slate-600">This role has read-only access.</p>}
        {canReview && member.status === "imported" && action("start_review", "Move to Pending Review")}
        {canReview && member.status === "correction_requested" && action("start_review", "Return to Pending Review")}
        {canReview && ["pending_review", "duplicate_review"].includes(member.status ?? "") && action("approve", "Approve Member")}
        {canReview && ["pending_review", "duplicate_review"].includes(member.status ?? "") && action("reject", "Reject Member", true)}
        {canReview && member.status === "pending_review" && action("request_correction", "Request Correction", true)}
        {admin && member.status === "pending_review" && action("mark_duplicate", "Mark Duplicate", true)}
        {admin && member.duplicateSignal && action("remove_duplicate_flag", "Remove Duplicate Flag", true)}
        {admin && member.status === "approved" && action("prepare_activation", "Move to Pending Activation")}
        {admin && member.status === "pending_activation" && !workspace.invitation && action("generate_invite", "Generate Invite")}
        {admin && member.status === "pending_activation" && workspace.invitation && action("regenerate_invite", "Regenerate Invite")}
        {admin && member.status === "pending_activation" && workspace.invitation && action("mark_invite_sent", "Mark Invite Sent")}
        {admin && member.status === "pending_activation" && workspace.invitation && action("resend_invite", "Resend Invite")}
        {admin && member.status === "pending_activation" && workspace.invitation && action("expire_invite", "Expire Invite")}
        {admin && member.status === "pending_activation" && workspace.invitation && action("mark_onboarding_started", "Mark Onboarding Started")}
        {admin && member.status === "pending_activation" && workspace.invitation && action("mark_onboarding_completed", "Mark Onboarding Completed")}
        {admin && <form action={submitAssociationMemberAction} className="rounded-lg border bg-slate-50 p-3"><input type="hidden" name="member_id" value={member.id} /><input type="hidden" name="action" value="assign_reviewer" /><select name="assigned_reviewer_id" defaultValue={member.assignedReviewerId ?? ""} className="w-full rounded border px-2 py-2 text-sm"><option value="">Unassigned</option>{workspace.reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.label}</option>)}</select><textarea required name="reason" placeholder="Required reassignment reason" rows={2} className="mt-2 w-full rounded border px-2 py-2 text-sm" /><button className="mt-2 w-full rounded border px-3 py-2 text-sm font-black">Assign Reviewer</button></form>}
        {canReview && !["imported", "correction_requested", "pending_review", "duplicate_review", "approved"].includes(member.status ?? "") && <p className="rounded bg-slate-100 p-3 text-sm font-bold text-slate-600">No review transition is available from this state.</p>}
      </aside>
    </div>
  </section>;
}
