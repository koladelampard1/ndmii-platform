import type { Metadata } from "next";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LcdboLanding } from "@/components/lcdbo/lcdbo-landing";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO | Local Content Development Beyond Oil",
  description: "LCDBO is a national industrial transformation programme for MSME growth, industrial clusters, investment readiness and non-oil competitiveness.",
  alternates: {
    canonical: LCDBO_CANONICAL_ORIGIN,
  },
  openGraph: {
    title: "LCDBO | Local Content Development Beyond Oil",
    description: "A national programme platform for industrial clusters, MSME participation, investment readiness and non-oil competitiveness.",
    url: LCDBO_CANONICAL_ORIGIN,
    siteName: "LCDBO",
    type: "website",
  },
};

export default async function LcdboHomePage() {
  const data = await loadLcdboPublicData();

  return (
    <LcdboShell landing>
      <LcdboLanding strategicPartnerCount={Math.max(data.partners.length, 6)} />
    </LcdboShell>
  );
}
