import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentRole } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const role = await getCurrentRole();

  if (role !== "admin") {
    redirect("/access-denied");
  }

  return (
    <DashboardShell navbar={<Navbar isAuthenticated />} sidebar={<Sidebar />}>
      {children}
    </DashboardShell>
  );
}
