import { PartnerCard } from "@/components/lcdbo/lcdbo-cards";
import { LcdboFinalCta, LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";

export default async function LcdboPartnersPage() {
  const data = await loadLcdboPublicData();
  const grouped = new Map<string, typeof data.partners>();
  for (const partner of data.partners) {
    grouped.set(partner.category, [...(grouped.get(partner.category) ?? []), partner]);
  }

  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Strategic partners"
        title="Institutional partners for beyond-oil industrial growth."
        description="LCDBO is structured as a partner ecosystem: private-sector convener, public agencies, industrial associations, engineering partners, funders, and market-access institutions."
      />
      {[...grouped.entries()].map(([category, partners]) => (
        <LcdboSection key={category} title={category}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
          </div>
        </LcdboSection>
      ))}
      <LcdboFinalCta />
    </LcdboShell>
  );
}
