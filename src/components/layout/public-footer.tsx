import Link from "next/link";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";

const FOOTER_LINKS = [
  {
    title: "Platform",
    links: [
      { label: "Overview", href: "/about" },
      { label: "Verify", href: "/verify" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Business Identity", href: "/for-msmes" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "MSMEs", href: "/for-msmes" },
      { label: "Associations", href: "/for-associations" },
      { label: "Government", href: "/for-government" },
      { label: "Financial Institutions", href: "/for-financial-institutions" },
    ],
  },
  {
    title: "Programmes",
    links: [
      { label: "LCDBO", href: "/lcdbo" },
      { label: "Industrial Clusters", href: "/lcdbo/clusters" },
      { label: "Property / DLPI", href: "/property" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Guides", href: "/resources" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Register", href: "/register" },
      { label: "Sign In", href: "/login" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="bg-[#061711] text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_2fr] lg:py-14">
        <div>
          <Link href="/" className="inline-flex rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            <DbinBrandLogo textClassName="text-sm font-semibold text-white md:text-base" />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            DBIN is Nigeria’s trusted digital infrastructure for business identity, verification, operating readiness,
            public trust and institution-ready enterprise intelligence.
          </p>
          <p className="mt-5 text-xs text-slate-500">
            © {new Date().getFullYear()} Digital Business Identity Network. All rights reserved.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-semibold text-white">{group.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
