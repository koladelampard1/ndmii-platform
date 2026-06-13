import { redirect, unstable_rethrow } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { canRole } from "@/lib/impact-intelligence/permissions";
import {
  createInstitutionalReport,
  getReportFormOptions,
  type ReportFormOptions,
} from "@/lib/data/impact-reports";
import { EmptyState } from "../../_components";
import { ReportCreationStudio } from "./report-creation-studio";

const ROUTE = "/dashboard/impact-intelligence/reports";
const EXPECTED_CREATE_ERRORS = ["required", "select", "does not", "permission", "unavailable", "valid"];
const EMPTY_OPTIONS: ReportFormOptions = { programmes: [], cohorts: [], members: [], interventions: [] };

async function createReportAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    const reportId = await createInstitutionalReport(ctx, formData);
    redirect(`${ROUTE}/${reportId}?success=Draft%20report%20created`);
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "Report draft could not be created.";
    if (!EXPECTED_CREATE_ERRORS.some((item) => message.toLowerCase().includes(item))) throw error;
    redirect(`${ROUTE}/new?error=${encodeURIComponent(message)}`);
  }
}

export default async function NewInstitutionalReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const query = (await searchParams) ?? {};
  let options = EMPTY_OPTIONS;
  let loadError: string | null = null;

  try {
    const ctx = await getCurrentUserContext();
    if (!canRole(ctx.role, "report", "create")) redirect("/access-denied");
    options = await getReportFormOptions(ctx);
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Report creation is temporarily unavailable.";
  }

  if (loadError) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState
          title="Report studio could not load"
          description="Programme scope options or the current session are temporarily unavailable. No report data has been changed."
          icon={FileText}
        />
      </section>
    );
  }

  return <ReportCreationStudio options={options} action={createReportAction} error={query.error} />;
}
