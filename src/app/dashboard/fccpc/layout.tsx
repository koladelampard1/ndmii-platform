import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

export default async function FccpcWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole(["fccpc_officer", "admin"]);

  return children;
}
