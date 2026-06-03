import type { ReactNode } from "react";
import { requireImpactPortfolioRoute } from "../_route-guards";

export default async function InterventionsLayout({ children }: { children: ReactNode }) {
  await requireImpactPortfolioRoute("/dashboard/impact-intelligence/interventions");
  return children;
}
