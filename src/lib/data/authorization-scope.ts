import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canActOnMsme, canViewMsme } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

export async function requireRole(roles: UserRole[]) {
  const ctx = await getCurrentUserContext();
  if (!roles.includes(ctx.role)) {
    redirect("/access-denied");
  }
  return ctx;
}

export async function getScopedMsmes() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (ctx.role === "admin") {
    const { data } = await supabase.from("msmes").select("*").order("created_at", { ascending: false });
    return data ?? [];
  }

  if (ctx.role === "msme") {
    const { data } = await supabase.from("msmes").select("*").eq("id", ctx.linkedMsmeId ?? "").order("created_at", { ascending: false });
    return data ?? [];
  }

  if (ctx.role === "association_officer") {
    const { data } = await supabase
      .from("msmes")
      .select("*")
      .eq("association_id", ctx.linkedAssociationId ?? "")
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  if (ctx.role === "reviewer") {
    const { data } = await supabase
      .from("msmes")
      .select("*")
      .in("review_status", ["pending_review", "submitted", "changes_requested"])
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  const { data } = await supabase.from("msmes").select("*").order("created_at", { ascending: false });
  return (data ?? []).filter((row) => canViewMsme(ctx.role, ctx, row));
}

export async function assertMsmeAction(msmeId: string, action: string) {
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();
  const { data: msme } = await supabase.from("msmes").select("id,association_id,created_by,review_status").eq("id", msmeId).maybeSingle();

  if (!msme || !canActOnMsme(ctx.role, action, ctx, msme)) {
    redirect("/access-denied");
  }

  return { ctx, msme };
}
