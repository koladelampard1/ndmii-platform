import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BadgeCheck, Banknote, Boxes, BriefcaseBusiness, Building2, Check, Factory, Globe2, Handshake, Landmark, Leaf, MapPinned, Network, Ship, Sparkles, TrendingUp, Users, Wrench } from "lucide-react";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF } from "@/lib/lcdbo/content";

const impactTargets: Array<{ value: string; label: string; note: string; icon: LucideIcon }> = [
  { value: "774", label: "LGAs targeted", note: "Programme target", icon: MapPinned },
  { value: "36 + FCT", label: "States covered", note: "National ambition", icon: Landmark },
  { value: "5,000+", label: "MSMEs per LGA", note: "Enablement target", icon: Users },
  { value: "$100B", label: "Investment mobilisation", note: "Long-term target", icon: TrendingUp },
  { value: "$1T", label: "Industrial economy pathway", note: "Growth ambition", icon: Factory },
];

const deliveryCards: Array<{ title: string; description: string; image: string; alt: string; icon: LucideIcon }> = [
  { title: "Industrial Clusters", description: "Shared infrastructure that turns local capability into scaled production.", image: "/images/lcdbo/industrial-cluster-warehouse.jpg", alt: "Workers moving goods through a modern industrial warehouse", icon: Factory },
  { title: "MSME Enablement", description: "Identity, readiness and practical support for businesses built to grow.", image: "/images/lcdbo/woman-entrepreneur.jpg", alt: "Woman entrepreneur working at her business", icon: BriefcaseBusiness },
  { title: "Investment Flows", description: "Organised opportunities for patient capital, DFIs and strategic investors.", image: "/images/lcdbo/investment-partnership.jpg", alt: "Business partners confirming an investment relationship", icon: Banknote },
  { title: "Exports & Markets", description: "Stronger value chains connected to buyers across Africa and the world.", image: "/images/lcdbo/export-containers.jpg", alt: "Aerial view of a busy container port and export logistics hub", icon: Ship },
];

const stakeholders: Array<{ title: string; benefit: string; icon: LucideIcon }> = [
  { title: "MSMEs", benefit: "Move from verified identity to production, support and markets.", icon: BriefcaseBusiness },
  { title: "Investors", benefit: "Discover organised clusters and investment-ready enterprises.", icon: TrendingUp },
  { title: "States", benefit: "Translate local advantage into jobs and industrial capacity.", icon: Landmark },
  { title: "Partners", benefit: "Coordinate delivery through one national programme framework.", icon: Handshake },
  { title: "Technical Partners", benefit: "Deploy standards, engineering and specialist capability.", icon: Wrench },
  { title: "Development Institutions", benefit: "Back traceable interventions with measurable outcomes.", icon: Building2 },
];

const journey = [
  { title: "Identity & Verification", icon: BadgeCheck },
  { title: "Cluster Placement", icon: MapPinned },
  { title: "Business Enablement", icon: Wrench },
  { title: "Investment & Support", icon: Banknote },
  { title: "Market Access & Exports", icon: Globe2 },
  { title: "Sustainable Growth", icon: Leaf },
] as const;

export function LcdboLanding({ strategicPartnerCount }: { strategicPartnerCount: number }) {
  return <>
    <LandingHero />
    <ImpactStrip strategicPartnerCount={strategicPartnerCount} />
    <DeliverySection />
    <StakeholderSection />
    <ImpactStory />
    <JourneySection />
    <SicipSection />
    <FinalCta />
  </>;
}

