import { cookies, headers } from "next/headers";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server";
import { normalizeUserRole, type UserContext } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

export type AuthenticatedUser = {
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

const NDMII_AUTH_USER_ID_COOKIE = "ndmii_auth_user_id";
const NDMII_APP_USER_ID_COOKIE = "ndmii_app_user_id";
const NDMII_ROLE_COOKIE = "ndmii_role";

const VALID_USER_ROLES = new Set<UserRole>([
  "public",
  "msme",
  "association_officer",
  "reviewer",
  "boi_executive",
  "programme_officer",
  "assessment_officer",
  "field_officer",
  "data_analyst",
  "auditor",
  "fccpc_officer",
  "nrs_officer",
  "firs_officer",
  "admin",
  "super_admin",
]);

async function getAuthDiagnosticRequestMeta() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "unknown";
  const rawPathname =
    headerStore.get("next-url") ??
    headerStore.get("x-next-url") ??
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("x-matched-path") ??
    headerStore.get("referer") ??
    "unknown";

  try {
    return {
      host,
      pathname: rawPathname.startsWith("http") ? new URL(rawPathname).pathname : rawPathname,
    };
  } catch {
    return { host, pathname: rawPathname };
  }
}

type AuthRuntimeDiagnostic = {
  source: "getAuthenticatedUser" | "getCurrentUserContext";
  requestHost: string;
  pathname: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  authUserId: string | null;
  authEmail: string | null;
  matchedPublicUsersRow: Pick<UserProfileRow, "id" | "email" | "role" | "auth_user_id"> | null;
  publicUsersAuthUserId: string | null;
  resolvedRole: UserRole | "public";
  expectedRole: string | null;
  failureReason: string | null;
};

function logAuthRuntimeDiagnostic(diagnostic: AuthRuntimeDiagnostic) {
  console.info("[auth-runtime-diagnostic]", diagnostic);
}

function toUserRole(value: string | null | undefined): UserRole | null {
  if (!value) return null;
  const normalized = normalizeUserRole(value, "public");
  if (normalized === "public" && value.trim().toLowerCase() !== "public") return null;
  return VALID_USER_ROLES.has(normalized as UserRole) ? (normalized as UserRole) : null;
}

function getErrorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return typeof error;
}

function isRecoverableSupabaseVerificationError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error instanceof TypeError) return true;

  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code).toUpperCase();
    return ["ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "ENOTFOUND", "ETIMEDOUT"].includes(code);
  }

  return false;
}

