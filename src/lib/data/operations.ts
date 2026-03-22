import { supabase } from "@/lib/supabase/client";

export async function logActivity(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await supabase.from("activity_logs").insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}
