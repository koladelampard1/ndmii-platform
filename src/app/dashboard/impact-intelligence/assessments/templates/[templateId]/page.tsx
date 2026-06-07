import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getAssessmentTemplate } from "@/lib/data/impact-intelligence";
import { EmptyState, SectionCard } from "../../../_components";
import { logImpactRouteDiagnostic } from "../../../_diagnostics";

function optionsText(options: unknown) {
  if (!Array.isArray(options) || options.length === 0) return "No options";
  return options
    .map((option) => {
      if (typeof option === "string") return option;
      if (option && typeof option === "object" && "label" in option) return String(option.label);
      return null;
    })
    .filter(Boolean)
    .join(", ");
}

export default async function AssessmentTemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getAssessmentTemplate>> | null = null;
  try {
    ctx = await getCurrentUserContext();
    detail = await getAssessmentTemplate(templateId, ctx);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/assessments/templates/[templateId]", operation: "assessment_template_detail_load_failed", error });
    return (
      <section className="space-y-6">
        <SectionCard title="Assessment Template Unavailable">
          <EmptyState title="Assessment template could not load" description="The template source, current session, or role assignment is temporarily unavailable." icon={ClipboardCheck} />
        </SectionCard>
      </section>
    );
  }
  const { template, sections, questions } = detail;
  if (!template) notFound();

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{template.assessment_type} template</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{template.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{template.description ?? "No description has been recorded for this template."}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">v{template.version}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{template.status}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Sections</p><p className="mt-1 text-xl font-semibold text-slate-950">{sections.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Questions</p><p className="mt-1 text-xl font-semibold text-slate-950">{questions.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Total weight</p><p className="mt-1 text-xl font-semibold text-slate-950">{questions.reduce((sum, question) => sum + Number(question.weight ?? 0), 0)}</p></div>
      </div>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Question structure</h2>
          <Link href="/dashboard/impact-intelligence/assessments" className="text-sm font-medium text-emerald-700">Create assessment</Link>
        </div>
        <div className="mt-4 space-y-4">
          {sections.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No sections have been defined for this template.</p>
          ) : (
            sections.map((section) => {
              const sectionQuestions = questions.filter((question) => question.section_id === section.id);
              return (
                <section key={section.id} className="rounded-lg border">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <h3 className="font-medium text-slate-950">{section.display_order}. {section.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Weight: {section.weight}</p>
                  </div>
                  {sectionQuestions.length === 0 ? (
                    <p className="p-4 text-sm text-slate-600">No questions in this section.</p>
                  ) : (
                    <div className="divide-y">
                      {sectionQuestions.map((question) => (
                        <div key={question.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_9rem_6rem]">
                          <div>
                            <p className="font-medium text-slate-950">{question.question_text}</p>
                            <p className="mt-1 text-xs text-slate-500">{question.category ?? "uncategorized"} • {question.is_required ? "required" : "optional"} • {optionsText(question.options_json)}</p>
                          </div>
                          <p className="text-slate-600">{question.question_type}</p>
                          <p className="text-slate-600">Weight {question.weight}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}
