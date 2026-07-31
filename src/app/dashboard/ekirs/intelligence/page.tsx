import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { GeographyFoundation, StatusBadge } from "@/components/state-revenue/state-revenue-components";
import { getEkirsLgaMetrics } from "@/lib/state-revenue/ekirs-demo-data";
import { EKIRS_JURISDICTION } from "@/lib/state-revenue/jurisdictions";

export default function EkirsIntelligencePage() {
  const lgas = getEkirsLgaMetrics();
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Privacy-safe operating intelligence"
        title="LGA & LCDA Intelligence"
        description="Synthetic aggregate views across Ekiti LGAs, with LCDA records held pending authoritative state confirmation."
        disclosure="No live revenue metrics, taxpayer liabilities, payment records or private owner fields are displayed in EKIRS intelligence."
      />
      <GeographyFoundation config={EKIRS_JURISDICTION} />
      <WorkspaceSection title="LGA aggregate coverage" description="Aggregates are calculated from controlled reference records only.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {lgas.map((lga) => (
            <article key={lga.lga} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-950">{lga.lga}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone="slate">{lga.total} records</StatusBadge>
                <StatusBadge tone="emerald">{lga.jurisdictionVerified} verified</StatusBadge>
                <StatusBadge tone="sky">{lga.tinLinked} TIN linked</StatusBadge>
                {lga.qualityFlags ? <StatusBadge tone="amber">{lga.qualityFlags} flags</StatusBadge> : null}
              </div>
            </article>
          ))}
        </div>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
