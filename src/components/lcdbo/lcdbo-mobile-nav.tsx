"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF } from "@/lib/lcdbo/content";

export type LcdboNavItem = {
  href: string;
  label: string;
};

export function LcdboMobileNav({ navItems }: { navItems: LcdboNavItem[] }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  function closeMenu() {
    const details = detailsRef.current;
    if (!details?.open) return;
    details.open = false;
    summaryRef.current?.focus();
  }

  return (
    <details ref={detailsRef} className="relative xl:hidden" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    }}>
      <summary ref={summaryRef} aria-label="Open LCDBO menu" className="grid h-11 min-h-11 w-11 cursor-pointer list-none place-items-center rounded-md border border-white/20 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]">
        <Menu className="h-4 w-4" aria-hidden="true" />
      </summary>
      <nav className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl" aria-label="Mobile LCDBO navigation">
        <div className="border-b border-slate-100 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#008751]">LCDBO</p>
          <p className="mt-1 text-sm font-black text-[#06172f]">An RMRDC-led Programme</p>
        </div>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={closeMenu} className="block min-h-11 rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008751]">
            {item.label}
          </Link>
        ))}
        <div className="mt-2 grid gap-2 border-t border-slate-100 p-2">
          <Link href={LCDBO_REGISTER_HREF} onClick={closeMenu} className="min-h-11 rounded-lg bg-[#D4A017] px-3 py-2.5 text-center text-sm font-black text-[#06172f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008751]">
            Register Your Business
          </Link>
          <Link href="/dashboard/lcdbo" onClick={closeMenu} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-black text-[#0B2E59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008751]">
            Programme Workspace
          </Link>
          <Link href={LCDBO_PARTNER_HREF} onClick={closeMenu} className="min-h-11 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-black text-[#0B2E59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008751]">
            Partner With LCDBO
          </Link>
        </div>
      </nav>
    </details>
  );
}