function LandingHero() {
  return <section className="relative isolate min-h-[720px] overflow-hidden bg-[#06172f] text-white sm:min-h-[760px]">
    <Image src="/images/lcdbo/industrial-worker-hero.jpg" alt="African industrial worker at a production facility" fill priority sizes="100vw" className="object-cover object-[58%_36%]" />
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,15,34,0.98)_0%,rgba(5,25,52,0.90)_42%,rgba(5,25,52,0.36)_72%,rgba(5,25,52,0.18)_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,15,34,0.78)_0%,transparent_42%)]" />
    <div className="relative mx-auto flex min-h-[720px] max-w-7xl items-center px-4 py-20 sm:min-h-[760px] sm:px-6 lg:py-28">
      <div className="max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/40 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#efc85d] backdrop-blur"><Sparkles className="h-3.5 w-3.5" />Nigeria&apos;s industrial transformation platform</div>
        <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.6rem]">Building Nigeria&apos;s Industrial Future Together.</h1>
        <p className="mt-7 max-w-2xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">The Local Content Development Beyond Oil initiative connects MSMEs, industrial clusters, investors and partners to drive production, jobs, exports and inclusive economic growth.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryLink href={LCDBO_REGISTER_HREF}>Register Your Business</PrimaryLink>
          <SecondaryLink href="/lcdbo/clusters">Explore Industrial Clusters</SecondaryLink>
          <SecondaryLink href={LCDBO_PARTNER_HREF}>Partner With LCDBO</SecondaryLink>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-300"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />National reach</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />Cluster-led growth</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />Export ambition</span></div>
      </div>
    </div>
    <Link href="https://commons.wikimedia.org/wiki/File:Worker_in_Magadi_Salt_Factory.jpg" target="_blank" rel="noreferrer" className="absolute bottom-3 right-4 text-[9px] font-medium text-white/55 transition hover:text-white">Photo: Ninara / CC BY 2.0</Link>
  </section>;
}

