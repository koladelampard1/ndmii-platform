import { NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const BUCKET = "bookkeeping-receipts";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function ext(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function validate(file: File) {
  if (file.size > MAX_FILE_BYTES) return "File too large. Max size is 10MB.";
  const extension = ext(file.name);
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return "Unsupported file type. Allowed: jpg, jpeg, png, webp, pdf, doc, docx.";
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) return "Unsupported file type. Allowed: jpg, jpeg, png, webp, pdf, doc, docx.";
  return null;
}

export async function POST(request: Request) {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const formData = await request.formData();

  const type = String(formData.get("type") ?? "Expense");
  const amount = Number(formData.get("amount") ?? 0);
  const category = String(formData.get("category") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const { data: inserted, error: insertError } = await supabase
    .from("msme_bookkeeping_records")
    .insert({
      msme_id: workspace.msme.id,
      type,
      amount,
      category,
      date,
      description,
    })
    .select("id,msme_id,type,amount,category,date,description,receipt_url,receipt_filename")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: "Failed to save record." }, { status: 500 });
  }

  const maybeFile = formData.get("receipt");
  let receiptUrl: string | null = inserted.receipt_url ?? null;
  let receiptFilename: string | null = inserted.receipt_filename ?? null;

  if (maybeFile instanceof File && maybeFile.size > 0) {
    const validationError = validate(maybeFile);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const { data: bucket } = await supabase.storage.getBucket(BUCKET);
    if (!bucket) {
      await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: `${MAX_FILE_BYTES}`, allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES) });
    }

    const safeName = sanitizeFileName(maybeFile.name);
    const storagePath = `${workspace.msme.id}/${inserted.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, maybeFile, {
      contentType: maybeFile.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });

    receiptUrl = `supabase://${BUCKET}/${storagePath}`;
    receiptFilename = maybeFile.name;

    await supabase.from("msme_bookkeeping_records").update({ receipt_url: receiptUrl, receipt_filename: receiptFilename }).eq("id", inserted.id).eq("msme_id", workspace.msme.id);
  }

  return NextResponse.json({
    record: {
      id: inserted.id,
      date: inserted.date,
      type: inserted.type,
      category: inserted.category,
      description: inserted.description,
      amount: Number(inserted.amount ?? 0),
      receipt_url: receiptUrl,
      receipt_filename: receiptFilename,
    },
  });
}
