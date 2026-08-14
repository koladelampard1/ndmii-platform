import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveCorrespondenceAction,
  decideRepresentativeLetterAction,
  dispatchCorrespondenceAction,
  saveRepresentativeDraftAction,
  submitRepresentativeLetterAction,
  signCorrespondenceAction,
  transitionDeliveryEvidenceAction,
  transitionCorrespondenceAction,
} from "@/app/dashboard/correspondence/actions";
import { StatusBadge, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceRecord, getCorrespondenceRepresentativeAuthority, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN, type LcdboCorrespondenceRecord } from "@/lib/lcdbo-correspondence/types";
import { counterpartyLabelForRepresentative, institutionLabelForRepresentative, isCounterpartyAction, isInitiatorAction, simplifiedStatusForRecord, simplifiedStatusLabel, type RepresentativeAuthority } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("view");
  const record = await getCorrespondenceRecord(id, supabase);
  if (!record) notFound();
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const latestVersion = record.versions?.[0];
  const verificationToken = typeof record.metadata?.verification_token === "string" ? record.metadata.verification_token : null;
  const simplifiedStatus = simplifiedStatusForRecord(record);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{record.reference}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{record.subject}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{record.summary ?? "No summary recorded."}</p>
          </div>
          <div className="space-y-2 text-right">
            <StatusBadge status={record.status} />
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{simplifiedStatusLabel(simplifiedStatus)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Issuer" value={`${record.issuer}/${record.direction}`} />
          <Info label="Current step" value={simplifiedStatusLabel(simplifiedStatus)} />
          <Info label="Owner" value={record.owner?.full_name ?? record.owner?.email ?? "Unassigned"} />
          <Info label="Sensitivity" value={record.sensitivity} />
          <Info label="Updated" value={new Date(record.updated_at).toLocaleString()} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <WorkspaceCard title="Current document version" description="Approvals and signatures are bound to the active document hash.">
            {latestVersion ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <p className="font-black text-slate-950">{latestVersion.version_label}</p>
                  <p className="text-xs font-mono text-slate-600">{latestVersion.document_hash ?? "Hash pending"}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/api/lcdbo/correspondence/${record.id}/draft-pdf`} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">Open draft PDF</Link>
                  {record.issued_version_id ? <Link href={`/api/lcdbo/correspondence/${record.id}/final-pdf`} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white">Open final PDF</Link> : null}
                </div>
                <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">{latestVersion.body || "Document body has not been added."}</pre>
                {authority && isInitiatorAction(record, authority) && ["draft", "returned_for_correction"].includes(simplifiedStatus) ? (
                  <RepresentativeDraftEditForm record={record} body={latestVersion.body ?? ""} />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No document version has been created yet.</p>
            )}
          </WorkspaceCard>

          <WorkspaceCard title="Audit timeline">
            <ol className="space-y-3">
              {(record.actions ?? []).map((action) => (
                <li key={action.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{action.action_type.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{new Date(action.created_at).toLocaleString()}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{action.note ?? `${action.from_status ?? "new"} → ${action.to_status ?? "updated"}`}</p>
                </li>
              ))}
            </ol>
          </WorkspaceCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <WorkspaceCard title="Dispatch and delivery">
              <DeliveryHistory recordId={record.id} dispatches={record.dispatches ?? []} evidence={record.delivery_evidence ?? []} />
            </WorkspaceCard>

            <WorkspaceCard title="Responses and relationships">
              <CompactList
                empty="No response or related-record history has been recorded."
                rows={[
                  ...(record.responses ?? []).map((response) => ({
                    id: response.id,
                    title: response.response_reference ?? "Response received",
                    meta: response.response_summary,
                  })),
                  ...(record.relationships ?? []).map((relationship) => ({
                    id: relationship.id,
                    title: relationship.relationship_type.replaceAll("_", " "),
                    meta: relationship.note ?? relationship.target_record_id,
                  })),
                ]}
              />
            </WorkspaceCard>
          </div>
        </div>

        <aside className="space-y-6">
          <WorkspaceCard title="Next action" description="Representative actions are limited to your institution and preserve version, signature and audit integrity.">
            <div className="space-y-4">
              {authority ? <RepresentativeActionPanel record={record} authority={authority} /> : <LegacyActionPanel record={record} />}
              {verificationToken ? (
                <Link href={`${LCDBO_CORRESPONDENCE_CANONICAL_ORIGIN}/verify/${verificationToken}`} className="inline-flex text-sm font-black text-emerald-700">Open public verification</Link>
              ) : null}
            </div>
          </WorkspaceCard>
        </aside>
      </div>
    </div>
  );
}

function RepresentativeDraftEditForm({ record, body }: { record: LcdboCorrespondenceRecord; body: string }) {
  return (
    <form action={saveRepresentativeDraftAction} className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <input type="hidden" name="record_id" value={record.id} />
      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${record.id}`} />
      <p className="text-sm font-black text-emerald-950">Edit current letter</p>
      <p className="mt-1 text-xs leading-5 text-emerald-900">If a returned letter is based on a frozen signed version, saving creates a new corrected version so signatures cannot be reused.</p>
      <label className="mt-3 block text-xs font-bold text-emerald-950">Subject<input required name="subject" defaultValue={record.subject} className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900" /></label>
      <label className="mt-2 block text-xs font-bold text-emerald-950">Summary<textarea name="summary" rows={2} defaultValue={record.summary ?? ""} className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900" /></label>
      <label className="mt-2 block text-xs font-bold text-emerald-950">Letter body<textarea required name="body" rows={8} defaultValue={body} className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900" /></label>
      <div className="mt-3"><SubmitButton>Save corrected draft</SubmitButton></div>
    </form>
  );
}

