import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LcdboLanding } from "@/components/lcdbo/lcdbo-landing";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";

export default async function LcdboHomePage() {
  const data = await loadLcdboPublicData();

  return (
    <LcdboShell landing>
      <LcdboLanding strategicPartnerCount={Math.max(data.partners.length, 6)} />
    </LcdboShell>
  );
}
