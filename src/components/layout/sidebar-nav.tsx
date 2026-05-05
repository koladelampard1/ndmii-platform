"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationGroup } from "@/lib/auth/authorization";

type SidebarNavProps = {
  groups: NavigationGroup[];
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ groups }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} className="space-y-1.5">
          <h2 className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {group.label}
          </h2>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item.href);

              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "block rounded-md border px-3 py-2 text-sm font-medium transition",
                      active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
                        : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:text-slate-950",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