async function getFallbackAuthenticatedUser(baseDiagnostic: {
  source: "getAuthenticatedUser";
  requestHost: string;
  pathname: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expectedRole: null;
}, supabaseVerificationError?: unknown): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const fallbackAuthUserId = cookieStore.get(NDMII_AUTH_USER_ID_COOKIE)?.value?.trim() || null;
  const fallbackAppUserId = cookieStore.get(NDMII_APP_USER_ID_COOKIE)?.value?.trim() || null;
  const fallbackRole = toUserRole(cookieStore.get(NDMII_ROLE_COOKIE)?.value);

  if (!fallbackAuthUserId && !fallbackAppUserId) {
    logAuthRuntimeDiagnostic({
      ...baseDiagnostic,
      authUserId: null,
      authEmail: null,
      matchedPublicUsersRow: null,
      publicUsersAuthUserId: null,
      resolvedRole: "public",
      failureReason: "missing_supabase_auth_cookies",
    });
    return null;
  }

  try {
    const profileClient = await createServiceRoleSupabaseClient();
    const { data: profile, error } = fallbackAppUserId
      ? await profileClient
          .from("users")
          .select("id,email,role,full_name,auth_user_id")
          .eq("id", fallbackAppUserId)
          .maybeSingle()
      : await profileClient
          .from("users")
          .select("id,email,role,full_name,auth_user_id")
          .eq("auth_user_id", fallbackAuthUserId)
          .maybeSingle();

    if (error) throw error;

    const resolvedRole = toUserRole(profile?.role);
    const authUserIdMatches = !fallbackAuthUserId || profile?.auth_user_id === fallbackAuthUserId;

    if (!profile || !resolvedRole || !authUserIdMatches) {
      logAuthRuntimeDiagnostic({
        ...baseDiagnostic,
        authUserId: fallbackAuthUserId,
        authEmail: null,
        matchedPublicUsersRow: profile
          ? {
              id: profile.id,
              email: profile.email,
              role: profile.role,
              auth_user_id: profile.auth_user_id,
            }
          : null,
        publicUsersAuthUserId: profile?.auth_user_id ?? null,
        resolvedRole: "public",
        failureReason: !profile
          ? "fallback_public_users_row_missing"
          : !resolvedRole
            ? "fallback_public_users_role_invalid_or_missing"
            : "fallback_auth_user_id_mismatch",
      });
      return null;
    }

    console.info("[server-auth-fallback-session]", {
      authUserId: profile.auth_user_id,
      appUserId: profile.id,
      role: resolvedRole,
    });
    if (supabaseVerificationError) {
      console.info("[auth-fallback-after-supabase-verification-failure]", {
        authUserId: profile.auth_user_id,
        appUserId: profile.id,
        resolvedDbRole: resolvedRole,
        errorType: getErrorType(supabaseVerificationError),
      });
    }
    logAuthRuntimeDiagnostic({
      ...baseDiagnostic,
      authUserId: profile.auth_user_id,
      authEmail: profile.email,
      matchedPublicUsersRow: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        auth_user_id: profile.auth_user_id,
      },
      publicUsersAuthUserId: profile.auth_user_id,
      resolvedRole,
      failureReason: fallbackRole && fallbackRole !== resolvedRole ? "fallback_cookie_role_superseded_by_public_users" : null,
    });

    return {
      authUserId: profile.auth_user_id,
      appUserId: profile.id,
      role: resolvedRole,
      email: profile.email,
      fullName: profile.full_name ?? profile.email,
    };
  } catch (error) {
    console.error("[server-auth] failed to resolve fallback session", {
      error: error instanceof Error ? error.message : String(error),
    });
    logAuthRuntimeDiagnostic({
      ...baseDiagnostic,
      authUserId: fallbackAuthUserId,
      authEmail: null,
      matchedPublicUsersRow: null,
      publicUsersAuthUserId: null,
      resolvedRole: "public",
      failureReason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const requestMeta = await getAuthDiagnosticRequestMeta();
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value ?? null;
  const baseDiagnostic = {
    source: "getAuthenticatedUser" as const,
    requestHost: requestMeta.host,
    pathname: requestMeta.pathname,
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    expectedRole: null,
  };

  if (!accessToken && !refreshToken) return getFallbackAuthenticatedUser(baseDiagnostic);

  let supabaseSessionVerified = false;

  try {
    const authClient = await createServerSupabaseClient();
    let authUser = null;
    let authError: unknown = null;

    if (accessToken) {
      const { data: authData, error } = await authClient.auth.getUser(accessToken);
      authUser = authData.user;
      authError = error;
    }

    if (!authUser && refreshToken) {
      const { data: refreshData, error } = await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });
      accessToken = refreshData.session?.access_token ?? accessToken;
      authUser = refreshData.user ?? null;
      authError = error ?? authError;
    }

    if (!authUser) {
      if (isRecoverableSupabaseVerificationError(authError)) {
        return getFallbackAuthenticatedUser(baseDiagnostic, authError);
      }

      const authErrorMessage = authError instanceof Error ? authError.message : null;
      console.warn("[server-auth] unable to verify Supabase session", {
        error: authErrorMessage ?? "missing_auth_user",
      });
      logAuthRuntimeDiagnostic({
        ...baseDiagnostic,
        authUserId: null,
        authEmail: null,
        matchedPublicUsersRow: null,
        publicUsersAuthUserId: null,
        resolvedRole: "public",
        failureReason: authErrorMessage ?? "missing_auth_user",
      });
      return null;
    }

    supabaseSessionVerified = true;
    const authUserId = authUser.id;
    const email = authUser.email?.trim().toLowerCase() || null;
    const profileClient = await createServiceRoleSupabaseClient();

    const { data: profile, error: profileError } = await profileClient
      .from("users")
      .select("id,email,role,full_name,auth_user_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      const { data: emailMatchedProfile, error: emailMatchError } = email
        ? await profileClient
            .from("users")
            .select("id,email,role,auth_user_id")
            .eq("email", email)
            .maybeSingle()
        : { data: null, error: null };

      if (emailMatchError) throw emailMatchError;

      console.info("[server-auth-role-resolution]", {
        authUserId,
        matchedPublicUserId: emailMatchedProfile?.id ?? null,
        resolvedRole: "public",
        missingLookupReason: emailMatchedProfile
          ? emailMatchedProfile.auth_user_id
            ? "public_users_auth_user_id_mismatch_for_email_match"
            : "public_users_auth_user_id_missing_for_email_match"
          : "no_public_users_row_for_auth_user_id",
      });
      logAuthRuntimeDiagnostic({
        ...baseDiagnostic,
        authUserId,
        authEmail: email,
        matchedPublicUsersRow: emailMatchedProfile
          ? {
              id: emailMatchedProfile.id,
              email: emailMatchedProfile.email,
              role: emailMatchedProfile.role,
              auth_user_id: emailMatchedProfile.auth_user_id,
            }
          : null,
        publicUsersAuthUserId: emailMatchedProfile?.auth_user_id ?? null,
        resolvedRole: "public",
        failureReason: emailMatchedProfile
          ? emailMatchedProfile.auth_user_id
            ? "public_users_auth_user_id_mismatch_for_email_match"
            : "public_users_auth_user_id_missing_for_email_match"
          : "no_public_users_row_for_auth_user_id",
      });
      return null;
    }

    const resolvedRole = toUserRole(profile.role);
    console.info("[server-auth-role-resolution]", {
      authUserId,
      matchedPublicUserId: profile.id,
      resolvedRole: resolvedRole ?? "public",
      missingLookupReason: resolvedRole ? null : "public_users_role_invalid_or_missing",
    });
    logAuthRuntimeDiagnostic({
      ...baseDiagnostic,
      authUserId,
      authEmail: email,
      matchedPublicUsersRow: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        auth_user_id: profile.auth_user_id,
      },
      publicUsersAuthUserId: profile.auth_user_id,
      resolvedRole: resolvedRole ?? "public",
      failureReason: resolvedRole ? null : "public_users_role_invalid_or_missing",
    });

    return {
      authUserId,
      appUserId: profile.id,
      role: resolvedRole,
      email: profile.email ?? email,
      fullName: profile.full_name ?? profile.email ?? email,
    };
  } catch (error) {
    if (!supabaseSessionVerified && isRecoverableSupabaseVerificationError(error)) {
      return getFallbackAuthenticatedUser(baseDiagnostic, error);
    }

    console.error("[server-auth] failed to resolve current user", {
      error: error instanceof Error ? error.message : String(error),
    });
    logAuthRuntimeDiagnostic({
      ...baseDiagnostic,
      authUserId: null,
      authEmail: null,
      matchedPublicUsersRow: null,
      publicUsersAuthUserId: null,
      resolvedRole: "public",
      failureReason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

type CurrentUser = AuthenticatedUser;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getAuthenticatedUser();
}

export async function getCurrentUserContext(): Promise<UserContext> {
  const requestMeta = await getAuthDiagnosticRequestMeta();
  const cookieStore = await cookies();
  const currentUser = await getAuthenticatedUser();
  const role = currentUser?.role ?? "public";
  const email = currentUser?.email ?? null;
  const authUserId = currentUser?.authUserId ?? null;
  let appUserId = currentUser?.appUserId ?? null;

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

  logAuthRuntimeDiagnostic({
    source: "getCurrentUserContext",
    requestHost: requestMeta.host,
    pathname: requestMeta.pathname,
    hasAccessToken: Boolean(cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value),
    hasRefreshToken: Boolean(cookieStore.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value),
    authUserId,
    authEmail: email,
    matchedPublicUsersRow: currentUser
      ? {
          id: currentUser.appUserId,
          email: currentUser.email,
          role: currentUser.role,
          auth_user_id: currentUser.authUserId,
        }
      : null,
    publicUsersAuthUserId: currentUser?.authUserId ?? null,
    resolvedRole: role,
    expectedRole: null,
    failureReason: currentUser ? null : "get_authenticated_user_returned_null",
  });

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
