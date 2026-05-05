import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentUserContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await getCurrentUserContext();

  console.info("[dashboard-layout]", {
    userId: context?.appUserId ?? context?.authUserId ?? null,
    role: context?.role ?? null,
  });

  if (!context || !context.role || context.role === "public") {
    redirect("/login");
  }

  return (
    <DashboardShell navbar={<Navbar isAuthenticated />} sidebar={<Sidebar />}>
      {children}
    </DashboardShell>
  );
}
