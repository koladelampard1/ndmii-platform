import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

export async function requireWorkspaceRole(allowedRoles: UserRole[]) {
  const ctx = await getCurrentUserContext();

  if (!allowedRoles.includes(ctx.role)) {
    redirect("/access-denied");
  }

  return ctx;
}
