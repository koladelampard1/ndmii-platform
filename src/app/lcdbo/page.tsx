import Link from "next/link";
import { ClusterCard, FlowDiagram, PartnerCard, PillarGrid, StatGrid } from "@/components/lcdbo/lcdbo-cards";
import { LcdboFinalCta, LcdboHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LcdboSicipTeaser } from "@/components/lcdbo/lcdbo-visuals";
import { ecosystemFlow, lcdboPillars, lcdboStats, programmeLabel, stakeholderValue } from "@/lib/lcdbo/content";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";

export default async function LcdboHomePage() {
  const data = await loadLcdboPublicData();

  return (
    <LcdboShell>
      <LcdboHero />

      <LcdboSection
        eyebrow="National ambition"
        title="Programme targets for industrial scale."
        description={`${programmeLabel(data.programme)} uses DBIN infrastructure to connect identity, programme operations, clusters and institutional partners. All figures below are programme targets unless stated otherwise.`}
      >
        <StatGrid stats={lcdboStats} />
      </LcdboSection>

      <LcdboSection
        eyebrow="National vision"
        title="From local economies to national growth."
        description="A clear operating pathway connects local production capacity to clusters, jobs, exports and wider economic transformation."
      >
        <FlowDiagram items={ecosystemFlow} />
      </LcdboSection>

      <LcdboSection eyebrow="Programme pillars" title="Six pillars for beyond-oil industrial transformation.">
        <PillarGrid pillars={lcdboPillars} />
      </LcdboSection>

      <LcdboSection eyebrow="Stakeholder value" title="One programme ecosystem. Clear value for every participant." description="LCDBO creates distinct participation pathways while preserving one governed national operating picture.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stakeholderValue.map((item, index) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-black text-[#D4A017]">0{index + 1}</span><h3 className="mt-3 text-lg font-black text-[#0B2E59]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p></article>)}
        </div>
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

      <LcdboSection eyebrow="Investment mobilisation" title="The next programme layer.">
        <LcdboSicipTeaser />
      </LcdboSection>

      <LcdboFinalCta />
    </LcdboShell>
  );
}
