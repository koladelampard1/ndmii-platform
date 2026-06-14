import { redirect, unstable_rethrow } from "next/navigation";
import { FileWarning, LockKeyhole, Target } from "lucide-react";
import { EmptyState } from "../../../_components";
import { requireImpactRoute } from "../../../_route-guards";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  createIndicatorMeasurement,
  getIndicatorDefinition,
  getIndicatorFormOptions,
  logImpactIndicatorDiagnostic,
  type IndicatorFormOptions,
} from "@/lib/data/impact-indicators";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { MeasurementCaptureStudio } from "./measurement-capture-studio";

const INDICATORS_ROUTE = "/dashboard/impact-intelligence/indicators";
const ROUTE_SUFFIX = "measurement";
const EXPECTED_ACTION_ERRORS = [
  "required",
  "numeric",
  "valid",
  "permission",
  "indicator",
  "measurement",
  "assigned",
  "active",
  "temporarily unavailable",
];

const EMPTY_OPTIONS: IndicatorFormOptions = {
  programmes: [],
  cohorts: [],
  members: [],
  interventions: [],
  assessments: [],
  scoreRuns: [],
  visits: [],
  users: [],
};

type SearchParams = Promise<{ error?: string }>;

function isExpectedActionError(error: unknown) {
  return error instanceof Error
    && EXPECTED_ACTION_ERRORS.some((message) => error.message.toLowerCase().includes(message));
}

function hasValidOptionCollections(value: unknown): value is IndicatorFormOptions {
  if (!value || typeof value !== "object") return false;
  const options = value as Record<string, unknown>;
  return ["programmes", "cohorts", "members", "interventions", "assessments", "scoreRuns", "visits", "users"]
    .every((key) => Array.isArray(options[key]));
}

async function createMeasurementAction(indicatorId: string, formData: FormData) {
  "use server";
  const route = `${INDICATORS_ROUTE}/${indicatorId}/${ROUTE_SUFFIX}`;
  const ctx = await requireImpactRoute(route);
  formData.set("indicator_definition_id", indicatorId);
  try {
    await createIndicatorMeasurement(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactIndicatorDiagnostic({
      operation: "indicator_measurement_studio_submit_failed",
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      indicatorDefinitionId: indicatorId,
      programmeId: typeof formData.get("programme_id") === "string" ? String(formData.get("programme_id")) : null,
      errorMessage: error instanceof Error ? error.message : "Measurement could not be created.",
      success: false,
    });
    if (!isExpectedActionError(error)) throw error;
    const message = error instanceof Error ? error.message : "Measurement could not be created.";
    redirect(`${route}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${INDICATORS_ROUTE}/${indicatorId}?success=${encodeURIComponent("Draft measurement added.")}`);
}

export default async function IndicatorMeasurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ indicatorId: string }>;
  searchParams: SearchParams;
}) {
  const { indicatorId } = await params;
  const query = (await searchParams) ?? {};
  const route = `${INDICATORS_ROUTE}/${indicatorId}/${ROUTE_SUFFIX}`;
  const ctx = await requireImpactRoute(route);
  const canCreate = canRole(ctx.role, "indicator", "create")
    && ["super_admin", "assessment_officer", "field_officer"].includes(ctx.role);

  if (!canCreate) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          title="Measurement capture is read-only"
          description="Your current role can review indicator outcomes but cannot create measurements under the existing policy."
          icon={LockKeyhole}
        />
      </section>
    );
  }

  let indicator = null;
  let options = EMPTY_OPTIONS;
  let evidence: ImpactEvidenceRecord[] = [];
  let optionsAvailable = false;
  let evidenceAvailable = false;
  let loadError: string | null = null;

  try {
    indicator = await getIndicatorDefinition(ctx, indicatorId);
    if (!indicator) {
      loadError = "The requested indicator is unavailable.";
    } else if (indicator.status !== "active") {
      loadError = "Measurements require an active indicator definition.";
    } else {
      try {
        const loadedOptions = await getIndicatorFormOptions(ctx);
        if (!hasValidOptionCollections(loadedOptions)) {
          throw new Error("Indicator measurement options returned an invalid collection shape.");
        }
        options = loadedOptions;
        optionsAvailable = true;
      } catch (error) {
        unstable_rethrow(error);
        logImpactIndicatorDiagnostic({
          operation: "indicator_measurement_studio_options_load_failed",
          role: ctx.role,
          authUserId: ctx.authUserId,
          appUserId: ctx.appUserId,
          indicatorDefinitionId: indicatorId,
          errorMessage: error instanceof Error ? error.message : "Measurement options unavailable.",
          success: false,
        });
      }

      if (indicator.programme_id && canRole(ctx.role, "evidence", "read")) {
        try {
          evidence = await listImpactEvidence(ctx, { programmeId: indicator.programme_id, limit: 250 });
          evidenceAvailable = true;
        } catch (error) {
          unstable_rethrow(error);
          logImpactIndicatorDiagnostic({
            operation: "indicator_measurement_studio_evidence_load_failed",
            role: ctx.role,
            authUserId: ctx.authUserId,
            appUserId: ctx.appUserId,
            indicatorDefinitionId: indicatorId,
            programmeId: indicator.programme_id,
            errorMessage: error instanceof Error ? error.message : "Evidence source unavailable.",
            success: false,
          });
        }
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Measurement workspace is temporarily unavailable.";
    logImpactIndicatorDiagnostic({
      operation: "indicator_measurement_studio_load_failed",
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      indicatorDefinitionId: indicatorId,
      errorMessage: loadError,
      success: false,
    });
  }

  if (!indicator || loadError) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          title="Measurement studio could not load"
          description={loadError ?? "The indicator or current programme scope is temporarily unavailable. No measurement data has been changed."}
          icon={FileWarning}
        />
      </section>
    );
  }

  if (!optionsAvailable) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          title="Measurement options unavailable"
          description="Scoped programme, beneficiary, assessment, and field-visit options could not be loaded. No values are being inferred."
          icon={Target}
        />
      </section>
    );
  }

  return (
    <MeasurementCaptureStudio
      indicator={indicator}
      options={options}
      evidence={evidence}
      evidenceAvailable={evidenceAvailable}
      action={createMeasurementAction.bind(null, indicatorId)}
      error={query.error}
      role={ctx.role}
      canOpenEvidence={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence")}
      canOpenReports={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports")}
    />
  );
}
