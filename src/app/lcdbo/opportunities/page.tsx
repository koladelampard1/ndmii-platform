import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { opportunityCards } from "@/lib/lcdbo/content";

export default function LcdboOpportunitiesPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Opportunities"
        title="Structured entry points for MSMEs, investors, states, and partners."
        description="These opportunity tracks are placeholders for future modules. CTAs currently route to existing DBIN registration or LCDBO contact paths with programme context."
      />
      <LcdboSection title="Programme opportunity tracks">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {opportunityCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-black text-[#06172f]">{card.title}</h2>
                <span className="rounded-full bg-[#d9a441]/15 px-3 py-1 text-[11px] font-black text-[#72520c]">{card.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#1f8a5b]">{card.audience}</p>
              <Link href={card.href} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#06172f] px-4 py-3 text-sm font-black text-white">
                {card.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}
