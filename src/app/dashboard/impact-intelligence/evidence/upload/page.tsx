import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  FileWarning,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { EmptyState } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";
import { requireImpactRoute } from "../../_route-guards";
import {
  IMPACT_EVIDENCE_EXTENSIONS,
  IMPACT_EVIDENCE_MAX_FILE_SIZE,
  IMPACT_EVIDENCE_MIME_TYPES,
  EMPTY_IMPACT_EVIDENCE_UPLOAD_OPTIONS,
  getImpactEvidenceUploadOptions,
  normalizeImpactEvidenceUploadOptions,
  uploadImpactEvidence,
} from "@/lib/data/impact-evidence";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canRole } from "@/lib/impact-intelligence/permissions";
import { CreateEvidenceForm } from "../create-evidence-form";

const ROUTE = "/dashboard/impact-intelligence/evidence/upload";
const EVIDENCE_ROUTE = "/dashboard/impact-intelligence/evidence";

const EXPECTED_UPLOAD_ERRORS = [
  "Select a programme",
  "Select a beneficiary cohort",
  "Select a cohort beneficiary",
  "Selected evidence",
  "Choose an evidence file",
  "Evidence file must be",
  "Evidence must be",
  "already uploaded",
  "assigned visits or beneficiaries",
  "permission to upload",
  "storage is unavailable",
  "upload failed",
  "could not be saved",
  "could not be checked",
  "could not be validated",
  "links could not be saved",
];

type SearchParams = Promise<{
  programme_id?: string;
  cohort_id?: string;
  error?: string;
}>;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isExpectedUploadError(error: unknown) {
  return error instanceof Error && EXPECTED_UPLOAD_ERRORS.some((message) => error.message.includes(message));
}

function hasValidUploadOptionCollections(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const options = value as Record<string, unknown>;
  return Array.isArray(options.programmes)
    && Array.isArray(options.cohorts)
    && Array.isArray(options.members)
    && Array.isArray(options.interventions)
    && Array.isArray(options.assessments)
    && Array.isArray(options.visits);
}

async function uploadEvidenceAction(formData: FormData) {
  "use server";
  const ctx = await requireImpactRoute(ROUTE);
  try {
    const evidenceId = await uploadImpactEvidence(ctx, formData);
    redirect(`${EVIDENCE_ROUTE}/${evidenceId}?success=Evidence%20uploaded`);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "evidence_upload_studio_submit_failed", error });
    if (!isExpectedUploadError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Evidence upload could not be completed.");
    redirect(`${ROUTE}?${params}`);
  }
}

export default async function EvidenceUploadPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams ?? {};
  const ctx = await requireImpactRoute(ROUTE);
  const canCreate = canRole(ctx.role, "evidence", "create");
  let options = EMPTY_IMPACT_EVIDENCE_UPLOAD_OPTIONS;
  let optionsAvailable = false;
  let loadError: string | null = null;

  if (canCreate) {
    try {
      const loadedOptions = await getImpactEvidenceUploadOptions(ctx, {
        programmeId: query.programme_id,
        cohortId: query.cohort_id,
      });
      if (!hasValidUploadOptionCollections(loadedOptions)) {
        logImpactRouteDiagnostic({
          ctx,
          route: ROUTE,
          operation: "evidence_upload_studio_options_shape_invalid",
          error: new Error("Evidence upload options returned an invalid collection shape."),
        });
      }
      options = normalizeImpactEvidenceUploadOptions(loadedOptions);
      optionsAvailable = true;
    } catch (error) {
      unstable_rethrow(error);
      logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "evidence_upload_studio_options_load_failed", error });
      loadError = "Upload options are temporarily unavailable.";
    }
  }

  const scopeMessage = getProgrammeScopeEmptyMessage(ctx);
  const noScopedOptions = optionsAvailable && options.programmes.length === 0;
  const currentUserName = ctx.fullName ?? ctx.email ?? "Current user";

  return (
    <section className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-[#071733] px-5 py-6 text-white shadow-xl shadow-slate-300/30 sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-100/70">
            <Link href="/dashboard/impact-intelligence" className="hover:text-white">Impact Intelligence</Link>
            <span>/</span>
            <Link href={EVIDENCE_ROUTE} className="hover:text-white">Evidence</Link>
            <span>/</span>
            <span className="text-white">Upload Studio</span>
          </nav>
          <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10"><Upload className="h-5 w-5 text-emerald-300" /></span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Evidence Upload Studio</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Upload Evidence</h1>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-blue-100/80">
                Attach verified field, assessment, or programme evidence to support institutional impact claims.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold">
                <BadgeCheck className="h-3.5 w-3.5 text-blue-300" /> {humanize(ctx.role)}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold ${canCreate && optionsAvailable && !noScopedOptions ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200"}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {canCreate && optionsAvailable && !noScopedOptions ? "Upload workspace ready" : "Upload unavailable"}
              </span>
              <Link href={EVIDENCE_ROUTE} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold hover:bg-white/10">
                <ArrowLeft className="h-3.5 w-3.5" /> Evidence portfolio
              </Link>
            </div>
          </div>
          <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            <div className="flex items-center gap-3"><LockKeyhole className="h-4 w-4 text-emerald-300" /><div><p className="text-[9px] uppercase tracking-[0.1em] text-blue-100/50">Storage</p><p className="text-[11px] font-bold">Private evidence vault</p></div></div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-emerald-300" /><div><p className="text-[9px] uppercase tracking-[0.1em] text-blue-100/50">Integrity</p><p className="text-[11px] font-bold">Checksum recorded on upload</p></div></div>
            <div className="flex items-center gap-3"><BadgeCheck className="h-4 w-4 text-emerald-300" /><div><p className="text-[9px] uppercase tracking-[0.1em] text-blue-100/50">Scope</p><p className="text-[11px] font-bold">Policy-filtered programme context</p></div></div>
          </div>
        </div>
      </header>

      {query.error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <div><p className="font-bold">Upload could not be completed</p><p className="mt-1 text-xs">{query.error}</p></div>
        </div>
      )}

      {!canCreate ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState title="Upload action unavailable" description={`${humanize(ctx.role)} has read-only evidence access under the current policy. No upload action is exposed.`} icon={LockKeyhole} />
        </div>
      ) : !optionsAvailable ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState title="Upload workspace unavailable" description={loadError ?? "The scoped upload options could not be loaded. No programme context is being inferred."} icon={FileWarning} />
        </div>
      ) : noScopedOptions ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState title="No upload scope available" description={scopeMessage ?? "No assigned beneficiary, visit, or programme options are available for evidence upload."} icon={LockKeyhole} />
        </div>
      ) : (
        <CreateEvidenceForm
          key={`${query.programme_id ?? ""}:${query.cohort_id ?? ""}`}
          options={options}
          selectedProgrammeId={query.programme_id ?? ""}
          selectedCohortId={query.cohort_id ?? ""}
          action={uploadEvidenceAction}
          currentUserName={currentUserName}
          currentRole={ctx.role}
          maxFileSizeBytes={IMPACT_EVIDENCE_MAX_FILE_SIZE}
          acceptedMimeTypes={Array.from(IMPACT_EVIDENCE_MIME_TYPES)}
          acceptedExtensions={Array.from(IMPACT_EVIDENCE_EXTENSIONS)}
        />
      )}
    </section>
  );
}
