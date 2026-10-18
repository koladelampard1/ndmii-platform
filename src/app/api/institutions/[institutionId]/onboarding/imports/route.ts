import { NextResponse } from "next/server";
import { canManageMember } from "@/lib/institutional/administration-policy";
import { AdministrationError, administrationErrorResponse, findVerifiedExistingUser, recordInstitutionAudit, requireInstitutionActor, requireManager } from "@/lib/institutional/administration-server";
import { IMPORT_TYPES, parseImportRows, type ImportType } from "@/lib/institutional/onboarding-policy";

type Context = { params: Promise<{ institutionId: string }> };
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireInstitutionActor((await context.params).institutionId); requireManager(actor);
    const body = await request.json().catch(() => null);
    const importType = body?.importType as ImportType;
    const sourceName = typeof body?.sourceName === "string" ? body.sourceName.trim() : "";
    if (!IMPORT_TYPES.includes(importType) || sourceName.length < 1 || sourceName.length > 180) throw new AdministrationError(400, "Check the import type and source name.");
    const parsed = parseImportRows(body?.rows, importType); if (!parsed) throw new AdministrationError(400, "Provide between 1 and 500 import rows.");
    if (body?.action === "validate") return NextResponse.json({ rows: parsed, validRows: parsed.filter((row) => !row.errors.length).length,
      failedRows: parsed.filter((row) => row.errors.length).length }, { headers: { "Cache-Control": "no-store" } });
    if (body?.action !== "import") throw new AdministrationError(400, "Unsupported import action.");
    const { data: onboardingProject, error: projectError } = await actor.db.from("institution_onboarding_projects").select("institution_id")
      .eq("institution_id", actor.institution.id).maybeSingle();
    if (projectError) throw projectError; if (!onboardingProject) throw new AdministrationError(409, "Initialize institution onboarding before importing rosters.");

    const { data: batch, error: batchError } = await actor.db.from("institution_import_batches").insert({
      institution_id: actor.institution.id, import_type: importType, source_name: sourceName,
      total_rows: parsed.length, valid_rows: parsed.filter((row) => !row.errors.length).length, created_by_user_id: actor.userId,
    }).select("id").single();
    if (batchError || !batch) throw batchError ?? new Error("Import batch could not be created.");

    let imported = 0; let failed = 0;
    const rowResults: Array<{ institution_id: string; batch_id: string; row_number: number; row_data: Record<string, unknown>; status: string; errors: string[]; created_entity_id: string | null }> = [];
    for (const row of parsed) {
      const errors = [...row.errors]; let createdEntityId: string | null = null; let status = errors.length ? "invalid" : "valid";
      if (!errors.length) {
        try {
          if (importType === "bdsp_organisations") {
            const item = row.rowData as { name: string; registrationNumber: string; serviceStates: string[] };
            const { data, error } = await actor.db.from("institution_bdsp_organisations").upsert({ institution_id: actor.institution.id,
              name: item.name, registration_number: item.registrationNumber || null, service_states: item.serviceStates,
              created_by_user_id: actor.userId }, { onConflict: "institution_id,name", ignoreDuplicates: true }).select("id").maybeSingle();
            if (error) throw error;
            if (data?.id) { createdEntityId = data.id; status = "imported"; imported++; } else status = "skipped";
          } else {
            const item = row.rowData as { email: string; bdspName: string; deliveryType: string; serviceStates: string[] };
            const user = await findVerifiedExistingUser(actor.db, item.email);
            if (!canManageMember({ platformAdmin: actor.platformAdmin, actorRole: actor.membership?.role ?? null, targetRole: "institution_agent",
              actorUserId: actor.userId, targetUserId: user.id, action: "invite" })) throw new AdministrationError(403, "Agent invitation is not permitted.");
            let bdspId: string | null = null;
            if (item.bdspName) {
              const { data: bdsp } = await actor.db.from("institution_bdsp_organisations").select("id").eq("institution_id", actor.institution.id).ilike("name", item.bdspName).eq("status", "active").maybeSingle();
              if (!bdsp) throw new AdministrationError(404, `BDSP not found: ${item.bdspName}`); bdspId = bdsp.id;
            }
            const { data: existing } = await actor.db.from("institution_members").select("id").eq("institution_id", actor.institution.id)
              .eq("user_id", user.id).eq("role", "institution_agent").in("status", ["active", "invited"]).maybeSingle();
            if (existing) { status = "skipped"; }
            else {
              const { data: member, error: memberError } = await actor.db.from("institution_members").insert({ institution_id: actor.institution.id,
                user_id: user.id, role: "institution_agent", status: "invited", invited_by: actor.userId }).select("id").single();
              if (memberError || !member) throw memberError ?? new Error("Agent membership failed.");
              const { data: profile, error: profileError } = await actor.db.from("institution_agent_profiles").insert({ institution_id: actor.institution.id,
                member_id: member.id, bdsp_organisation_id: bdspId, delivery_type: item.deliveryType, service_states: item.serviceStates }).select("id").single();
              if (profileError || !profile) { await actor.db.from("institution_members").update({ status: "revoked" }).eq("id", member.id); throw profileError ?? new Error("Agent profile failed."); }
              createdEntityId = profile.id; status = "imported"; imported++;
            }
          }
        } catch (cause) { errors.push(cause instanceof AdministrationError ? cause.message : "Row could not be imported."); status = "invalid"; }
      }
      if (status === "invalid") failed++;
      rowResults.push({ institution_id: actor.institution.id, batch_id: batch.id, row_number: row.rowNumber,
        row_data: row.rowData, status, errors, created_entity_id: createdEntityId });
    }
    const { error: rowsError } = await actor.db.from("institution_import_rows").insert(rowResults); if (rowsError) throw rowsError;
    const finalStatus = failed === 0 ? "imported" : imported > 0 ? "partially_imported" : "failed";
    const { error: updateError } = await actor.db.from("institution_import_batches").update({ status: finalStatus, imported_rows: imported,
      failed_rows: failed, completed_at: new Date().toISOString() }).eq("id", batch.id).eq("institution_id", actor.institution.id);
    if (updateError) throw updateError;
    await actor.db.from("institution_onboarding_projects").update({ status: "data_setup", updated_by_user_id: actor.userId }).eq("institution_id", actor.institution.id).eq("status", "configuration");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: actor.institution.id,
      eventType: "institution.onboarding.import_completed", entityType: "institution_import_batches", entityId: batch.id,
      metadata: { importType, totalRows: parsed.length, importedRows: imported, failedRows: failed } });
    return NextResponse.json({ batchId: batch.id, status: finalStatus, importedRows: imported, failedRows: failed, rows: rowResults.map(({ row_number, status, errors }) => ({ rowNumber: row_number, status, errors })) },
      { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
