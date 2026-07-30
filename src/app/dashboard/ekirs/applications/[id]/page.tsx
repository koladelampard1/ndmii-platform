import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceContentGrid, WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { StatusBadge } from "@/components/state-revenue/state-revenue-components";
import { reviewEkirsApplicationAction, reviewEkirsEvidenceAction } from "@/app/dashboard/ekirs/applications/actions";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getStateRevenueApplicationDetail, requireStateRevenueApplicationAccess } from "@/lib/state-revenue/onboarding";

export default async function EkirsApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, query, ctx, supabase] = await Promise.all([
    params,
    searchParams,
    getCurrentUserContext(),
    createServiceRoleSupabaseClient(),
  ]);
  const detail = await getStateRevenueApplicationDetail(id, supabase);
  if (!detail) notFound();
  await requireStateRevenueApplicationAccess({ applicationId: id, ctx, client: supabase, mode: "view" });

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Application review"
        title={detail.proposed_business_name ?? detail.application_reference}
        description={`Reference ${detail.application_reference}. Applicant evidence and decision history are visible only inside the authorised EKIRS workspace.`}
        disclosure="DBIN identity is not a CAC certificate, TIN or tax-clearance certificate. Ekiti presence reflects the approved operating-location standard at review time."
        actions={<Link href="/dashboard/ekirs/applications" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Back to queue</Link>}
      />
      {query.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{decodeURIComponent(query.error)}</div> : null}
      {query.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Action recorded: {decodeURIComponent(query.success)}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Status</p>
          <div className="mt-3"><StatusBadge tone={detail.current_status === "approved" ? "emerald" : detail.current_status === "rejected" ? "rose" : "amber"}>{detail.current_status.replace(/_/g, " ")}</StatusBadge></div>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Eligibility</p>
          <p className="mt-3 text-lg font-black">{detail.eligibility_status.replace(/_/g, " ")}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Duplicate screening</p>
          <p className="mt-3 text-lg font-black">{detail.duplicate_status.replace(/_/g, " ")}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Verification level</p>
          <p className="mt-3 text-lg font-black">Level {detail.verification_level}</p>
        </article>
      </div>
      <WorkspaceContentGrid columns="lg:grid-cols-2">
        <WorkspaceSection title="Applicant and business" description="Private contact details are kept in the authorised workspace only.">
          <dl className="grid gap-3 text-sm">
            <div><dt className="font-black text-slate-500">Business</dt><dd>{detail.proposed_business_name}</dd></div>
            <div><dt className="font-black text-slate-500">Owner / representative</dt><dd>{detail.owner_name ?? "Not provided"}</dd></div>
            <div><dt className="font-black text-slate-500">Email</dt><dd>{detail.contact_email}</dd></div>
            <div><dt className="font-black text-slate-500">Sector</dt><dd>{detail.sector}</dd></div>
            <div><dt className="font-black text-slate-500">CAC / TIN</dt><dd>{detail.cac_number ?? "No CAC"} · {detail.tin ?? "No TIN"}</dd></div>
          </dl>
        </WorkspaceSection>
        <WorkspaceSection title="Ekiti operating location" description="Approval requires a configured Ekiti operating location.">
          {detail.location ? (
            <dl className="grid gap-3 text-sm">
              <div><dt className="font-black text-slate-500">LGA</dt><dd>{detail.location.lga_name}</dd></div>
              <div><dt className="font-black text-slate-500">Town</dt><dd>{detail.location.town}</dd></div>
              <div><dt className="font-black text-slate-500">Address</dt><dd>{detail.location.address}</dd></div>
              <div><dt className="font-black text-slate-500">Activity</dt><dd>{detail.location.business_activity}</dd></div>
            </dl>
          ) : <p className="text-sm text-slate-600">No location record found.</p>}
        </WorkspaceSection>
      </WorkspaceContentGrid>
      <WorkspaceContentGrid columns="lg:grid-cols-3">
        <WorkspaceSection title="Evidence metadata" description="Files are represented through private evidence metadata; public URLs are not exposed.">
          <div className="space-y-2">
            {detail.evidence.length ? detail.evidence.map((evidence) => (
              <div key={evidence.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{evidence.evidence_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{evidence.original_filename ?? "Metadata only"} · {evidence.evidence_status.replace(/_/g, " ")}</p>
                    {evidence.rejection_reason ? <p className="mt-1 text-xs text-rose-700">{evidence.rejection_reason}</p> : null}
                  </div>
                  {evidence.storage_path ? (
                    <div className="flex gap-2">
                      <a href={`/api/ekirs/evidence/${evidence.id}`} target="_blank" rel="noreferrer" className="text-xs font-black text-emerald-700">Preview</a>
                      <a href={`/api/ekirs/evidence/${evidence.id}?disposition=attachment`} className="text-xs font-black text-slate-700">Download</a>
                    </div>
                  ) : null}
                </div>
                <form action={reviewEkirsEvidenceAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="application_id" value={detail.id} />
                  <input type="hidden" name="evidence_id" value={evidence.id} />
                  <input name="review_note" className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs" placeholder="Reviewer note, if needed" />
                  <div className="flex flex-wrap gap-2">
                    <button name="evidence_status" value="under_review" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700">Mark under review</button>
                    <button name="evidence_status" value="accepted" className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-black text-white">Accept</button>
                    <button name="evidence_status" value="replacement_requested" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-900">Request replacement</button>
                    <button name="evidence_status" value="rejected" className="rounded-lg bg-rose-700 px-3 py-2 text-[11px] font-black text-white">Reject</button>
                  </div>
                </form>
              </div>
            )) : <p className="text-sm text-slate-600">No evidence metadata recorded.</p>}
          </div>
        </WorkspaceSection>
        <WorkspaceSection title="Duplicate candidates" description="Strong matches require authorised resolution before identity issuance.">
          <div className="space-y-2">
            {detail.identityCandidates.length ? detail.identityCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-black">{candidate.confidence_category} confidence</p>
                <p className="text-xs text-slate-500">{candidate.match_signals.join(", ")}</p>
              </div>
            )) : <p className="text-sm text-slate-600">No candidate identity records.</p>}
          </div>
        </WorkspaceSection>
        <WorkspaceSection title="History" description="Material application status changes are preserved.">
          <div className="space-y-2">
            {detail.history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-black">{item.new_status.replace(/_/g, " ")}</p>
                <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>
      </WorkspaceContentGrid>
      <WorkspaceSection title="Reviewer decision" description="Invalid transitions and self-approval are enforced server-side.">
        <form action={reviewEkirsApplicationAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_1fr]">
          <input type="hidden" name="application_id" value={detail.id} />
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Decision notes
            <textarea name="notes" className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Reason code
            <input name="reason_code" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" placeholder="e.g. evidence_incomplete" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Affected sections / evidence
            <input name="sections" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" placeholder="e.g. operating location, utility bill" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Response due date
            <input name="due_at" type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Field officer user ID
            <input name="assigned_field_officer_id" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button name="action" value="start_review" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Start review</button>
            <button name="action" value="request_evidence" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">Request evidence</button>
            <button name="action" value="request_additional_information" className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-amber-900">Request additional info</button>
            <button name="action" value="flag_duplicate" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">Flag duplicate</button>
            <button name="action" value="assign_field_officer" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-900">Assign field task</button>
            <button name="action" value="submit_field_verification" className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-black text-sky-900">Submit field outcome</button>
            <button name="action" value="approve" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white">Approve</button>
            <button name="action" value="reject" className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-black text-white">Reject</button>
          </div>
        </form>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
