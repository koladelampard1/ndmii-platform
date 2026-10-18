import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticCase } from "@/lib/institutional/diagnostics-server";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
const BUCKET = "institution-diagnostic-evidence";
export async function POST(request: Request, context: { params: Promise<{ institutionId: string; caseId: string }> }) {
  try {
    const { institutionId, caseId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    const record = await diagnosticCase(actor, caseId, true);
    if (["submitted", "approved"].includes(record.status)) throw new AdministrationError(409, "Case is closed for edits at this stage.");
    const form = await request.formData();
    const file = form.get("file");
    const activityId = form.get("activityId");
    if (!(file instanceof File) || file.size < 1 || file.size > 10485760 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
      (activityId !== null && (typeof activityId !== "string" || !isUuid(activityId))))
      throw new AdministrationError(400, "Upload a PDF, PNG or JPEG under 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = file.type === "application/pdf" ? [37,80,68,70,45] : file.type === "image/png" ? [137,80,78,71,13,10,26,10] : [255,216,255];
    if (!signature.every((byte, index) => bytes[index] === byte)) throw new AdministrationError(400, "File content does not match its type.");
    if (activityId) {
      const { data: activity, error } = await actor.db.from("institution_diagnostic_activities").select("id")
        .eq("institution_id", actor.institution.id).eq("case_id", caseId).eq("id", activityId).maybeSingle();
      if (error) throw error;
      if (!activity) throw new AdministrationError(404, "Service record unavailable.");
    }
    const path = `${institutionId}/${caseId}/${crypto.randomUUID()}`;
    const { error: uploadError } = await actor.db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await actor.db.from("institution_diagnostic_evidence").insert({
      institution_id: institutionId, case_id: caseId, activity_id: activityId || null, storage_path: path,
      file_name: file.name.slice(0, 255), mime_type: file.type, byte_size: file.size, uploaded_by_user_id: actor.userId,
    }).select("id,file_name,mime_type,byte_size,created_at").single();
    if (error) {
      await actor.db.storage.from(BUCKET).remove([path]);
      throw error;
    }
    return NextResponse.json({ evidence: data }, { status: 201 });
  } catch (error) { return administrationErrorResponse(error); }
}
