import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Factory,
  Landmark,
  Network,
  ShieldCheck,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { LcdboMobileNav, type LcdboNavItem } from "@/components/lcdbo/lcdbo-mobile-nav";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF, lcdboPublicHref } from "@/lib/lcdbo/content";
import { lcdboInstitutionalAttribution, lcdboStructuredData } from "@/lib/lcdbo/public-governance";

const navItems: LcdboNavItem[] = [
  { href: lcdboPublicHref("/about"), label: "About" },
  { href: lcdboPublicHref("/model"), label: "Model" },
  { href: lcdboPublicHref("/clusters"), label: "Clusters" },
  { href: lcdboPublicHref("/partners"), label: "Partners" },
  { href: lcdboPublicHref("/opportunities"), label: "Opportunities" },
  { href: lcdboPublicHref("/events"), label: "Events" },
  { href: lcdboPublicHref("/resources"), label: "Resources" },
  { href: lcdboPublicHref("/contact"), label: "Contact" },
];

export function LcdboShell({ children }: { children: ReactNode; landing?: boolean }) {
  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#101828]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html { scroll-padding-top: 9.75rem; }
            #lcdbo-main :where(section[id], article[id], div[id], h1[id], h2[id], h3[id]) { scroll-margin-top: 9.75rem; }
            @media (max-width: 767px) {
              html { scroll-padding-top: 8.5rem; }
              #lcdbo-main :where(section[id], article[id], div[id], h1[id], h2[id], h3[id]) { scroll-margin-top: 8.5rem; }
            }
            @media (prefers-reduced-motion: reduce) {
              *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
            }
          `,
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lcdboStructuredData) }}
      />
      <a href="#lcdbo-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-[#06172f] focus:shadow-xl">
        Skip to LCDBO content
      </a>
      <LcdboInstitutionalMasthead />
      <LcdboPublicHeader />
      <main id="lcdbo-main">
        {children}
      </main>
      <LcdboInstitutionalFooter />
    </div>
  );
}

function LcdboInstitutionalMasthead() {
  return (
    <div className="relative z-40 border-b border-emerald-950/10 bg-white text-[#06172f]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <InstitutionTextMark label="RMRDC" emphasis />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0B2E59] sm:text-xs">
              Raw Materials Research and Development Council
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-600 sm:text-sm">
              Institutional Home and Public-Sector Anchor of LCDBO
            </p>
          </div>
        </div>
        <p className="inline-flex w-fit rounded-full border border-[#D4A017]/35 bg-[#D4A017]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[#6d4c06]">
          A National Industrial Transformation Programme
        </p>
      </div>
    </div>
  );
}

function LcdboPublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B2E59]/96 text-white shadow-lg shadow-slate-950/10 backdrop-blur supports-[backdrop-filter]:bg-[#0B2E59]/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={lcdboPublicHref()} className="flex min-w-0 items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#008751] text-[11px] font-black tracking-[0.08em] text-white shadow-lg shadow-black/20">
            LC
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-black leading-none tracking-[0.08em] text-white">LCDBO</span>
            <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.12em] text-[#f2c76b] sm:block">
              Local Content Development Beyond Oil
            </span>
            <span className="mt-1 block text-[10px] font-bold text-emerald-100 sm:hidden">An RMRDC-led Programme</span>
          </span>
          <span className="hidden border-l border-white/15 pl-3 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100 md:block">
            An RMRDC-led Programme
          </span>
        </Link>

        <nav className="hidden items-center gap-4 text-sm font-semibold text-slate-200 xl:flex" aria-label="LCDBO public navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md transition hover:text-[#f2c76b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href={LCDBO_REGISTER_HREF} className="hidden rounded-md bg-[#D4A017] px-3 py-2 text-xs font-black text-[#06172f] transition hover:bg-[#f2c76b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c76b] sm:inline-flex">
            Register
          </Link>
          <Link href="/dashboard/lcdbo" className="hidden rounded-md border border-white/20 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017] md:inline-flex">
            Programme Workspace
          </Link>
          <LcdboMobileNav navItems={navItems} />
        </div>
      </div>
    </header>
  );
}

export function LcdboHero() {
  return (
    <section className="relative overflow-hidden bg-[#0B2E59] text-white">
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute left-[-10%] top-10 h-72 w-72 rounded-full bg-[#1f8a5b] blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-5%] h-96 w-96 rounded-full bg-[#d9a441] blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="max-w-4xl">
          <p className="inline-flex rounded-full border border-[#d9a441]/40 bg-[#d9a441]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">
            An RMRDC-led national industrial transformation programme
          </p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl lg:text-[4.25rem] lg:leading-[1.04]">
            Building Nigeria&apos;s Industrial Future, Beyond Oil.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            LCDBO connects Nigerian raw materials, MSMEs, industrial clusters, investors and markets to build productive capacity, create jobs and grow exports.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={LCDBO_REGISTER_HREF} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#d9a441] px-4 text-sm font-black text-[#06172f] transition hover:bg-[#f2c76b]">
              Register Your Business <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={lcdboPublicHref("/clusters")} className="inline-flex h-11 items-center rounded-md border border-white/25 px-4 text-sm font-bold text-white transition hover:bg-white/10">
              Explore Industrial Clusters
            </Link>
            <Link href={LCDBO_PARTNER_HREF} className="inline-flex h-11 items-center rounded-md border border-white/25 px-4 text-sm font-bold text-white transition hover:bg-white/10">
              Partner With LCDBO
            </Link>
          </div>
        </div>
        <IndustrialSystemVisual />
      </div>
    </section>
  );
}

export function IndustrialSystemVisual() {
  const nodes = [
    { label: "Industrial clusters", icon: Factory },
    { label: "MSME enablement", icon: ShieldCheck },
    { label: "Investment flows", icon: Landmark },
    { label: "Exports & markets", icon: Network },
    { label: "Jobs & production", icon: Building2 },
  ];
  return (
    <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-4 shadow-2xl shadow-slate-950/30">
      <div className="rounded-xl border border-white/10 bg-[#091f3c] p-4">
        <div className="relative mb-3 min-h-36 overflow-hidden rounded-xl border border-white/10 bg-emerald-400/[0.06]">
          <div className="absolute left-[22%] top-[12%] h-[76%] w-[58%] rotate-[-8deg] rounded-[42%_58%_54%_46%/44%_36%_64%_56%] border border-emerald-300/30 bg-emerald-400/10" />
          {["left-[38%] top-[28%]", "left-[58%] top-[47%]", "left-[43%] top-[65%]"].map((position) => <span key={position} className={`absolute ${position} h-4 w-4 rounded-full border-4 border-[#091f3c] bg-[#D4A017] shadow-lg`} />)}
          <p className="absolute bottom-3 left-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Nigeria programme footprint</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            return (
              <div key={node.label} className={index === 4 ? "col-span-2" : ""}>
                <div className="flex min-h-24 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#1f8a5b]/20 text-[#78d6a3]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#f2c76b]">LCDBO Layer</p>
                    <p className="mt-1 text-sm font-black text-white">{node.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl bg-[#D4A017] p-4 text-[#0B2E59]">
          <p className="text-xs font-black uppercase tracking-[0.14em]">Programme operating picture</p>
          <p className="mt-1 text-2xl font-black">Clusters + Capital + Commerce</p>
        </div>
      </div>
    </div>
  );
}

export function LcdboSection({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="mb-7 max-w-3xl">
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1f8a5b]">{eyebrow}</p> : null}
        <h2 className="mt-2 text-3xl font-black tracking-tight text-[#06172f] sm:text-4xl">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function LcdboPageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="relative overflow-hidden bg-[#0B2E59] text-white">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#008751]/25 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f2c76b]">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{description}</p>
      </div>
    </section>
  );
}

export function LcdboFinalCta() {
  return (
    <section className="bg-[#07172e] px-4 py-14 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f2c76b]">Build beyond oil</p>
          <h2 className="mt-2 text-3xl font-black">Join Nigeria&apos;s Industrial Transformation Journey</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">MSMEs, states, investors, associations, technical partners, and institutions can enter through DBIN without creating a separate account system.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={LCDBO_REGISTER_HREF} className="inline-flex h-11 items-center rounded-md bg-[#d9a441] px-4 text-sm font-black text-[#06172f]">
            Register Your Business
          </Link>
          <Link href={LCDBO_PARTNER_HREF} className="inline-flex h-11 items-center rounded-md border border-white/25 px-4 text-sm font-bold text-white">
            Partner With LCDBO
          </Link>
        </div>
      </div>
    </section>
  );
}

function LcdboInstitutionalFooter() {
  return (
    <footer id="lcdbo-footer" className="bg-[#041226] px-4 py-12 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <InstitutionTextMark label="RMRDC" />
            <div>
              <p className="text-2xl font-black tracking-[0.08em]">LCDBO</p>
              <p className="mt-1 text-sm font-bold text-slate-300">Local Content Development Beyond Oil</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm leading-6 text-slate-300">
            <p><span className="font-black text-white">Institutional attribution:</span> An RMRDC-led national industrial transformation programme.</p>
            <p><span className="font-black text-white">Programme architecture and implementation:</span> Roseate Forte Nigeria Limited.</p>
            <p><span className="font-black text-white">Digital infrastructure:</span> Powered by DBIN.</p>
            <p><span className="font-black text-white">Public enquiry:</span> <span>{lcdboInstitutionalAttribution.publicContactEmail}</span></p>
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4A017]">Programme</p>
            <nav className="mt-4 grid gap-2 text-sm font-bold text-slate-300" aria-label="LCDBO footer navigation">
              {navItems.slice(0, 6).map((item) => <Link key={item.href} href={item.href} className="hover:text-white">{item.label}</Link>)}
            </nav>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4A017]">Access</p>
            <nav className="mt-4 grid gap-2 text-sm font-bold text-slate-300" aria-label="LCDBO footer access links">
              <Link href={LCDBO_REGISTER_HREF} className="hover:text-white">Register Your Business</Link>
              <Link href="/dashboard/lcdbo" className="hover:text-white">Programme Workspace</Link>
              <Link href={LCDBO_PARTNER_HREF} className="hover:text-white">Partner With LCDBO</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-7xl gap-4 border-t border-white/10 pt-6 text-xs leading-5 text-slate-400 lg:grid-cols-[1fr_auto] lg:items-center">
        <p>© {new Date().getFullYear()} LCDBO. Programme identity presented with institutional attribution. Images are credited where licence information is available. Public pages are designed for accessible use and privacy-conscious enquiry routing.</p>
        <DbinBrandLogo textClassName="text-white" />
      </div>
    </footer>
  );
}

function InstitutionTextMark({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  return (
    <span className={`grid h-11 w-16 shrink-0 place-items-center rounded-xl border text-[10px] font-black tracking-[0.12em] shadow-sm ${emphasis ? "border-[#008751]/25 bg-[#008751] text-white" : "border-white/10 bg-white/10 text-white"}`}>
      {label}
    </span>
  );
}
