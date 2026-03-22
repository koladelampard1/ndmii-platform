import Link from "next/link";

const items = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/msme", label: "MSME Registry" },
  { href: "/dashboard/msme/onboarding", label: "Onboarding Wizard" },
  { href: "/dashboard/reviews", label: "Reviewer Workflow" },
  { href: "/dashboard/compliance", label: "KYC Module" },
  { href: "/dashboard/msme/id-card", label: "Digital ID Card" },
  { href: "/dashboard/payments", label: "Tax / VAT" },
  { href: "/verify", label: "Public Verification" },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-slate-50 p-4">
      <p className="mb-4 text-sm font-semibold uppercase text-slate-500">Role Dashboards</p>
      <ul className="space-y-2">
        {items.map((item) => (
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
