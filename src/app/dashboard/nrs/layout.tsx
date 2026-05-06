import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";

export default async function NrsWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole(["nrs_officer", "firs_officer", "admin"]);

  return children;
}
