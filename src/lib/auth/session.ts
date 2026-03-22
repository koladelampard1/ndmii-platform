import { cookies } from "next/headers";
import { UserRole } from "@/types/roles";

export async function getCurrentRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const role = cookieStore.get("ndmii_role")?.value as UserRole | undefined;
  return role ?? "public";
}
