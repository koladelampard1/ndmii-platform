import type { ReactNode } from "react";
import { requireImpactRoute } from "../_route-guards";

export default async function IndicatorsLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence/indicators");
  return children;
}
