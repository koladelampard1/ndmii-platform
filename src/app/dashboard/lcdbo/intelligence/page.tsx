import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { calculateDataQuality, calculateProgrammeHealth, getKpiSnapshots, getReportSnapshots } from "@/lib/data/lcdbo-governance";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LcdboIntelligenceDashboard } from "@/components/lcdbo/lcdbo-intelligence-dashboard";

export default async function LcdboIntelligencePage() {
  const { programme } = await requireLcdboIntelligenceAccess();
  const supabase = await createServiceRoleSupabaseClient();
  const snapshot = await getLcdboIntelligenceSnapshot(supabase);
  const [kpiSnapshots, reportSnapshots] = await Promise.all([getKpiSnapshots(programme.id, 48, supabase), getReportSnapshots(programme.id, undefined, 8, supabase)]);
  return <LcdboIntelligenceDashboard snapshot={snapshot} quality={calculateDataQuality(snapshot)} health={calculateProgrammeHealth(snapshot)} kpiSnapshots={kpiSnapshots} reportSnapshots={reportSnapshots} />;
}
