import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Factory, FileCheck2, Gauge, MapPin, UserRoundCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createLcdboClusterInterest,
  createLcdboEnrolment,
  getLcdboProgramme,
  getMsmeLcdboClusterInterests,
  getMsmeLcdboEnrolment,
  listLcdboClusters,
  updateLcdboClusterInterestStatus,
  updateLcdboEnrolmentStatus,
} from "@/lib/data/lcdbo-enrolment";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ClusterInterestStatus, ProgrammeEnrolmentStatus } from "@/types/platform";
import { getClusterReadinessAssessment, getDocumentRequestsForMsme, PARTICIPATION_STATUSES } from "@/lib/data/lcdbo-operations";
import { msmeDocumentSubmissionAction } from "@/app/dashboard/lcdbo/operations-actions";
import { LcdboCommandMetricCard, LcdboEmptyState, LcdboJourneyFlow, LcdboStatusBadge } from "@/components/lcdbo/lcdbo-visuals";

const SUPPORT_OPTIONS = ["Shared facilities", "Standards and certification", "Technical training", "Market access", "Export readiness"];

function statusClass(status: string) {
  if (["active", "accepted", "placed"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["rejected", "suspended", "inactive"].includes(status)) return "bg-rose-100 text-rose-800";
  if (["waitlisted", "under_review", "pending_review", "interested", "onboarding", "needs_documents", "submitted"].includes(status)) return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function labelStatus(status: ProgrammeEnrolmentStatus | ClusterInterestStatus) {
  return status.replaceAll("_", " ");
}

async function requireOwnedMsme() {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" || !ctx.appUserId || !ctx.linkedMsmeId) redirect("/access-denied");
  const supabase = await createServiceRoleSupabaseClient();
  const { data: msme } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,owner_name,sector,state,lga,address,created_by")
    .eq("id", ctx.linkedMsmeId)
    .eq("created_by", ctx.appUserId)
    .maybeSingle();
  if (!msme) redirect("/access-denied");
  return { ctx, supabase, msme };
}

async function joinLcdboAction(formData: FormData) {
  "use server";
  const { ctx, supabase, msme } = await requireOwnedMsme();
  await createLcdboEnrolment({
    msmeId: msme.id,
    actorUserId: ctx.appUserId!,
    applicationNote: String(formData.get("application_note") ?? ""),
    source: "lcdbo_msme_workspace",
    client: supabase,
  });
  revalidatePath("/dashboard/msme/lcdbo");
  redirect("/dashboard/msme/lcdbo?success=enrolment_submitted");
}

async function withdrawEnrolmentAction(formData: FormData) {
  "use server";
  const { ctx, supabase, msme } = await requireOwnedMsme();
  const enrolment = await getMsmeLcdboEnrolment(msme.id, supabase);
  if (!enrolment || enrolment.id !== String(formData.get("enrolment_id")) || enrolment.status !== "pending_review") redirect("/access-denied");
  await updateLcdboEnrolmentStatus({ enrolmentId: enrolment.id, status: "withdrawn", actorUserId: ctx.appUserId!, client: supabase });
  revalidatePath("/dashboard/msme/lcdbo");
  redirect("/dashboard/msme/lcdbo?success=enrolment_withdrawn");
}

async function clusterInterestAction(formData: FormData) {
  "use server";
  const { ctx, supabase, msme } = await requireOwnedMsme();
  const enrolment = await getMsmeLcdboEnrolment(msme.id, supabase);
  if (!enrolment || !["pending_review", "active"].includes(enrolment.status)) redirect("/access-denied");

  const interestReason = String(formData.get("interest_reason") ?? "").trim();
  const productOrService = String(formData.get("product_or_service") ?? "").trim();
  const currentLocation = String(formData.get("current_location") ?? "").trim();
  if (!interestReason || !productOrService || !currentLocation) {
    redirect("/dashboard/msme/lcdbo?error=complete_cluster_interest");
  }
  await createLcdboClusterInterest({
    msmeId: msme.id,
    clusterId: String(formData.get("cluster_id") ?? ""),
    actorUserId: ctx.appUserId!,
    interestReason,
    capacitySummary: String(formData.get("capacity_summary") ?? ""),
    productOrService,
    currentLocation,
    preferredSupport: formData.getAll("preferred_support").map(String),
    client: supabase,
  });
  revalidatePath("/dashboard/msme/lcdbo");
  redirect("/dashboard/msme/lcdbo?success=cluster_interest_submitted");
}

async function withdrawClusterInterestAction(formData: FormData) {
  "use server";
  const { ctx, supabase, msme } = await requireOwnedMsme();
  const interestId = String(formData.get("interest_id") ?? "");
  const interests = await getMsmeLcdboClusterInterests(msme.id, supabase);
  const interest = interests.find((item) => item.id === interestId);
  if (!interest || !["interested", "under_review", "waitlisted"].includes(interest.status)) redirect("/access-denied");
  await updateLcdboClusterInterestStatus({ interestId, status: "withdrawn", actorUserId: ctx.appUserId!, client: supabase });
  revalidatePath("/dashboard/msme/lcdbo");
  redirect("/dashboard/msme/lcdbo?success=cluster_interest_withdrawn");
}

export default async function MsmeLcdboPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, msme } = await requireOwnedMsme();
  const [programme, enrolment, clusters, interests] = await Promise.all([
    getLcdboProgramme(supabase),
    getMsmeLcdboEnrolment(msme.id, supabase),
    listLcdboClusters(supabase),
    getMsmeLcdboClusterInterests(msme.id, supabase),
  ]);
  const interestByCluster = new Map(interests.map((interest) => [interest.cluster_id, interest]));
  const canExpressInterest = Boolean(enrolment && ["pending_review", "active"].includes(enrolment.status));
  const participant = interests.find((interest) => (PARTICIPATION_STATUSES as readonly string[]).includes(interest.status)) ?? null;
  const [readiness, documentRequests, assignedOfficer] = await Promise.all([
    participant ? getClusterReadinessAssessment(participant.id, supabase) : Promise.resolve(null),
    getDocumentRequestsForMsme(msme.id, supabase),
    participant?.assigned_officer_id
      ? supabase.from("users").select("id,full_name,email").eq("id", participant.assigned_officer_id).maybeSingle().then(({ data }) => data)
      : Promise.resolve(null),
  ]);
  const openDocumentRequests = documentRequests.filter((request) => ["requested", "rejected"].includes(request.status));
  const hasSubmittedDocuments = documentRequests.some((request) => request.submissions?.some((submission) => ["submitted", "accepted"].includes(submission.status)));
  const activeInterest = interests.find((interest) => !["rejected", "withdrawn"].includes(interest.status)) ?? null;
  const progressSteps = ["Business registered", "LCDBO enrolment", "Cluster interest", "Cluster review", "Readiness assessment", "Document submission", "Cluster placement", "Active participation"] as const;
  let completedSteps = 1;
  if (enrolment && !["rejected", "withdrawn"].includes(enrolment.status)) completedSteps = 2;
  if (activeInterest) completedSteps = 3;
  if (activeInterest && !["interested", "under_review", "waitlisted"].includes(activeInterest.status)) completedSteps = 4;
  if (readiness) completedSteps = 5;
  if (hasSubmittedDocuments || (!documentRequests.length && Boolean(readiness))) completedSteps = 6;
  if (participant && ["placed", "active"].includes(participant.status)) completedSteps = 7;
  if (participant?.status === "active") completedSteps = 8;
  const nextAction = !enrolment || ["rejected", "withdrawn"].includes(enrolment.status)
    ? { title: "Join LCDBO", detail: "Submit your programme enrolment request to enter the industrial transformation pipeline.", href: "#programme-enrolment" }
    : enrolment.status === "pending_review"
      ? { title: "Your enrolment is under review", detail: "The programme team is validating your request. No action is required right now.", href: "#programme-enrolment" }
      : !activeInterest
        ? { title: "Select an industrial cluster", detail: "Explore available clusters and express interest where your capabilities align.", href: "#available-clusters" }
        : openDocumentRequests.length
          ? { title: "Submit requested evidence", detail: `${openDocumentRequests.length} document request${openDocumentRequests.length === 1 ? " is" : "s are"} waiting for your response.`, href: "#document-requests" }
          : readiness
            ? { title: "Review your readiness feedback", detail: `Your latest readiness level is ${readiness.readiness_level.replaceAll("_", " ")}.`, href: "#programme-progress" }
            : assignedOfficer
              ? { title: "Continue with your assigned officer", detail: `${assignedOfficer.full_name ?? assignedOfficer.email} is supporting your participation journey.`, href: "#participation-summary" }
              : { title: "Wait for cluster review", detail: "Your cluster interest is in the programme review pipeline.", href: "#programme-progress" };

  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-[#0B2E59] p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#008751]/30 blur-3xl" aria-hidden="true" />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">{programme?.name ?? "LCDBO Programme"}</p>
        <div className="relative mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your LCDBO participation journey</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Track programme enrolment, cluster participation, readiness and evidence requirements for {msme.business_name}.</p>
          </div>
          {enrolment ? <LcdboStatusBadge status={enrolment.status} /> : <LcdboStatusBadge status="not_enrolled" />}
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ label: "Enrolment", value: enrolment ? labelStatus(enrolment.status) : "Not enrolled" }, { label: "Cluster status", value: participant ? labelStatus(participant.status) : activeInterest ? labelStatus(activeInterest.status) : "No cluster selected" }, { label: "Assigned officer", value: assignedOfficer?.full_name ?? assignedOfficer?.email ?? "Awaiting assignment" }, { label: "Readiness", value: readiness ? `${readiness.readiness_level.replaceAll("_", " ")} · ${readiness.overall_score}/5` : "Not assessed" }].map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p><p className="mt-1 text-sm font-bold capitalize text-white">{item.value}</p></div>)}
        </div>
      </header>

      {query.success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Your LCDBO request has been updated successfully.</p>}
      {query.error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">Complete all required cluster-interest fields and try again.</p>}

      <article id="programme-progress" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Programme progress</p><h2 className="mt-1 text-xl font-black text-[#0B2E59]">Eight milestones to active participation</h2></div><span className="text-sm font-black text-[#0B2E59]">{completedSteps}/8 complete</span></div><div className="mt-6"><LcdboJourneyFlow items={progressSteps} completed={completedSteps} /></div></article>

      <article className="overflow-hidden rounded-2xl border border-[#D4A017]/30 bg-amber-50 p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#D4A017] text-[#0B2E59]"><ArrowRight className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a650f]">Next best action</p><h2 className="mt-1 text-xl font-black text-[#0B2E59]">{nextAction.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{nextAction.detail}</p></div></div><Link href={nextAction.href} className="shrink-0 rounded-xl bg-[#0B2E59] px-4 py-3 text-center text-sm font-black text-white">View next step</Link></div></article>

      <div id="participation-summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <LcdboCommandMetricCard icon={Factory} label="Interested clusters" value={interests.filter((item) => !["rejected", "withdrawn"].includes(item.status)).length} />
        <LcdboCommandMetricCard icon={CheckCircle2} label="Accepted cluster" value={participant?.cluster_id ? 1 : 0} />
        <LcdboCommandMetricCard icon={UserRoundCheck} label="Assigned officer" value={assignedOfficer ? 1 : 0} />
        <LcdboCommandMetricCard icon={FileCheck2} label="Documents open" value={openDocumentRequests.length} attention={openDocumentRequests.length > 0} />
        <LcdboCommandMetricCard icon={Gauge} label="Readiness score" value={readiness ? `${readiness.overall_score}/5` : "—"} />
      </div>

      <article id="programme-enrolment" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#06172f]">Programme enrolment</h2>
            <p className="mt-1 text-sm text-slate-600">Requests are reviewed by the LCDBO programme team before activation.</p>
          </div>
          {enrolment && <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(enrolment.status)}`}>{labelStatus(enrolment.status)}</span>}
        </div>
        {!enrolment || ["rejected", "withdrawn"].includes(enrolment.status) ? (
          <form action={joinLcdboAction} className="mt-5 grid gap-3 md:grid-cols-[1fr,auto] md:items-end">
            <label className="text-sm font-semibold text-slate-700">Why do you want to join LCDBO?
              <textarea name="application_note" rows={3} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" placeholder="Briefly describe your growth or cluster goals." />
            </label>
            <button className="rounded-xl bg-[#0d6b47] px-5 py-3 text-sm font-black text-white hover:bg-[#09583a]">Join LCDBO</button>
          </form>
        ) : (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>Submitted:</strong> {new Date(enrolment.enrolled_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>
            {enrolment.review_note && <p className="mt-2"><strong>Programme note:</strong> {enrolment.review_note}</p>}
            {enrolment.status === "pending_review" && (
              <form action={withdrawEnrolmentAction} className="mt-4">
                <input type="hidden" name="enrolment_id" value={enrolment.id} />
                <button className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700">Withdraw pending request</button>
              </form>
            )}
          </div>
        )}
      </article>

      {participant ? (
        <article className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Cluster Participation</p><h2 className="mt-1 text-2xl font-black text-[#06172f]">Your operational placement</h2></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black capitalize ${statusClass(participant.status)}`}>{labelStatus(participant.status)}</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryCard icon={UserRoundCheck} label="Assigned officer" value={assignedOfficer?.full_name ?? assignedOfficer?.email ?? "Assignment pending"} />
            <SummaryCard icon={Gauge} label="Readiness" value={readiness ? `${readiness.overall_score}/5 · ${readiness.readiness_level.replaceAll("_", " ")}` : "Assessment pending"} />
            <SummaryCard icon={FileCheck2} label="Documents outstanding" value={String(documentRequests.filter((request) => ["requested", "rejected"].includes(request.status)).length)} />
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-black text-slate-900">Next steps</p>
            <p className="mt-1">{participant.status === "needs_documents" ? "Respond to the document requests below so onboarding can continue." : participant.status === "onboarding" ? "Your officer is preparing your business for cluster participation." : participant.status === "placed" ? "Your business has been formally placed into the cluster." : participant.status === "active" ? "Your business is active in the cluster participation programme." : "The LCDBO team will confirm onboarding and placement requirements."}</p>
            {readiness?.recommended_support?.length ? <p className="mt-2"><strong>Recommended support:</strong> {readiness.recommended_support.join(", ")}</p> : null}
          </div>
        </article>
      ) : <LcdboEmptyState icon={Factory} title="No cluster placement yet" detail="Once a cluster interest is accepted, your participation summary, assigned officer and readiness journey will appear here." />}

      {documentRequests.length > 0 ? (
        <article id="document-requests" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black text-[#06172f]">Requested documents and evidence</h2>
          <p className="mt-1 text-sm text-slate-600">Submit a secure document link or metadata response. Direct LCDBO file upload will follow storage provisioning.</p>
          <div className="mt-5 space-y-4">
            {documentRequests.map((request) => {
              const submission = request.submissions?.[0];
              const canSubmit = ["requested", "rejected"].includes(request.status)
                && (!submission || submission.status === "rejected");
              return <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{request.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{request.document_type.replaceAll("_", " ")} · Due {request.due_date ?? "not specified"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span></div>
                {request.description && <p className="mt-3 text-sm text-slate-600">{request.description}</p>}
                {submission && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p><strong>Response:</strong> {submission.notes || "Document link supplied"}</p>{submission.file_url && <Link href={submission.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-blue-700">Open submitted link</Link>}{submission.review_notes && <p className="mt-2"><strong>Review note:</strong> {submission.review_notes}</p>}</div>}
                {canSubmit && <form action={msmeDocumentSubmissionAction} className="mt-4 grid gap-2 md:grid-cols-2"><input type="hidden" name="request_id" value={request.id} /><input name="file_url" type="url" placeholder="Secure document URL (optional)" className="rounded-lg border px-3 py-2 text-sm" /><input name="notes" placeholder="Response or evidence notes" className="rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black text-white md:col-span-2">{submission ? "Resubmit response" : "Submit response"}</button></form>}
              </div>;
            })}
          </div>
        </article>
      ) : <LcdboEmptyState icon={FileCheck2} title="No document requests" detail="There is nothing to submit right now. Programme officers will request evidence here when it is needed for participation review." />}

      <div id="available-clusters">
        <h2 className="text-2xl font-black text-[#06172f]">Available industrial clusters</h2>
        <p className="mt-1 text-sm text-slate-600">Express interest where your products, services, and growth plans align.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {clusters.map((cluster) => {
          const interest = interestByCluster.get(cluster.id);
          return (
            <article key={cluster.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Factory className="h-5 w-5" /></span>
                {interest && <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(interest.status)}`}>{labelStatus(interest.status)}</span>}
              </div>
              <h3 className="mt-4 text-xl font-black text-[#06172f]">{cluster.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{cluster.description}</p>
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500"><MapPin className="h-4 w-4" />{cluster.location_description ?? "Location being finalised"}</p>

              {interest && !["rejected", "withdrawn"].includes(interest.status) ? (
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p><strong>Product/service:</strong> {interest.product_or_service}</p>
                  <p className="mt-1"><strong>Interest:</strong> {interest.interest_reason}</p>
                  {interest.review_note && <p className="mt-2"><strong>Programme note:</strong> {interest.review_note}</p>}
                  {["interested", "under_review", "waitlisted"].includes(interest.status) && (
                    <form action={withdrawClusterInterestAction} className="mt-4">
                      <input type="hidden" name="interest_id" value={interest.id} />
                      <button className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700">Withdraw interest</button>
                    </form>
                  )}
                </div>
              ) : canExpressInterest ? (
                <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-emerald-800">Express cluster interest</summary>
                  <form action={clusterInterestAction} className="mt-4 space-y-3">
                    <input type="hidden" name="cluster_id" value={cluster.id} />
                    <Field label="Product or service" name="product_or_service" required placeholder="What do you produce or provide?" />
                    <Field label="Current location" name="current_location" required defaultValue={[msme.lga, msme.state].filter(Boolean).join(", ")} />
                    <TextField label="Why this cluster?" name="interest_reason" required />
                    <TextField label="Current capacity" name="capacity_summary" placeholder="Team, production volume, equipment, certifications, or facilities." />
                    <fieldset>
                      <legend className="text-sm font-semibold text-slate-700">Preferred support</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {SUPPORT_OPTIONS.map((option) => <label key={option} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" name="preferred_support" value={option} />{option}</label>)}
                      </div>
                    </fieldset>
                    <button className="w-full rounded-lg bg-[#0d6b47] px-4 py-2.5 text-sm font-black text-white">Submit interest</button>
                  </form>
                </details>
              ) : (
                <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Join LCDBO before expressing cluster interest.</p>
              )}
            </article>
          );
        })}
        {clusters.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No LCDBO clusters are available yet.</div>}
      </div>
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-emerald-700" /><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 line-clamp-2 text-lg font-black capitalize text-[#06172f]">{value}</p></article>;
}

function Field({ label, name, required = false, placeholder, defaultValue }: { label: string; name: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input name={name} required={required} placeholder={placeholder} defaultValue={defaultValue} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>;
}

function TextField({ label, name, required = false, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<textarea name={name} required={required} placeholder={placeholder} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>;
}
