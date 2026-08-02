import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { safePublicResources } from "@/lib/lcdbo/public-governance";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO Resources | Programme References and Participation Guides",
  description:
    "Access LCDBO programme references for the delivery model, industrial clusters, partner participation and opportunity pathways.",
  alternates: {
    canonical: `${LCDBO_CANONICAL_ORIGIN}/resources`,
  },
};

export default function LcdboResourcesPage() {
  const resources = safePublicResources();

  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Resources"
        title="LCDBO knowledge base and programme references."
        description="Core references for understanding the LCDBO model, cluster network, partnership pathways and participation opportunities."
      />
      <LcdboSection title="Programme resources" description="Published resources link to existing public pages. Scheduled publications are listed clearly without fake downloads or inactive files. Controlled internal documents are not exposed publicly.">
        <div className="grid gap-4 md:grid-cols-2">
          {resources.map((resource) => (
            <article key={resource.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#d9a441]">
              <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1f8a5b]/10 text-[#1f8a5b]">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f8a5b]">{resource.category}</p>
                <h2 className="mt-1 text-lg font-black text-[#06172f]">{resource.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{resource.description}</p>
                <p className="mt-3 text-xs text-slate-500">Last reviewed: {resource.lastReviewed}. {resource.sourceNote}</p>
              </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                  {resource.status === "published" ? "Published" : resource.status === "scheduled" ? "Publication scheduled" : resource.status}
                </span>
                {resource.href ? (
                  <Link href={resource.href} className="text-sm font-black text-[#008751] transition hover:text-[#005f39]">
                    Open resource
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-slate-400">No public download</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}
