import { AdministrationError, type requireInstitutionActor } from "@/lib/institutional/administration-server";

type Actor = Awaited<ReturnType<typeof requireInstitutionActor>>;

export async function loadOnboarding(actor: Actor) {
  const [project, checks, imports, readiness, owners] = await Promise.all([
    actor.db.from("institution_onboarding_projects").select("*").eq("institution_id", actor.institution.id).maybeSingle(),
    actor.db.from("institution_onboarding_checks").select("*").eq("institution_id", actor.institution.id).order("category").order("created_at"),
    actor.db.from("institution_import_batches").select("id,import_type,source_name,status,total_rows,valid_rows,imported_rows,failed_rows,created_at,completed_at").eq("institution_id", actor.institution.id).order("created_at", { ascending: false }).limit(20),
    actor.db.rpc("institution_go_live_readiness", { p_institution_id: actor.institution.id }),
    actor.db.from("institution_implementation_owners").select("*").eq("institution_id", actor.institution.id).order("owner_label"),
  ]);
  for (const result of [project, checks, imports, readiness, owners]) if (result.error) throw result.error;
  return { project: project.data, checks: checks.data ?? [], imports: imports.data ?? [], readiness: readiness.data, owners: owners.data ?? [] };
}
export function requirePlatformOnboardingManager(actor: Actor) {
  if (!actor.platformAdmin) throw new AdministrationError(403, "Platform administrator access is required for institution provisioning.");
}
