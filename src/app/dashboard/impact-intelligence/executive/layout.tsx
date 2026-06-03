import type { ReactNode } from "react";
import { requireImpactPortfolioRoute } from "../_route-guards";

export default async function ExecutiveLayout({ children }: { children: ReactNode }) {
  await requireImpactPortfolioRoute("/dashboard/impact-intelligence/executive");
  return children;
}
