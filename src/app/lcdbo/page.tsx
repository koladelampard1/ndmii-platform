import type { Metadata } from "next";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LcdboLanding } from "@/components/lcdbo/lcdbo-landing";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";
import { LCDBO_CANONICAL_ORIGIN } from "@/lib/routing/dbin-hosts";

export const metadata: Metadata = {
  title: "LCDBO | RMRDC-led Industrial Transformation Programme",
  description:
    "Local Content Development Beyond Oil is an RMRDC-led programme connecting Nigerian raw materials, MSMEs, industrial clusters, investors and markets.",
  alternates: {
    canonical: LCDBO_CANONICAL_ORIGIN,
  },
  openGraph: {
    title: "LCDBO | RMRDC-led Industrial Transformation Programme",
    description:
      "An RMRDC-led national industrial transformation programme for raw-material value addition, MSME growth, industrial clusters and non-oil competitiveness.",
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
