import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Check,
  Factory,
  Globe2,
  Landmark,
  MapPinned,
  Network,
  PackageCheck,
  ShieldCheck,
  Ship,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF } from "@/lib/lcdbo/content";

const challenges = [
  "Import dependence",
  "Fragmented industrial clusters",
  "Low MSME productivity",
  "Limited access to investment",
  "Weak export readiness",
  "Disconnected support programmes",
] as const;

const responses = [
  "Trusted business identity",
  "Cluster-led production",
  "MSME enablement",
  "Investment readiness",
  "Market access",
  "Export growth",
] as const;

const traditionalInterventions = ["Isolated training", "Fragmented grants", "Limited follow-up", "Weak market connection"] as const;
const lcdboFramework = ["Organises production", "Builds cluster ecosystems", "Connects investment", "Tracks readiness", "Enables markets and exports", "Measures outcomes"] as const;

const modelJourney: Array<{ title: string; detail: string; icon: LucideIcon; trust?: boolean }> = [
  { title: "DBIN trust layer", detail: "Secure programme infrastructure", icon: ShieldCheck, trust: true },
  { title: "Business identity", detail: "Verification and consent", icon: BadgeCheck },
  { title: "Cluster placement", detail: "Value-chain participation", icon: MapPinned },
  { title: "Business enablement", detail: "Capability and support", icon: Wrench },
  { title: "Investment readiness", detail: "Visible, credible pipelines", icon: Banknote },
  { title: "Market access", detail: "Buyers and procurement", icon: Globe2 },
  { title: "Export growth", detail: "Regional and global trade", icon: Ship },
  { title: "Industrial transformation", detail: "Jobs and competitiveness", icon: Factory },
];

const participants: Array<{ title: string; value: string; icon: LucideIcon }> = [
  { title: "MSMEs", value: "Production support, cluster participation and market pathways.", icon: BriefcaseBusiness },
  { title: "State Governments", value: "A framework for local industry, jobs and investment pipelines.", icon: Landmark },
  { title: "Federal Agencies", value: "Coordinated policy delivery and measurable programme visibility.", icon: Building2 },
  { title: "Investors", value: "Organised opportunities and clearer industrial pipeline intelligence.", icon: TrendingUp },
  { title: "Development Finance Institutions", value: "Traceable interventions and increasingly bankable enterprises.", icon: Banknote },
  { title: "Industrial Associations", value: "Structured member mobilisation and value-chain coordination.", icon: Network },
  { title: "Technical Partners", value: "Defined pathways for standards, skills and production capability.", icon: Wrench },
  { title: "Buyers and Off-takers", value: "Discoverable local supply and stronger supplier development.", icon: PackageCheck },
];

const outcomes: Array<{ title: string; detail: string; icon: LucideIcon }> = [
  { title: "Job Creation", detail: "Designed to support productive employment through stronger local industries.", icon: Users },
  { title: "Industrial Growth", detail: "Creates the structure for coordinated production and shared infrastructure.", icon: Factory },
  { title: "Import Substitution", detail: "Intended to enable stronger domestic supply and local value addition.", icon: Boxes },
  { title: "Export Expansion", detail: "Builds pathways toward standards, aggregation and international markets.", icon: Ship },
  { title: "MSME Scale", detail: "Designed to support enterprises as they grow capability and output.", icon: BriefcaseBusiness },
  { title: "Investment Attraction", detail: "Creates clearer pipelines for catalytic and commercial capital.", icon: Banknote },
  { title: "Regional Competitiveness", detail: "Intended to strengthen Nigerian value chains across African markets.", icon: Globe2 },
  { title: "Measurable Outcomes", detail: "Enables readiness, participation and programme performance tracking.", icon: BarChart3 },
];

export default function LcdboAboutPage() {
  return (
    <LcdboShell landing>
      <BlueprintHero />
      <WhyLcdboSection />
      <WhatLcdboIsSection />
      <ModelJourneySection />
      <DbinPositioningSection />
      <OneClusterSection />
      <ParticipantsSection />
      <OutcomesSection />
      <FinalCta />
    </LcdboShell>
  );
}

function BlueprintHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#06172f] px-4 py-16 text-white sm:px-6 lg:py-24">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="absolute -right-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#008751]/25 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/35 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#efc85d]"><Landmark className="h-4 w-4" />About LCDBO</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5rem]">A National Framework for <span className="text-[#efc85d]">Local Content Beyond Oil.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">LCDBO connects industrial policy, local enterprise, cluster development, investment readiness and market access into one coordinated pathway for Nigeria&apos;s productive economy.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/lcdbo/model" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Explore the model <ArrowRight className="h-4 w-4" /></Link><Link href="/lcdbo/clusters" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">View Industrial Clusters</Link></div>
        </div>
        <BlueprintVisual />
      </div>
    </section>
  );
}

