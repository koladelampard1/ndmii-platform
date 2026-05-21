import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";
import { sanitizeProviderLogoFileName, validateProviderLogoFile } from "@/lib/msme/provider-logo-upload";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const PROVIDER_LOGO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PROVIDER_LOGO_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";
const DEBUG_LOGO_UPLOAD = process.env.NODE_ENV !== "production" && process.env.DBIN_DEBUG_LOGS === "1";

function debugLogoLog(message: string, payload: Record<string, unknown>) {
  if (!DEBUG_LOGO_UPLOAD) return;
  console.info(`[msme-settings][logo-upload] ${message}`, payload);
}

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
  const corsHeaders = getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]);

  try {
    const workspace = await getProviderWorkspaceContext();

    const formData = await request.formData();
    const file = formData.get("logo_file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No logo image uploaded." }, { status: 400, headers: corsHeaders });
    }

    const validationResult = validateProviderLogoFile(file);
    if (!validationResult.ok) {
      return NextResponse.json({ error: validationResult.message, code: validationResult.error }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createServiceRoleSupabaseClient();
    const { data: providerRows, error: providerLookupError } = await supabase
      .from("provider_profiles")
      .select("id,msme_id")
      .or(`id.eq.${workspace.provider.id},msme_id.eq.${workspace.msme.id}`)
      .order("updated_at", { ascending: false })
      .limit(10);

    const providerRow = (providerRows ?? []).find((row) => {
      const msmeRef = String(row.msme_id ?? "");
      return row.id === workspace.provider.id || msmeRef === workspace.msme.id;
    });

    if (providerLookupError || !providerRow?.id) {
      console.error("[msme-settings][logo-upload][provider-lookup-failed]", {
        providerProfileResolved: Boolean(workspace.provider.id),
        rowCount: providerRows?.length ?? 0,
        error: toErrorLog(providerLookupError),
      });
      return NextResponse.json({ error: "Could not resolve your provider profile for logo upload." }, { status: 400, headers: corsHeaders });
    }

    const safeName = sanitizeProviderLogoFileName(file.name);
    const storagePath = `${providerRow.msme_id}/${providerRow.id}/logo-${Date.now()}-${safeName}`;

    debugLogoLog("start", {
      providerProfileId: providerRow.id,
      bucket: PROVIDER_LOGO_BUCKET,
      bytes: file.size,
      mimeType: file.type || null,
    });

    const { error: uploadError } = await supabase.storage.from(PROVIDER_LOGO_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

    if (uploadError) {
      console.error("[msme-settings][logo-upload][upload-failed]", {
        providerProfileId: providerRow.id,
        bucket: PROVIDER_LOGO_BUCKET,
        error: toErrorLog(uploadError),
      });
      return NextResponse.json({ error: "Failed to upload logo image to storage." }, { status: 500, headers: corsHeaders });
    }

    const { data: publicUrlData } = supabase.storage.from(PROVIDER_LOGO_BUCKET).getPublicUrl(storagePath);
    const logoUrl = publicUrlData.publicUrl;

    debugLogoLog("upload-success", {
      providerProfileId: providerRow.id,
      bucket: PROVIDER_LOGO_BUCKET,
    });

    const payload = {
      logo_url: logoUrl,
    };

    debugLogoLog("provider-profile-update", { table: "provider_profiles", providerProfileId: providerRow.id, payloadKeyCount: Object.keys(payload).length });

    const { data: persistedRows, error: persistError } = await supabase
      .from("provider_profiles")
      .update(payload)
      .eq("msme_id", providerRow.msme_id)
      .eq("id", providerRow.id)
      .select("id,msme_id,logo_url");

    if (persistError || !persistedRows?.length) {
      console.error("[msme-settings][logo-upload][persist-failed]", {
        providerProfileId: providerRow.id,
        error: toErrorLog(persistError ?? "no_rows_updated"),
      });
      return NextResponse.json({ error: "Logo upload succeeded, but profile save failed. Please retry." }, { status: 500, headers: corsHeaders });
    }

    debugLogoLog("persist-success", {
      providerProfileId: providerRow.id,
    });

    revalidatePath("/dashboard/msme/settings");
    revalidatePath("/dashboard/msme/profile");
    revalidatePath(`/providers/${providerRow.id}`);

    return NextResponse.json(
      {
        logoUrl,
        providerProfileId: providerRow.id,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("[msme-settings][logo-upload][unexpected-failure]", { error: toErrorLog(error) });
    return NextResponse.json({ error: "Unable to upload logo right now." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]),
  });
}
