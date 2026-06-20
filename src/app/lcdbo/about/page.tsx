import { LcdboFinalCta, LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";

const cards = [
  { title: "National industrial coordination", text: "LCDBO organises MSMEs, institutions, states, associations, and investors around cluster-led production systems." },
  { title: "Beyond-oil local content", text: "The programme focuses on non-oil value chains that can create jobs, deepen manufacturing, and expand exports." },
  { title: "DBIN-powered infrastructure", text: "Business identity, verification, compliance, programme data, and partner access remain inside the DBIN platform." },
];

export default function LcdboAboutPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="About LCDBO"
        title="A national framework for local content beyond oil."
        description="LCDBO is designed as a programme workspace inside DBIN, connecting industrial policy, MSME enablement, cluster development, funding readiness, and market access."
      />
      <LcdboSection title="What LCDBO does" description="The initiative turns fragmented business support into a structured operating model for industrial transformation.">
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-[#06172f]">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.text}</p>
            </article>
          ))}
        </div>
      </LcdboSection>
      <LcdboSection title="Platform position" description="LCDBO does not replace DBIN. It uses DBIN as the digital rail for identity, consent, programme operations, cluster data, partner access, and future funding/investor modules.">
        <div className="grid gap-4 lg:grid-cols-3">
          {["Policy and programme coordination", "Cluster and value-chain mobilisation", "Business identity and readiness intelligence"].map((item) => (
            <div key={item} className="rounded-xl bg-[#06172f] p-5 text-white">
              <p className="text-sm font-black">{item}</p>
            </div>
          ))}
        </div>
      </LcdboSection>
      <LcdboFinalCta />
    </LcdboShell>
  );
}
