import { AdministrationError, administrationErrorResponse, requireInstitutionActor } from "@/lib/institutional/administration-server";
import { diagnosticCase } from "@/lib/institutional/diagnostics-server";
import { isUuid } from "@/lib/institutional/administration-policy";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ institutionId: string; caseId: string; evidenceId: string }> }) {
  try {
    const { institutionId, caseId, evidenceId } = await context.params;
    const actor = await requireInstitutionActor(institutionId);
    await diagnosticCase(actor, caseId);
    if (!isUuid(evidenceId)) throw new AdministrationError(400, "Invalid evidence.");
    const { data, error } = await actor.db.from("institution_diagnostic_evidence")
      .select("storage_path,file_name,mime_type").eq("institution_id", institutionId).eq("case_id", caseId).eq("id", evidenceId).maybeSingle();
    if (error) throw error;
    if (!data) throw new AdministrationError(404, "Evidence unavailable.");
    const { data: blob, error: storageError } = await actor.db.storage.from("institution-diagnostic-evidence").download(data.storage_path);
    if (storageError || !blob) throw new AdministrationError(503, "Evidence temporarily unavailable.");
    return new Response(await blob.arrayBuffer(), { headers: {
      "Content-Type": data.mime_type, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(data.file_name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return administrationErrorResponse(error); }
}
