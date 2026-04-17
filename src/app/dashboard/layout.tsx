import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell navbar={<Navbar isAuthenticated />} sidebar={<Sidebar />}>
      {children}
    </DashboardShell>
  );
}
