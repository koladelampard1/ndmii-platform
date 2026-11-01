import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, BadgeCheck, BarChart3, Building2, ChevronDown,
  ClipboardCheck, FileCheck2, FileText, Handshake, Landmark, LockKeyhole,
  MapPin, Menu, Network, Search, ShieldCheck, Users, WalletCards,
  type LucideIcon,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";

const nav = [
  { title: "For businesses", links: [
    { text: "Business journey", href: "/for-msmes" },
    { text: "Business identity", href: "/platform/business-identity" },
    { text: "Operating tools", href: "/platform/business-tools" },
    { text: "Compliance readiness", href: "/platform/compliance" },
  ] },
  { title: "For institutions", links: [
    { text: "Financial institutions", href: "/for-financial-institutions" },
    { text: "Associations & cooperatives", href: "/for-associations" },
    { text: "Government", href: "/for-government" },
    { text: "Partner with DBIN", href: "/partners" },
  ] },
  { title: "Programmes", links: [
    { text: "Programme workspaces", href: "/programmes" },
    { text: "LCDBO", href: "/lcdbo" },
    { text: "Industrial clusters", href: "/lcdbo/clusters" },
    { text: "Intelligence & reporting", href: "/platform/intelligence" },
  ] },
  { title: "Explore", links: [
    { text: "Platform overview", href: "/platform" },
    { text: "Marketplace", href: "/marketplace" },
    { text: "Verify a business", href: "/verify" },
    { text: "About DBIN", href: "/about" },
    { text: "Contact", href: "/contact" },
  ] },
];

const journey: Array<{ step: string; title: string; copy: string; icon: LucideIcon }> = [
  { step: "01", title: "Establish identity", copy: "Create a structured business record and control what is shared.", icon: BadgeCheck },
  { step: "02", title: "Build trust", copy: "Prepare evidence for review and make approved facts verifiable.", icon: ShieldCheck },
  { step: "03", title: "Develop capability", copy: "Diagnose needs, organise records and follow a development plan.", icon: ClipboardCheck },
  { step: "04", title: "Prepare for opportunity", copy: "Bring the right evidence to markets, finance and programmes.", icon: WalletCards },
  { step: "05", title: "Show progress", copy: "Track services, follow-up and outcomes in connected workspaces.", icon: BarChart3 },
];

const businessTools: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  { title: "Digital business identity", copy: "A consistent profile, credential status and public verification route.", icon: BadgeCheck },
  { title: "Operating records", copy: "Invoices, receipts, quotations and documents organised around the business.", icon: FileText },
  { title: "Readiness & development", copy: "Evidence checklists, diagnostics and actions that make the next step clearer.", icon: ClipboardCheck },
  { title: "Markets & programmes", copy: "A route to discovery, buyer enquiries and relevant participation pathways.", icon: Handshake },
];

const institutionTools: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  { title: "Set up your network", copy: "Manage institution teams, associations, delivery partners and assigned agents.", icon: Network },
  { title: "Support each enterprise", copy: "Onboard businesses, assess needs and record services and evidence.", icon: Users },
  { title: "Prepare financing cases", copy: "Work through product requirements, evidence review and controlled handover.", icon: FileCheck2 },
  { title: "See what changed", copy: "Follow portfolios, programme delivery, risks and outcomes with governed reporting.", icon: BarChart3 },
];

const audiences: Array<{ title: string; copy: string; href: string; icon: LucideIcon }> = [
  { title: "Businesses", copy: "Build a trusted identity and a stronger operating record.", href: "/for-msmes", icon: BadgeCheck },
  { title: "Associations", copy: "Bring member businesses into a structured, visible portfolio.", href: "/for-associations", icon: Users },
  { title: "Financial institutions", copy: "Support MSME development and evidence-based preparation.", href: "/for-financial-institutions", icon: Landmark },
  { title: "Government & programmes", copy: "Coordinate enterprise journeys across teams and places.", href: "/for-government", icon: Building2 },
];

