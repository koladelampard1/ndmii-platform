import { cookies } from "next/headers";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/auth/authorization";
import { normalizeUserRole } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

type CurrentUser = {
  authUserId: string | null;
  appUserId: string;
  role: UserRole | null;
  email: string | null;
  fullName: string | null;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  full_name: string | null;
  auth_user_id: string | null;
};

const VALID_USER_ROLES = new Set<UserRole>([
  "public",
  "msme",
  "association_officer",
  "reviewer",
  "fccpc_officer",
  "nrs_officer",
  "firs_officer",
  "admin",
]);

function toUserRole(value: string | null | undefined): UserRole | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]/g, "_");
  return VALID_USER_ROLES.has(normalized as UserRole) ? (normalized as UserRole) : null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const hasAppSession = cookieStore.get("ndmii_auth")?.value === "1";
  const authUserId = cookieStore.get("ndmii_auth_user_id")?.value || null;
  const appUserId = cookieStore.get("ndmii_app_user_id")?.value || null;
  const email = cookieStore.get("ndmii_email")?.value?.trim().toLowerCase() || null;

  if (!hasAppSession || !authUserId) {
    return null;
  }

  try {
    const supabase = await createServiceRoleSupabaseClient();

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(authUserId);
    if (authError || !authData.user) {
      console.warn("[server-auth] unable to verify auth user", {
        authUserId,
        error: authError?.message ?? "missing_auth_user",
      });
      return null;
    }

    let profile: UserProfileRow | null = null;

    if (appUserId) {
      const { data, error } = await supabase
        .from("users")
        .select("id,email,role,full_name,auth_user_id")
        .eq("id", appUserId)
        .maybeSingle();

      if (error) throw error;
      profile = data as UserProfileRow | null;
    }

    if (!profile && authUserId) {
      const { data, error } = await supabase
        .from("users")
        .select("id,email,role,full_name,auth_user_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (error) throw error;
      profile = data as UserProfileRow | null;
    }

    if (!profile && email) {
      const { data, error } = await supabase
        .from("users")
        .select("id,email,role,full_name,auth_user_id")
        .eq("email", email)
        .maybeSingle();

      if (error) throw error;
      profile = data as UserProfileRow | null;
    }

    if (!profile) {
      return null;
    }

    return {
      authUserId: profile.auth_user_id ?? authUserId,
      appUserId: profile.id,
      role: toUserRole(profile.role),
      email: profile.email ?? email,
      fullName: profile.full_name ?? profile.email ?? email,
    };
  } catch (error) {
    console.error("[server-auth] failed to resolve current user", {
      authUserId,
      appUserId,
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getCurrentUserContext(): Promise<UserContext> {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser();
  const role = currentUser?.role ?? normalizeUserRole(cookieStore.get("ndmii_role")?.value, "public");
  const email = cookieStore.get("ndmii_email")?.value ?? null;
  const authUserId = currentUser?.authUserId ?? cookieStore.get("ndmii_auth_user_id")?.value ?? null;
  let appUserId = currentUser?.appUserId ?? cookieStore.get("ndmii_app_user_id")?.value ?? null;

  const context: UserContext = {
    authUserId,
    appUserId,
    role,
    email: currentUser?.email ?? email,
    fullName: currentUser?.fullName ?? email,
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
      .select("id,msme_id")
      .eq("created_by", appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkedByOwner?.id) {
      context.linkedMsmeId = linkedByOwner.id;
    } else if (email) {
      const { data: linkedByEmail } = await supabase
        .from("msmes")
        .select("id,msme_id")
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
      const { data: linkedMsme } = await supabase
        .from("msmes")
        .select("id,msme_id")
        .or(`id.eq.${context.linkedMsmeId},msme_id.eq.${context.linkedMsmeId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const msmeLookupCandidates = [linkedMsme?.msme_id, context.linkedMsmeId].filter(
        (value): value is string => Boolean(value),
      );

      for (const candidate of msmeLookupCandidates) {
        const { data: linkedProvider } = await supabase
          .from("provider_profiles")
          .select("id,msme_id")
          .eq("msme_id", candidate)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (linkedProvider?.id) {
          context.linkedProviderId = linkedProvider.id;
          break;
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[session-msme-linking]", {
        source: "src/lib/auth/session.ts#getCurrentUserContext",
        authEmail: context.email,
        userId: context.appUserId,
        linkedMsmeId: context.linkedMsmeId,
        linkedProviderId: context.linkedProviderId,
        decision: context.linkedMsmeId ? "resolved_msme_link" : "missing_msme_link",
      });
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