function RepresentativeActionPanel({ record, authority }: { record: LcdboCorrespondenceRecord; authority: RepresentativeAuthority }) {
  const simplifiedStatus = simplifiedStatusForRecord(record);
  const isInitiator = isInitiatorAction(record, authority);
  const isCounterparty = isCounterpartyAction(record, authority) || record.current_assignee_id === authority.user_id;
  const institution = institutionLabelForRepresentative(authority.representative_role);
  const counterparty = counterpartyLabelForRepresentative(authority.representative_role);

  if (isInitiator && ["draft", "returned_for_correction"].includes(simplifiedStatus)) {
    return (
      <form action={submitRepresentativeLetterAction} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
        <input type="hidden" name="record_id" value={record.id} />
        <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${record.id}`} />
        <p className="text-sm font-black text-emerald-950">Step 4 — Approve and send to counterparty</p>
        <p className="mt-1 text-xs leading-5 text-emerald-900">Applies the authorised {institution} institutional signature to the current version and sends it to {counterparty} for countersignature.</p>
        <div className="mt-3"><SubmitButton>{`Apply ${institution} signature and send to ${counterparty}`}</SubmitButton></div>
      </form>
    );
  }

  if (isCounterparty && ["awaiting_roseate", "awaiting_rmrdc"].includes(simplifiedStatus)) {
    return (
      <form action={decideRepresentativeLetterAction} className="rounded-2xl border border-slate-200 p-3">
        <input type="hidden" name="record_id" value={record.id} />
        <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${record.id}`} />
        <p className="text-sm font-black text-slate-950">Counterparty decision</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">Approve and apply your institutional signature, return for correction, or reject with a reason.</p>
        <label className="mt-3 block text-xs font-bold text-slate-600">Decision
          <select name="decision" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="approved">Approve and apply institutional signature</option>
            <option value="revision_requested">Return for correction</option>
            <option value="rejected">Reject</option>
          </select>
        </label>
        <label className="mt-2 block text-xs font-bold text-slate-600">Reason / comment<textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        <div className="mt-3"><SubmitButton>Record decision</SubmitButton></div>
      </form>
    );
  }

  if (isInitiator && simplifiedStatus === "ready_to_send") return <DispatchForm recordId={record.id} />;
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">No action is required from your institution right now.</p>;
}

function LegacyActionPanel({ record }: { record: LcdboCorrespondenceRecord }) {
  return (
    <>
      {record.status === "draft" || record.status === "revision_requested" ? (
        <SimpleTransitionForm recordId={record.id} toStatus="in_review" actionType="submitted_for_review" label="Submit for review" mode="draft" />
      ) : null}
      {record.status === "in_review" ? (
        <SimpleTransitionForm recordId={record.id} toStatus="awaiting_approval" actionType="reviewed" label="Move to approval" mode="review" />
      ) : null}
      {record.status === "awaiting_approval" ? <ApprovalForm recordId={record.id} /> : null}
      {record.status === "awaiting_signature" ? <SignatureForm recordId={record.id} /> : null}
      {record.status === "signed" ? (
        <SimpleTransitionForm recordId={record.id} toStatus="ready_for_dispatch" actionType="ready_for_dispatch" label="Mark ready for dispatch" mode="dispatch" />
      ) : null}
      {record.status === "ready_for_dispatch" || record.status === "dispatch_failed" ? <DispatchForm recordId={record.id} /> : null}
      {record.status === "sent" ? (
        <SimpleTransitionForm recordId={record.id} toStatus="delivered" actionType="delivery_recorded" label="Record delivery" mode="dispatch" />
      ) : null}
      {record.status === "delivered" || record.status === "acknowledged" || record.status === "response_received" ? (
        <SimpleTransitionForm recordId={record.id} toStatus="closed" actionType="closed" label="Close record" mode="administer" />
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>;
}

function CompactList({ rows, empty }: { rows: { id: string; title: string; meta: string }[]; empty: string }) {
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-black text-slate-950">{row.title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{row.meta}</p>
        </article>
      ))}
    </div>
  );
}