function ImpactStrip({ strategicPartnerCount }: { strategicPartnerCount: number }) {
  const metrics = [...impactTargets, { value: `${strategicPartnerCount}+`, label: "Strategic partners", note: "Growing ecosystem", icon: Network }];
  return <section className="relative z-10 bg-[#06172f] px-4 pb-10 sm:px-6"><div className="mx-auto -mt-10 grid max-w-7xl gap-2 rounded-3xl border border-white/10 bg-[#091f3c]/95 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{metrics.map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="min-h-36 rounded-2xl border border-white/8 bg-white/[0.045] p-4 text-white"><Icon className="h-5 w-5 text-[#efc85d]" /><p className="mt-5 text-3xl font-black tracking-tight">{metric.value}</p><h2 className="mt-1 text-sm font-bold text-white">{metric.label}</h2><p className="mt-2 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-300">{metric.note}</p></article>; })}</div></section>;
}

function DeliverySection() {
  return <Section eyebrow="What LCDBO delivers" title="An ecosystem built for industrial scale." description="From factory floor to global market, LCDBO brings the actors and infrastructure of growth into one coherent pathway.">
    <div className="grid gap-5 md:grid-cols-2">{deliveryCards.map((card) => { const Icon = card.icon; return <article key={card.title} className="group relative min-h-[420px] overflow-hidden rounded-[28px] bg-[#06172f] shadow-lg shadow-slate-200"><Image src={card.image} alt={card.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#041226] via-[#041226]/35 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#008751] text-white shadow-lg"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-3xl font-black tracking-tight text-white">{card.title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-slate-200 sm:text-base">{card.description}</p></div></article>; })}</div>
  </Section>;
}

function StakeholderSection() {
  return <section className="relative overflow-hidden bg-[#07172e] px-4 py-20 text-white sm:px-6 lg:py-28"><div className="absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#008751]/20 blur-3xl" /><div className="relative mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Stakeholder value</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">One ambition. Distinct value for every partner.</h2></div><div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">{stakeholders.map((item) => { const Icon = item.icon; return <article key={item.title} className="bg-[#091f3c] p-6 sm:p-8"><Icon className="h-6 w-6 text-emerald-400" /><h3 className="mt-6 text-xl font-black">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{item.benefit}</p></article>; })}</div></div></section>;
}

function ImpactStory() {
  const outcomes = ["Jobs for Nigerians", "Industries for Tomorrow", "Exports for the World", "Prosperity for All"];
  return <Section eyebrow="National impact" title="Real People. Real Progress." description="Across Nigeria, businesses are growing, clusters are forming, jobs are being created and communities are transforming.">
    <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center"><div><div className="space-y-3">{outcomes.map((item, index) => <div key={item} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-sm font-black text-[#008751]">0{index + 1}</span><p className="font-black text-[#06172f]">{item}</p></div>)}</div><Link href="/lcdbo/about" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#007a49]">Discover the LCDBO vision <ArrowRight className="h-4 w-4" /></Link></div><div className="grid min-h-[560px] grid-cols-2 grid-rows-2 gap-3"><StoryImage src="/images/lcdbo/women-briquette-production.jpg" alt="Women workers producing biomass briquettes in Namibia" className="row-span-2" credit="GIZ / CC BY-SA 4.0" creditHref="https://commons.wikimedia.org/wiki/File:Bushblok_briquette_production_Namibia.jpg" /><StoryImage src="/images/lcdbo/agro-processing.jpg" alt="Agricultural machinery supporting agro-processing value chains" /><StoryImage src="/images/lcdbo/brick-factory-workers.jpg" alt="Workers carrying newly produced bricks at a factory in Somalia" /></div></div>
  </Section>;
}

function JourneySection() {
  return <section className="border-y border-slate-200 bg-white px-4 py-20 sm:px-6 lg:py-24"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">The LCDBO journey</p><h2 className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">From trusted identity to sustainable growth.</h2></div><div className="relative mt-12 grid gap-4 md:grid-cols-3 xl:grid-cols-6"><div className="absolute left-[8%] right-[8%] top-8 hidden h-px bg-slate-200 xl:block" />{journey.map((item, index) => { const Icon = item.icon; return <article key={item.title} className="relative rounded-2xl border border-slate-200 bg-[#f8fafc] p-5"><span className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl bg-[#0B2E59] text-white shadow-lg shadow-blue-950/15"><Icon className="h-6 w-6" /></span><p className="mt-6 text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">Step {String(index + 1).padStart(2, "0")}</p><h3 className="mt-2 text-base font-black leading-5 text-[#06172f]">{item.title}</h3></article>; })}</div></div></section>;
}

function SicipSection() {
  return <section className="bg-[#eef3f7] px-4 py-20 sm:px-6 lg:py-24"><div className="relative mx-auto min-h-[520px] max-w-7xl overflow-hidden rounded-[32px] bg-[#06172f] text-white shadow-2xl"><Image src="/images/lcdbo/industrial-landscape-cta.jpg" alt="Large industrial logistics facility prepared for investment and production" fill sizes="100vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#041226]/98 via-[#041226]/88 to-[#041226]/20" /><div className="relative flex min-h-[520px] max-w-3xl flex-col justify-center p-7 sm:p-12 lg:p-16"><span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#efc85d]/30 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.17em] text-[#efc85d]"><Sparkles className="h-4 w-4" />Coming soon</span><h2 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">Special Industrial Clusters Investment Programme</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">SICIP will provide the investment mobilisation layer for industrial cluster development, strategic investors, project pipelines and funding partnerships.</p><div className="mt-8 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-bold"><Boxes className="h-4 w-4 text-emerald-400" />Project pipelines</span><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-bold"><Handshake className="h-4 w-4 text-emerald-400" />Strategic capital</span><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-bold"><Factory className="h-4 w-4 text-emerald-400" />Cluster infrastructure</span></div></div></div></section>;
}

function FinalCta() {
  return <section className="relative isolate overflow-hidden bg-[#06172f] px-4 py-24 text-white sm:px-6 lg:py-32"><Image src="/images/lcdbo/export-containers.jpg" alt="International container port representing Nigeria's export ambition" fill sizes="100vw" className="object-cover" /><div className="absolute inset-0 bg-[#041226]/80" /><div className="absolute inset-0 bg-gradient-to-r from-[#041226]/95 via-[#041226]/75 to-transparent" /><div className="relative mx-auto max-w-7xl"><div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#efc85d]">The future is built together</p><h2 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">Be part of Nigeria&apos;s industrial transformation.</h2><p className="mt-5 text-2xl font-bold text-slate-200">Connect. Grow. Transform.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><PrimaryLink href={LCDBO_REGISTER_HREF}>Register Your Business</PrimaryLink><SecondaryLink href={LCDBO_PARTNER_HREF}>Partner With LCDBO</SecondaryLink></div></div></div></section>;
}

function Section({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="bg-[#f7f9fc] px-4 py-20 sm:px-6 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-10 max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">{eyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">{title}</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p></div>{children}</div></section>;
}

function StoryImage({ src, alt, className = "", credit, creditHref }: { src: string; alt: string; className?: string; credit?: string; creditHref?: string }) {
  return <figure className={`group relative min-h-64 overflow-hidden rounded-[26px] bg-slate-200 ${className}`}><Image src={src} alt={alt} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-700 group-hover:scale-105" />{credit && creditHref ? <Link href={creditHref} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[8px] font-semibold text-white/80 backdrop-blur">{credit}</Link> : null}</figure>;
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#efc85d]">{children}<ArrowRight className="h-4 w-4" /></Link>; }
function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white backdrop-blur transition hover:bg-white/12">{children}</Link>; }
