import { redirect, unstable_rethrow } from "next/navigation";
import { FileWarning, LockKeyhole } from "lucide-react";
import { EmptyState } from "../../_components";
import { requireImpactRoute } from "../../_route-guards";
import {
  INDICATOR_DEFINITION_MANAGE_ROLES,
  createIndicatorDefinition,
  getIndicatorFormOptions,
  logImpactIndicatorDiagnostic,
  type IndicatorFormOptions,
} from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { IndicatorDesignStudio } from "./indicator-design-studio";

const ROUTE = "/dashboard/impact-intelligence/indicators/create";
const INDICATORS_ROUTE = "/dashboard/impact-intelligence/indicators";
const EXPECTED_ACTION_ERRORS = [
  "required",
  "select a valid",
  "indicator definition",
  "permission",
  "duplicate key",
  "already exists",
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

function hasValidOptionCollections(value: unknown): value is IndicatorFormOptions {
  if (!value || typeof value !== "object") return false;
  const options = value as Record<string, unknown>;
  return ["programmes", "cohorts", "members", "interventions", "assessments", "scoreRuns", "visits", "users"]
    .every((key) => Array.isArray(options[key]));
}

function isExpectedActionError(error: unknown) {
  return error instanceof Error
    && EXPECTED_ACTION_ERRORS.some((message) => error.message.toLowerCase().includes(message));
}

async function createIndicatorAction(formData: FormData) {
  "use server";
  const ctx = await requireImpactRoute(ROUTE);
  try {
    await createIndicatorDefinition(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactIndicatorDiagnostic({
      operation: "indicator_design_studio_submit_failed",
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      programmeId: typeof formData.get("programme_id") === "string" ? String(formData.get("programme_id")) : null,
      errorMessage: error instanceof Error ? error.message : "Indicator definition could not be created.",
      success: false,
    });
    if (!isExpectedActionError(error)) throw error;
    const message = error instanceof Error ? error.message : "Indicator definition could not be created.";
    redirect(`${INDICATORS_ROUTE}?error=${encodeURIComponent(message)}`);
  }
  redirect(`${INDICATORS_ROUTE}?success=${encodeURIComponent("Indicator definition created.")}`);
}

export default async function CreateIndicatorPage({ searchParams }: { searchParams: SearchParams }) {
  const query = (await searchParams) ?? {};
  const ctx = await requireImpactRoute(ROUTE);

  if (ctx.role === "field_officer") redirect("/access-denied");

  const canCreate = canRole(ctx.role, "indicator", "create")
    && (INDICATOR_DEFINITION_MANAGE_ROLES as readonly string[]).includes(ctx.role);
  const canOpenAnalytics = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/analytics");
  let options = EMPTY_OPTIONS;
  let optionsAvailable = false;
  let loadError: string | null = null;

  if (canCreate) {
    try {
      const loadedOptions = await getIndicatorFormOptions(ctx);
      if (!hasValidOptionCollections(loadedOptions)) {
        throw new Error("Indicator options returned an invalid collection shape.");
      }
      options = loadedOptions;
      optionsAvailable = true;
    } catch (error) {
      unstable_rethrow(error);
      loadError = "Indicator design options are temporarily unavailable.";
      logImpactIndicatorDiagnostic({
        operation: "indicator_design_studio_options_load_failed",
        role: ctx.role,
        authUserId: ctx.authUserId,
        appUserId: ctx.appUserId,
        errorMessage: error instanceof Error ? error.message : loadError,
        success: false,
      });
    }
  }

  const noScopedProgrammes = optionsAvailable && options.programmes.length === 0;

  if (!canCreate) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          title="Indicator design is read-only"
          description="Your current role can review indicator definitions but cannot create them under the existing policy."
          icon={LockKeyhole}
        />
      </section>
    );
  }

  if (!optionsAvailable) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          title="Indicator studio could not load"
          description={loadError ?? "Scoped indicator options are temporarily unavailable. No indicator data has been changed."}
          icon={FileWarning}
        />
      </section>
    );
  }

  return (
    <IndicatorDesignStudio
      options={options}
      action={createIndicatorAction}
      error={query.error}
      role={ctx.role}
      canOpenAnalytics={canOpenAnalytics}
      scopeNotice={noScopedProgrammes ? getProgrammeScopeEmptyMessage(ctx) : null}
    />
  );
}
