import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole(["admin"]);

  return children;
}
