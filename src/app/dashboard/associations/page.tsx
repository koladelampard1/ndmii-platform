import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";

async function associationAction(formData: FormData) {
  "use server";
  const associationId = String(formData.get("association_id"));
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  if (ctx.role === "association_officer" && associationId !== ctx.linkedAssociationId) redirect("/access-denied");
  const memberId = String(formData.get("member_id") ?? "");
  const kind = String(formData.get("kind"));

  if (kind === "verify_member") {
    await supabase.from("association_members").update({ is_verified: true, member_status: "active" }).eq("id", memberId);
    await logActivity("association_verify_member", "association_member", memberId, { associationId });
  }

  if (kind === "invite_member") {
    const msmeId = String(formData.get("msme_id"));
    await supabase.from("association_members").insert({ association_id: associationId, msme_id: msmeId, member_status: "invited", is_verified: false });
    await logActivity("association_invite_member", "association", associationId, { msmeId });
  }

  if (kind === "update_details") {
    const profile = String(formData.get("profile") ?? "");
    const lgaCoverage = String(formData.get("lga_coverage") ?? "");
    await supabase.from("associations").update({ profile, lga_coverage: lgaCoverage }).eq("id", associationId);
    await logActivity("association_update_details", "association", associationId, { lgaCoverage });
  }

  redirect("/dashboard/associations?saved=1");
}

export default async function AssociationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const associationQuery = supabase.from("associations").select("id,name,state,sector,lga_coverage,profile");
  const msmeQuery = supabase.from("msmes").select("id,msme_id,business_name,association_id").limit(80);

  const [{ data: associations }, { data: msmes }] = await Promise.all([
    ctx.role === "association_officer" ? associationQuery.eq("id", ctx.linkedAssociationId ?? "") : associationQuery,
    ctx.role === "association_officer" ? msmeQuery.eq("association_id", ctx.linkedAssociationId ?? "") : msmeQuery,
  ]);

  const memberMap = new Map<string, { total: number; verified: number; pending: number; flagged: number; members: any[] }>();
  let membersQuery = supabase
    .from("association_members")
    .select("id,association_id,member_status,is_verified,msmes(msme_id,business_name,flagged)");

  if (ctx.role === "association_officer") {
    membersQuery = membersQuery.eq("association_id", ctx.linkedAssociationId ?? "");
  }

  const { data: members } = await membersQuery;

  (members ?? []).forEach((m) => {
    const prev = memberMap.get(m.association_id) ?? { total: 0, verified: 0, pending: 0, flagged: 0, members: [] };
    prev.total += 1;
    if (m.is_verified) prev.verified += 1;
    if (!m.is_verified) prev.pending += 1;
    if ((m.msmes as any)?.flagged) prev.flagged += 1;
    prev.members.push(m);
    memberMap.set(m.association_id, prev);
  });

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Association Management Console</h1>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Association workflow updated.</p>}
      {(associations ?? []).map((association) => {
        const stats = memberMap.get(association.id) ?? { total: 0, verified: 0, pending: 0, flagged: 0, members: [] };
        const csv = ["MSME ID,Business,Status,Verified"].concat(
          stats.members.map((m) => `${(m.msmes as any)?.msme_id ?? ""},${(m.msmes as any)?.business_name ?? ""},${m.member_status},${m.is_verified}`)
        ).join("\n");
        const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

        return (
          <article key={association.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{association.name}</h2>
                <p className="text-sm text-slate-600">{association.sector} • {association.state} • LGA coverage: {association.lga_coverage ?? "Not specified"}</p>
                <p className="mt-1 text-xs text-slate-500">{association.profile ?? "Association profile pending update."}</p>
              </div>
              <a href={csvHref} download={`${association.name.replaceAll(" ", "-").toLowerCase()}-members.csv`} className="rounded border px-3 py-2 text-xs">Export member list</a>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4 text-sm">
              <div className="rounded border p-2">Total members: <strong>{stats.total}</strong></div>
              <div className="rounded border p-2">Verified members: <strong>{stats.verified}</strong></div>
              <div className="rounded border p-2">Pending members: <strong>{stats.pending}</strong></div>
              <div className="rounded border p-2">Flagged members: <strong>{stats.flagged}</strong></div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <form action={associationAction} className="space-y-2 rounded border p-3">
                <input type="hidden" name="association_id" value={association.id} /><input type="hidden" name="kind" value="invite_member" />
                <p className="text-xs font-medium">Invite member</p>
                <select name="msme_id" className="w-full rounded border px-2 py-1 text-xs">{(msmes ?? []).map((m) => <option key={m.id} value={m.id}>{m.business_name} ({m.msme_id})</option>)}</select>
                <button className="w-full rounded bg-slate-900 px-2 py-1 text-xs text-white">Send invite</button>
              </form>
              <form action={associationAction} className="space-y-2 rounded border p-3 md:col-span-2">
                <input type="hidden" name="association_id" value={association.id} /><input type="hidden" name="kind" value="update_details" />
                <p className="text-xs font-medium">Update association details</p>
                <input name="lga_coverage" defaultValue={association.lga_coverage ?? ""} className="w-full rounded border px-2 py-1 text-xs" placeholder="LGA coverage" />
                <input name="profile" defaultValue={association.profile ?? ""} className="w-full rounded border px-2 py-1 text-xs" placeholder="Association profile" />
                <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Save details</button>
              </form>
            </div>
            <div className="mt-3 overflow-hidden rounded border">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100"><tr><th className="px-2 py-2">Member</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Action</th></tr></thead>
                <tbody>
                  {stats.members.length === 0 && <tr><td className="px-2 py-4 text-center text-slate-500" colSpan={3}>No members linked yet.</td></tr>}
                  {stats.members.map((member) => (
                    <tr key={member.id} className="border-t">
                      <td className="px-2 py-2">{(member.msmes as any)?.business_name} ({(member.msmes as any)?.msme_id})</td>
                      <td className="px-2 py-2">{member.member_status} {member.is_verified ? "• verified" : "• pending"}</td>
                      <td className="px-2 py-2">
                        <form action={associationAction}>
                          <input type="hidden" name="association_id" value={association.id} /><input type="hidden" name="member_id" value={member.id} /><input type="hidden" name="kind" value="verify_member" />
                          <button className="rounded border px-2 py-1">Verify member association</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </section>
  );
}
