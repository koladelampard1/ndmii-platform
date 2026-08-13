import { recordResponseAction, updateResponseExpectationAction } from "@/app/dashboard/correspondence/actions";
import { CorrespondenceTable, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceResponsesPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const responseRequired = snapshot.records.filter((record) => record.response_required);
  return (
    <div className="space-y-6">
      <WorkspaceCard title="Record response" description="Log inbound responses and close response obligations while preserving the correspondence history.">
        <form action={recordResponseAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="redirect_to" value="/dashboard/correspondence/responses" />
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Correspondence<select name="record_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{responseRequired.map((record) => <option key={record.id} value={record.id}>{record.reference} · {record.subject}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Response channel<select name="response_channel" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="manual_register">Manual register</option><option value="email">Email</option><option value="official_portal">Official portal</option><option value="courier">Courier</option></select></label>
          <label className="text-sm font-bold text-slate-700">Response reference<input name="response_reference" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Private document path<input name="response_document_path" placeholder="lcdbo-correspondence-documents/..." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-3">Response summary<textarea name="response_summary" required rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <div className="md:col-span-3"><SubmitButton>Record response</SubmitButton></div>
        </form>
      </WorkspaceCard>
      <WorkspaceCard title="Response expectation" description="Assign a response owner, set a deadline or waive the response requirement with a recorded reason.">
        <form action={updateResponseExpectationAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="redirect_to" value="/dashboard/correspondence/responses" />
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Correspondence<select name="record_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{snapshot.records.map((record) => <option key={record.id} value={record.id}>{record.reference} · {record.subject}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Action<select name="response_action" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="require">Require response</option><option value="waive">Waive response</option></select></label>
          <label className="text-sm font-bold text-slate-700">Owner<select name="owner_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Keep current owner</option>{snapshot.users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Response deadline<input name="response_due_at" type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-3">Reason<textarea name="reason" required rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <div className="md:col-span-3"><SubmitButton>Update expectation</SubmitButton></div>
        </form>
      </WorkspaceCard>
      <WorkspaceCard title="Response tracking" description="Response-required correspondence, due dates, overdue items, acknowledgements and closure workflow."><CorrespondenceTable records={responseRequired} /></WorkspaceCard>
    </div>
  );
}
