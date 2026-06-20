import { FlowDiagram, PillarGrid } from "@/components/lcdbo/lcdbo-cards";
import { LcdboFinalCta, LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { adcFramework, modelSteps } from "@/lib/lcdbo/content";

export default function LcdboModelPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="LCDBO model"
        title="Acquire. Demonstrate. Commercialise."
        description="A reduced-friction industrial development pathway that moves MSMEs from identity and readiness into clusters, finance, markets, and export growth."
      />
      <LcdboSection title="What LCDBO is" description="LCDBO is the industrial development programme layer. It uses BIN/DBIN for digital infrastructure and connects into SICIP for investment mobilisation.">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f8a5b]">BIN</p><h2 className="mt-2 text-xl font-black text-[#06172f]">Digital infrastructure</h2></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f8a5b]">LCDBO</p><h2 className="mt-2 text-xl font-black text-[#06172f]">Industrial development programme</h2></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f8a5b]">SICIP</p><h2 className="mt-2 text-xl font-black text-[#06172f]">Investment mobilisation programme</h2></article>
        </div>
      </LcdboSection>
      <LcdboSection title="ADC framework">
        <PillarGrid pillars={adcFramework} />
      </LcdboSection>
      <LcdboSection title="Business movement through the ecosystem" description="The pathway is designed to be tracked as data, not just described as policy.">
        <FlowDiagram items={modelSteps} />
      </LcdboSection>
      <LcdboSection title="80% MSME / 20% large enterprise ecosystem positioning">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid overflow-hidden rounded-xl md:grid-cols-[4fr_1fr]">
            <div className="bg-[#1f8a5b] p-6 text-white"><p className="text-4xl font-black">80%</p><p className="mt-1 text-sm font-bold">MSME production, suppliers, artisans, cooperatives, and small manufacturers</p></div>
            <div className="bg-[#d9a441] p-6 text-[#06172f]"><p className="text-4xl font-black">20%</p><p className="mt-1 text-sm font-bold">Large enterprise anchors, offtakers, financiers, and infrastructure partners</p></div>
          </div>
        </div>
      </LcdboSection>
      <LcdboFinalCta />
    </LcdboShell>
  );
}
