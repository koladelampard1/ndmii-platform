import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AmaanahDashboardEntryPage() {
  const service = await createServiceRoleSupabaseClient();
  const { data: institution, error } = await service
    .from("institutions")
    .select("id")
    .eq("slug", "amaanah-finance")
    .maybeSingle();

  if (error || !institution?.id) redirect("/dashboard/institutions");
  redirect(`/dashboard/institutions/${institution.id}/overview`);
}
