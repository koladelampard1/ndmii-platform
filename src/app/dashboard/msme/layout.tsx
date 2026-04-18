"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProviderWorkspaceNav } from "@/components/msme/provider-workspace-nav";

export default function MsmeWorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWorkspaceHome = pathname === "/dashboard/msme";
  const isProfilePage = pathname === "/dashboard/msme/profile";
  const isServicesPage = pathname === "/dashboard/msme/services";
  const isPortfolioPage = pathname === "/dashboard/msme/portfolio";

  if (isWorkspaceHome || isProfilePage || isServicesPage || isPortfolioPage) {
    return <>{children}</>;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-950 to-blue-900 p-5 text-white shadow-sm">
        <h1 className="text-2xl font-semibold">Provider Operations Workspace</h1>
        <p className="mt-1 text-sm text-blue-100">Manage your marketplace profile, quotes, invoicing, and revenue operations.</p>
      </header>
      <ProviderWorkspaceNav />
      {children}
    </section>
  );
}