function BlueprintVisual() {
  const layers = [
    { title: "Industrial policy", icon: Landmark },
    { title: "Local enterprise", icon: BriefcaseBusiness },
    { title: "Cluster ecosystems", icon: Factory },
    { title: "Capital & markets", icon: Banknote },
  ];
  return <div className="relative rounded-[30px] border border-white/15 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7"><div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">National blueprint</p><p className="mt-2 text-2xl font-black">Policy to production</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D4A017] text-[#06172f]"><Network className="h-6 w-6" /></span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{layers.map((layer, index) => { const Icon = layer.icon; return <article key={layer.title} className="group min-h-32 rounded-2xl border border-white/10 bg-[#091f3c] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/30"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-emerald-400" /><span className="text-[9px] font-black text-[#efc85d]">0{index + 1}</span></div><p className="mt-8 text-sm font-black">{layer.title}</p></article>; })}</div><div className="mt-3 rounded-2xl bg-[#008751] p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">National outcome</p><p className="mt-2 text-2xl font-black">Competitive productive economy</p></div></div>;
}

function WhyLcdboSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="The national imperative" title="Why LCDBO Exists" description="Nigeria's productive economy needs a coordinated bridge between enterprise potential, industrial infrastructure, capital and markets." /><div className="mt-9 grid overflow-hidden rounded-[28px] border border-slate-200 shadow-xl shadow-slate-200/60 lg:grid-cols-2"><ComparisonList label="The industrial challenge" items={challenges} tone="challenge" /><ComparisonList label="The LCDBO response" items={responses} tone="response" /></div></div></section>
  );
}

function ComparisonList({ label, items, tone }: { label: string; items: readonly string[]; tone: "challenge" | "response" }) {
  const response = tone === "response";
  return <article className={`p-6 sm:p-8 ${response ? "relative overflow-hidden bg-[#071d38] text-white" : "bg-[#f3f5f7]"}`}>{response ? <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#008751]/25 blur-3xl" /> : null}<p className={`relative text-[10px] font-black uppercase tracking-[0.18em] ${response ? "text-emerald-300" : "text-slate-500"}`}>{label}</p><div className="relative mt-6 grid gap-3 sm:grid-cols-2">{items.map((item, index) => <div key={item} className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3.5 transition hover:-translate-y-0.5 ${response ? "border-white/10 bg-white/[0.055] hover:border-emerald-300/30 hover:bg-white/[0.09]" : "border-slate-200 bg-white hover:border-amber-200 hover:shadow-sm"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${response ? "bg-[#008751] text-white" : "bg-amber-50 text-xs font-black text-[#a66f00]"}`}>{response ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}</span><p className={`text-sm font-bold ${response ? "text-white" : "text-slate-700"}`}>{item}</p></div>)}</div></article>;
}

function WhatLcdboIsSection() {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="The operating framework" title="What LCDBO Is" description="LCDBO is a national industrial development framework: a programme layer for cluster-led growth, a coordination model for public and private actors, and a pathway from local production to national competitiveness." /><div className="mt-9 grid gap-5 lg:grid-cols-2"><article className="rounded-[26px] border border-slate-200 bg-white p-6 sm:p-8"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Traditional MSME interventions</p><h3 className="mt-3 text-2xl font-black text-slate-500">Useful—but often disconnected.</h3><div className="mt-6 grid gap-3 sm:grid-cols-2">{traditionalInterventions.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">{item}</div>)}</div><p className="mt-6 border-t border-slate-200 pt-5 text-sm font-semibold leading-6 text-slate-500">LCDBO is not simply a website, grant scheme, training programme or directory.</p></article><article className="relative overflow-hidden rounded-[26px] bg-[#0B2E59] p-6 text-white shadow-xl sm:p-8"><div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#008751]/30 blur-3xl" /><p className="relative text-[10px] font-black uppercase tracking-[0.18em] text-[#efc85d]">The LCDBO framework</p><h3 className="relative mt-3 text-2xl font-black">An operating framework for industrialisation beyond oil.</h3><div className="relative mt-6 grid gap-3 sm:grid-cols-2">{lcdboFramework.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"><Check className="h-4 w-4 shrink-0 text-emerald-300" /><p className="text-sm font-bold">{item}</p></div>)}</div></article></div></div></section>
  );
}

function ModelJourneySection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="The operating journey" title="How the LCDBO Model Works" description="A trusted pathway moves businesses from verified participation into clusters, capability development, investment readiness and markets." /><div className="mt-9 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{modelJourney.map((step, index) => { const Icon = step.icon; return <div key={step.title} className="relative"><article className={`h-full min-h-44 rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${step.trust ? "border-[#008751]/30 bg-emerald-50" : index === modelJourney.length - 1 ? "border-[#D4A017]/40 bg-[#06172f] text-white" : "border-slate-200 bg-[#f8fafc]"}`}><span className={`grid h-11 w-11 place-items-center rounded-xl ${step.trust ? "bg-[#008751] text-white" : index === modelJourney.length - 1 ? "bg-[#D4A017] text-[#06172f]" : "bg-[#0B2E59] text-white"}`}><Icon className="h-5 w-5" /></span><p className={`mt-5 text-sm font-black leading-5 ${index === modelJourney.length - 1 ? "text-white" : "text-[#06172f]"}`}>{step.title}</p><p className={`mt-2 text-[11px] leading-4 ${index === modelJourney.length - 1 ? "text-slate-300" : "text-slate-500"}`}>{step.detail}</p></article>{index < modelJourney.length - 1 ? <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#D4A017] xl:absolute xl:-right-3 xl:top-1/2 xl:z-10 xl:m-0 xl:-translate-y-1/2 xl:-rotate-90" /> : null}</div>; })}</div></div></section>
  );
}

function DbinPositioningSection() {
  return (
    <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Powered by trusted business identity</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Programme ambition, built on trusted infrastructure.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">LCDBO uses the Digital Business Identity Network as the trust infrastructure for business verification, participation tracking, consent, programme operations and cluster intelligence.</p></div><div className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 sm:p-7"><div className="rounded-2xl border border-[#efc85d]/25 bg-[#D4A017] p-5 text-[#06172f]"><p className="text-[10px] font-black uppercase tracking-[0.16em]">Programme layer</p><div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#06172f] text-white"><Factory className="h-5 w-5" /></span><p className="text-2xl font-black">LCDBO</p></div><p className="mt-3 text-sm font-bold">Clusters · Enablement · Investment · Markets</p></div><ArrowDown className="mx-auto my-3 h-5 w-5 text-emerald-300" /><div className="rounded-2xl border border-white/10 bg-white p-5 text-[#06172f]"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#008751]">Trust infrastructure layer</p><div className="mt-3 inline-flex"><DbinBrandLogo /></div><p className="mt-3 text-sm font-bold text-slate-600">Identity · Verification · Consent · Intelligence</p></div></div></div></section>
  );
}

function OneClusterSection() {
  const flow = [
    { value: "774", label: "LGAs", icon: MapPinned },
    { value: "774", label: "Industrial Clusters", icon: Factory },
    { value: "5,000", label: "MSMEs per Cluster", icon: Users },
    { value: "One", label: "Production Network", icon: Network },
    { value: "Growth", label: "Jobs, Exports & Industry", icon: TrendingUp },
  ];
  return (
    <section className="relative overflow-hidden bg-[#0B2E59] px-4 py-16 text-white sm:px-6 lg:py-24"><div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:30px_30px]" /><div className="relative mx-auto max-w-7xl"><SectionHeading dark eyebrow="The national vision" title="One Cluster. Every Local Government." description="Each Local Government Area can be organised around its strongest economic advantage—cocoa, leather, rubber, seafood, rice, textiles, agro-processing, technology or creative industries." /><div className="mt-10 grid gap-3 lg:grid-cols-5">{flow.map((item, index) => { const Icon = item.icon; return <div key={item.label} className="relative"><article className="group flex min-h-44 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.055] p-5 transition hover:-translate-y-1 hover:border-[#efc85d]/40 hover:bg-white/[0.08]"><Icon className="h-6 w-6 text-emerald-400" /><div><p className="text-3xl font-black tracking-tight">{item.value}</p><p className="mt-2 text-xs font-bold leading-5 text-slate-300">{item.label}</p></div></article>{index < flow.length - 1 ? <ArrowDown className="mx-auto my-2 h-5 w-5 text-[#efc85d] lg:absolute lg:-right-5 lg:top-1/2 lg:z-10 lg:m-0 lg:-translate-y-1/2 lg:-rotate-90" /> : null}</div>; })}</div></div></section>
  );
}

function ParticipantsSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="The participation ecosystem" title="Who Participates" description="LCDBO gives each stakeholder a clear role in building stronger production systems, investable enterprises and competitive value chains." /><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{participants.map((participant) => { const Icon = participant.icon; return <article key={participant.title} className="group rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:bg-white hover:shadow-xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-[#008751] transition group-hover:bg-[#008751] group-hover:text-white"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-black text-[#06172f]">{participant.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{participant.value}</p></article>; })}</div></div></section>
  );
}

function OutcomesSection() {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="The intended impact" title="What LCDBO Is Designed to Deliver" description="The framework creates the conditions for stronger enterprises, more productive value chains and measurable industrial progress without treating outcomes as guaranteed." /><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{outcomes.map((outcome) => { const Icon = outcome.icon; return <article key={outcome.title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#D4A017]/50 hover:shadow-xl"><Icon className="h-6 w-6 text-[#008751]" /><h3 className="mt-6 text-lg font-black text-[#06172f]">{outcome.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{outcome.detail}</p></article>; })}</div></div></section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-24"><div className="absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-[#008751]/25 blur-3xl" /><div className="relative mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">A coordinated national pathway</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Join Nigeria&apos;s Industrial Transformation Journey.</h2><p className="mt-5 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">Businesses, states, investors and partners can participate in a coordinated framework for production, investment and market access.</p></div><div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Register Your Business <ArrowRight className="h-4 w-4" /></Link><Link href={LCDBO_PARTNER_HREF} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">Partner With LCDBO</Link></div></div></section>
  );
}

function SectionHeading({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) {
  return <div className="max-w-3xl"><p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-[#efc85d]" : "text-[#008751]"}`}>{eyebrow}</p><h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#06172f]"}`}>{title}</h2><p className={`mt-4 text-base leading-7 sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{description}</p></div>;
}
