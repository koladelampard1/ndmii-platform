import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { bankingProfileConfigured, loadMsmeBankingProfile } from "@/lib/data/msme-banking";
import { calculateProfileCompletion } from "@/lib/profile-completion";

export async function getWorkspaceProfileCompletion(supabase: SupabaseClient<any>, workspace: ProviderWorkspaceContext) {
  const bankingProfile = await loadMsmeBankingProfile(supabase, workspace.msme.id);
  return calculateProfileCompletion({
    businessName: workspace.msme.business_name,
    ownerName: workspace.msme.owner_name,
    phone: workspace.msme.contact_phone ?? workspace.provider.contact_phone,
    email: workspace.msme.contact_email ?? workspace.provider.contact_email,
    businessAddress: workspace.msme.address,
    tradeSector: workspace.msme.sector,
    cacNumber: workspace.msme.cac_number,
    tin: workspace.msme.tin,
    passportPhoto: workspace.msme.passport_photo_path ?? workspace.msme.passport_photo_url,
    bankDetailsPresent: bankingProfileConfigured(bankingProfile),
  });
}

export async function trackProfileCompletionAnalytics(
  supabase: SupabaseClient<any>,
  params: {
    appUserId: string | null;
    msmeId: string;
    percentage: number;
    source: "dashboard" | "settings" | "profile_save";
  },
) {
  const { data: recent } = await supabase
    .from("activity_logs")
    .select("action,metadata")
    .eq("entity_id", params.msmeId)
    .in("action", ["msme_dashboard_reached", "profile_completion_started", "profile_completion_percentage", "profile_completion_finished"])
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (recent ?? []) as Array<{ action: string; metadata?: Record<string, unknown> | null }>;
  const inserts: Array<Record<string, unknown>> = [];
  const metadata = { profile_completion_percentage: params.percentage, source: params.source };
  if (params.source === "dashboard" && !rows.some((row) => row.action === "msme_dashboard_reached")) {
    inserts.push({ action: "msme_dashboard_reached", metadata });
  }
  if (params.source === "settings" && params.percentage < 100 && !rows.some((row) => row.action === "profile_completion_started")) {
    inserts.push({ action: "profile_completion_started", metadata });
  }
  const lastMeasured = rows.find((row) => row.action === "profile_completion_percentage");
  if (Number(lastMeasured?.metadata?.profile_completion_percentage) !== params.percentage) {
    inserts.push({ action: "profile_completion_percentage", metadata });
  }
  if (params.percentage === 100 && !rows.some((row) => row.action === "profile_completion_finished")) {
    inserts.push({ action: "profile_completion_finished", metadata });
  }
  if (inserts.length === 0) return;
  await supabase.from("activity_logs").insert(inserts.map((entry) => ({
    actor_user_id: params.appUserId,
    entity_type: "msme",
    entity_id: params.msmeId,
    ...entry,
  })));
}

