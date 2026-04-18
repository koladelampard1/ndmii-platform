import { ReactNode } from "react";
import { MsmeWorkspaceSidebar } from "@/components/msme/msme-workspace-sidebar";

export default function MsmeWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1700px] gap-5 p-4 lg:grid-cols-[290px,minmax(0,1fr)] lg:p-6">
      <MsmeWorkspaceSidebar />
      <main className="min-w-0 space-y-5">{children}</main>
    </div>
  );
}
