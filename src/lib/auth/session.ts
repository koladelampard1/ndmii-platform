import { cookies } from "next/headers";
import type { UserRole } from "@/types/roles";

export async function getCurrentUserContext() {
  const cookieStore = await cookies();
  const role = (cookieStore.get("ndmii_role")?.value as UserRole | undefined) ?? "public";
  const email = cookieStore.get("ndmii_email")?.value ?? null;
  const userId = cookieStore.get("ndmii_auth_user_id")?.value ?? null;
  const appUserId = cookieStore.get("ndmii_app_user_id")?.value ?? null;

  return {
    role,
    user: email ? { email, id: userId } : null,
    profile: email ? { id: appUserId, full_name: email, role } : null,
  };
}

export async function getCurrentRole(): Promise<UserRole> {
  const context = await getCurrentUserContext();
  return context.role;
}
