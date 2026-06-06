import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { FileArchive } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import {
  IMPACT_EVIDENCE_CREATE_ROLES,
  type ImpactEvidenceRecord,
  type ImpactEvidenceUploadOptions,
  getImpactEvidenceUploadOptions,
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  uploadImpactEvidence,
} from "@/lib/data/impact-evidence";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge } from "../_components";
import { CreateEvidenceForm } from "./create-evidence-form";

type SearchParams = {
  create_programme_id?: string;
  create_cohort_id?: string;
  error?: string;
  success?: string;
};

const EMPTY_UPLOAD_OPTIONS: ImpactEvidenceUploadOptions = {
  programmes: [],
  cohorts: [],
  members: [],
  interventions: [],
  assessments: [],
  visits: [],
};

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

function isExpectedUploadError(error: unknown) {
  return error instanceof Error && EXPECTED_UPLOAD_ERRORS.some((message) => error.message.includes(message));
}

async function uploadEvidenceAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    const evidenceId = await uploadImpactEvidence(ctx, formData);
    redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}?success=Evidence%20uploaded`);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedUploadError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Evidence upload could not be completed.");
    redirect(`/dashboard/impact-intelligence/evidence?${params}`);
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not uploaded";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function displayName(item: ImpactEvidenceRecord) {
  return item.original_filename ?? item.file_name ?? "Evidence file";
}

export default async function EvidencePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const filters = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let evidence: ImpactEvidenceRecord[] = [];
  let uploadOptions = EMPTY_UPLOAD_OPTIONS;
  let loadError: string | null = null;

  try {
    ctx = await getCurrentUserContext();
    evidence = await listImpactEvidence(ctx, { limit: 100 });
    if ((IMPACT_EVIDENCE_CREATE_ROLES as readonly string[]).includes(ctx.role)) {
      uploadOptions = await getImpactEvidenceUploadOptions(ctx, {
        programmeId: filters.create_programme_id,
        cohortId: filters.create_cohort_id,
      });
    }
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Impact evidence is temporarily unavailable.";
    logImpactEvidenceDiagnostic({
      operation: "evidence_page_load_failed",
      actorRole: ctx?.role ?? null,
      errorMessage: loadError,
      success: false,
    });
  }

  const canCreate = Boolean(ctx && (IMPACT_EVIDENCE_CREATE_ROLES as readonly string[]).includes(ctx.role));

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Programme assurance"
        title="Evidence Repository"
        description="Upload, review, and securely access evidence anchored to programme cohorts, beneficiaries, interventions, assessments, and field monitoring."
        badge={`${evidence.length} records`}
        actions={[{ href: "/dashboard/impact-intelligence/monitoring", label: "Monitoring", icon: FileArchive }]}
      />

      {loadError && (
        <SectionCard title="Evidence Repository Unavailable">
          <EmptyState
            title="Evidence records could not load"
            description={loadError.includes("permission") ? "Your signed-in role does not currently have evidence access. Ask an administrator to verify your assigned role." : "Evidence records are temporarily unavailable. Try again after the data source is restored."}
            icon={FileArchive}
          />
        </SectionCard>
      )}

      {!loadError && filters.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{filters.error}</div>
      )}

      {!loadError && filters.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{filters.success}</div>
      )}

      {!loadError && canCreate && (
        <SectionCard title="Upload cohort-anchored evidence">
          <CreateEvidenceForm
            key={`${filters.create_programme_id ?? ""}:${filters.create_cohort_id ?? ""}`}
            options={uploadOptions}
            selectedProgrammeId={filters.create_programme_id ?? ""}
            selectedCohortId={filters.create_cohort_id ?? ""}
            action={uploadEvidenceAction}
          />
        </SectionCard>
      )}

      {!loadError && (
        <SectionCard title="Evidence Register" action={<QuickLink href="/dashboard/impact-intelligence/monitoring">Monitoring</QuickLink>}>
          {evidence.length === 0 ? (
            <EmptyState
              title="No evidence uploaded"
              description={canCreate ? "Use the constrained upload form to add the first evidence file." : "Evidence within your assigned scope will appear here."}
              icon={FileArchive}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {evidence.map((item) => (
                <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold uppercase text-slate-500">
                      {(item.mime_type?.split("/")[1] ?? item.file_type ?? "file").slice(0, 4)}
                    </div>
                    <StatusBadge value={item.status ?? "draft"} />
                  </div>
                  <h2 className="mt-3 break-words font-semibold text-slate-950">{displayName(item)}</h2>
                  <p className="mt-1 text-sm text-slate-600">{item.description ?? "No evidence context note."}</p>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>{item.impact_programmes?.name ?? "Legacy/unlinked programme"} · {item.impact_beneficiary_cohorts?.name ?? "Legacy/unlinked cohort"}</p>
                    <p>{item.msmes?.business_name ?? "Legacy/unlinked beneficiary"} · {formatDate(item.uploaded_at ?? item.created_at)}</p>
                    <p>Uploaded by {item.uploaded_by?.full_name ?? item.uploaded_by?.email ?? "Unknown user"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </section>
  );
}
