import type { ReactNode } from "react";
import { requireImpactPortfolioRoute } from "../_route-guards";

export default async function ProgrammesLayout({ children }: { children: ReactNode }) {
  await requireImpactPortfolioRoute("/dashboard/impact-intelligence/programmes");
  return children;
}
