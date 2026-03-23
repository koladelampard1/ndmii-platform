import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/roles";
import type { UserContext } from "@/lib/auth/authorization";

export async function getCurrentUserContext(): Promise<UserContext> {
  const cookieStore = await cookies();
  const role = (cookieStore.get("ndmii_role")?.value as UserRole | undefined) ?? "public";
  const email = cookieStore.get("ndmii_email")?.value ?? null;
  const authUserId = cookieStore.get("ndmii_auth_user_id")?.value ?? null;
  const appUserId = cookieStore.get("ndmii_app_user_id")?.value ?? null;

  const context: UserContext = {
    authUserId,
    appUserId,
    role,
    email,
    fullName: email,
    linkedMsmeId: null,
    linkedAssociationId: null,
  };

  if (!appUserId || role === "public") return context;

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.from("users").select("full_name").eq("id", appUserId).maybeSingle();
  context.fullName = user?.full_name ?? context.fullName;

  if (role === "msme") {
    const { data: msme } = await supabase.from("msmes").select("id").eq("created_by", appUserId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    context.linkedMsmeId = msme?.id ?? null;
  }

  if (role === "association_officer") {
    const { data: association } = await supabase.from("associations").select("id").eq("officer_user_id", appUserId).maybeSingle();
    context.linkedAssociationId = association?.id ?? null;
  }

  return context;
}

export async function getCurrentRole(): Promise<UserRole> {
  const context = await getCurrentUserContext();
  return context.role;
}
