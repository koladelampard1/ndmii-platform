import type { ReactNode } from "react";
import { requireImpactRoute } from "../_route-guards";

export default async function IntelligenceLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence/intelligence");
  return children;
}
