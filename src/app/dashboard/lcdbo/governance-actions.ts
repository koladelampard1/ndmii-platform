"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { calculateDataQuality, calculateProgrammeHealth, generateKpiSnapshot, generateReportSnapshot, type SnapshotFrequency } from "@/lib/data/lcdbo-governance";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function generateGovernanceSnapshotAction(formData: FormData) {
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!ctx.appUserId || !programme || (!isPlatformAdmin(ctx.role) && ctx.role !== "programme_officer")) redirect("/access-denied");
  const frequency = String(formData.get("frequency") ?? "monthly") as SnapshotFrequency;
  if (!["daily", "weekly", "monthly", "quarterly"].includes(frequency)) redirect("/dashboard/lcdbo/data-quality?error=invalid_frequency");
  const supabase = await createServiceRoleSupabaseClient();
  const intelligence = await getLcdboIntelligenceSnapshot(supabase);
  const quality = calculateDataQuality(intelligence);
  const health = calculateProgrammeHealth(intelligence);
  try {
    await Promise.all([
      generateKpiSnapshot({ programmeId: programme.id, frequency, generatedBy: ctx.appUserId, notes: "Governed LCDBO snapshot generated from the Data Quality Centre.", client: supabase }),
      generateReportSnapshot({ programmeId: programme.id, reportType: "data_quality", frequency, generatedBy: ctx.appUserId, metrics: quality, client: supabase }),
      generateReportSnapshot({ programmeId: programme.id, reportType: "programme_health", frequency, generatedBy: ctx.appUserId, metrics: health, client: supabase }),
      generateReportSnapshot({ programmeId: programme.id, reportType: "national", frequency, generatedBy: ctx.appUserId, client: supabase }),
    ]);
  } catch (error) {
    console.error("[lcdbo-governance-snapshot]", error);
    redirect("/dashboard/lcdbo/data-quality?error=snapshot_unavailable");
  }
  revalidatePath("/dashboard/lcdbo/data-quality");
  revalidatePath("/dashboard/lcdbo/intelligence");
  revalidatePath("/dashboard/lcdbo/executive");
  redirect("/dashboard/lcdbo/data-quality?success=snapshot_generated");
}
