import type { ReactNode } from "react";
import { requireImpactRoute } from "../_route-guards";

export default async function RiskFlagsLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence/risk-flags");
  return children;
}
