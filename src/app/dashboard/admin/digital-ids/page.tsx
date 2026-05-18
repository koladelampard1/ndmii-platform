import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/data/authorization-scope";
import { approveCredential, reissueCredentialToken, revokeCredential, suspendCredential } from "@/lib/data/credential-trust";

async function credentialAction(formData: FormData) {
  "use server";

  const ctx = await requireRole(["admin", "reviewer"]);
  const supabase = await createServerSupabaseClient();
  const credentialId = String(formData.get("credential_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const { data: credential } = await supabase
    .from("digital_identity_credentials")
    .select("id,msme_id,ndmii_id,validation_snapshot")
    .eq("id", credentialId)
    .maybeSingle();

  if (!credential?.id) return;

  if (action === "approve") {
    await supabase.from("msmes").update({ review_status: "approved", verification_status: "verified" }).eq("id", credential.msme_id);
    await approveCredential(supabase, {
      msmeId: credential.msme_id,
      ndmiiId: credential.ndmii_id,
      actor: ctx,
      validationSnapshot: (credential.validation_snapshot as Record<string, unknown> | null) ?? undefined,
    });
  }

  if (action === "suspend") {
    await suspendCredential(supabase, { credentialId, actor: ctx, reason });
  }

  if (action === "revoke") {
    await revokeCredential(supabase, { credentialId, actor: ctx, reason });
  }

  if (action === "reissue") {
    await reissueCredentialToken(supabase, { credentialId, actor: ctx });
  }

  revalidatePath("/dashboard/admin/digital-ids");
  revalidatePath("/dashboard/msme/id-card");
  revalidatePath("/verify");
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

export default async function AdminDigitalIdsPage() {
  await requireRole(["admin", "reviewer"]);
  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("digital_identity_credentials")
    .select("id,ndmii_id,status,issued_at,approved_at,revoked_at,suspended_at,token_expires_at,qr_code_ref,msmes(id,msme_id,business_name,review_status,verification_status)")
    .order("updated_at", { ascending: false })
    .limit(250);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Digital Identity Credentials</h1>
        <p className="text-sm text-slate-600">Approve, suspend, revoke, regenerate tokens, and reissue QR verification links.</p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Credential</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Lifecycle</th>
              <th className="px-3 py-2">Controls</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 && (
              <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No credentials have been issued.</td></tr>
            )}
            {(rows ?? []).map((row: any) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{row.ndmii_id}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{row.qr_code_ref ?? "QR pending"}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{row.msmes?.business_name ?? "Unknown business"}</p>
                  <p className="text-xs text-slate-500">{row.msmes?.msme_id ?? row.msme_id}</p>
                  <p className="text-xs text-slate-500">Review: {row.msmes?.review_status ?? "unknown"}</p>
                </td>
                <td className="px-3 py-2 capitalize">{row.status}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  <p>Issued: {formatDate(row.issued_at)}</p>
                  <p>Approved: {formatDate(row.approved_at)}</p>
                  <p>Expires: {formatDate(row.token_expires_at)}</p>
                  <p>Suspended: {formatDate(row.suspended_at)}</p>
                  <p>Revoked: {formatDate(row.revoked_at)}</p>
                </td>
                <td className="px-3 py-2">
                  <form action={credentialAction} className="space-y-2">
                    <input type="hidden" name="credential_id" value={row.id} />
                    <input name="reason" placeholder="Reason for suspend/revoke" className="w-full rounded border px-2 py-1 text-xs" />
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" name="action" value="approve">Approve</Button>
                      <Button size="sm" variant="secondary" name="action" value="suspend">Suspend</Button>
                      <Button size="sm" variant="secondary" name="action" value="revoke">Revoke</Button>
                      <Button size="sm" variant="secondary" name="action" value="reissue">Regenerate token</Button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
