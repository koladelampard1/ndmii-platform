import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadReadinessSnapshot, resolveMsmeForUser } from "@/lib/finance-readiness/repository";
import { FinanceReadinessFlow } from "@/components/msme/finance-readiness-flow";

export default async function MsmeFinanceReadinessPage() {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const msme = await resolveMsmeForUser(supabase, { appUserId: ctx.appUserId, email: ctx.email });
  const snapshot = msme?.id ? await loadReadinessSnapshot(supabase, msme.id as string) : null;

  return <FinanceReadinessFlow initialSnapshot={snapshot} />;
}
