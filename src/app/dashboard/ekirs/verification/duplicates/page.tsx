import Link from "next/link";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { StatusBadge } from "@/components/state-revenue/state-revenue-components";
import { listStateRevenueApplications } from "@/lib/state-revenue/onboarding";

export default async function EkirsDuplicateReviewPage() {
  const applications = (await listStateRevenueApplications({ jurisdictionId: "ekiti" })).filter((row: any) =>
    ["duplicate_review_required", "under_review", "submitted"].includes(row.current_status)
    || ["possible_match", "strong_match", "manual_review_required"].includes(row.duplicate_status),
  );

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Identity governance"
        title="Duplicate Review"
        description="Review possible canonical-identity matches before creating or linking a DBIN business identity. Strong matches block automatic identity creation."
        disclosure="Possible duplicate records are preserved for governed resolution; the workspace does not destructively merge records."
      />
      <WorkspaceSection title={`${applications.length} candidate${applications.length === 1 ? "" : "s"}`} description="Only authorised reviewers can resolve duplicate identity conflicts.">
        {!applications.length ? <WorkspaceState type="empty" title="No duplicate candidates" description="Applications with strong or possible identity matches will appear here." /> : (
          <div className="grid gap-3">
            {applications.map((row: any) => (
              <Link key={row.id} href={`/dashboard/ekirs/applications/${row.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{row.proposed_business_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.application_reference}</p>
                  </div>
                  <StatusBadge tone={row.duplicate_status === "strong_match" ? "rose" : "amber"}>{row.duplicate_status.replace(/_/g, " ")}</StatusBadge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
