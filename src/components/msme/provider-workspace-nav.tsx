import Link from "next/link";

const LINKS = [
  { href: "/dashboard/msme/profile", label: "Profile overview" },
  { href: "/dashboard/msme/public-profile", label: "Public profile preview" },
  { href: "/dashboard/msme/services", label: "Services" },
  { href: "/dashboard/msme/portfolio", label: "Portfolio / gallery" },
  { href: "/dashboard/msme/reviews", label: "Reviews" },
  { href: "/dashboard/msme/complaints", label: "Complaints" },
  { href: "/dashboard/msme/quotes", label: "Quote requests" },
  { href: "/dashboard/msme/settings", label: "Settings" },
];

export function ProviderWorkspaceNav() {
  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Provider operations</p>
      <div className="grid gap-2 md:grid-cols-4">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
