import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSESSMENT_MANAGE_ROLES,
  ASSESSMENT_REVIEW_ROLES,
  completeAssessment,
  getImpactAssessmentDetail,
  reviewAssessment,
  saveAssessmentResponse,
  type ImpactAssessmentQuestion,
  type ImpactAssessmentResponse,
} from "@/lib/data/impact-intelligence";

async function saveResponsesAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await saveAssessmentResponse(ctx, assessmentId, formData);
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

async function completeAssessmentAction(assessmentId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  await completeAssessment(ctx, assessmentId);
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

async function reviewAssessmentAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await reviewAssessment(ctx, assessmentId, formData);
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
  if (status === "completed") return "bg-blue-100 text-blue-700";
  if (status === "in_progress" || status === "submitted") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AssessmentDetailPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const [ctx, detail] = await Promise.all([getCurrentUserContext(), getImpactAssessmentDetail(assessmentId)]);
  const { assessment, template, sections, questions, responses, scores, reviews } = detail;
  if (!assessment) notFound();

  const canManage = ASSESSMENT_MANAGE_ROLES.includes(ctx.role);
  const canReview = ASSESSMENT_REVIEW_ROLES.includes(ctx.role);
  const locked = assessment.status === "reviewed" || assessment.status === "approved";
  const saveResponses = saveResponsesAction.bind(null, assessment.id);
  const complete = completeAssessmentAction.bind(null, assessment.id);
  const review = reviewAssessmentAction.bind(null, assessment.id);
  const overall = scores.find((score) => score.section_id === null);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{template?.name ?? "Assessment"} v{assessment.template_version ?? template?.version ?? 1}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{assessment.title ?? template?.name ?? "MSME assessment"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{assessment.msmes?.business_name ?? "Unlinked MSME"} • {assessment.impact_programmes?.name ?? "No programme"} • {assessment.impact_interventions?.title ?? "No intervention"}</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(assessment.status)}`}>{assessment.status ?? "draft"}</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Overall score</p><p className="mt-1 text-xl font-semibold text-slate-950">{overall ? `${overall.weighted_score.toFixed(1)}%` : "Pending"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Readiness</p><p className="mt-1 text-xl font-semibold capitalize text-slate-950">{overall?.readiness_category ?? assessment.risk_level ?? "Pending"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Responses</p><p className="mt-1 text-xl font-semibold text-slate-950">{responses.length}/{questions.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Reviews</p><p className="mt-1 text-xl font-semibold text-slate-950">{reviews.length}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <form action={saveResponses} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950">Assessment response</h2>
            {canManage && !locked && <Button type="submit">Save responses</Button>}
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
                          <span>{question.question_text} {question.is_required && <span className="text-red-600">*</span>}</span>
                          <QuestionInput question={question} responses={responses} disabled={!canManage || locked} />
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
            <form action={complete} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Completion</h2>
              <p className="mt-2 text-sm text-slate-600">Completing validates required responses and recalculates the score.</p>
              <Button type="submit" className="mt-4 w-full">Complete assessment</Button>
            </form>
          )}

          {canReview && assessment.status === "completed" && (
            <form action={review} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Review assessment</h2>
              <select name="review_status" defaultValue="reviewed" className="mt-3 w-full rounded-md border px-3 py-2 text-sm">
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="returned">Return for update</option>
              </select>
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
