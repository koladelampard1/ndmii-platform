import Link from "next/link";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { StatusBadge } from "@/components/state-revenue/state-revenue-components";
import { getCurrentUserContext } from "@/lib/auth/session";
import { listStateRevenueApplications } from "@/lib/state-revenue/onboarding";

export default async function EkirsFieldVerificationPage() {
  const ctx = await getCurrentUserContext();
  const applications = await listStateRevenueApplications({ jurisdictionId: "ekiti", ctx, queue: "field" });

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Field operations"
        title="Field Verification"
        description="Assigned field-verification work for Ekiti operating-location confirmation. GPS capture is consent-led and not mandatory in Sprint 1."
        disclosure="Field officers see assigned work only when scoped role and assignment policies are active."
      />
      <WorkspaceSection title={`${applications.length} field item${applications.length === 1 ? "" : "s"}`} description="Field outcomes support eligibility; field officers do not approve final applications by default.">
        {!applications.length ? <WorkspaceState type="empty" title="No field verification tasks" description="Applications referred for field verification will appear here." /> : (
          <div className="grid gap-3">
            {applications.map((row: any) => {
              const location = row.state_revenue_operating_locations?.[0];
              return (
                <Link key={row.id} href={`/dashboard/ekirs/applications/${row.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{row.proposed_business_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.application_reference} · {location ? `${location.lga_name}, ${location.town}` : "Location pending"}</p>
                    </div>
                    <StatusBadge tone="sky">{row.current_status.replace(/_/g, " ")}</StatusBadge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
