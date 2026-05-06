import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentUserContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await getCurrentUserContext();
  if (ctx.role === "public") {
    redirect("/login");
  }

  return (
    <DashboardShell navbar={<Navbar isAuthenticated />} sidebar={<Sidebar />}>
      {children}
    </DashboardShell>
  );
}
