import { sendEmailDispatchAction } from "@/app/dashboard/correspondence/actions";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceDispatchPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("dispatch");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const dispatchable = snapshot.records.filter((record) => ["signed", "ready_for_dispatch", "dispatch_failed"].includes(record.status));
  return (
    <div className="space-y-6">
      <WorkspaceCard title="Email dispatch attempt" description="Record a deterministic UAT email dispatch attempt or fail closed when production email credentials are intentionally not configured.">
        <form action={sendEmailDispatchAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="redirect_to" value="/dashboard/correspondence/dispatch" />
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Correspondence<select name="record_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{dispatchable.map((record) => <option key={record.id} value={record.id}>{record.reference} · {record.subject}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Sender<input name="sender_identity" defaultValue="LCDBO Joint Secretariat" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700">To<input name="to_recipients" type="email" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Subject<input name="subject" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-3">Body<textarea name="body" required rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <div className="md:col-span-3"><SubmitButton>Record email attempt</SubmitButton></div>
        </form>
      </WorkspaceCard>
      <WorkspaceCard title="Dispatch queue" description="Signed records awaiting dispatch tracking and official issuance."><CorrespondenceTable records={dispatchable} /></WorkspaceCard>
    </div>
  );
}
