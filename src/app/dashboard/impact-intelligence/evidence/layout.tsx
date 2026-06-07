import type { ReactNode } from "react";
import { requireImpactRoute } from "../_route-guards";

export default async function EvidenceLayout({ children }: { children: ReactNode }) {
  await requireImpactRoute("/dashboard/impact-intelligence/evidence");
  return children;
}
