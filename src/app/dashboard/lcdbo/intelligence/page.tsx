import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LcdboIntelligenceDashboard } from "@/components/lcdbo/lcdbo-intelligence-dashboard";

export default async function LcdboIntelligencePage() {
  await requireLcdboIntelligenceAccess();
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  return <LcdboIntelligenceDashboard snapshot={snapshot} />;
}
