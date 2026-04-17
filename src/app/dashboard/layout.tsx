import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardLayoutShell } from "./dashboard-layout-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardLayoutShell navbar={<Navbar />} sidebar={<Sidebar />}>{children}</DashboardLayoutShell>;
}
