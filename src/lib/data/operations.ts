import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function logActivity(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const supabase = await createServiceRoleSupabaseClient();
  await supabase.from("activity_logs").insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}
