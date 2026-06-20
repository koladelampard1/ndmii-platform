import Link from "next/link";
import { ClusterCard, FlowDiagram, PartnerCard, PillarGrid, StatGrid } from "@/components/lcdbo/lcdbo-cards";
import { LcdboFinalCta, LcdboHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { ecosystemFlow, lcdboPillars, lcdboStats, programmeLabel } from "@/lib/lcdbo/content";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";

export default async function LcdboHomePage() {
  const data = await loadLcdboPublicData();

  return (
    <LcdboShell>
      <LcdboHero />

      <LcdboSection
        eyebrow="National targets"
        title="A programme workspace for industrial scale, not another disconnected portal."
        description={`${programmeLabel(data.programme)} runs on DBIN infrastructure: business identity, programme data, partner access, clusters, consent, and future funding workflows in one platform foundation.`}
      >
        <StatGrid stats={lcdboStats} />
      </LcdboSection>

      <LcdboSection
        eyebrow="Operating model"
        title="From stakeholders to production, exports, jobs, and growth."
        description="LCDBO aligns institutions, associations, MSMEs, investors, technical partners, and governments around structured industrial clusters and measurable commercial outcomes."
      >
        <FlowDiagram items={ecosystemFlow} />
      </LcdboSection>

      <LcdboSection eyebrow="Programme pillars" title="Six pillars for beyond-oil industrial transformation.">
        <PillarGrid pillars={lcdboPillars} />
      </LcdboSection>

      <LcdboSection eyebrow="Pilot clusters" title="Featured industrial cluster pilots." description="These cluster records come from the DBIN platform foundation when available, with seeded pilot data as the current baseline.">
        <div className="grid gap-4 lg:grid-cols-3">
          {data.clusters.slice(0, 3).map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>
        <div className="mt-5">
          <Link href="/lcdbo/clusters" className="inline-flex rounded-md bg-[#06172f] px-4 py-3 text-sm font-black text-white">
            Explore Industrial Clusters
          </Link>
        </div>
      </LcdboSection>

      <LcdboSection eyebrow="Strategic partners" title="A multi-institution industrial ecosystem.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.partners.map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </div>
      </LcdboSection>

      <LcdboFinalCta />
    </LcdboShell>
  );
}
