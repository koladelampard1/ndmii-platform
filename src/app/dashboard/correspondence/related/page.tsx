import { createRelationshipAction } from "@/app/dashboard/correspondence/actions";
import { CorrespondenceTable, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceRelatedPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return (
    <div className="space-y-6">
      <WorkspaceCard title="Link correspondence" description="Connect incoming responses, outgoing replies, follow-ups, supersession records and case history.">
        <form action={createRelationshipAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="redirect_to" value="/dashboard/correspondence/related" />
          <label className="text-sm font-bold text-slate-700">Source record<select name="source_record_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{snapshot.records.map((record) => <option key={record.id} value={record.id}>{record.reference}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Target record<select name="target_record_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{snapshot.records.map((record) => <option key={record.id} value={record.id}>{record.reference}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Relationship<select name="relationship_type" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="related_to">Related to</option><option value="response_to">Response to</option><option value="reply_to">Reply to</option><option value="follow_up_to">Follow-up to</option><option value="supersedes">Supersedes</option><option value="acknowledgement_of">Acknowledgement of</option></select></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-3">Note<textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <div className="md:col-span-3"><SubmitButton>Create relationship</SubmitButton></div>
        </form>
      </WorkspaceCard>
      <WorkspaceCard title="Correspondence register" description="Open a record detail page to inspect its relationship history."><CorrespondenceTable records={snapshot.records} /></WorkspaceCard>
    </div>
  );
}
