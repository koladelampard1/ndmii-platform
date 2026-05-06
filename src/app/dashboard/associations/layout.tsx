import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

export default async function AssociationWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole(["association_officer", "admin"]);

  return children;
}
