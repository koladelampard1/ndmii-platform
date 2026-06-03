import type { ReactNode } from "react";
import { requireImpactRoute } from "../_route-guards";

export default async function CohortsLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence/cohorts");
  return children;
}
