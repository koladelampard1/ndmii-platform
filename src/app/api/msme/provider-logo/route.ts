import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { sanitizeProviderLogoFileName, validateProviderLogoFile } from "@/lib/msme/provider-logo-upload";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const PROVIDER_LOGO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PROVIDER_LOGO_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";

function toErrorLog(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; name?: unknown; statusCode?: unknown };
  return {
    message: typeof maybeError.message === "string" ? maybeError.message : String(maybeError.message ?? "unknown_error"),
    details: typeof maybeError.details === "string" ? maybeError.details : null,
    hint: typeof maybeError.hint === "string" ? maybeError.hint : null,
    code: typeof maybeError.code === "string" ? maybeError.code : null,
    name: typeof maybeError.name === "string" ? maybeError.name : null,
    statusCode: maybeError.statusCode ?? null,
  };
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentUserContext();
    if (!context.appUserId || !["msme", "admin"].includes(context.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("logo_file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No logo image uploaded." }, { status: 400 });
    }

    const validationResult = validateProviderLogoFile(file);
    if (!validationResult.ok) {
      return NextResponse.json({ error: validationResult.message, code: validationResult.error }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabaseClient();

    let msmeQuery = supabase
      .from("msmes")
      .select("id,msme_id")
      .eq("created_by", context.appUserId)
      .order("created_at", { ascending: false })
      .limit(1);
    let { data: msmeRow, error: msmeLookupError } = await msmeQuery.maybeSingle();

    if (!msmeRow?.msme_id && context.linkedMsmeId) {
      msmeQuery = supabase
        .from("msmes")
        .select("id,msme_id")
        .or(`id.eq.${context.linkedMsmeId},msme_id.eq.${context.linkedMsmeId}`)
        .order("created_at", { ascending: false })
        .limit(1);
      const linkedMsmeLookup = await msmeQuery.maybeSingle();
      msmeRow = linkedMsmeLookup.data;
      msmeLookupError = linkedMsmeLookup.error;
    }

    if (msmeLookupError || !msmeRow?.msme_id) {
      console.error("[msme-settings][logo-upload][msme-lookup-failed]", {
        appUserId: context.appUserId,
        linkedMsmeId: context.linkedMsmeId,
        error: toErrorLog(msmeLookupError),
      });
      return NextResponse.json({ error: "Could not resolve your MSME profile for logo upload." }, { status: 400 });
    }

    const { data: providerRow, error: providerLookupError } = await supabase
      .from("provider_profiles")
      .select("id,msme_id")
      .eq("msme_id", msmeRow.msme_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (providerLookupError || !providerRow?.id) {
      console.error("[msme-settings][logo-upload][provider-lookup-failed]", {
        appUserId: context.appUserId,
        msmePublicId: msmeRow.msme_id,
        error: toErrorLog(providerLookupError),
      });
      return NextResponse.json({ error: "Could not resolve your provider profile for logo upload." }, { status: 400 });
    }

    const safeName = sanitizeProviderLogoFileName(file.name);
    const storagePath = `${providerRow.msme_id}/${providerRow.id}/logo-${Date.now()}-${safeName}`;

    console.info("[msme-settings][logo-upload][start]", {
      appUserId: context.appUserId,
      providerProfileId: providerRow.id,
      msmePublicId: providerRow.msme_id,
      bucket: PROVIDER_LOGO_BUCKET,
      storagePath,
      fileName: file.name,
      bytes: file.size,
      mimeType: file.type || null,
    });

    const { error: uploadError } = await supabase.storage.from(PROVIDER_LOGO_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

    if (uploadError) {
      console.error("[msme-settings][logo-upload][upload-failed]", {
        appUserId: context.appUserId,
        providerProfileId: providerRow.id,
        msmePublicId: providerRow.msme_id,
        bucket: PROVIDER_LOGO_BUCKET,
        storagePath,
        error: toErrorLog(uploadError),
      });
      return NextResponse.json({ error: "Failed to upload logo image to storage." }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(PROVIDER_LOGO_BUCKET).getPublicUrl(storagePath);
    const logoUrl = publicUrlData.publicUrl;

    console.info("[msme-settings][logo-upload][upload-success]", {
      appUserId: context.appUserId,
      providerProfileId: providerRow.id,
      msmePublicId: providerRow.msme_id,
      bucket: PROVIDER_LOGO_BUCKET,
      storagePath,
      logoUrl,
    });

    const { data: persistedRows, error: persistError } = await supabase
      .from("msmes")
      .update({ passport_photo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq("id", msmeRow.id)
      .eq("msme_id", providerRow.msme_id)
      .select("id,msme_id,passport_photo_url");

    if (persistError || !persistedRows?.length) {
      console.error("[msme-settings][logo-upload][persist-failed]", {
        appUserId: context.appUserId,
        providerProfileId: providerRow.id,
        msmePublicId: providerRow.msme_id,
        logoUrl,
        error: toErrorLog(persistError ?? "no_rows_updated"),
      });
      return NextResponse.json({ error: "Logo upload succeeded, but profile save failed. Please retry." }, { status: 500 });
    }

    console.info("[msme-settings][logo-upload][persist-success]", {
      appUserId: context.appUserId,
      providerProfileId: providerRow.id,
      msmePublicId: providerRow.msme_id,
      logoUrl,
    });

    revalidatePath("/dashboard/msme/settings");
    revalidatePath("/dashboard/msme/profile");
    revalidatePath(`/providers/${providerRow.id}`);

    return NextResponse.json({
      logoUrl,
      bucket: PROVIDER_LOGO_BUCKET,
      storagePath,
      providerProfileId: providerRow.id,
      msmePublicId: providerRow.msme_id,
    });
  } catch (error) {
    console.error("[msme-settings][logo-upload][unexpected-failure]", { error: toErrorLog(error) });
    return NextResponse.json({ error: "Unable to upload logo right now." }, { status: 500 });
  }
}
