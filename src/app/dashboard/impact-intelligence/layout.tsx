import { ReactNode } from "react";
import { requireImpactRoute } from "./_route-guards";

export default async function ImpactIntelligenceLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence");
  return children;
}
