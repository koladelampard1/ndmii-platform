import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

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

  if (!allowedRoles.includes(ctx.role)) {
    console.info("[workspace-role-guard]", {
      resolvedRole: ctx.role,
      expectedRole,
      redirectReason: "workspace_role_not_allowed",
      currentPathname,
    });
    redirect("/access-denied");
  }

  console.info("[workspace-role-guard]", {
    resolvedRole: ctx.role,
    expectedRole,
    redirectReason: null,
    currentPathname,
  });

  return ctx;
}
