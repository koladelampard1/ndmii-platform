import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSESSMENT_MANAGE_ROLES,
  ASSESSMENT_REVIEW_ROLES,
  getMissingRequiredAssessmentQuestions,
  getImpactAssessmentDetail,
  reviewAssessment,
  saveAssessmentDraft,
  submitAssessment,
  type ImpactAssessmentQuestion,
  type ImpactAssessmentResponse,
} from "@/lib/data/impact-intelligence";
import {
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
} from "@/lib/data/impact-evidence";

const EXPECTED_ASSESSMENT_ERRORS = [
  "Required question missing:",
  "must be numeric.",
  "must be a valid date.",
  "must use one of the configured options.",
  "contains a selection that is not configured",
  "Return reason is required",
  "Reviewed or completed assessments cannot be edited.",
  "You do not have permission to manage impact assessments.",
  "You do not have permission to review impact assessments.",
];

function isExpectedAssessmentError(error: unknown) {
  return error instanceof Error && EXPECTED_ASSESSMENT_ERRORS.some((message) => error.message.includes(message));
}

function redirectWithAssessmentError(assessmentId: string, error: unknown) {
  const params = new URLSearchParams();
  params.set("error", error instanceof Error ? error.message : "Assessment action could not be completed.");
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}?${params.toString()}`);
}

async function saveDraftAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await saveAssessmentDraft(ctx, assessmentId, formData);
  } catch (error) {
    if (!isExpectedAssessmentError(error)) throw error;
    redirectWithAssessmentError(assessmentId, error);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

async function submitAssessmentAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await submitAssessment(ctx, assessmentId, formData);
  } catch (error) {
    if (!isExpectedAssessmentError(error)) throw error;
    redirectWithAssessmentError(assessmentId, error);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

async function reviewAssessmentAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await reviewAssessment(ctx, assessmentId, formData);
  } catch (error) {
    if (!isExpectedAssessmentError(error)) throw error;
    redirectWithAssessmentError(assessmentId, error);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

function responseValue(question: ImpactAssessmentQuestion, responses: ImpactAssessmentResponse[]) {
  const response = responses.find((item) => item.question_id === question.id);
  if (!response) return "";
  if (question.question_type === "number") return response.response_number?.toString() ?? "";
  if (question.question_type === "boolean") return response.response_boolean ? "true" : "false";
  if (question.question_type === "multi-select") {
    const values = response.response_json?.values;
    return Array.isArray(values) ? values.join(", ") : response.response_text ?? "";
  }
  return response.response_text ?? "";
}

function optionsFor(question: ImpactAssessmentQuestion) {
  if (!Array.isArray(question.options_json)) return [];
  return question.options_json
    .map((option) => {
      if (typeof option === "string") return { label: option, value: option };
      if (option && typeof option === "object" && "value" in option) return { label: String("label" in option ? option.label : option.value), value: String(option.value) };
      return null;
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;
}

function QuestionInput({ question, responses, disabled }: { question: ImpactAssessmentQuestion; responses: ImpactAssessmentResponse[]; disabled: boolean }) {
  const name = `response_${question.id}`;
  const value = responseValue(question, responses);
  const baseClass = "w-full rounded-md border px-3 py-2 text-sm font-normal disabled:bg-slate-50";
  if (question.question_type === "textarea") return <textarea disabled={disabled} name={name} rows={3} defaultValue={value} className={baseClass} />;
  if (question.question_type === "number") return <input disabled={disabled} name={name} type="number" step="0.01" defaultValue={value} className={baseClass} />;
  if (question.question_type === "boolean") {
    return (
      <select disabled={disabled} name={name} defaultValue={value} className={baseClass}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (question.question_type === "date") return <input disabled={disabled} name={name} type="date" defaultValue={value} className={baseClass} />;
  if (question.question_type === "select") {
    const options = optionsFor(question);
    return (
      <select disabled={disabled} name={name} defaultValue={value} className={baseClass}>
        <option value="">Select</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  if (question.question_type === "multi-select") return <input disabled={disabled} name={name} defaultValue={value} className={baseClass} placeholder="Comma-separated selections" />;
  if (question.question_type === "file_upload") return <input disabled={disabled} name={name} defaultValue={value} className={baseClass} placeholder="File upload placeholder or evidence reference" />;
  return <input disabled={disabled} name={name} defaultValue={value} className={baseClass} />;
}

function statusClass(status: string | null) {
  if (status === "reviewed" || status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "submitted" || status === "completed") return "bg-blue-100 text-blue-700";
  if (status === "returned") return "bg-red-100 text-red-700";
  if (status === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { assessmentId } = await params;
  const query = await searchParams;
  const ctx = await getCurrentUserContext();
  const [detail, evidenceFiles] = await Promise.all([
    getImpactAssessmentDetail(assessmentId, ctx),
    listImpactEvidence(ctx, { assessmentId, limit: 100 }).catch(() => {
      logImpactEvidenceDiagnostic({
        operation: "assessment_detail_evidence_unavailable",
        actorRole: ctx.role,
        success: false,
        errorCode: "source_unavailable",
      });
      return [];
    }),
  ]);
  const { assessment, template, sections, questions, responses, scores, reviews, visits } = detail;
  if (!assessment) notFound();

  const canManage = ASSESSMENT_MANAGE_ROLES.includes(ctx.role);
  const canReview = ASSESSMENT_REVIEW_ROLES.includes(ctx.role);
  const locked = assessment.status === "reviewed" || assessment.status === "approved" || assessment.status === "completed";
  const saveDraft = saveDraftAction.bind(null, assessment.id);
  const submit = submitAssessmentAction.bind(null, assessment.id);
  const review = reviewAssessmentAction.bind(null, assessment.id);
  const overall = scores.find((score) => score.section_id === null);
  const missingRequiredQuestions = getMissingRequiredAssessmentQuestions(questions, responses);
  const missingRequiredQuestionIds = new Set(missingRequiredQuestions.map((question) => question.id));

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{template?.name ?? "Assessment"} v{assessment.template_version ?? template?.version ?? 1}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{assessment.title ?? template?.name ?? "MSME assessment"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{assessment.msmes?.business_name ?? "Unlinked MSME"} • {assessment.impact_programmes?.name ?? "No programme"} • {assessment.impact_beneficiary_cohorts?.name ?? "Legacy/unanchored cohort"} • {assessment.impact_interventions?.title ?? "No intervention"}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(assessment.status)}`}>{assessment.status ?? "draft"}</span>
        </div>
      </header>

      {query.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {query.error}
        </div>
      )}

      {assessment.status === "returned" && assessment.return_reason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Returned for correction:</span> {assessment.return_reason}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Overall score</p><p className="mt-1 text-xl font-semibold text-slate-950">{overall ? `${overall.weighted_score.toFixed(1)}%` : "Pending"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Readiness</p><p className="mt-1 text-xl font-semibold capitalize text-slate-950">{overall?.readiness_category ?? assessment.risk_level ?? "Pending"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Responses</p><p className="mt-1 text-xl font-semibold text-slate-950">{responses.length}/{questions.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Reviews</p><p className="mt-1 text-xl font-semibold text-slate-950">{reviews.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Programme</p><p className="mt-1 font-semibold text-slate-950">{assessment.impact_programmes?.name ?? "Unassigned"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Cohort</p><p className="mt-1 font-semibold text-slate-950">{assessment.impact_beneficiary_cohorts?.name ?? "Legacy/unanchored"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Beneficiary status</p><p className="mt-1 font-semibold text-slate-950">{assessment.impact_cohort_members?.member_status ?? "Not anchored"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Field visit</p><p className="mt-1 font-semibold text-slate-950">{assessment.impact_field_visits?.title ?? "Not linked"}</p></div>
      </div>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Related field visits</h2>
        {visits.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No field visits are linked to this assessment yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visits.map((visit) => (
              <Link key={visit.id} href={`/dashboard/impact-intelligence/monitoring/${visit.id}`} className="rounded-lg border p-3 hover:border-emerald-200 hover:bg-emerald-50/40">
                <p className="font-medium text-slate-950">{visit.title ?? "Field visit"}</p>
                <p className="mt-1 text-xs text-slate-500">{visit.location_text ?? "Location pending"} • {visit.status ?? "pending"}</p>
              </Link>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Assessment evidence ({evidenceFiles.length})</h2>
          <Link href={`/dashboard/impact-intelligence/evidence?create_programme_id=${assessment.programme_id ?? ""}&create_cohort_id=${assessment.cohort_id ?? ""}`} className="text-sm font-medium text-emerald-700">Open evidence repository</Link>
        </div>
        {evidenceFiles.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No evidence is linked to this assessment.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {evidenceFiles.map((item) => (
              <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`} className="rounded-lg border p-3 hover:border-emerald-200 hover:bg-emerald-50/40">
                <p className="font-medium text-slate-950">{item.original_filename ?? item.file_name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status} · {item.evidence_category?.replaceAll("_", " ") ?? "other"}</p>
              </Link>
            ))}
          </div>
        )}
      </article>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <form action={saveDraft} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950">Assessment response</h2>
            {canManage && !locked && (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary">Save Draft</Button>
                <Button type="submit" formAction={submit}>Submit Assessment</Button>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-5">
            {sections.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">This assessment template has no sections.</p>
            ) : (
              sections.map((section) => {
                const sectionQuestions = questions.filter((question) => question.section_id === section.id);
                return (
                  <section key={section.id} className="rounded-lg border">
                    <div className="border-b bg-slate-50 px-4 py-3">
                      <h3 className="font-medium text-slate-950">{section.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">Section weight {section.weight}</p>
                    </div>
                    <div className="space-y-4 p-4">
                      {sectionQuestions.map((question) => (
                        <label key={question.id} className="block space-y-2 text-sm font-medium text-slate-700">
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{question.question_text}</span>
                            {question.is_required && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Required</span>}
                            {missingRequiredQuestionIds.has(question.id) && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Missing</span>}
                          </span>
                          <QuestionInput question={question} responses={responses} disabled={!canManage || locked} />
                          {missingRequiredQuestionIds.has(question.id) && (
                            <span className="block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                              This required question must be answered before the assessment can be completed.
                            </span>
                          )}
                          <span className="block text-xs font-normal text-slate-500">{question.category ?? "uncategorized"} • weight {question.weight}{question.help_text ? ` • ${question.help_text}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </form>

        <aside className="space-y-4">
          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Scoring summary</h2>
            {scores.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">Scores calculate after responses are saved.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {scores.map((score) => (
                  <div key={score.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-medium text-slate-950">{score.section_title ?? "Overall"}</p>
                      <p className="text-slate-600">{score.weighted_score.toFixed(1)}%</p>
                    </div>
                    <p className="mt-1 text-xs capitalize text-slate-500">{score.score}/{score.max_score} • {score.readiness_category ?? "pending"}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          {canManage && !locked && (
            <article className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Submission readiness</h2>
              <p className="mt-2 text-sm text-slate-600">Drafts can be saved with missing required answers. Submission validates required answers and calculates the preliminary score.</p>
              {missingRequiredQuestions.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-semibold">Required responses missing.</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {missingRequiredQuestions.map((question) => (
                      <li key={question.id}>{question.question_text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )}

          {canReview && (assessment.status === "submitted" || assessment.status === "completed") && (
            <form action={review} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Review assessment</h2>
              <select name="review_status" defaultValue="reviewed" className="mt-3 w-full rounded-md border px-3 py-2 text-sm">
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="returned">Return for update</option>
              </select>
              <input name="return_reason" className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Return reason when correction is required" />
              <textarea name="notes" rows={4} className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Review notes" />
              <Button type="submit" className="mt-3 w-full">Submit review</Button>
            </form>
          )}

          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Review history</h2>
            {reviews.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">No reviews recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {reviews.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium capitalize text-slate-950">{item.review_status}</p>
                    <p className="mt-1 text-slate-600">{item.notes ?? "No notes"}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}
