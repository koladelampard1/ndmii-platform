import Link from "next/link";
import { ClipboardCheck, Download, FileClock, Gauge, UserRoundCheck } from "lucide-react";
import {
  documentRequestAction,
  documentReviewAction,
  officerAssignmentAction,
  participationStatusAction,
  readinessAssessmentAction,
} from "@/app/dashboard/lcdbo/operations-actions";
import {
  DOCUMENT_TYPES,
  PARTICIPATION_STATUSES,
  type LcdboClusterParticipant,
  type LcdboDocumentRequest,
  type LcdboOfficer,
  type LcdboReadinessAssessment,
  type ReadinessLevel,
} from "@/lib/data/lcdbo-operations";

type Props = {
  participants: LcdboClusterParticipant[];
  assessments: Map<string, LcdboReadinessAssessment>;
  documents: LcdboDocumentRequest[];
  officers: LcdboOfficer[];
  workload: Array<{ officer: LcdboOfficer; count: number }>;
  readiness: Array<[ReadinessLevel, number]>;
  metrics: { active: number; onboarding: number; needsDocuments: number; placed: number };
  canAssign: boolean;
};

function label(value: string) { return value.replaceAll("_", " "); }
function badge(status: string) {
  if (["active", "placed", "accepted"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["needs_documents", "onboarding", "submitted"].includes(status)) return "bg-amber-100 text-amber-900";
  if (["rejected", "inactive"].includes(status)) return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export function LcdboOperationsPanel({ participants, assessments, documents, officers, workload, readiness, metrics, canAssign }: Props) {
  const memberById = new Map(participants.map((item) => [item.id, item]));
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Cluster Operations</p><h2 className="mt-1 text-2xl font-black text-[#06172f]">Placement and participation</h2><p className="mt-1 text-sm text-slate-600">Move approved MSMEs through readiness, documentation, onboarding, and formal placement.</p></div>
        {canAssign && <div className="flex flex-wrap gap-2">{[
          ["enrolments", "Enrolments"], ["cluster-interests", "Interests"], ["cluster-members", "Participants"], ["readiness", "Readiness"], ["documents", "Documents"],
        ].map(([key, text]) => <Link key={key} href={`/api/lcdbo/export/${key}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700"><Download className="h-3.5 w-3.5" />{text}</Link>)}</div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UserRoundCheck} label="Active members" value={metrics.active} />
        <Metric icon={ClipboardCheck} label="In onboarding" value={metrics.onboarding} />
        <Metric icon={FileClock} label="Needs documents" value={metrics.needsDocuments} />
        <Metric icon={Gauge} label="Placed" value={metrics.placed} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr,1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-[#06172f]">Assigned officer workload</h3><div className="mt-4 space-y-3">{workload.map(({ officer, count }) => <div key={officer.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold">{officer.full_name ?? officer.email}</span><span className="font-black">{count}</span></div>)}{!workload.length && <Empty text="No officers have assigned MSMEs." />}</div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-[#06172f]">Readiness distribution</h3><div className="mt-4 space-y-3">{readiness.map(([level, count]) => <div key={level} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold capitalize">{label(level)}</span><span className="font-black">{count}</span></div>)}{!readiness.length && <Empty text="Assessments will populate readiness distribution." />}</div></article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-[#06172f]">Cluster participants</h3>
        <div className="mt-4 space-y-4">
          {participants.map((member) => {
            const assessment = assessments.get(member.id);
            return <details key={member.id} className="group rounded-xl border border-slate-200 p-4" open={participants.length === 1}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div><p className="font-black text-slate-900">{member.msme?.business_name ?? "MSME participant"}</p><p className="mt-1 text-xs text-slate-500">{member.msme?.msme_id} · {member.cluster?.name} · {member.msme?.state}</p></div>
                <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${badge(member.status)}`}>{label(member.status)}</span>{assessment && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{assessment.overall_score}/5</span>}</div>
              </summary>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <form action={participationStatusAction} className="space-y-2 rounded-xl bg-slate-50 p-4"><h4 className="text-sm font-black">Participation status</h4><input type="hidden" name="cluster_member_id" value={member.id} /><select name="status" defaultValue={member.status} className="w-full rounded-lg border px-3 py-2 text-sm">{PARTICIPATION_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select><input name="note" placeholder="Status note" className="w-full rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-[#06172f] px-3 py-2 text-xs font-black text-white">Update status</button></form>
                <form action={officerAssignmentAction} className="space-y-2 rounded-xl bg-slate-50 p-4"><h4 className="text-sm font-black">Responsible officer</h4><input type="hidden" name="cluster_member_id" value={member.id} /><select name="officer_user_id" defaultValue={member.assigned_officer_id ?? ""} disabled={!canAssign} className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-slate-100"><option value="">Unassigned</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email}</option>)}</select><input name="assignment_notes" defaultValue={member.assignment_notes ?? ""} disabled={!canAssign} placeholder="Assignment notes" className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-slate-100" /><button disabled={!canAssign} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Save assignment</button></form>
                <form action={readinessAssessmentAction} className="space-y-3 rounded-xl bg-slate-50 p-4 lg:col-span-2"><div className="flex items-center justify-between"><h4 className="text-sm font-black">Readiness assessment</h4>{assessment && <span className="text-xs font-bold capitalize text-blue-700">Latest: {label(assessment.readiness_level)}</span>}</div><input type="hidden" name="cluster_member_id" value={member.id} /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{["production_capacity", "equipment_readiness", "workforce_readiness", "finance_readiness", "compliance_readiness", "market_readiness", "export_readiness", "digital_readiness"].map((area) => <label key={area} className="text-xs font-semibold capitalize">{label(area)}<select name={area} defaultValue={assessment?.[area as keyof LcdboReadinessAssessment] as number ?? 3} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm">{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</select></label>)}</div><input name="recommended_support" placeholder="Recommended support, comma separated" className="w-full rounded-lg border px-3 py-2 text-sm" /><textarea name="assessment_notes" rows={2} placeholder="Assessment notes" className="w-full rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white">Save assessment</button></form>
                <form action={documentRequestAction} className="space-y-2 rounded-xl bg-slate-50 p-4 lg:col-span-2"><h4 className="text-sm font-black">Request document or evidence</h4><input type="hidden" name="cluster_member_id" value={member.id} /><div className="grid gap-2 md:grid-cols-4"><select name="document_type" className="rounded-lg border px-3 py-2 text-sm">{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select><input name="title" required placeholder="Request title" className="rounded-lg border px-3 py-2 text-sm" /><input name="due_date" type="date" className="rounded-lg border px-3 py-2 text-sm" /><input name="description" placeholder="Instructions" className="rounded-lg border px-3 py-2 text-sm" /></div><button className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white">Create request</button></form>
              </div>
            </details>;
          })}
          {!participants.length && <Empty text="Accepted cluster interests will appear here for operational placement." />}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-xl font-black text-[#06172f]">Document request queue</h3><div className="mt-4 space-y-3">{documents.map((request) => { const member = memberById.get(request.cluster_member_id); const submission = request.submissions?.[0]; return <div key={request.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{request.title}</p><p className="mt-1 text-xs text-slate-500">{member?.msme?.business_name} · {label(request.document_type)} · Due {request.due_date ?? "not set"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${badge(request.status)}`}>{label(request.status)}</span></div>{submission && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p>{submission.notes || "Document link submitted."}</p>{submission.file_url && <Link href={submission.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-blue-700">Open submitted link</Link>}{submission.status === "submitted" && <form action={documentReviewAction} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="cluster_member_id" value={request.cluster_member_id} /><input type="hidden" name="submission_id" value={submission.id} /><input name="review_notes" placeholder="Review note" className="min-w-52 flex-1 rounded-lg border px-3 py-2 text-xs" /><button name="status" value="accepted" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Accept</button><button name="status" value="rejected" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">Reject</button></form>}</div>}</div>; })}{!documents.length && <Empty text="No participation document requests yet." />}</div></article>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: number }) { return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-emerald-700" /><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-[#06172f]">{value}</p></article>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</p>; }
