import { redirect } from "next/navigation";

const SECTION_REDIRECTS: Record<string, string> = {
  "business-pipeline": "/dashboard/impact-intelligence/cohorts",
  "funding-programmes": "/dashboard/impact-intelligence/programmes",
  "funding-pipeline": "/dashboard/impact-intelligence/interventions",
  "investment-readiness": "/dashboard/impact-intelligence/assessments",
  documents: "/dashboard/impact-intelligence/evidence",
  "portfolio-monitoring": "/dashboard/impact-intelligence/monitoring",
  "portfolio-intelligence": "/dashboard/impact-intelligence/analytics",
  reports: "/dashboard/impact-intelligence/reports",
  "risk-signals": "/dashboard/impact-intelligence/risk-flags",
  executive: "/dashboard/impact-intelligence/executive",
};

export default async function BoiWorkspaceSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  redirect(SECTION_REDIRECTS[section] ?? "/dashboard/boi");
}