function DeliveryHistory({
  recordId,
  dispatches,
  evidence,
}: {
  recordId: string;
  dispatches: NonNullable<LcdboCorrespondenceRecord["dispatches"]>;
  evidence: NonNullable<LcdboCorrespondenceRecord["delivery_evidence"]>;
}) {
  if (!dispatches.length && !evidence.length) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No dispatch or delivery evidence has been recorded.</p>;
  }
  return (
    <div className="space-y-3">
      {dispatches.map((dispatch) => (
        <article key={dispatch.id} className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-black text-slate-950">{dispatch.dispatch_channel} · {dispatch.tracking_number}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{dispatch.status} · {new Date(dispatch.dispatched_at).toLocaleString()}</p>
        </article>
      ))}
      {evidence.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{item.evidence_type.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{[item.receiving_person, item.delivery_note, item.malware_scan_status].filter(Boolean).join(" · ")}</p>
            </div>
            <StatusBadge status={item.status ?? "active"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.file_path && item.status === "active" ? (
              <Link href={`/api/lcdbo/correspondence/evidence/${item.id}/download`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white">Private download</Link>
            ) : null}
            {item.status === "active" ? (
              <Link href={`/dashboard/correspondence/delivery-evidence?record_id=${recordId}&replace_evidence_id=${item.id}`} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-800">Replace with new version</Link>
            ) : null}
            {item.status === "active" ? (
              <form action={transitionDeliveryEvidenceAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${recordId}`} />
                <input type="hidden" name="evidence_id" value={item.id} />
                <input name="note" placeholder="Invalidation note" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" />
                <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-700">Invalidate</button>
              </form>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function SimpleTransitionForm({ recordId, toStatus, actionType, label, mode }: { recordId: string; toStatus: string; actionType: string; label: string; mode: string }) {
  return (
    <form action={transitionCorrespondenceAction} className="rounded-2xl border border-slate-200 p-3">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${recordId}`} />
      <input type="hidden" name="to_status" value={toStatus} />
      <input type="hidden" name="action_type" value={actionType} />
      <input type="hidden" name="mode" value={mode} />
      <label className="text-xs font-bold text-slate-600">Note<textarea name="note" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
      <div className="mt-3"><SubmitButton>{label}</SubmitButton></div>
    </form>
  );
}

function ApprovalForm({ recordId }: { recordId: string }) {
  return (
    <form action={approveCorrespondenceAction} className="rounded-2xl border border-slate-200 p-3">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${recordId}`} />
      <label className="text-xs font-bold text-slate-600">Approval role<select name="approval_role" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="joint_secretariat">Joint secretariat</option><option value="rmrdc_reviewer">RMRDC reviewer</option><option value="roseate_reviewer">Roseate reviewer</option></select></label>
      <label className="mt-2 block text-xs font-bold text-slate-600">Decision<select name="decision" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="approved">Approve</option><option value="revision_requested">Request revision</option><option value="rejected">Reject</option></select></label>
      <label className="mt-2 block text-xs font-bold text-slate-600">Note<textarea name="note" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
      <div className="mt-3"><SubmitButton>Record decision</SubmitButton></div>
    </form>
  );
}

function SignatureForm({ recordId }: { recordId: string }) {
  return (
    <form action={signCorrespondenceAction} className="rounded-2xl border border-slate-200 p-3">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${recordId}`} />
      <label className="text-xs font-bold text-slate-600">Signature authority<select name="signature_role" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="signatory_delegate">Delegated signatory</option><option value="rmrdc_signatory">RMRDC signatory</option><option value="roseate_signatory">Roseate signatory</option></select></label>
      <p className="mt-2 text-xs leading-5 text-slate-500">The server records a protected signature event. Raw signature files are never exposed publicly.</p>
      <div className="mt-3"><SubmitButton>Record protected signature</SubmitButton></div>
    </form>
  );
}

function DispatchForm({ recordId }: { recordId: string }) {
  return (
    <form action={dispatchCorrespondenceAction} className="rounded-2xl border border-slate-200 p-3">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${recordId}`} />
      <label className="text-xs font-bold text-slate-600">Channel<select name="dispatch_channel" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="email">Email</option><option value="courier">Courier</option><option value="hand_delivery">Hand delivery</option><option value="official_portal">Official portal</option></select></label>
      <label className="mt-2 block text-xs font-bold text-slate-600">Provider/courier tracking identifier<input name="tracking_number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
      <p className="mt-1 text-xs leading-5 text-slate-500">The LCDBO reference is the permanent correspondence tracking number. Add a provider or courier identifier only when the channel supplies one.</p>
      <label className="mt-2 block text-xs font-bold text-slate-600">Dispatch note<textarea name="note" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
      <div className="mt-3"><SubmitButton>Record dispatch</SubmitButton></div>
    </form>
  );
}
