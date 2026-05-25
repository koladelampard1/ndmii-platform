import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { getCurrentUserContext } from "@/lib/auth/session";
import { AdminCommandShell } from "@/components/admin/admin-command-shell";

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole(["admin"]);
  const ctx = await getCurrentUserContext();

  return <AdminCommandShell adminName={ctx.fullName}>{children}</AdminCommandShell>;
}
