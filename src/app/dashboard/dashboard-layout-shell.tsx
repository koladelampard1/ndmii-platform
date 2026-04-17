"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

type DashboardLayoutShellProps = {
  navbar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
};

export function DashboardLayoutShell({ navbar, sidebar, children }: DashboardLayoutShellProps) {
  const pathname = usePathname();
  const isMsmeWorkspace = pathname.startsWith("/dashboard/msme");

  if (isMsmeWorkspace) {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      {navbar}
      <div className="mx-auto flex max-w-7xl">
        {sidebar}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
