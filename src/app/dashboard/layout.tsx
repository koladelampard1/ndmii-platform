import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentUserContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getDashboardPathname() {
  const headerStore = await headers();
  return (
    headerStore.get("x-dbin-pathname") ??
    headerStore.get("next-url") ??
    headerStore.get("x-next-url") ??
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("x-matched-path") ??
    ""
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [ctx, pathname] = await Promise.all([getCurrentUserContext(), getDashboardPathname()]);
  const isNrsWorkspace = pathname.startsWith("/dashboard/nrs") || pathname.startsWith("/dashboard/firs");
  if (ctx.role === "public") {
    if (isNrsWorkspace) {
      const nextPath = pathname || "/dashboard/nrs";
      redirect(`/login?workspace=nrs&next=${encodeURIComponent(nextPath)}`);
    }
    redirect("/login");
  }

  if (isNrsWorkspace) {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }

  return (
    <DashboardShell navbar={<Navbar isAuthenticated />} sidebar={<Sidebar />}>
      {children}
    </DashboardShell>
  );
}
