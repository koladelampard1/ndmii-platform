import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { requirePropertyOperationsAccess, resolvePropertyOperationsAccess } from "@/lib/property/property-operations-service";

export async function requireRegistryOperationsContext(mutate = false) {
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();
  try {
    const access = await requirePropertyOperationsAccess({ ctx, client: supabase, mutate });
    return { ctx, supabase, access };
  } catch {
    redirect("/access-denied");
  }
}

export async function getRegistryOperationsContext() {
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();
  const access = await resolvePropertyOperationsAccess({ ctx, client: supabase });
  if (!access.allowed) redirect("/access-denied");
  return { ctx, supabase, access };
}
