import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Factory, Landmark, Menu, Network, ShieldCheck } from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF } from "@/lib/lcdbo/content";

const navItems = [
  { href: "/lcdbo/about", label: "About" },
  { href: "/lcdbo/model", label: "Model" },
  { href: "/lcdbo/clusters", label: "Clusters" },
  { href: "/lcdbo/partners", label: "Partners" },
  { href: "/lcdbo/opportunities", label: "Opportunities" },
  { href: "/lcdbo/events", label: "Events" },
  { href: "/lcdbo/resources", label: "Resources" },
  { href: "/lcdbo/contact", label: "Contact" },
];

export function LcdboShell({ children, landing = false }: { children: ReactNode; landing?: boolean }) {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#101828]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B2E59]/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/lcdbo" className="flex items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a441]">
            {landing ? (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#008751] text-[11px] font-black tracking-[0.08em] text-white shadow-lg shadow-black/20">LC</span>
                <span>
                  <span className="block text-lg font-black leading-none tracking-[0.08em] text-white">LCDBO</span>
                  <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.12em] text-[#f2c76b] sm:block">Local Content Development Beyond Oil</span>
                </span>
              </>
            ) : (
              <>
                <DbinBrandLogo textClassName="text-white" />
                <span className="hidden border-l border-white/20 pl-3 text-xs font-bold uppercase tracking-[0.16em] text-[#f2c76b] sm:block">LCDBO</span>
              </>
            )}
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-semibold text-slate-200 xl:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-[#f2c76b]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={LCDBO_REGISTER_HREF} className="hidden rounded-md bg-[#d9a441] px-3 py-2 text-xs font-black text-[#06172f] transition hover:bg-[#f2c76b] sm:inline-flex">
              Register
            </Link>
            <Link href="/dashboard/lcdbo" className="hidden rounded-md border border-white/20 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 md:inline-flex">
              {landing ? "Programme Workspace" : "Workspace"}
            </Link>
            <details className="relative xl:hidden">
              <summary aria-label="Open LCDBO menu" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md border border-white/20 text-white"><Menu className="h-4 w-4" /></summary>
              <nav className="absolute right-0 top-12 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl" aria-label="Mobile LCDBO navigation">{navItems.map((item) => <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-slate-50">{item.label}</Link>)}</nav>
            </details>
          </div>
        </div>
      </header>
      {children}
    </main>
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
            National industrial transformation initiative
          </p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl lg:text-[4.25rem] lg:leading-[1.04]">Transforming Local Economies Through Production, Industrialisation and Commercialisation</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">The Local Content Development Beyond Oil (LCDBO) initiative is building a national ecosystem for industrial clusters, MSME growth, investment mobilisation, market access and inclusive economic transformation.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={LCDBO_REGISTER_HREF} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#d9a441] px-4 text-sm font-black text-[#06172f] transition hover:bg-[#f2c76b]">
              Register Your Business <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/lcdbo/clusters" className="inline-flex h-11 items-center rounded-md border border-white/25 px-4 text-sm font-bold text-white transition hover:bg-white/10">
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
