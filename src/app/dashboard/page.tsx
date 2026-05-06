import { redirect } from "next/navigation";
import { getDefaultDashboardRoute } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/session";

export default async function DashboardPage() {
  const ctx = await getCurrentUserContext();
  if (ctx.role === "public") {
    redirect("/access-denied");
  }

  redirect(getDefaultDashboardRoute(ctx.role));
}
