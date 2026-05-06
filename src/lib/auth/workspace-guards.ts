import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getCurrentUserContext } from "@/lib/auth/session";
import { SUPABASE_ACCESS_TOKEN_COOKIE, SUPABASE_REFRESH_TOKEN_COOKIE } from "@/lib/supabase/server";
import type { UserRole } from "@/types/roles";

async function resolveRequestHost() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "unknown";
}

async function resolveCurrentPathname() {
  const headerStore = await headers();
  const directPath =
    headerStore.get("next-url") ??
    headerStore.get("x-next-url") ??
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("x-matched-path");

  if (directPath) {
    return directPath.startsWith("http") ? new URL(directPath).pathname : directPath;
  }

  const referer = headerStore.get("referer");
  return referer ? new URL(referer).pathname : "unknown";
}

export async function requireWorkspaceRole(allowedRoles: UserRole[], pathname?: string) {
  const ctx = await getCurrentUserContext();
  const currentPathname = pathname ?? await resolveCurrentPathname();
  const expectedRole = allowedRoles.join(",");
  const requestHost = await resolveRequestHost();
  const cookieStore = await cookies();

  if (!allowedRoles.includes(ctx.role)) {
    console.info("[workspace-role-guard]", {
      requestHost,
      pathname: currentPathname,
      hasAccessToken: Boolean(cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value),
      hasRefreshToken: Boolean(cookieStore.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value),
      authUserId: ctx.authUserId,
      authEmail: ctx.email,
      matchedPublicUsersRow: ctx.appUserId
        ? {
            id: ctx.appUserId,
            email: ctx.email,
            role: ctx.role,
            auth_user_id: ctx.authUserId,
          }
        : null,
      publicUsersAuthUserId: ctx.authUserId,
      resolvedRole: ctx.role,
      expectedRole,
      redirectReason: "workspace_role_not_allowed",
      failureReason: "workspace_role_not_allowed",
    });
    redirect("/access-denied");
  }

  console.info("[workspace-role-guard]", {
    requestHost,
    pathname: currentPathname,
    hasAccessToken: Boolean(cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value),
    hasRefreshToken: Boolean(cookieStore.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value),
    authUserId: ctx.authUserId,
    authEmail: ctx.email,
    matchedPublicUsersRow: ctx.appUserId
      ? {
          id: ctx.appUserId,
          email: ctx.email,
          role: ctx.role,
          auth_user_id: ctx.authUserId,
        }
      : null,
    publicUsersAuthUserId: ctx.authUserId,
    resolvedRole: ctx.role,
    expectedRole,
    redirectReason: null,
    failureReason: null,
  });

  return ctx;
}
