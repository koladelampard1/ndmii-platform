import { resolveOrCreateUserProfile } from "@/lib/auth/profile";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { computeInviteExpiry, generateInviteToken, sendActivationInvite } from "@/lib/associations/invites";

type BulkRow = {
  business_name: string;
  owner_full_name: string;
  phone: string;
  email: string;
  category: string;
  subcategory?: string;
  location: string;
  association_member_id?: string;
  cac_number?: string;
  tin?: string;
  address?: string;
};

export type BulkProcessResult = {
  total: number;
  invited: number;
  activated: number;
  failed: number;
  alreadyExists: number;
  details: Array<{
    email: string;
    status: "INVITED" | "FAILED" | "ALREADY_EXISTS";
    message: string;
  }>;
};

function randomSeedPassword() {
  return `Ndmii!${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function processAssociationBulkRows({
  associationId,
  uploadedBy,
  rows,
}: {
  associationId: string;
  uploadedBy: string | null;
  rows: BulkRow[];
}): Promise<BulkProcessResult> {
  const supabase = await createServiceRoleSupabaseClient();

  let invited = 0;
  let failed = 0;
  let alreadyExists = 0;
  const details: BulkProcessResult["details"] = [];

  for (const row of rows) {
    const normalizedEmail = row.email.trim().toLowerCase();
    const normalizedPhone = row.phone.trim();

    try {
      const { data: existingMsmeByEmail } = await supabase
        .from("msmes")
        .select("id")
        .eq("contact_email", normalizedEmail)
        .maybeSingle();

      const { data: existingMsmeByPhone } = await supabase
        .from("msmes")
        .select("id")
        .eq("contact_phone", normalizedPhone)
        .maybeSingle();

      const duplicateMsmeId = existingMsmeByEmail?.id ?? existingMsmeByPhone?.id ?? null;

      if (duplicateMsmeId) {
        await supabase.from("association_members").upsert(
          {
            association_id: associationId,
            msme_id: duplicateMsmeId,
            role: "MEMBER",
            invite_status: "ALREADY_EXISTS",
          },
          { onConflict: "association_id,msme_id" },
        );

        alreadyExists += 1;
        details.push({ email: normalizedEmail, status: "ALREADY_EXISTS", message: "Existing MSME account linked to association." });
        continue;
      }

      const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: randomSeedPassword(),
        email_confirm: true,
        user_metadata: {
          role: "msme",
          owner_name: row.owner_full_name,
          onboarding_source: "association_bulk_upload",
        },
      });

      if (authError || !authUserData.user?.id) {
        failed += 1;
        details.push({ email: normalizedEmail, status: "FAILED", message: authError?.message ?? "Unable to create auth user." });
        continue;
      }

      const authUserId = authUserData.user.id;
      const profile = await resolveOrCreateUserProfile(supabase, { authUserId, email: normalizedEmail });

      if (!profile?.id) {
        failed += 1;
        details.push({ email: normalizedEmail, status: "FAILED", message: "Unable to resolve app user profile." });
        continue;
      }

      await supabase
        .from("users")
        .update({ full_name: row.owner_full_name, role: "msme", auth_user_id: authUserId })
        .eq("id", profile.id);

      const kycPayload = {
        NIN: "",
        BVN: "",
        CAC: row.cac_number?.trim() ?? "",
        TIN: row.tin?.trim() ?? "",
      } as const;

      const { checks, overallStatus } = await runKycSimulation(kycPayload);

      const { data: msme, error: msmeError } = await supabase
        .from("msmes")
        .insert({
          msme_id: generateMsmeId(row.location),
          association_id: associationId,
          business_name: row.business_name,
          owner_name: row.owner_full_name,
          state: row.location,
          sector: row.category,
          lga: row.subcategory ?? null,
          address: row.address?.trim() || null,
          contact_email: normalizedEmail,
          contact_phone: normalizedPhone,
          cac_number: row.cac_number?.trim() || null,
          tin: row.tin?.trim() || null,
          verification_status: "pending_review",
          review_status: "pending_review",
          created_by: profile.id,
        })
        .select("id")
        .single();

      if (msmeError || !msme?.id) {
        failed += 1;
        details.push({ email: normalizedEmail, status: "FAILED", message: "Unable to create MSME profile." });
        continue;
      }

      await ensureWorkflowRecords(supabase, { msmeId: msme.id, overallStatus, checks });

      const token = generateInviteToken();
      const inviteSentAt = new Date().toISOString();
      const inviteExpiresAt = computeInviteExpiry(new Date(inviteSentAt));

      await supabase.from("association_members").upsert(
        {
          association_id: associationId,
          msme_id: msme.id,
          role: "MEMBER",
          invite_status: "INVITED",
          invite_token: token,
          invite_sent_at: inviteSentAt,
          invite_expires_at: inviteExpiresAt,
          created_by_admin_id: uploadedBy,
        },
        { onConflict: "association_id,msme_id" },
      );

      const inviteResponse = await sendActivationInvite({ email: normalizedEmail, token });

      if (!inviteResponse.ok) {
        await supabase
          .from("association_members")
          .update({ invite_status: "FAILED" })
          .eq("association_id", associationId)
          .eq("msme_id", msme.id);

        failed += 1;
        details.push({ email: normalizedEmail, status: "FAILED", message: "Invite send failed." });
        continue;
      }

      invited += 1;
      details.push({ email: normalizedEmail, status: "INVITED", message: "MSME account created and invite sent." });

      await supabase.from("activity_logs").insert({
        actor_user_id: uploadedBy,
        action: "association_member_bulk_invited",
        entity_type: "association_members",
        entity_id: msme.id,
        metadata: {
          association_id: associationId,
          source: "admin_association_bulk_upload",
        },
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unexpected error";
      details.push({ email: normalizedEmail, status: "FAILED", message });
    }
  }

  return {
    total: rows.length,
    invited,
    activated: 0,
    failed,
    alreadyExists,
    details,
  };
}
