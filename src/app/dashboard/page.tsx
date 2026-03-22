import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/session";
import { getDefaultDashboardRoute } from "@/lib/auth/rbac";

export default async function DashboardPage() {
  const role = await getCurrentRole();
  redirect(getDefaultDashboardRoute(role));
}
