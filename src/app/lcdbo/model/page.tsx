import type { Metadata } from "next";
import { FlowDiagram, PillarGrid } from "@/components/lcdbo/lcdbo-cards";
import { LcdboFinalCta, LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { adcFramework, modelSteps } from "@/lib/lcdbo/content";
import {
  lcdboInstitutionalFramework,
  lcdboMilestoneProgrammes,
  lcdboProgrammePillars,
} from "@/lib/lcdbo/programme-model";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";
import { ArrowRight, CheckCircle2, Database, Factory, Landmark } from "lucide-react";

export const metadata: Metadata = {
  title: "LCDBO Delivery Model | Acquire, Demonstrate, Commercialise",
  description:
    "Explore the LCDBO delivery model connecting business identity, raw-material intelligence, cluster participation, investment readiness and market access.",
  alternates: {
    canonical: `${LCDBO_CANONICAL_ORIGIN}/model`,
  },
};

export default function LcdboModelPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="LCDBO model"
        title="Acquire. Demonstrate. Commercialise."
        description="A reduced-friction industrial development pathway that moves MSMEs from identity and readiness into clusters, finance, markets, and export growth."
      />
      <LcdboSection title="One national programme architecture" description="Three connected layers move businesses from trusted identity to industrial participation and investment mobilisation.">
        <div className="grid gap-3 md:grid-cols-[1fr,auto,1fr,auto,1fr] md:items-center">
          {[{ code: "BIN", title: "Digital infrastructure", detail: "Identity, verification, consent and trusted programme data.", icon: Database }, { code: "LCDBO", title: "Industrial development", detail: "MSME enablement, cluster participation and market readiness.", icon: Factory }, { code: "SICIP", title: "Investment mobilisation", detail: "Strategic investors, project pipelines and funding partnerships.", icon: Landmark }].map((item, index) => { const Icon = item.icon; return <div key={item.code} className="contents"><article className={`rounded-2xl border p-6 shadow-sm ${index === 1 ? "border-[#008751]/30 bg-[#008751] text-white" : "border-slate-200 bg-white"}`}><Icon className={`h-6 w-6 ${index === 1 ? "text-emerald-100" : "text-[#008751]"}`} /><p className={`mt-5 text-xs font-black uppercase tracking-[0.14em] ${index === 1 ? "text-emerald-100" : "text-[#008751]"}`}>{item.code}</p><h2 className={`mt-2 text-xl font-black ${index === 1 ? "text-white" : "text-[#0B2E59]"}`}>{item.title}</h2><p className={`mt-2 text-sm leading-6 ${index === 1 ? "text-emerald-50" : "text-slate-600"}`}>{item.detail}</p></article>{index < 2 ? <ArrowRight className="mx-auto hidden h-5 w-5 text-[#D4A017] md:block" /> : null}</div>; })}
        </div>
      </LcdboSection>
      <LcdboSection title="ADC journey" description="A practical progression from capability acquisition to commercial scale.">
        <PillarGrid pillars={adcFramework} />
      </LcdboSection>
      <LcdboSection title="Business journey" description="Each milestone becomes a visible programme state, giving MSMEs and institutions a shared operating picture.">
        <FlowDiagram items={modelSteps} />
      </LcdboSection>
      <LcdboSection title="Source-backed operating components" description="The LCDBO model combines digital identity, research commercialisation, production infrastructure, investment readiness and market access into one pathway.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {lcdboProgrammePillars.map((pillar, index) => (
            <article key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">Component {String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-3 text-base font-black leading-6 text-[#06172f]">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.description}</p>
            </article>
          ))}
        </div>
      </LcdboSection>
      <LcdboSection title="Special Quasi-EPCM delivery structure" description="For scale and accountability, the model positions implementation around engineering, procurement, construction and management coordination with institutional partners and host communities.">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[26px] bg-[#06172f] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#efc85d]">Delivery accountability</p>
            <h2 className="mt-3 text-3xl font-black">From project preparation to operational mobilisation.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">The Special Quasi-EPCM model supports engineering coordination, project preparation, procurement planning, construction oversight, operational mobilisation, cluster management and institutional accountability.</p>
          </article>
          <div className="grid gap-3 sm:grid-cols-2">
            {lcdboInstitutionalFramework.map((item) => (
              <article key={item.actor} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-[#06172f]">{item.actor}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.contribution}</p>
              </article>
            ))}
          </div>
        </div>
      </LcdboSection>
      <LcdboSection title="Milestone programmes inside the model" description="The operating model is supported by economic, security, infrastructure, transport, social, power and broadband milestone programmes.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {lcdboMilestoneProgrammes.map((programme) => (
            <article key={programme.abbreviation} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-2xl font-black text-[#008751]">{programme.abbreviation}</p>
              <h2 className="mt-3 text-sm font-black leading-5 text-[#06172f]">{programme.title}</h2>
            </article>
          ))}
        </div>
      </LcdboSection>
      <LcdboSection title="80% MSME / 20% large enterprise ecosystem positioning">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid overflow-hidden rounded-xl md:grid-cols-[4fr_1fr]">
            <div className="bg-[#1f8a5b] p-6 text-white"><p className="text-4xl font-black">80%</p><p className="mt-1 text-sm font-bold">MSME production, suppliers, artisans, cooperatives, and small manufacturers</p></div>
            <div className="bg-[#d9a441] p-6 text-[#06172f]"><p className="text-4xl font-black">20%</p><p className="mt-1 text-sm font-bold">Large enterprise anchors, offtakers, financiers, and infrastructure partners</p></div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600"><CheckCircle2 className="h-4 w-4 text-[#008751]" />An inclusive supplier ecosystem anchored by commercial demand.</p>
        </div>
      </LcdboSection>
      <LcdboFinalCta />
    </LcdboShell>
  );
}
