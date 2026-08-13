import { recordDeliveryEvidenceAction } from "@/app/dashboard/correspondence/actions";
import { CorrespondenceTable, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceRecord, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceDeliveryEvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireLcdboCorrespondenceAccess("dispatch");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const selectedRecordId = typeof params.record_id === "string" ? params.record_id : null;
  const replaceEvidenceId = typeof params.replace_evidence_id === "string" ? params.replace_evidence_id : null;
  const selectedRecord = selectedRecordId ? await getCorrespondenceRecord(selectedRecordId, supabase) : null;
  const evidenceBeingReplaced = replaceEvidenceId
    ? selectedRecord?.delivery_evidence?.find((evidence) => evidence.id === replaceEvidenceId)
    : null;
  const eligibleRecords = snapshot.records.filter((record) => ["sent", "delivery_failed", "delivered", "acknowledged"].includes(record.status));
  return (
    <div className="space-y-6">
      <WorkspaceCard title="Record delivery evidence" description="Capture delivery notes, acknowledgements, receipt references or private storage file references against an issued dispatch.">
        {selectedRecord?.dispatches?.length ? (
          <form action={recordDeliveryEvidenceAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value={`/dashboard/correspondence/${selectedRecord.id}`} />
            <input type="hidden" name="record_id" value={selectedRecord.id} />
            {evidenceBeingReplaced ? <input type="hidden" name="supersedes_evidence_id" value={evidenceBeingReplaced.id} /> : null}
            {evidenceBeingReplaced ? (
              <div className="md:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                You are replacing an active evidence record. The previous evidence will be marked superseded and retained for audit history; no file or record is silently overwritten.
              </div>
            ) : null}
            <label className="text-sm font-bold text-slate-700">Dispatch<select name="dispatch_event_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{selectedRecord.dispatches.map((dispatch) => <option key={dispatch.id} value={dispatch.id}>{dispatch.dispatch_channel} · {dispatch.tracking_number}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Evidence type<select name="evidence_type" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="delivery_note">Delivery note</option><option value="acknowledgement">Acknowledgement</option><option value="receipt">Receipt</option><option value="failure_notice">Failure notice</option><option value="waybill">Waybill</option><option value="other">Other</option></select></label>
            <label className="text-sm font-bold text-slate-700">Record status<select name="record_status" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="delivered">Delivered</option><option value="acknowledged">Acknowledged</option></select></label>
            <label className="text-sm font-bold text-slate-700">Receiving person<input name="receiving_person" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Upload supporting evidence<input name="evidence_file" type="file" accept="application/pdf,image/png,image/jpeg,text/plain" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Private file path<input name="file_path" placeholder="lcdbo-correspondence-documents/..." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">File hash<input name="file_hash" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Delivery note<textarea name="delivery_note" rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><SubmitButton>Record evidence</SubmitButton></div>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">Select an issued record with dispatch history below to capture delivery evidence.</div>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Issued records" description="Choose an issued correspondence item for delivery, failure or acknowledgement evidence.">
        <CorrespondenceTable records={eligibleRecords} />
      </WorkspaceCard>
    </div>
  );
}
