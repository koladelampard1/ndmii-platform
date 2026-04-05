import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/auth/authorization";
import { normalizeUserRole } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

export async function getCurrentUserContext(): Promise<UserContext> {
  const cookieStore = await cookies();
  const role = normalizeUserRole(cookieStore.get("ndmii_role")?.value, "public");
  const email = cookieStore.get("ndmii_email")?.value ?? null;
  const authUserId = cookieStore.get("ndmii_auth_user_id")?.value ?? null;
  let appUserId = cookieStore.get("ndmii_app_user_id")?.value ?? null;

  const context: UserContext = {
    authUserId,
    appUserId,
    role,
    email,
    fullName: email,
    linkedMsmeId: null,
    linkedProviderId: null,
    linkedAssociationId: null,
  };

  const supabase = await createServerSupabaseClient();
  if (role === "public") return context;

  if (!appUserId && authUserId) {
    const { data: linkedByAuthUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    appUserId = linkedByAuthUser?.id ?? null;
    context.appUserId = appUserId;
  }

  if (!appUserId && email) {
    const { data: linkedByEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    appUserId = linkedByEmail?.id ?? null;
    context.appUserId = appUserId;
  }

  if (!appUserId) return context;

  const { data: user } = await supabase.from("users").select("full_name").eq("id", appUserId).maybeSingle();
  context.fullName = user?.full_name ?? context.fullName;

  if (role === "msme") {
    const { data: linkedByOwner } = await supabase
      .from("msmes")
      .select("id")
      .eq("created_by", appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkedByOwner?.id) {
      context.linkedMsmeId = linkedByOwner.id;
    } else if (email) {
      const { data: linkedByEmail } = await supabase
        .from("msmes")
        .select("id")
        .eq("contact_email", email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (linkedByEmail?.id) {
        context.linkedMsmeId = linkedByEmail.id;
      }
    }

    if (!context.linkedMsmeId && context.linkedProviderId) {
      const { data: providerMsme } = await supabase
        .from("provider_profiles")
        .select("msme_id")
        .eq("id", context.linkedProviderId)
        .maybeSingle();
      context.linkedMsmeId = providerMsme?.msme_id ?? null;
    }

    if (!context.linkedMsmeId && context.fullName) {
      const { data: linkedByProviderName } = await supabase
        .from("provider_profiles")
        .select("id,msme_id,display_name")
        .ilike("display_name", context.fullName)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      context.linkedMsmeId = linkedByProviderName?.msme_id ?? null;
      context.linkedProviderId = linkedByProviderName?.id ?? context.linkedProviderId;
    }

    if (context.linkedMsmeId) {
      const { data: linkedProvider } = await supabase
        .from("provider_profiles")
        .select("id")
        .eq("msme_id", context.linkedMsmeId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      context.linkedProviderId = linkedProvider?.id ?? context.linkedProviderId;
    }
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
