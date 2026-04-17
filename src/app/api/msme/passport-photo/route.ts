import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
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

export async function POST(request: Request) {
  try {
    const context = await getCurrentUserContext();
    const { appUserId, role } = context;

    if (!appUserId || !["msme", "admin"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("passport_photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No passport photo file uploaded." }, { status: 400 });
    }

    const validationResult = validatePassportPhotoFile(file);
    if (!validationResult.ok) {
      return NextResponse.json({ error: validationResult.message, code: validationResult.error }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
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
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(PASSPORT_BUCKET).getPublicUrl(uploadPath);

    console.info("[msme-passport-upload][success]", {
      fileName: file.name,
      size: file.size,
      mimeType: file.type || null,
      bucket: PASSPORT_BUCKET,
      uploadPath,
      publicUrl: publicUrlData.publicUrl,
    });

    return NextResponse.json({
      publicUrl: publicUrlData.publicUrl,
      bucket: PASSPORT_BUCKET,
      uploadPath,
    });
  } catch (error) {
    console.error("[msme-passport-upload][unexpected_error]", {
      error: toStorageErrorLog(error),
    });
    return NextResponse.json({ error: "Unable to upload passport photo right now." }, { status: 500 });
  }
}
