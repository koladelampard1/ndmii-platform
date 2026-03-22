import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/session";
import { ROLE_NAV_ITEMS, canAccessRoute } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

const ROLE_LABEL: Record<UserRole, string> = {
  public: "Public",
  admin: "Administrator",
  reviewer: "Reviewer",
  fccpc_officer: "FCCPC Officer",
  firs_officer: "FIRS Officer",
  association_officer: "Association Officer",
  msme: "MSME Operator",
};

export async function Sidebar() {
  const { role } = await getCurrentUserContext();
  const navItems = role === "public" ? [{ href: "/verify", label: "Public Verification" }] : ROLE_NAV_ITEMS[role];

  return (
    <aside className="w-72 border-r bg-slate-50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{ROLE_LABEL[role]} Portal</p>
      <p className="mb-4 text-sm font-semibold uppercase text-slate-500">Operational Modules</p>
      <ul className="space-y-1">
        {navItems
          .filter((item) => canAccessRoute(role, item.href))
          .map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-slate-200">
                {item.label}
              </Link>
            </li>
          ))}
      </ul>
    </aside>
  );
}
