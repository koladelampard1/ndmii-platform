import type { ReactNode } from "react";
import { requireImpactPortfolioRoute } from "../_route-guards";

export default async function AssessmentsLayout({ children }: { children: ReactNode }) {
  await requireImpactPortfolioRoute("/dashboard/impact-intelligence/assessments");
  return children;
}
