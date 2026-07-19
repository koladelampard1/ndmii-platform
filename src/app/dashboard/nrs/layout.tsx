import { ReactNode } from "react";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { NRS_ACCESS_ROLES } from "@/lib/nrs/access";

export default async function NrsWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceRole([...NRS_ACCESS_ROLES]);

  return children;
}
