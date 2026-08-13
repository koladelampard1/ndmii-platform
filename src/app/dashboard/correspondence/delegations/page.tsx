import { saveCorrespondenceDelegationAction, transitionCorrespondenceDelegationAction } from "@/app/dashboard/correspondence/actions";
import { StatusBadge, SubmitButton, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceDelegationsPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("administer");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  return (
    <div className="space-y-6">
      <WorkspaceCard title="Create signatory delegation" description="Configure temporary signatory delegations with expiry, role, reason and audit trail.">
        <form action={saveCorrespondenceDelegationAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="redirect_to" value="/dashboard/correspondence/delegations" />
          <label className="text-sm font-bold text-slate-700">Delegator<select name="delegator_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{snapshot.users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Delegate<select name="delegate_id" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{snapshot.users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Delegation role<select name="delegation_role" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="joint_signatory">Joint signatory</option><option value="rmrdc_signatory">RMRDC signatory</option><option value="roseate_signatory">Roseate signatory</option></select></label>
          <label className="text-sm font-bold text-slate-700">Organisation<input name="organisation" placeholder="RMRDC / Roseate Forte / Joint Secretariat" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700">Starts at<input name="starts_at" type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700">Expires at<input name="expires_at" type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-3">Reason<textarea name="reason" required rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
          <div className="md:col-span-3"><SubmitButton>Save delegation</SubmitButton></div>
        </form>
      </WorkspaceCard>

      <WorkspaceCard title="Active and historical delegations" description="Expired or cross-organisation delegations are rejected by the protected signing service.">
        {snapshot.delegations.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.delegations.map((delegation) => (
              <article key={delegation.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-slate-950">{delegation.delegation_role.replaceAll("_", " ")}</h2>
                    <p className="mt-1 text-sm text-slate-600">{delegation.delegator?.full_name ?? "Delegator"} → {delegation.delegate?.full_name ?? "Delegate"}</p>
                  </div>
                  <StatusBadge status={delegation.status} />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">Valid from {new Date(delegation.starts_at).toLocaleString()} {delegation.expires_at ? `until ${new Date(delegation.expires_at).toLocaleString()}` : "with no expiry"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["approve", "revoke", "expire"].map((action) => (
                    <form key={action} action={transitionCorrespondenceDelegationAction}>
                      <input type="hidden" name="redirect_to" value="/dashboard/correspondence/delegations" />
                      <input type="hidden" name="delegation_id" value={delegation.id} />
                      <input type="hidden" name="delegation_action" value={action} />
                      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black capitalize text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800">{action}</button>
                    </form>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No signatory delegations have been configured.</div>
        )}
      </WorkspaceCard>
    </div>
  );
}