function Header() {
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#082820] text-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-[#082820]">Skip to content</a>
    <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 xl:px-12">
      <Link href="/" aria-label="DBIN home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6ecaa]">
        <DbinBrandLogo compactOnMobile={false} iconClassName="h-12 w-12 rounded-full" textClassName="max-w-[10.5rem] whitespace-normal text-[12px] font-black leading-tight text-white" />
      </Link>
      <nav aria-label="Primary navigation" className="hidden items-center gap-1 xl:flex">
        {nav.map(group => <div key={group.title} className="group relative">
          <button type="button" aria-haspopup="true" className="inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6ecaa]">
            {group.title}<ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="invisible absolute left-0 top-full w-64 translate-y-2 rounded-xl border border-[#dfe9e0] bg-white p-2 text-[#17382e] opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
            {group.links.map(link => <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#edf5ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#276b50]">{link.text}</Link>)}
          </div>
        </div>)}
      </nav>
      <div className="hidden items-center gap-3 xl:flex">
        <Link href="/login" className="rounded-lg px-3 py-3 text-sm font-semibold text-white/85 hover:text-white">Sign in</Link>
        <Link href="/register" className="rounded-lg bg-[#b6ecaa] px-5 py-3 text-sm font-bold text-[#0b2b21] transition hover:bg-[#d6f7c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Create business identity</Link>
      </div>
      <details className="group relative xl:hidden">
        <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6ecaa] [&::-webkit-details-marker]:hidden"><span className="sr-only">Open navigation</span><Menu className="h-5 w-5" aria-hidden="true" /></summary>
        <div className="absolute right-0 top-14 max-h-[calc(100svh-6rem)] w-[min(90vw,23rem)] overflow-y-auto rounded-xl border border-white/15 bg-[#0c3429] p-5 shadow-2xl">
          <nav aria-label="Mobile navigation" className="grid gap-5">
            {nav.map(group => <div key={group.title}><h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#b6ecaa]">{group.title}</h2><div className="mt-2 grid gap-1">{group.links.map(link => <Link key={link.href} href={link.href} className="rounded-lg px-2 py-2 text-sm font-medium text-white/90 hover:bg-white/10">{link.text}</Link>)}</div></div>)}
            <div className="grid gap-2 border-t border-white/15 pt-4"><Link href="/login" className="rounded-lg border border-white/25 px-4 py-3 text-center text-sm font-semibold">Sign in</Link><Link href="/register" className="rounded-lg bg-[#b6ecaa] px-4 py-3 text-center text-sm font-bold text-[#0b2b21]">Create business identity</Link></div>
          </nav>
        </div>
      </details>
    </div>
  </header>;
}

function Intro({ eyebrow, title, copy, light = false }: { eyebrow: string; title: string; copy: string; light?: boolean }) {
  return <div className="max-w-3xl">
    <p className={light ? "text-xs font-extrabold uppercase tracking-[0.21em] text-[#b6ecaa]" : "text-xs font-extrabold uppercase tracking-[0.21em] text-[#3d7855]"}>{eyebrow}</p>
    <h2 className={light ? "mt-4 text-3xl font-semibold leading-[1.12] tracking-[-0.045em] text-white sm:text-5xl" : "mt-4 text-3xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#13382d] sm:text-5xl"}>{title}</h2>
    <p className={light ? "mt-5 text-base leading-7 text-white/70 sm:text-lg" : "mt-5 text-base leading-7 text-[#51675e] sm:text-lg"}>{copy}</p>
  </div>;
}

function Hero() {
  return <section className="relative overflow-hidden bg-[#082820] text-white">
    <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(circle_at_12%_12%,#1b5943_0,transparent_38%),radial-gradient(circle_at_95%_88%,#164835_0,transparent_35%)]" aria-hidden="true" />
    <div className="relative mx-auto grid max-w-[1440px] lg:min-h-[690px] lg:grid-cols-[1.04fr_0.96fr]">
      <div className="relative z-10 flex flex-col justify-center px-5 pb-14 pt-16 sm:px-8 sm:pt-20 lg:py-24 lg:pl-12 lg:pr-10">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.17em] text-[#c7f4bd]"><span className="h-2 w-2 rounded-full bg-[#b6ecaa]" />Digital Business Identity Network</p>
        <h1 className="mt-8 max-w-[760px] text-[clamp(3.5rem,6.1vw,6.5rem)] font-semibold leading-[0.99] tracking-[-0.07em]">One business identity.<br /><span className="text-[#b6ecaa]">More ways to grow.</span></h1>
        <p className="mt-8 max-w-xl text-lg leading-8 text-[#d4e3da] sm:text-xl">DBIN connects verified business profiles, operating records, development support and opportunity pathways in one reusable enterprise record.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/register" className="inline-flex min-h-[52px] items-center gap-2 rounded-lg bg-[#b6ecaa] px-6 py-3.5 text-sm font-bold text-[#0b2b21] transition hover:bg-[#d6f7c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Create a business identity <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          <Link href="/partners" className="inline-flex min-h-[52px] items-center gap-2 rounded-lg border border-white/35 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Deploy DBIN for your institution <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/15 pt-6 text-sm font-medium text-[#c6d9ce]">
          {[[BadgeCheck, "Identity"], [FileText, "Records"], [Handshake, "Opportunities"], [BarChart3, "Outcomes"]].map(([Icon, label]) => {
            const Symbol = Icon as LucideIcon;
            return <span key={label as string} className="inline-flex items-center gap-2"><Symbol className="h-4 w-4 text-[#b6ecaa]" />{label as string}</span>;
          })}
        </div>
      </div>
      <div className="relative min-h-[470px] overflow-hidden lg:min-h-full">
        <Image src="/images/lcdbo/agro-processing.jpg" alt="Nigerian agro-processing entrepreneur at work" fill priority sizes="(min-width:1024px) 48vw, 100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#082820]/75 via-[#082820]/10 to-[#082820]/5 lg:bg-gradient-to-r lg:from-[#082820]/55 lg:via-transparent lg:to-transparent" />
        <div className="absolute bottom-8 left-5 right-5 max-w-md rounded-2xl border border-white/30 bg-[#f8f5ea]/95 p-5 text-[#17382e] shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur sm:bottom-10 sm:left-10 sm:p-6">
          <div className="flex items-center justify-between gap-4"><span className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#528063]">The DBIN model</span><span className="rounded-full bg-[#e5eee4] px-3 py-1 text-[11px] font-bold text-[#23513b]">Connected record</span></div>
          <p className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.04em]">A business builds its record once, then puts it to work.</p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#cddbd0] pt-4 text-xs font-bold text-[#446251]"><span>01 / Establish trust</span><span>02 / Build readiness</span><span>03 / Access opportunity</span></div>
        </div>
      </div>
    </div>
  </section>;
}

function Journey() {
  return <section className="bg-[#f5f4eb] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
    <div className="mx-auto max-w-[1320px]">
      <Intro eyebrow="One connected journey" title="From first record to measurable progress." copy="A DBIN identity becomes more useful as the business is verified, supported and connected to the right opportunities. Each stage contributes to the same business journey." />
      <div className="mt-12 grid gap-3 md:grid-cols-5">
        {journey.map(({ step, title, copy, icon: Icon }, index) => <article key={step} className="relative flex flex-col rounded-xl border border-[#dbe4d7] bg-white p-5 shadow-[0_12px_32px_rgba(15,49,32,0.04)] sm:p-6">
          <div className="flex items-start justify-between"><span className="text-xs font-bold tracking-[0.18em] text-[#679278]">{step} / 05</span><Icon className="h-6 w-6 text-[#286a4f]" strokeWidth={1.6} aria-hidden="true" /></div>
          <h3 className="mt-12 text-xl font-semibold leading-tight tracking-[-0.035em] text-[#17382e]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#5a6e62]">{copy}</p>
          {index < journey.length - 1 ? <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 rounded-full bg-[#b6ecaa] p-1 text-[#194833] md:block" aria-hidden="true" /> : null}
        </article>)}
      </div>
    </div>
  </section>;
}

function BusinessSection() {
  return <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
    <div className="mx-auto grid max-w-[1320px] items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
      <div>
        <Intro eyebrow="For the business owner" title="A useful business record, beyond a listing." copy="Give buyers and partners a clear view of your business while keeping private evidence under your control. Use everyday tools to make your enterprise easier to operate and understand." />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">{businessTools.map(({ title, copy, icon: Icon }) => <div key={title} className="border-t border-[#d9e5da] pt-4"><Icon className="h-6 w-6 text-[#287653]" strokeWidth={1.6} aria-hidden="true" /><h3 className="mt-3 text-base font-semibold text-[#17382e]">{title}</h3><p className="mt-1.5 text-sm leading-6 text-[#5a6e62]">{copy}</p></div>)}</div>
        <Link href="/for-msmes" className="mt-9 inline-flex items-center gap-2 text-sm font-bold text-[#1c6847] underline decoration-[#b6ecaa] decoration-2 underline-offset-8 hover:text-[#0e3e2c]">Explore the business journey <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <div className="relative overflow-hidden rounded-[1.75rem] bg-[#e7eee6] p-5 sm:p-9 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-white/35" aria-hidden="true" />
        <div className="relative rounded-2xl border border-[#d6e4d7] bg-white p-5 shadow-[0_26px_70px_rgba(23,56,46,0.14)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2eae0] pb-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.19em] text-[#61836c]">Illustrative record</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#153a2c]">Business Passport</h3></div><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#edf5ea]"><BadgeCheck className="h-7 w-7 text-[#2c7556]" aria-hidden="true" /></div></div>
          <div className="mt-6 flex items-center gap-4 rounded-xl bg-[#f5f7f1] p-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#d8eadd] text-lg font-bold text-[#276b50]">B</div><div><p className="text-base font-semibold text-[#153a2c]">Your business</p><p className="text-xs text-[#64776a]">One identity · controlled sharing</p></div><span className="ml-auto hidden rounded-full border border-[#bcd8c6] px-3 py-1 text-xs font-semibold text-[#286b4e] sm:inline">Profile</span></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">{[
            { label: "Identity", sub: "Profile and credential status", icon: BadgeCheck },
            { label: "Operations", sub: "Invoices, receipts and documents", icon: FileText },
            { label: "Readiness", sub: "Evidence and development actions", icon: ClipboardCheck },
            { label: "Participation", sub: "Markets and programmes", icon: Handshake },
          ].map(({ label, sub, icon: Icon }) => <div key={label} className="rounded-lg border border-[#e2eae0] p-3.5"><Icon className="h-5 w-5 text-[#2c7556]" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-[#17382e]">{label}</p><p className="mt-1 text-xs leading-5 text-[#6c7c70]">{sub}</p></div>)}</div>
          <div className="mt-5 flex items-start gap-3 rounded-lg bg-[#113c2e] p-4 text-white"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#b6ecaa]" aria-hidden="true" /><p className="text-xs leading-5 text-white/85">Public verification shows approved facts. Private records remain subject to permissions and business sharing.</p></div>
        </div>
        <p className="relative mt-4 text-center text-xs text-[#557361]">Conceptual view using no customer data</p>
      </div>
    </div>
  </section>;
}

function InstitutionSection() {
  return <section className="bg-[#113d2e] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
    <div className="mx-auto grid max-w-[1320px] gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20">
      <div>
        <Intro eyebrow="For institutions and delivery networks" title="Run the work behind enterprise growth." copy="DBIN gives a finance company, association or programme a way to coordinate businesses, authorised teams, external agents, evidence and follow-up in an institution-specific workspace." light />
        <div className="mt-9 grid gap-3 sm:grid-cols-2">{institutionTools.map(({ title, copy, icon: Icon }) => <div key={title} className="rounded-xl border border-white/15 bg-white/[0.06] p-5"><Icon className="h-6 w-6 text-[#b6ecaa]" strokeWidth={1.6} aria-hidden="true" /><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{copy}</p></div>)}</div>
        <Link href="/partners" className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#b6ecaa] px-6 py-3 text-sm font-bold text-[#0b2b21] transition hover:bg-[#d6f7c9]">Explore institutional deployment <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Image src="/images/lcdbo/investment-partnership.jpg" alt="Enterprise partners reviewing business information together" fill sizes="(min-width:1024px) 46vw, 100vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#092a22]/75 via-transparent to-transparent" /></div>
        <div className="relative -mt-20 ml-5 max-w-md rounded-xl border border-[#cfdec8] bg-[#f7f7ee] p-5 text-[#17382e] shadow-2xl sm:ml-auto sm:mr-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#4c805a]">How an institution works</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold"><span className="rounded-lg bg-[#e3eee1] px-2 py-3">Assign a team</span><span className="rounded-lg bg-[#e3eee1] px-2 py-3">Support MSMEs</span><span className="rounded-lg bg-[#e3eee1] px-2 py-3">Review results</span></div>
          <p className="mt-4 text-sm leading-6 text-[#526b5c]">Institution rules and product requirements are configured for each deployment. Financing decisions remain with the institution.</p>
        </div>
      </div>
    </div>
  </section>;
}

function AudienceSection() {
  return <section className="bg-[#f6f5ed] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
    <div className="mx-auto max-w-[1320px]">
      <Intro eyebrow="A network with different entry points" title="Find the DBIN path for you." copy="Each participant has a different job to do. DBIN connects those journeys while keeping roles and access clear." />
      <div className="mt-11 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{audiences.map(({ title, copy, href, icon: Icon }) => <Link key={title} href={href} className="group flex min-h-[250px] flex-col rounded-xl border border-[#dce6d9] bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287653]"><Icon className="h-8 w-8 text-[#287653]" strokeWidth={1.5} aria-hidden="true" /><h3 className="mt-auto text-xl font-semibold tracking-[-0.035em] text-[#17382e]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#5e7064]">{copy}</p><ArrowDownRight className="mt-5 h-5 w-5 text-[#287653] transition group-hover:translate-x-1 group-hover:translate-y-1" aria-hidden="true" /></Link>)}</div>
    </div>
  </section>;
}

function ProgrammesAndTrust() {
  return <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
    <div className="mx-auto grid max-w-[1320px] gap-14 lg:grid-cols-2 lg:gap-24">
      <div>
        <Intro eyebrow="Built for real delivery" title="One foundation. Different programme models." copy="Programme workspaces can bring together enrolment, assessment, field delivery, geographic coordination and reporting. The operating model is shaped around each programme." />
        <div className="mt-9 divide-y divide-[#dbe6da] border-t border-[#dbe6da]">{[
          { title: "Enterprise development", copy: "Diagnostics, delivery actions, agent assignments and follow-up.", href: "/programmes" },
          { title: "Local content & clusters", copy: "Participation and readiness pathways across states, LGAs and industrial clusters.", href: "/lcdbo" },
          { title: "Impact intelligence", copy: "Evidence quality, KPIs, risks and executive programme snapshots.", href: "/platform/intelligence" },
        ].map(item => <Link key={item.title} href={item.href} className="group flex items-start justify-between gap-4 py-5"><div><h3 className="text-lg font-semibold text-[#17382e]">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#5d7065]">{item.copy}</p></div><ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#287653] transition group-hover:translate-x-1" aria-hidden="true" /></Link>)}</div>
        <p className="mt-4 text-xs leading-5 text-[#6a7e70]">Programme capabilities depend on the configured deployment and its governance arrangements.</p>
      </div>
      <div className="rounded-2xl bg-[#eaf2e9] p-7 sm:p-10">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#3d7855]">Trust by design</p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#17382e] sm:text-4xl">Share what is useful. Protect what is private.</h2>
        <p className="mt-4 text-base leading-7 text-[#526b5d]">A public verification result and a private business case serve different purposes. DBIN keeps those views and their permissions separate.</p>
        <div className="mt-8 grid gap-3">{[
          { icon: ShieldCheck, title: "Clear verification status", copy: "Show what has been reviewed without implying credit approval or a guarantee." },
          { icon: LockKeyhole, title: "Controlled access", copy: "Role permissions and business sharing govern access to private records." },
          { icon: FileCheck2, title: "Traceable work", copy: "Evidence, decisions and follow-up stay connected to the relevant business journey." },
        ].map(({ icon: Icon, title, copy }) => <div key={title} className="flex gap-4 rounded-lg border border-[#d4e3d3] bg-white/80 p-4"><Icon className="mt-0.5 h-6 w-6 shrink-0 text-[#287653]" aria-hidden="true" /><div><h3 className="text-sm font-semibold text-[#17382e]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#617365]">{copy}</p></div></div>)}</div>
      </div>
    </div>
  </section>;
}

function Marketplace() {
  return <section className="bg-[#e9eee5] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
    <div className="mx-auto grid max-w-[1320px] items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#3d7855]">A place to discover</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#17382e] sm:text-5xl">Find businesses ready to be found.</h2><p className="mt-5 max-w-lg text-base leading-7 text-[#526b5d]">Explore public business profiles by service and location. View the details each business has chosen to share, then start an enquiry.</p><Link href="/marketplace" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#1c6847] underline decoration-[#a4cfa9] decoration-2 underline-offset-8">Browse the marketplace <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
      <form action="/marketplace" method="get" role="search" aria-label="Search DBIN marketplace" className="rounded-xl border border-[#d2dfcf] bg-white p-5 shadow-[0_22px_60px_rgba(16,50,34,0.1)] sm:p-7">
        <p className="mb-5 text-lg font-semibold text-[#17382e]">Search the business marketplace</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-[#3b5948]">What do you need?<span className="mt-2 flex h-[52px] items-center gap-2 rounded-lg border border-[#cbd9cd] px-3"><Search className="h-5 w-5 text-[#528063]" aria-hidden="true" /><input name="q" placeholder="Product or service" className="w-full bg-transparent text-sm font-medium text-[#17382e] outline-none placeholder:text-[#82938a]" /></span></label>
          <label className="block text-sm font-semibold text-[#3b5948]">Where?<span className="mt-2 flex h-[52px] items-center gap-2 rounded-lg border border-[#cbd9cd] px-3"><MapPin className="h-5 w-5 text-[#528063]" aria-hidden="true" /><input name="location" placeholder="State or city" className="w-full bg-transparent text-sm font-medium text-[#17382e] outline-none placeholder:text-[#82938a]" /></span></label>
        </div>
        <input type="hidden" name="verification" value="verified_or_approved" />
        <button type="submit" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#164d36] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0d3728] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c7556]">Search businesses <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </form>
    </div>
  </section>;
}

function FinalCTA() {
  return <section className="relative overflow-hidden bg-[#082820] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-24">
    <div className="pointer-events-none absolute -right-20 -top-36 h-[34rem] w-[34rem] rounded-full border-[6rem] border-[#b6ecaa]/10" aria-hidden="true" />
    <div className="relative mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-9 lg:flex-row lg:items-end"><div className="max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#b6ecaa]">Your next step</p><h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.05em] sm:text-5xl">Put a trusted business record to work.</h2><p className="mt-5 text-lg leading-8 text-white/70">Start with your business, verify a public record or explore a DBIN workspace for your organisation.</p></div><div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end"><Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#b6ecaa] px-5 py-3 text-sm font-bold text-[#0b2b21]">Register a business</Link><Link href="/verify" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/35 px-5 py-3 text-sm font-bold">Verify a business</Link><Link href="/partners" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/35 px-5 py-3 text-sm font-bold">Partner with DBIN</Link></div></div>
  </section>;
}

function Footer() {
  const groups = [
    { title: "Platform", links: [{ text: "Overview", href: "/platform" }, { text: "Business identity", href: "/platform/business-identity" }, { text: "Business tools", href: "/platform/business-tools" }, { text: "Verification", href: "/verify" }] },
    { title: "Solutions", links: [{ text: "Businesses", href: "/for-msmes" }, { text: "Associations", href: "/for-associations" }, { text: "Financial institutions", href: "/for-financial-institutions" }, { text: "Government", href: "/for-government" }] },
    { title: "Explore", links: [{ text: "Marketplace", href: "/marketplace" }, { text: "Programmes", href: "/programmes" }, { text: "Resources", href: "/resources" }, { text: "Contact", href: "/contact" }] },
  ];
  return <footer className="bg-[#061d18] px-5 py-14 text-white sm:px-8 lg:px-12">
    <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
      <div><DbinBrandLogo compactOnMobile={false} iconClassName="h-12 w-12 rounded-full" textClassName="max-w-[11rem] whitespace-normal text-sm font-black leading-tight text-white" /><p className="mt-5 max-w-xs text-sm leading-6 text-white/60">Trusted identity, useful records and connected opportunities for Nigerian enterprise.</p></div>
      {groups.map(group => <nav key={group.title} aria-label={group.title + " links"}><h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#b6ecaa]">{group.title}</h2><div className="mt-4 grid gap-3">{group.links.map(link => <Link key={link.href} href={link.href} className="text-sm text-white/65 transition hover:text-white">{link.text}</Link>)}</div></nav>)}
    </div>
    <div className="mx-auto mt-14 flex max-w-[1320px] flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6 text-xs text-white/50"><span>© {new Date().getFullYear()} Digital Business Identity Network</span><div className="flex gap-5"><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/cookies" className="hover:text-white">Cookies</Link></div></div>
  </footer>;
}

export function DbinHomepage() {
  return <><Header /><main id="main-content"><Hero /><Journey /><BusinessSection /><InstitutionSection /><AudienceSection /><ProgrammesAndTrust /><Marketplace /><FinalCTA /></main><Footer /></>;
}
