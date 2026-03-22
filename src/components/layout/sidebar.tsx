import Link from "next/link";
import { getCurrentRole } from "@/lib/auth/session";
import { isRoleAllowedPath } from "@/lib/auth/rbac";
import type { UserRole } from "@/types/roles";

const items = [
  { href: "/dashboard/executive", label: "Executive Dashboard" },
  { href: "/dashboard/msme", label: "MSME Registry" },
  { href: "/dashboard/msme/onboarding", label: "Onboarding Wizard" },
  { href: "/dashboard/reviews", label: "Reviewer Workflow" },
  { href: "/dashboard/compliance", label: "KYC Simulation" },
  { href: "/dashboard/fccpc", label: "FCCPC Workspace" },
  { href: "/dashboard/firs", label: "FIRS Operations" },
  { href: "/dashboard/associations", label: "Associations" },
  { href: "/dashboard/manufacturers", label: "Manufacturers" },
  { href: "/dashboard/reports", label: "Reports & Export" },
  { href: "/dashboard/audit", label: "Audit Trail" },
  { href: "/dashboard/payments", label: "Tax / VAT" },
  { href: "/dashboard/msme/id-card", label: "Digital ID Card" },
  { href: "/verify", label: "Public Verification" },
];

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
  const role = await getCurrentRole();

  return (
    <aside className="w-72 border-r bg-slate-50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{ROLE_LABEL[role]} Portal</p>
      <p className="mb-4 text-sm font-semibold uppercase text-slate-500">Operational Modules</p>
      <ul className="space-y-1">
        {items
          .filter((item) => isRoleAllowedPath(role, item.href))
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
