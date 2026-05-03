import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrCreateUserProfile } from "@/lib/auth/profile";
import { getRegistrationMode, mapRegistrationErrorMessage } from "@/lib/auth/registration";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type RegistrationRequest = {
  email: string;
  password: string;
  business_name: string;
  owner_name: string;
  state: string;
  sector: string;
  business_type?: string;
  contact_phone?: string;
  lga?: string;
  address?: string;
  nin?: string;
  bvn?: string;
  cac_number?: string;
  tin?: string;
  registration_path?: string;
  association_id?: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRegistrationPath(value: unknown) {
  const path = normalizeString(value);
  if (path === "existing_association_member" || path === "new_association_applicant" || path === "independent") return path;
  return "independent";
}

const MSME_PROFILE_COLUMNS = [
  "msme_id",
  "business_name",
  "owner_name",
  "state",
  "sector",
  "contact_email",
  "contact_phone",
  "lga",
  "address",
  "business_type",
  "nin",
  "bvn",
  "cac_number",
  "tin",
  "registration_path",
  "association_id",
  "verification_status",
  "review_status",
  "created_by",
] as const;

const LEGACY_MSME_PROFILE_COLUMNS = [
  "msme_id",
  "business_name",
  "owner_name",
  "state",
  "sector",
  "nin",
  "bvn",
  "cac_number",
  "tin",
  "association_id",
  "verification_status",
  "created_by",
] as const;

async function getTableColumns(supabase: SupabaseClient, tableName: string, probeColumns: readonly string[], fallbackColumns: readonly string[]) {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);

  if (!error) {
    const columns = new Set((data ?? []).map((row) => String(row.column_name)));
    if (columns.size > 0) return columns;
  } else {
    console.error("[register:schema-column-lookup-failed]", {
      tableName,
      error: {
        message: error.message,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      },
    });
  }

  const detectedColumns = new Set<string>();
  for (const column of probeColumns) {
    const { error: probeError } = await supabase.from(tableName).select(column).limit(1);
    if (!probeError) detectedColumns.add(column);
  }

  return detectedColumns.size > 0 ? detectedColumns : new Set(fallbackColumns);
}

function filterPayloadByColumns<T extends Record<string, unknown>>(payload: T, columns: Set<string>) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => columns.has(key)));
}

function describeSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined) {
  if (!error) return "Unknown Supabase error.";

  return [
    error.message,
    error.code ? `code: ${error.code}` : null,
    error.details ? `details: ${error.details}` : null,
    error.hint ? `hint: ${error.hint}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  if (getRegistrationMode() !== "demo") {
    return NextResponse.json({ error: "Admin registration is disabled in production mode." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as RegistrationRequest;
    const email = normalizeString(body.email).toLowerCase();
    const password = normalizeString(body.password);
    const businessName = normalizeString(body.business_name);
    const ownerName = normalizeString(body.owner_name);
    const state = normalizeString(body.state);
    const sector = normalizeString(body.sector);
    const registrationPath = normalizeRegistrationPath(body.registration_path);
    const associationId = normalizeString(body.association_id);
    const requiresAssociation = registrationPath === "existing_association_member" || registrationPath === "new_association_applicant";

    if (!email || !password || !businessName || !ownerName || !state || !sector) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }

    if (requiresAssociation && !associationId) {
      return NextResponse.json({ error: "Please select an MSME association." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password is too weak. Use at least 8 characters." }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabaseClient();

    const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "msme",
        owner_name: ownerName,
      },
    });

    if (authError || !authUserData.user?.id) {
      return NextResponse.json({ error: mapRegistrationErrorMessage(authError?.message ?? "Unable to create auth user.") }, { status: 400 });
    }

    const authUserId = authUserData.user.id;

    const { data: existingUserByEmail, error: existingUserError } = await supabase
      .from("users")
      .select("id,role")
      .eq("email", email)
      .maybeSingle();

    if (existingUserError) {
      return NextResponse.json({ error: "Account created, but profile sync failed. Please contact support for quick recovery." }, { status: 500 });
    }

    if (existingUserByEmail?.role && existingUserByEmail.role !== "msme") {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: "This email is already linked to a non-MSME account. Please use a different email." }, { status: 409 });
    }

    const profile = await resolveOrCreateUserProfile(supabase, {
      authUserId,
      email,
    });

    if (!profile?.id) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: "Account created, but profile sync failed. Please contact support for quick recovery." }, { status: 500 });
    }

    if (profile.full_name !== ownerName || profile.role !== "msme") {
      const { error: profileUpdateError } = await supabase
        .from("users")
        .update({ full_name: ownerName, role: "msme", auth_user_id: authUserId })
        .eq("id", profile.id);

      if (profileUpdateError) {
        await supabase.auth.admin.deleteUser(authUserId);
        return NextResponse.json({ error: "Account created, but profile sync failed. Please contact support for quick recovery." }, { status: 500 });
      }
    }

    const msmePublicId = generateMsmeId(state);
    const kycPayload = {
      NIN: normalizeString(body.nin),
      BVN: normalizeString(body.bvn),
      CAC: normalizeString(body.cac_number),
      TIN: normalizeString(body.tin),
    } as const;

    const { checks, overallStatus } = await runKycSimulation(kycPayload);

    const profilePayload = {
      msme_id: msmePublicId,
      business_name: businessName,
      owner_name: ownerName,
      state,
      sector,
      contact_email: email,
      contact_phone: normalizeString(body.contact_phone),
      lga: normalizeString(body.lga),
      address: normalizeString(body.address),
      business_type: normalizeString(body.business_type),
      nin: kycPayload.NIN,
      bvn: kycPayload.BVN,
      cac_number: kycPayload.CAC,
      tin: kycPayload.TIN,
      registration_path: registrationPath,
      association_id: requiresAssociation ? associationId : null,
      verification_status: requiresAssociation ? "pending_association_approval" : "pending_dbin_verification",
      review_status: "pending_review",
      created_by: profile.id,
    };

    const msmeColumns = await getTableColumns(supabase, "msmes", MSME_PROFILE_COLUMNS, LEGACY_MSME_PROFILE_COLUMNS);
    const payload = filterPayloadByColumns(profilePayload, msmeColumns);
    const payloadKeys = Object.keys(payload);

    const { data: existingMsme } = await supabase
      .from("msmes")
      .select("id,msme_id")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: msme, error: msmeError } = existingMsme?.id
      ? await supabase.from("msmes").update(payload).eq("id", existingMsme.id).select("id,msme_id").single()
      : await supabase.from("msmes").insert(payload).select("id,msme_id").single();

    if (msmeError || !msme?.id) {
      console.error("[register:profile-sync-failed]", {
        error: msmeError
          ? {
              message: msmeError.message,
              code: msmeError.code ?? null,
              details: msmeError.details ?? null,
              hint: msmeError.hint ?? null,
            }
          : "MSME write returned no row.",
        payloadKeys,
        registrationPath,
        associationId: requiresAssociation ? associationId : null,
      });

      return NextResponse.json(
        { error: `Unable to complete MSME registration profile sync. ${describeSupabaseError(msmeError)}` },
        { status: 500 },
      );
    }

    if (requiresAssociation) {
      const membershipType = registrationPath === "existing_association_member" ? "existing_member" : "join_request";
      const { error: membershipError } = await supabase.from("association_memberships").upsert(
        {
          association_id: associationId,
          msme_id: msme.id,
          user_id: profile.id,
          membership_type: membershipType,
          approval_status: "pending",
          reviewed_by: null,
          reviewed_at: null,
        },
        { onConflict: "association_id,msme_id" },
      );

      if (membershipError) {
        console.error("[register:association-membership-failed]", {
          error: {
            message: membershipError.message,
            code: membershipError.code ?? null,
            details: membershipError.details ?? null,
            hint: membershipError.hint ?? null,
          },
          registrationPath,
          associationId,
          msmeId: msme.id,
        });

        return NextResponse.json(
          { error: `Registration was created, but association approval setup failed. ${describeSupabaseError(membershipError)}` },
          { status: 500 },
        );
      }
    }

    await ensureWorkflowRecords(supabase, {
      msmeId: msme.id,
      overallStatus,
      checks,
    });

    await supabase.from("activity_logs").insert([
      {
        actor_user_id: profile.id,
        action: "msme_registered",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { msme_id: msme.msme_id, source: "demo_admin_register" },
      },
      {
        actor_user_id: profile.id,
        action: "msme_submitted",
        entity_type: "msme",
        entity_id: msme.id,
        metadata: { status: profilePayload.verification_status, registration_path: registrationPath },
      },
    ]);

    return NextResponse.json({
      ok: true,
      msmeId: msme.msme_id,
      verificationStatus: profilePayload.verification_status,
      reviewStatus: profilePayload.review_status,
      message: requiresAssociation
        ? "Registration successful. Your association will confirm your membership before DBIN verification."
        : "Registration successful. Your MSME onboarding is now in DBIN verification.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete registration.";
    return NextResponse.json({ error: mapRegistrationErrorMessage(message) }, { status: 500 });
  }
}
