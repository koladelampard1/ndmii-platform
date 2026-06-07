import type { ReactNode } from "react";
import { requireImpactRoute } from "../../_route-guards";

export default async function AssessmentTemplatesLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence/assessments/templates");
  return children;
}
