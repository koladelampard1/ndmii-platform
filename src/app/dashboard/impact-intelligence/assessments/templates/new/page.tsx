import { redirect, unstable_rethrow } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TEMPLATE_STATUSES,
  ASSESSMENT_TYPES,
  createAssessmentTemplate,
} from "@/lib/data/impact-intelligence";
import { EmptyState, SectionCard } from "../../../_components";
import { logImpactRouteDiagnostic } from "../../../_diagnostics";
import { AssessmentDesignStudio } from "./assessment-design-studio";

const ROUTE = "/dashboard/impact-intelligence/assessments/templates/new";
const EXPECTED_TEMPLATE_ERRORS = ["required", "invalid", "valid", "blueprint", "scoring", "version", "permission", "already exists"];

const DEFAULT_BLUEPRINT = [
  "Business profile | Is the business registration information current? | boolean | compliance | 10 | yes | | | {\"mode\":\"boolean\",\"true_score\":10,\"false_score\":0}",
  "Business profile | Primary operating challenge | textarea | operations | 5 | no | |",
  "Finance readiness | Monthly revenue band | select | finance | 15 | yes | Below NGN 500k, NGN 500k-2m, Above NGN 2m | | {\"mode\":\"select_options\",\"option_scores\":{\"Below NGN 500k\":5,\"NGN 500k-2m\":10,\"Above NGN 2m\":15}}",
  "Finance readiness | Does the MSME keep sales records? | boolean | finance | 15 | yes | |",
  "Monitoring | Evidence file reference | file_upload | evidence | 5 | no | | Placeholder for future upload integration",
].join("\n");

const DEFAULT_SCORING_BANDS = JSON.stringify([
  { label: "low", min: 0, max: 49.9999 },
  { label: "moderate", min: 50, max: 74.9999 },
  { label: "strong", min: 75, max: 100 },
], null, 2);

async function createTemplateAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let templateId: string;
  try {
    templateId = await createAssessmentTemplate(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_template_create_failed", error });
    if (!(error instanceof Error) || !EXPECTED_TEMPLATE_ERRORS.some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirect(`${ROUTE}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/impact-intelligence/assessments/templates/${templateId}`);
}

export default async function NewAssessmentTemplatePage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let loadError: string | null = null;
  try {
    ctx = await getCurrentUserContext();
    if (!canRole(ctx.role, "assessment_template", "create")) redirect("/access-denied");
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Assessment template creation is temporarily unavailable.";
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_template_create_page_load_failed", error });
  }

  if (!ctx || loadError) {
    return (
      <section className="space-y-6">
        <SectionCard title="Template Creation Unavailable">
          <EmptyState
            title="Assessment template creation could not load"
            description="The current session or assessment source is temporarily unavailable. No template data has been changed."
            icon={ClipboardCheck}
          />
        </SectionCard>
      </section>
    );
  }

  return (
    <AssessmentDesignStudio
      action={createTemplateAction}
      assessmentTypes={ASSESSMENT_TYPES}
      defaultBlueprint={DEFAULT_BLUEPRINT}
      defaultScoringBands={DEFAULT_SCORING_BANDS}
      error={query.error}
      questionTypes={ASSESSMENT_QUESTION_TYPES}
      role={ctx.role}
      statuses={ASSESSMENT_TEMPLATE_STATUSES}
      canOpenAssessments={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments")}
    />
  );
}
