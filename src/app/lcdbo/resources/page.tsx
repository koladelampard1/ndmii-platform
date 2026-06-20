import Link from "next/link";
import { FileText } from "lucide-react";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";

const resources = [
  { title: "Programme Model Brief", type: "Framework", href: "/lcdbo/model" },
  { title: "Pilot Cluster Registry", type: "Data view", href: "/lcdbo/clusters" },
  { title: "Partner Participation Pathways", type: "Guide", href: "/lcdbo/partners" },
  { title: "Opportunity Tracks", type: "Pipeline", href: "/lcdbo/opportunities" },
];

export default function LcdboResourcesPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Resources"
        title="LCDBO knowledge base and programme references."
        description="Resources are structured as platform links for now. Document repositories, downloads, and published reports can be attached in a future phase."
      />
      <LcdboSection title="Available resources">
        <div className="grid gap-4 md:grid-cols-2">
          {resources.map((resource) => (
            <Link key={resource.title} href={resource.href} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#d9a441]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1f8a5b]/10 text-[#1f8a5b]">
                <FileText className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.14em] text-[#1f8a5b]">{resource.type}</span>
                <span className="mt-1 block text-lg font-black text-[#06172f]">{resource.title}</span>
              </span>
            </Link>
          ))}
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}
