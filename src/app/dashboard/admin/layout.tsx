import { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/auth/workspace-guards";
import { AdminCommandShell } from "@/components/admin/admin-command-shell";

async function currentPathname() {
  const headerStore = await headers();
  const directPath =
    headerStore.get("next-url") ??
    headerStore.get("x-next-url") ??
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("x-matched-path");

  if (directPath) return directPath.startsWith("http") ? new URL(directPath).pathname : directPath;
  const referer = headerStore.get("referer");
  return referer ? new URL(referer).pathname : "unknown";
}

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = await currentPathname();
  const ctx = await requireWorkspaceRole(["admin", "reviewer", "fccpc_officer", "firs_officer"], pathname);
  const sharedWorkspace = pathname === "/dashboard/admin/msmes" || pathname.startsWith("/dashboard/admin/msmes/") || pathname === "/dashboard/admin/association-members" || pathname.startsWith("/dashboard/admin/association-members/");
  if (ctx.role !== "admin" && !sharedWorkspace) {
    redirect("/access-denied");
  }

  return <AdminCommandShell adminName={ctx.fullName} adminRole={ctx.role}>{children}</AdminCommandShell>;
}
