import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

export default async function ReviewerWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole(["reviewer", "admin", "fccpc_officer", "firs_officer", "nrs_officer"]);

  return children;
}
