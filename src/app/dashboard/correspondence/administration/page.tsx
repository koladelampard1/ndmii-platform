import { generateReminderJobsAction } from "@/app/dashboard/correspondence/actions";
import { SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceAdministrationPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("administer");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const pendingJobs = snapshot.jobs.filter((job) => job.status === "pending");
  return (
    <div className="space-y-6">
      <WorkspaceCard title="Administration" description="Manage governance settings, reminders, delegations, records administration and controlled exports.">
        <ul className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <li className="rounded-2xl border border-slate-200 p-4"><strong>Reference policy:</strong> LCDBO/Issuer/Year/Direction/Sequence, generated server-side.</li>
          <li className="rounded-2xl border border-slate-200 p-4"><strong>Signature policy:</strong> protected server-side signature event, no public raw assets.</li>
          <li className="rounded-2xl border border-slate-200 p-4"><strong>Issuance rule:</strong> approval, signature and dispatch tracking are mandatory.</li>
          <li className="rounded-2xl border border-slate-200 p-4"><strong>Email adapter:</strong> deterministic adapter is available for controlled UAT; production email fails closed until approved credentials are configured.</li>
        </ul>
      </WorkspaceCard>

      <WorkspaceCard title="Reminder and escalation jobs" description="Generate idempotent reminders for review, approval, signature, delivery failure and response obligations.">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-black text-slate-950">{pendingJobs.length}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Pending jobs</p>
          </div>
          <form action={generateReminderJobsAction}>
            <input type="hidden" name="redirect_to" value="/dashboard/correspondence/administration" />
            <SubmitButton>Generate reminder jobs</SubmitButton>
          </form>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {snapshot.jobs.slice(0, 10).map((job) => (
            <article key={job.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-950">{job.job_type.replaceAll("_", " ")}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">{job.status}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{job.idempotency_key}</p>
            </article>
          ))}
        </div>
      </WorkspaceCard>
    </div>
  );
}
