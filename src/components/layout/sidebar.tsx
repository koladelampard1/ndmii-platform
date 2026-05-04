import { getCurrentUserContext } from "@/lib/auth/session";
import { ROLE_NAV_GROUPS, ROLE_NAV_ITEMS, canAccessRoute, type NavigationGroup } from "@/lib/auth/authorization";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { UserRole } from "@/types/roles";

const ROLE_LABEL: Record<UserRole, string> = {
  public: "Public",
  admin: "Administrator",
  reviewer: "Reviewer",
  fccpc_officer: "FCCPC Officer",
  nrs_officer: "NRS Officer",
  firs_officer: "NRS Officer",
  association_officer: "Association Officer",
  msme: "MSME Operator",
};

export async function Sidebar() {
  const { role } = await getCurrentUserContext();
  const navGroups: NavigationGroup[] = role === "public"
    ? [{ label: "Public", items: [{ href: "/verify", label: "Public Verification" }] }]
    : ROLE_NAV_GROUPS[role] ?? [{ label: "Operational Modules", items: ROLE_NAV_ITEMS[role] }];

  const allowedGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(role, item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-72 shrink-0 border-r bg-slate-50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{ROLE_LABEL[role]} Portal</p>
      <p className="mb-4 text-sm font-semibold uppercase text-slate-500">Core Workflows</p>
      <SidebarNav groups={allowedGroups} />
    </aside>
  );
}
