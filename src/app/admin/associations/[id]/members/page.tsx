import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeInviteExpiry, generateInviteToken, sendActivationInvite } from "@/lib/associations/invites";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function profileCompletionStatus(msme: {
  passport_photo_url?: string | null;
  sector?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  state?: string | null;
}) {
  const checks = [
    Boolean(msme.passport_photo_url),
    Boolean(msme.sector),
    Boolean(msme.contact_email || msme.contact_phone),
    Boolean(msme.state),
  ];

  const score = checks.filter(Boolean).length;
  if (score === checks.length) return "COMPLETE";
  if (score >= 2) return "PARTIAL";
  return "INCOMPLETE";
}

async function resendInviteAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const associationId = String(formData.get("association_id") ?? "");
  const memberId = String(formData.get("member_id") ?? "");

  const supabase = await createServerSupabaseClient();
  const { data: member } = await supabase
    .from("association_members")
    .select("id,invite_token,invite_expires_at,msmes(contact_email)")
    .eq("id", memberId)
    .eq("association_id", associationId)
    .maybeSingle();

  if (!member?.id) redirect(`/admin/associations/${associationId}/members?error=member_not_found`);

  const email = (member.msmes as { contact_email?: string | null } | null)?.contact_email;
  if (!email) redirect(`/admin/associations/${associationId}/members?error=missing_email`);

  const now = new Date();
  const existingTokenValid = Boolean(
    member.invite_token
      && member.invite_expires_at
      && new Date(member.invite_expires_at).getTime() > now.getTime(),
  );

  const token = existingTokenValid ? member.invite_token : generateInviteToken();
  const inviteSentAt = now.toISOString();
  const inviteExpiresAt = existingTokenValid ? member.invite_expires_at : computeInviteExpiry(now);

  await supabase
    .from("association_members")
    .update({
      invite_token: token,
      invite_status: "INVITED",
      invite_sent_at: inviteSentAt,
      invite_expires_at: inviteExpiresAt,
    })
    .eq("id", memberId);

  const sent = await sendActivationInvite({ email, token });

  if (!sent.ok) {
    await supabase.from("association_members").update({ invite_status: "FAILED" }).eq("id", memberId);
  }

  revalidatePath(`/admin/associations/${associationId}/members`);
  redirect(`/admin/associations/${associationId}/members?resent=1`);
}

export default async function AdminAssociationMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; resent?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const statusFilter = query.status?.toUpperCase();

  const supabase = await createServerSupabaseClient();
  let queryBuilder = supabase
    .from("association_members")
    .select("id,invite_status,invite_sent_at,activated_at,msmes(id,business_name,owner_name,contact_email,contact_phone,passport_photo_url,sector,state)")
    .eq("association_id", id)
    .order("created_at", { ascending: false });

  if (statusFilter && ["INVITED", "ACTIVATED", "FAILED", "ALREADY_EXISTS"].includes(statusFilter)) {
    queryBuilder = queryBuilder.eq("invite_status", statusFilter);
  }

  const { data: rows } = await queryBuilder;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Association members</h1>
      {query.resent && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Invite resent successfully.</p>}

      <form className="flex gap-2 text-sm">
        <select name="status" defaultValue={query.status ?? ""} className="rounded border px-2 py-2">
          <option value="">All statuses</option>
          <option value="INVITED">INVITED</option>
          <option value="ACTIVATED">ACTIVATED</option>
          <option value="FAILED">FAILED</option>
          <option value="ALREADY_EXISTS">ALREADY_EXISTS</option>
        </select>
        <button className="rounded border px-2 py-2">Apply filter</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Invite status</th>
              <th className="px-3 py-2">Activation status</th>
              <th className="px-3 py-2">Profile completion</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => {
              const msmeRaw = row.msmes as {
                id: string;
                business_name: string;
                owner_name: string;
                contact_email: string | null;
                contact_phone: string | null;
                passport_photo_url: string | null;
                sector: string | null;
                state: string | null;
              } | Array<{
                id: string;
                business_name: string;
                owner_name: string;
                contact_email: string | null;
                contact_phone: string | null;
                passport_photo_url: string | null;
                sector: string | null;
                state: string | null;
              }> | null;
              const msme = Array.isArray(msmeRaw) ? msmeRaw[0] : msmeRaw;

              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">{msme?.business_name ?? "-"}</td>
                  <td className="px-3 py-2">{msme?.owner_name ?? "-"}</td>
                  <td className="px-3 py-2">{msme?.contact_email ?? "-"}</td>
                  <td className="px-3 py-2">{msme?.contact_phone ?? "-"}</td>
                  <td className="px-3 py-2">{row.invite_status ?? "INVITED"}</td>
                  <td className="px-3 py-2">{row.activated_at ? "ACTIVATED" : "PENDING"}</td>
                  <td className="px-3 py-2">{profileCompletionStatus(msme ?? {})}</td>
                  <td className="px-3 py-2">
                    <form action={resendInviteAction}>
                      <input type="hidden" name="association_id" value={id} />
                      <input type="hidden" name="member_id" value={row.id} />
                      <button className="rounded border px-2 py-1 text-xs">Resend invite</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
