import { FileText } from "lucide-react";
import { BusinessPlanBuilderClient } from "./business-plan-builder-client";
import { ensureBusinessPlanDraft, getBusinessPlanVersions, getBusinessPlanWorkspace } from "@/lib/data/business-plan";

export default async function MsmeBusinessPlanPage() {
  const workspace = await getBusinessPlanWorkspace();
  const { session, sessions } = await ensureBusinessPlanDraft(workspace);
  const versions = await getBusinessPlanVersions(session.id, workspace);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">MSME Growth Tools</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Business Plan Builder</h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Answer practical Nigerian MSME questions, generate a professional plan, save versions, and download a lender-ready PDF.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">{workspace.provider.display_name || workspace.msme.business_name}</p>
            <p className="mt-1 text-emerald-800/80">DBIN/MSME ID: {workspace.msme.msme_id}</p>
          </div>
        </div>
      </header>

      <BusinessPlanBuilderClient
        initialSession={session}
        initialSessions={sessions}
        initialVersions={versions}
      />
    </section>
  );
}
