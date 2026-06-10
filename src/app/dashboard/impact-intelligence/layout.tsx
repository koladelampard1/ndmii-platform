import { ReactNode } from "react";
import { requireImpactRoute } from "./_route-guards";
import { ImpactIntelligenceShell } from "./impact-intelligence-shell";

export default async function ImpactIntelligenceLayout({ children }: { children: ReactNode }) {
  const ctx = await requireImpactRoute("/dashboard/impact-intelligence");
  return (
    <ImpactIntelligenceShell role={ctx.role} fullName={ctx.fullName} email={ctx.email}>
      {children}
    </ImpactIntelligenceShell>
  );
}
