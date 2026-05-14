import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getCredentialedCorsHeaders } from "@/lib/http/cors";
import { sanitizePassportFileName, validatePassportPhotoFile } from "@/lib/msme/passport-upload";

const PASSPORT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MSME_PASSPORT_BUCKET || "msme-passports";

function toStorageErrorLog(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const maybeError = error as { message?: unknown; name?: unknown; statusCode?: unknown };
  return {
    message: typeof maybeError.message === "string" ? maybeError.message : String(maybeError.message ?? "unknown_error"),
    name: typeof maybeError.name === "string" ? maybeError.name : "StorageError",
    statusCode: maybeError.statusCode ?? null,
  };
}

async function findOwnedMsme(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  context: Awaited<ReturnType<typeof getCurrentUserContext>>,
) {
  if (context.linkedMsmeId) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,contact_email,created_by")
      .or(`id.eq.${context.linkedMsmeId},msme_id.eq.${context.linkedMsmeId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (context.appUserId) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,contact_email,created_by")
      .eq("created_by", context.appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (context.email) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,contact_email,created_by")
      .eq("contact_email", context.email.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data;
  }

  return null;
}

export async function POST(request: Request) {
  const corsHeaders = getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]);

  try {
    const context = await getCurrentUserContext();
    const { appUserId, role } = context;

    if (!appUserId || !["msme", "admin"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const formData = await request.formData();
    const file = formData.get("passport_photo");
    const shouldPersistToMsme = String(formData.get("persist_to_msme") ?? "") === "1";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No passport photo file uploaded." }, { status: 400, headers: corsHeaders });
    }

    const validationResult = validatePassportPhotoFile(file);
    if (!validationResult.ok) {
      return NextResponse.json({ error: validationResult.message, code: validationResult.error }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createServiceRoleSupabaseClient();
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    const bucketExists = (buckets ?? []).some((bucket) => bucket.name === PASSPORT_BUCKET);

    if (bucketError || !bucketExists) {
      console.error("[msme-passport-upload][bucket-missing]", {
        bucket: PASSPORT_BUCKET,
        error: bucketError ? toStorageErrorLog(bucketError) : null,
      });
      return NextResponse.json(
        {
          error: `Passport photo storage bucket "${PASSPORT_BUCKET}" is not configured. Create a public Supabase Storage bucket named "${PASSPORT_BUCKET}" or set NEXT_PUBLIC_SUPABASE_MSME_PASSPORT_BUCKET to an existing public bucket.`,
          code: "passport_bucket_missing",
          bucket: PASSPORT_BUCKET,
        },
        { status: 500, headers: corsHeaders },
      );
    }

    const safeName = sanitizePassportFileName(file.name);
    const uploadPath = `${appUserId}/${Date.now()}-${safeName}`;

    console.info("[msme-passport-upload][start]", {
      fileName: file.name,
      size: file.size,
      mimeType: file.type || null,
      bucket: PASSPORT_BUCKET,
      uploadPath,
    });

    const { error: uploadError } = await supabase.storage.from(PASSPORT_BUCKET).upload(uploadPath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

    if (uploadError) {
      console.error("[msme-passport-upload][error]", {
        fileName: file.name,
        size: file.size,
        mimeType: file.type || null,
        bucket: PASSPORT_BUCKET,
        uploadPath,
        error: toStorageErrorLog(uploadError),
      });
      return NextResponse.json({ error: uploadError.message }, { status: 500, headers: corsHeaders });
    }

    const { data: publicUrlData } = supabase.storage.from(PASSPORT_BUCKET).getPublicUrl(uploadPath);
    const passportPhotoUrl = publicUrlData.publicUrl;
    let persisted = false;
    let msmeId: string | null = null;

    if (shouldPersistToMsme) {
      const ownedMsme = await findOwnedMsme(supabase, context);
      if (!ownedMsme?.id) {
        return NextResponse.json(
          { error: "Passport photo uploaded, but no owned MSME profile was found to update.", code: "owned_msme_not_found" },
          { status: 400, headers: corsHeaders },
        );
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("msmes")
        .update({ passport_photo_url: passportPhotoUrl })
        .eq("id", ownedMsme.id)
        .select("id,passport_photo_url");

      if (updateError || !updatedRows?.length) {
        console.error("[msme-passport-upload][persist-failed]", {
          msmeRowId: ownedMsme.id,
          error: toStorageErrorLog(updateError ?? "no_rows_updated"),
        });
        return NextResponse.json(
          { error: "Passport photo uploaded, but profile save failed. Please retry.", code: "passport_persist_failed" },
          { status: 500, headers: corsHeaders },
        );
      }

      persisted = true;
      msmeId = ownedMsme.id;
      revalidatePath("/dashboard/msme/settings");
      revalidatePath("/dashboard/msme/profile");
      revalidatePath("/dashboard/msme/id-card");
    }

    console.info("[msme-passport-upload][success]", {
      fileName: file.name,
      size: file.size,
      mimeType: file.type || null,
      bucket: PASSPORT_BUCKET,
      uploadPath,
      publicUrl: passportPhotoUrl,
      persisted,
      msmeId,
    });

    return NextResponse.json(
      {
        publicUrl: passportPhotoUrl,
        passportPhotoUrl,
        bucket: PASSPORT_BUCKET,
        uploadPath,
        persisted,
        msmeId,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("[msme-passport-upload][unexpected_error]", {
      error: toStorageErrorLog(error),
    });
    return NextResponse.json({ error: "Unable to upload passport photo right now." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCredentialedCorsHeaders(request, ["POST", "OPTIONS"]),
  });
}
