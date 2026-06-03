import type { ReactNode } from "react";
import { requireImpactPortfolioRoute } from "../_route-guards";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireImpactPortfolioRoute("/dashboard/impact-intelligence/reports");
  return children;
}
