"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

type DashboardShellProps = {
  children: ReactNode;
  navbar: ReactNode;
  sidebar: ReactNode;
};

export function DashboardShell({ children, navbar, sidebar }: DashboardShellProps) {
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
