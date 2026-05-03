import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function associationDetailAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const id = String(formData.get("association_id"));
  if (ctx.role === "association_officer" && id !== ctx.linkedAssociationId) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  await supabase.from("associations").update({
    name: String(formData.get("name")),
    sector: String(formData.get("sector_focus") ?? "General"),
    state: String(formData.get("state")),
    lga_coverage: String(formData.get("lga_coverage") ?? ""),
    profile: String(formData.get("profile") ?? ""),
    contact_email: String(formData.get("contact_email") ?? "") || null,
    contact_phone: String(formData.get("contact_phone") ?? "") || null,
    status: String(formData.get("status") ?? "active"),
  }).eq("id", id);

  redirect(`/dashboard/associations/${id}?saved=1`);
}

async function membershipApprovalAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const associationId = String(formData.get("association_id") ?? "");
  const membershipId = String(formData.get("membership_id") ?? "");
  const action = String(formData.get("action") ?? "");

  if (ctx.role === "association_officer" && associationId !== ctx.linkedAssociationId) redirect("/access-denied");
  if (!["approve", "reject"].includes(action)) redirect(`/dashboard/associations/${associationId}`);

  const supabase = await createServerSupabaseClient();
  const { data: membership } = await supabase
    .from("association_memberships")
    .select("id,msme_id,association_id")
    .eq("id", membershipId)
    .eq("association_id", associationId)
    .maybeSingle();

  if (!membership?.id) redirect(`/dashboard/associations/${associationId}`);

  const approved = action === "approve";
  const nowIso = new Date().toISOString();

  await supabase
    .from("association_memberships")
    .update({
      approval_status: approved ? "approved" : "rejected",
      reviewed_by: ctx.appUserId,
      reviewed_at: nowIso,
    })
    .eq("id", membership.id);

  await supabase
    .from("msmes")
    .update({
      verification_status: approved ? "pending_dbin_verification" : "rejected",
      review_status: approved ? "pending_review" : "rejected",
    })
    .eq("id", membership.msme_id);

  await supabase.from("activity_logs").insert({
    actor_user_id: ctx.appUserId,
    action: `association_membership_${action}`,
    entity_type: "association_memberships",
    entity_id: membership.id,
    metadata: {
      association_id: associationId,
      msme_id: membership.msme_id,
      resulting_status: approved ? "pending_dbin_verification" : "rejected",
    },
  });

  revalidatePath(`/dashboard/associations/${associationId}`);
  revalidatePath("/dashboard/reviews");
  redirect(`/dashboard/associations/${associationId}?membership=${action}`);
}

export default async function AssociationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; membership?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  if (ctx.role === "association_officer" && id !== ctx.linkedAssociationId) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const [{ data: association }, { data: members }, { data: pendingMemberships }] = await Promise.all([
    supabase.from("associations").select("id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone").eq("id", id).maybeSingle(),
    supabase
      .from("msmes")
      .select("id,msme_id,business_name,state,sector,verification_status")
      .eq("association_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("association_memberships")
      .select("id,membership_type,approval_status,user_id,created_at,msmes(business_name,msme_id)")
      .eq("association_id", id)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  if (!association) return <main className="rounded border bg-white p-6">Association not found.</main>;

  const pendingUserIds = Array.from(new Set((pendingMemberships ?? []).map((membership: any) => membership.user_id).filter(Boolean)));
  const { data: pendingUsers } = pendingUserIds.length
    ? await supabase.from("users").select("id,email,full_name").in("id", pendingUserIds)
    : { data: [] };
  const pendingUserMap = new Map((pendingUsers ?? []).map((user) => [user.id, user]));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Association Details</h1>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Association profile updated.</p>}
      {query.membership && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Membership request {query.membership === "approve" ? "approved" : "rejected"}.</p>}

      <form action={associationDetailAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <input type="hidden" name="association_id" value={association.id} />
        <input name="name" defaultValue={association.name} className="rounded border px-2 py-2 text-sm" />
        <input name="sector_focus" defaultValue={association.sector} className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={association.state} className="rounded border px-2 py-2 text-sm" />
        <input name="lga_coverage" defaultValue={association.lga_coverage ?? ""} className="rounded border px-2 py-2 text-sm" />
        <input name="contact_email" defaultValue={association.contact_email ?? ""} className="rounded border px-2 py-2 text-sm" />
        <input name="contact_phone" defaultValue={association.contact_phone ?? ""} className="rounded border px-2 py-2 text-sm" />
        <select name="status" defaultValue={association.status ?? "active"} className="rounded border px-2 py-2 text-sm"><option>active</option><option>inactive</option><option>under review</option></select>
        <input name="profile" defaultValue={association.profile ?? ""} className="rounded border px-2 py-2 text-sm md:col-span-3" />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save association details</button>
      </form>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Pending Members ({(pendingMemberships ?? []).length})</h2>
        <div className="mt-3 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(pendingMemberships ?? []).length === 0 && (
                <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={4}>No pending member approvals.</td></tr>
              )}
              {(pendingMemberships ?? []).map((membership: any) => (
                <tr key={membership.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium">{membership.msmes?.business_name ?? "Business record"}</p>
                    <p className="text-xs text-slate-500">{membership.msmes?.msme_id ?? "ID pending"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{pendingUserMap.get(membership.user_id)?.full_name ?? "MSME user"}</p>
                    <p className="text-xs text-slate-500">{pendingUserMap.get(membership.user_id)?.email ?? "No email"}</p>
                  </td>
                  <td className="px-3 py-2">{String(membership.membership_type).replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">
                    <form action={membershipApprovalAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="association_id" value={association.id} />
                      <input type="hidden" name="membership_id" value={membership.id} />
                      <button name="action" value="approve" className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white">Approve</button>
                      <button name="action" value="reject" className="rounded border px-3 py-1.5 text-xs font-medium">Reject</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Member coverage ({(members ?? []).length})</h2>
        <div className="mt-2 space-y-2 text-sm">
          {(members ?? []).map((member) => (
            <p key={member.id} className="rounded border p-2">{member.business_name} • {member.msme_id} • {member.verification_status ?? "pending_review"}</p>
          ))}
          {(members ?? []).length === 0 && <p className="text-slate-500">No linked members yet.</p>}
        </div>
      </article>
    </section>
  );
}
