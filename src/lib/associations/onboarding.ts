import { resolveOrCreateUserProfile } from "@/lib/auth/profile";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { computeInviteExpiry, generateInviteToken, sendActivationInvite } from "@/lib/associations/invites";
import crypto from "node:crypto";

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
  return `Ndmii!${crypto.randomBytes(12).toString("base64url")}`;
}

async function findAuthUserIdByEmail(supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>, email: string) {
  const { data: usersResponse, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  const match = usersResponse.users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function ensureMsmeAuthProfile({
  supabase,
  email,
  ownerName,
}: {
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>;
  email: string;
  ownerName: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingProfile } = await supabase
    .from("users")
    .select("id,auth_user_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  let authUserId = existingProfile?.auth_user_id ?? null;

  if (!authUserId) {
    const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: randomSeedPassword(),
      email_confirm: true,
      user_metadata: {
        role: "msme",
        owner_name: ownerName,
        onboarding_source: "association_bulk_upload",
      },
    });

    authUserId = authUserData.user?.id ?? null;

    if (!authUserId) {
      const authErrorMessage = authError?.message ?? "";
      const alreadyExistsError = authErrorMessage.toLowerCase().includes("already");
      if (!alreadyExistsError) return { ok: false as const, error: authError?.message ?? "Unable to create auth user." };
      authUserId = await findAuthUserIdByEmail(supabase, normalizedEmail);
    }
  }

  if (!authUserId) return { ok: false as const, error: "Unable to resolve auth user for email." };

  const profile = await resolveOrCreateUserProfile(supabase, { authUserId, email: normalizedEmail });
  if (!profile?.id) return { ok: false as const, error: "Unable to resolve app user profile." };

  await supabase
    .from("users")
    .update({ full_name: ownerName, role: "msme", auth_user_id: authUserId })
    .eq("id", profile.id);

  return { ok: true as const, profileId: profile.id };
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
        .select("id,owner_name,contact_email,created_by")
        .eq("contact_email", normalizedEmail)
        .maybeSingle();

      const { data: existingMsmeByPhone } = await supabase
        .from("msmes")
        .select("id,owner_name,contact_email,created_by")
        .eq("contact_phone", normalizedPhone)
        .maybeSingle();

      const duplicateMsme = existingMsmeByEmail ?? existingMsmeByPhone ?? null;
      const duplicateMsmeId = duplicateMsme?.id ?? null;

      if (duplicateMsmeId) {
        const existingMsme = duplicateMsme;
        if (!existingMsme) {
          failed += 1;
          details.push({ email: normalizedEmail, status: "FAILED", message: "Unable to resolve existing MSME row." });
          continue;
        }

        const account = await ensureMsmeAuthProfile({
          supabase,
          email: existingMsme.contact_email ?? normalizedEmail,
          ownerName: existingMsme.owner_name ?? row.owner_full_name,
        });

        if (!account.ok) {
          failed += 1;
          details.push({ email: normalizedEmail, status: "FAILED", message: account.error });
          continue;
        }

        if (!existingMsme.created_by) {
          await supabase.from("msmes").update({ created_by: account.profileId }).eq("id", duplicateMsmeId);
        }

        const { error: memberUpsertError } = await supabase.from("association_members").upsert(
          {
            association_id: associationId,
            msme_id: duplicateMsmeId,
            role: "MEMBER",
            invite_status: "ALREADY_EXISTS",
            created_by_admin_id: uploadedBy,
          },
          { onConflict: "association_id,msme_id" },
        );
        if (memberUpsertError) {
          failed += 1;
          details.push({ email: normalizedEmail, status: "FAILED", message: "Unable to link existing MSME to association members." });
          continue;
        }

        alreadyExists += 1;
        details.push({ email: normalizedEmail, status: "ALREADY_EXISTS", message: "Existing MSME account linked to association." });
        continue;
      }

      const account = await ensureMsmeAuthProfile({
        supabase,
        email: normalizedEmail,
        ownerName: row.owner_full_name,
      });

      if (!account.ok) {
        failed += 1;
        details.push({ email: normalizedEmail, status: "FAILED", message: account.error });
        continue;
      }

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
          created_by: account.profileId,
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

      const { error: memberUpsertError } = await supabase.from("association_members").upsert(
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
      if (memberUpsertError) {
        failed += 1;
        details.push({ email: normalizedEmail, status: "FAILED", message: "Unable to create association member invite record." });
        continue;
      }

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
