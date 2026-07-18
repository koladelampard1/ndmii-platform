"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";

type NavbarProps = {
  isAuthenticated?: boolean;
  roleLabel?: string;
};

const NAV_GROUPS = [
  {
    label: "Platform",
    links: [
      { label: "Platform Overview", href: "/platform", description: "How DBIN connects identity, trust and opportunity." },
      { label: "Business Identity", href: "/platform/business-identity", description: "Trusted digital profiles and business credentials." },
      { label: "Verification & Credentials", href: "/verify", description: "Confirm public business identity records." },
      { label: "Business Tools", href: "/platform/business-tools", description: "Invoices, receipts, records and operating readiness." },
      { label: "Compliance & Tax Readiness", href: "/platform/compliance", description: "Resources for evidence, records and readiness." },
      { label: "Intelligence & Reporting", href: "/platform/intelligence", description: "Institutional pathways for programme insight." },
    ],
  },
  {
    label: "Who We Serve",
    links: [
      { label: "MSMEs", href: "/for-msmes", description: "Register, verify and grow with trusted records." },
      { label: "Associations & Cooperatives", href: "/for-associations", description: "Coordinate member onboarding and visibility." },
      { label: "Government & Regulators", href: "/for-government", description: "Support formalisation, oversight and service delivery." },
      { label: "Financial Institutions", href: "/for-financial-institutions", description: "Use verifiable signals for MSME enablement." },
      { label: "Development Partners", href: "/partners", description: "Partner around measurable enterprise outcomes." },
      { label: "Procurement Teams", href: "/marketplace", description: "Find and verify credible providers." },
    ],
  },
  {
    label: "Programmes",
    links: [
      { label: "Programme Workspaces", href: "/programmes", description: "Reusable infrastructure for institutional programmes." },
      { label: "LCDBO", href: "/lcdbo", description: "Local Content Development Beyond Oil." },
      { label: "Industrial Clusters", href: "/lcdbo/clusters", description: "Cluster participation and production pathways." },
      { label: "Revenue Guides", href: "/resources", description: "Readiness resources for business and revenue engagement." },
      { label: "Property & Land Intelligence", href: "/property", description: "Privacy-safe public property verification." },
    ],
  },
];

const DIRECT_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Verify", href: "/verify" },
  { label: "Resources", href: "/resources" },
  { label: "Partners", href: "/partners" },
  { label: "About", href: "/about" },
];

export function Navbar({ isAuthenticated = false, roleLabel }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-950/70 bg-emerald-950/95 text-white shadow-sm backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-emerald-950"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
          <DbinBrandLogo textClassName="text-white" />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 text-sm lg:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 font-medium text-emerald-50/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {group.label}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <div className="invisible absolute left-0 top-full w-[24rem] translate-y-2 rounded-2xl border border-emerald-100/15 bg-white p-3 text-slate-900 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="grid gap-1">
                  {group.links.map((link) => (
                    <Link
                      key={`${group.label}-${link.label}`}
                      href={link.href}
                      className="rounded-xl px-3 py-2 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      <span className="block text-sm font-semibold text-slate-950">{link.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{link.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {DIRECT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 font-medium text-emerald-50/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {isAuthenticated ? (
            <>
              {roleLabel ? (
                <span className="rounded bg-emerald-900/80 px-2 py-1 text-xs uppercase tracking-wide text-emerald-100">
                  {roleLabel}
                </span>
              ) : null}
              <Link href="/logout">
                <Button size="sm" variant="secondary">
                  Sign out
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="secondary">Sign in</Button>
              </Link>
              <Link href="/register" className="sm:ml-1">
                <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Register</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-public-navigation"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 lg:hidden"
        >
          <span className="sr-only">{mobileOpen ? "Close navigation" : "Open navigation"}</span>
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {mobileOpen ? (
        <div id="mobile-public-navigation" className="border-t border-white/10 bg-emerald-950 px-4 pb-5 lg:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-4 pt-4">
            {NAV_GROUPS.map((group) => (
              <section key={group.label} aria-labelledby={`mobile-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <h2 id={`mobile-${group.label.replace(/\s+/g, "-").toLowerCase()}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  {group.label}
                </h2>
                <div className="mt-2 grid gap-1">
                  {group.links.map((link) => (
                    <Link key={`${group.label}-${link.label}`} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 text-sm text-emerald-50/90 transition hover:bg-white/10 hover:text-white">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
            <div className="grid gap-1">
              {DIRECT_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-emerald-50/90 transition hover:bg-white/10 hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {isAuthenticated ? (
                <Link href="/logout" onClick={() => setMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-emerald-950">
                  Sign out
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md border border-white/30 px-4 text-sm font-semibold text-white">
                    Sign in
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-400 px-4 text-sm font-semibold text-emerald-950">
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
