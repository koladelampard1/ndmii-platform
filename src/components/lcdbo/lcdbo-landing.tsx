import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BadgeCheck, Banknote, BriefcaseBusiness, Check, DatabaseZap, Factory, FileText, Globe2, Handshake, Landmark, Leaf, MapPinned, Network, Ship, Sparkles, TrendingUp, Users, Wrench } from "lucide-react";
import { LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF, lcdboPublicHref } from "@/lib/lcdbo/content";
import {
  lcdboMeasureDisclosure,
  safeProgrammeStatuses,
  safePublicMeasures,
  safePublicResources,
  type LcdboMeasureClassification,
} from "@/lib/lcdbo/public-governance";
import { lcdboAuthoritativeMeasures, lcdboImplementationPhases } from "@/lib/lcdbo/programme-model";

const stakeholders: Array<{ title: string; benefit: string; icon: LucideIcon }> = [
  { title: "MSMEs", benefit: "Grow production capacity and access new markets.", icon: BriefcaseBusiness },
  { title: "Industrial Clusters", benefit: "Coordinate producers, facilities and shared production infrastructure.", icon: Factory },
  { title: "Government Institutions", benefit: "Align industrial development with local raw-material and value-chain priorities.", icon: Landmark },
  { title: "Investors and DFIs", benefit: "Access visible, investment-ready industrial pipelines.", icon: TrendingUp },
  { title: "Research Institutions", benefit: "Connect industrial research capability to value addition and commercialisation.", icon: FileText },
  { title: "Technical Partners", benefit: "Strengthen standards, engineering and production capability.", icon: Wrench },
  { title: "Offtakers and Markets", benefit: "Connect verified production ecosystems to procurement and export demand.", icon: Globe2 },
];

const policyOutcomes: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Job Creation", icon: Users },
  { label: "Import Substitution", icon: Factory },
  { label: "Industrial Growth", icon: TrendingUp },
  { label: "Export Expansion", icon: Ship },
  { label: "MSME Scale", icon: BriefcaseBusiness },
  { label: "Investment Attraction", icon: Banknote },
];

const institutionalRoles: Array<{ name: string; role: string; detail: string; icon: LucideIcon; priority: "lead" | "delivery" | "infrastructure" }> = [
  {
    name: "RMRDC",
    role: "Institutional Lead and Public-Sector Anchor",
    detail: "Provides institutional leadership, raw-materials alignment and public-sector direction.",
    icon: Landmark,
    priority: "lead",
  },
  {
    name: "Roseate Forte Nigeria Limited",
    role: "Programme Architecture and Implementation",
    detail: "Designs the programme architecture, coordinates delivery and structures implementation pathways.",
    icon: Handshake,
    priority: "delivery",
  },
  {
    name: "DBIN",
    role: "Digital Infrastructure",
    detail: "Enables identity, onboarding, workflows, data confidence, evidence and reporting infrastructure.",
    icon: DatabaseZap,
    priority: "infrastructure",
  },
];

const deliveryProgression: Array<{ title: string; detail: string; icon: LucideIcon }> = [
  { title: "Raw materials intelligence", detail: "Identify local resource strengths and value-addition opportunities.", icon: Leaf },
  { title: "MSME identification and formalisation", detail: "Bring productive businesses into a governed participation pathway.", icon: BadgeCheck },
  { title: "Industrial cluster development", detail: "Coordinate enterprises, facilities and local production systems.", icon: Factory },
  { title: "Production and quality improvement", detail: "Strengthen standards, technical capacity and readiness for scale.", icon: Wrench },
  { title: "Investment and market access", detail: "Create clearer pathways to capital, buyers, procurement and exports.", icon: Banknote },
  { title: "Economic diversification outcomes", detail: "Support jobs, exports, local value addition and productive capacity.", icon: TrendingUp },
];

export function LcdboLanding({ strategicPartnerCount }: { strategicPartnerCount: number }) {
  return <>
    <LandingHero />
    <InstitutionalLeadershipBand />
    <ImpactStrip strategicPartnerCount={strategicPartnerCount} />
    <AuthoritativeProgrammePathway />
    <WhyIndustrialTransformation />
    <ProgrammeDeliveryModel />
    <RmrdcLeadershipSection />
    <StakeholderSection />
    <ProgrammeStatusSection />
    <ProgrammeResourcesSection />
    <FinalCta />
  </>;
}

function LandingHero() {
  return <section className="relative isolate min-h-[660px] overflow-hidden bg-[#06172f] text-white sm:min-h-[700px]">
    <Image src="/images/lcdbo/nigerian-manufacturing-hero.jpg" alt="Nigerian woman operating production machinery in her manufacturing workshop" fill priority sizes="100vw" className="object-cover object-[45%_center] scale-[1.02] sm:object-[68%_center]" />
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,15,34,0.99)_0%,rgba(5,25,52,0.94)_42%,rgba(5,25,52,0.50)_72%,rgba(5,25,52,0.22)_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,15,34,0.82)_0%,transparent_46%)]" />
    <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:80px_80px]" />
    <div className="relative mx-auto flex min-h-[660px] max-w-7xl items-center px-4 py-16 sm:min-h-[700px] sm:px-6 lg:py-20">
      <div className="max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/40 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#efc85d] backdrop-blur"><Sparkles className="h-3.5 w-3.5" />An RMRDC-led national industrial transformation programme</div>
        <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.35rem]">Building Nigeria&apos;s Industrial Future, Beyond Oil.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">LCDBO connects Nigerian raw materials, MSMEs, industrial clusters, investors and markets to build productive capacity, create jobs and grow exports.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryLink href={LCDBO_REGISTER_HREF}>Register Your Business</PrimaryLink>
          <SecondaryLink href={lcdboPublicHref("/clusters")}>Explore Industrial Clusters</SecondaryLink>
          <SecondaryLink href={LCDBO_PARTNER_HREF}>Partner With LCDBO</SecondaryLink>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-300"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />RMRDC institutional anchor</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />Roseate Forte delivery architecture</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />DBIN digital infrastructure</span></div>
      </div>
    </div>
    <Link href="https://commons.wikimedia.org/wiki/File:Edge_banding_a_workpiece_on_the_edge_banding_machine.jpg" target="_blank" rel="noreferrer" className="absolute bottom-3 right-4 text-[9px] font-semibold text-white/55 transition hover:text-white">Akpeski / CC BY-SA 4.0</Link>
  </section>;
}

function InstitutionalLeadershipBand() {
  return <section className="bg-[#06172f] px-4 py-14 text-white sm:px-6 lg:py-16">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-4xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Institutional Leadership and Delivery</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Public-sector leadership, implementation capability and governed digital infrastructure.</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">LCDBO combines public-sector leadership, programme implementation capability and governed digital infrastructure to coordinate industrial development beyond oil. Enabled by governed digital infrastructure and accountable programme operations.</p>
      </div>
      <div className="mt-9 grid gap-4 lg:grid-cols-[1.18fr_0.91fr_0.91fr]">
        {institutionalRoles.map((item, index) => {
          const Icon = item.icon;
          const isLead = item.priority === "lead";
          return <article key={item.name} className={`relative overflow-hidden rounded-[28px] border p-6 shadow-2xl shadow-black/10 ${isLead ? "border-[#efc85d]/40 bg-white text-[#06172f] lg:min-h-80" : "border-white/10 bg-white/[0.055] text-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${isLead ? "bg-[#008751] text-white" : "bg-emerald-400/10 text-emerald-300"}`}><Icon className="h-6 w-6" /></span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${isLead ? "bg-[#D4A017]/20 text-[#6d4c06]" : "border border-white/10 text-[#efc85d]"}`}>0{index + 1}</span>
            </div>
            <h3 className={`mt-7 text-3xl font-black tracking-tight ${isLead ? "sm:text-5xl" : "sm:text-3xl"}`}>{item.name}</h3>
            <p className={`mt-3 text-sm font-black uppercase tracking-[0.13em] ${isLead ? "text-[#008751]" : "text-[#efc85d]"}`}>{item.role}</p>
            <p className={`mt-4 text-sm leading-7 ${isLead ? "text-slate-600" : "text-slate-300"}`}>{item.detail}</p>
          </article>;
        })}
      </div>
    </div>
  </section>;
}

function RmrdcLeadershipSection() {
  return <section className="overflow-hidden bg-white px-4 py-16 sm:px-6 lg:py-24">
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">RMRDC institutional anchor</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">Anchored by the Raw Materials Research and Development Council.</h2>
        <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">RMRDC provides the institutional anchor for LCDBO, aligning the programme with Nigeria&apos;s raw-materials development priorities, industrial research capability, value-chain development and national economic diversification objectives.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {["Raw-material value addition", "Industrial research capability", "Local production systems", "Cluster development priorities"].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 text-sm font-black text-[#06172f]"><Check className="mb-3 h-5 w-5 text-[#008751]" />{item}</div>)}
        </div>
      </div>
      <figure className="relative min-h-[520px] overflow-hidden rounded-[34px] bg-[#06172f] shadow-2xl shadow-slate-200">
        <Image src="/images/lcdbo/agro-processing.jpg" alt="Industrial processing equipment supporting Nigerian raw-material value addition" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#031226]/95 via-[#031226]/25 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#efc85d]">From raw materials to productive capacity</p>
          <p className="mt-3 max-w-xl text-2xl font-black">A programme architecture designed around research, value addition, production and market access.</p>
        </figcaption>
      </figure>
    </div>
  </section>;
}

function ProgrammeDeliveryModel() {
  return <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">Programme delivery model</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">Converting institutional leadership into implementation.</h2>
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">RMRDC sets institutional direction and sector alignment. Roseate Forte structures programme architecture and delivery coordination. DBIN provides identity, workflows, data and reporting infrastructure.</p>
      </div>
      <div className="relative mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="absolute left-[8%] right-[8%] top-8 hidden h-px bg-[#D4A017]/40 xl:block" />
        {deliveryProgression.map((item, index) => {
          const Icon = item.icon;
          return <article key={item.title} className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl">
            <span className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl bg-[#0B2E59] text-white shadow-lg transition duration-300 group-hover:bg-[#008751]"><Icon className="h-6 w-6" /></span>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">Stage {String(index + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 text-base font-black leading-5 text-[#06172f]">{item.title}</h3>
            <p className="mt-3 text-xs leading-5 text-slate-500">{item.detail}</p>
          </article>;
        })}
      </div>
    </div>
  </section>;
}

function ImpactStrip({ strategicPartnerCount }: { strategicPartnerCount: number }) {
  const metrics = [
    ...safePublicMeasures(),
    {
      key: "strategic-partner-ecosystem",
      value: `${strategicPartnerCount}+`,
      label: "strategic partner records in platform seed data",
      classification: "Governed estimate" as LcdboMeasureClassification,
      timeframe: "Current public data model",
      basis: "Public LCDBO partner data loader with minimum public-category display count.",
      note: "Displayed as ecosystem context, not a verified partner-announcement count.",
      publicDisplay: true,
    },
  ];
  const iconByKey: Record<string, LucideIcon> = {
    "national-design-scope": Landmark,
    "lga-reference": MapPinned,
    "msme-lga-ambition": Users,
    "investment-mobilisation": TrendingUp,
    "one-trillion-economy": Factory,
    "top-ten-economy-2035": Globe2,
    "jobs-2030": BriefcaseBusiness,
    "strategic-partner-ecosystem": Network,
  };

  return <section id="programme-measures" aria-labelledby="programme-measures-title" className="relative z-10 bg-[#06172f] px-4 pb-10 sm:px-6"><div className="mx-auto -mt-8 max-w-7xl rounded-3xl border border-white/10 bg-[#091f3c]/95 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{metrics.map((metric) => { const Icon = iconByKey[metric.key] ?? Network; return <article key={metric.key} className="group relative min-h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-white transition duration-300 hover:-translate-y-1 hover:border-[#efc85d]/45 hover:bg-white/[0.075] hover:shadow-xl"><span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#efc85d]/70 to-transparent opacity-0 transition group-hover:opacity-100" /><Icon className="h-5 w-5 text-[#efc85d] transition group-hover:scale-110" /><p className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{metric.value}</p><h2 id={metric.key === "national-design-scope" ? "programme-measures-title" : undefined} className="mt-1 text-sm font-bold leading-5 text-white">{metric.label}</h2><p className="mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">{metric.classification}</p><p className="mt-3 text-[11px] leading-5 text-slate-300">{metric.note}</p></article>; })}</div><p className="mt-4 rounded-2xl border border-[#efc85d]/20 bg-[#efc85d]/10 px-4 py-3 text-xs font-semibold leading-5 text-[#f7df9b]">{lcdboMeasureDisclosure}</p></div></section>;
}

function AuthoritativeProgrammePathway() {
  const featuredMeasures = lcdboAuthoritativeMeasures.filter((measure) =>
    ["lga-industrial-development", "investment-mobilisation-2030", "jobs-2030", "top-ten-economy-2035"].includes(measure.key),
  );

  return <section className="bg-[#f3f6f9] px-4 py-14 sm:px-6 lg:py-16">
    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">Authoritative programme pathway</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">From 774-LGA ambition to phased industrial delivery.</h2>
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">The LCDBO source model frames a national pathway across local raw-material intelligence, enterprise formalisation, industrial clusters, infrastructure, investment and market access.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <PrimaryLink href={lcdboPublicHref("/programme-and-milestones")}>View Programme and Milestones</PrimaryLink>
          <Link href={lcdboPublicHref("/opportunities")} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:border-[#008751]/30 hover:text-[#008751]">Investment Pathways</Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {featuredMeasures.map((measure) => (
          <article key={measure.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#D4A017]/40 hover:shadow-lg">
            <p className="text-3xl font-black tracking-tight text-[#06172f]">{measure.value}</p>
            <h3 className="mt-2 text-sm font-black leading-5 text-[#06172f]">{measure.label}</h3>
            <p className="mt-3 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#008751]">{measure.classification}</p>
          </article>
        ))}
      </div>
    </div>
    <div className="mx-auto mt-8 grid max-w-7xl gap-3 md:grid-cols-2 xl:grid-cols-4">
      {lcdboImplementationPhases.map((phase) => (
        <article key={phase.phase} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">{phase.phase} · {phase.timeframe}</p>
          <h3 className="mt-3 text-lg font-black text-[#06172f]">{phase.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{phase.focus.slice(0, 3).join(" · ")}</p>
        </article>
      ))}
    </div>
  </section>;
}

function WhyIndustrialTransformation() {
  const challenges = ["Import dependence", "Fragmented industrial clusters", "Limited MSME scale", "Limited access to investment", "Weak export readiness"];
  const responses = ["Digital identity", "Cluster development", "MSME enablement", "Investment mobilisation", "Market access", "Export growth"];

  return <section className="relative overflow-hidden bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A017]/50 to-transparent" /><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">The national imperative</p><h2 className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">Why Industrial Transformation Matters</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">A coordinated response that converts Nigerian enterprise potential into jobs, productive capacity and global competitiveness.</p></div><div className="mt-9 grid overflow-hidden rounded-[28px] border border-slate-200 shadow-xl shadow-slate-200/60 lg:grid-cols-2"><article className="bg-[#f3f5f7] p-6 sm:p-8"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">The industrial challenge</p><div className="mt-6 grid gap-3">{challenges.map((item, index) => <div key={item} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-amber-200 hover:shadow-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-50 text-xs font-black text-[#a66f00]">{String(index + 1).padStart(2, "0")}</span><p className="font-bold text-slate-700">{item}</p></div>)}</div></article><article className="relative overflow-hidden bg-[#071d38] p-6 text-white sm:p-8"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#008751]/25 blur-3xl" /><p className="relative text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">The LCDBO response</p><div className="relative mt-6 grid gap-3 sm:grid-cols-2">{responses.map((item) => <div key={item} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-white/[0.09]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#008751] text-white"><Check className="h-4 w-4" /></span><p className="font-bold text-white">{item}</p></div>)}</div><div className="relative mt-6 flex items-center gap-3 border-t border-white/10 pt-6 text-xs font-black uppercase tracking-[0.14em] text-[#efc85d]"><span>Local capability</span><ArrowRight className="h-4 w-4" /><span>National competitiveness</span></div></article></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{policyOutcomes.map((outcome) => { const Icon = outcome.icon; return <article key={outcome.label} className="group flex min-h-24 flex-col justify-between rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#008751]/30 hover:bg-white hover:shadow-md"><Icon className="h-5 w-5 text-[#008751] transition group-hover:scale-110" /><p className="mt-4 text-sm font-black leading-5 text-[#06172f]">{outcome.label}</p></article>; })}</div></div></section>;
}

function StakeholderSection() {
  return <section id="participation-pathways" className="relative overflow-hidden bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20"><div className="absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#008751]/20 blur-3xl" /><div className="relative mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Partnership and participation</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Practical pathways for every industrial stakeholder.</h2><p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">LCDBO is structured for producers, institutions, capital providers, technical partners and market-access actors to participate through existing working pathways.</p></div><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{stakeholders.map((item, index) => { const Icon = item.icon; const spanClass = index === stakeholders.length - 1 ? "lg:col-span-6 xl:col-span-2 xl:col-start-5" : "lg:col-span-2"; return <article key={item.title} className={`group rounded-3xl border border-white/10 bg-[#091f3c] p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/25 hover:bg-[#0d2b50] sm:p-7 ${spanClass}`}><Icon className="h-6 w-6 text-emerald-400 transition duration-300 group-hover:scale-110 group-hover:text-[#efc85d]" /><h3 className="mt-5 text-xl font-black">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{item.benefit}</p></article>; })}</div><div className="mt-8 flex flex-col gap-3 sm:flex-row"><PrimaryLink href={LCDBO_REGISTER_HREF}>Register Your Business</PrimaryLink><SecondaryLink href={LCDBO_PARTNER_HREF}>Partner With LCDBO</SecondaryLink><SecondaryLink href={lcdboPublicHref("/opportunities")}>Explore Opportunities</SecondaryLink></div></div></section>;
}

function ProgrammeStatusSection() {
  return <section id="programme-status" aria-labelledby="programme-status-title" className="bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.76fr_1.24fr] lg:items-start"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">Programme readiness information</p><h2 id="programme-status-title" className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">From programme architecture to controlled implementation.</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">LCDBO is presented with a clear distinction between established programme architecture, operating infrastructure, engagement activity and subsequent phased activation.</p></div><div className="grid gap-3 sm:grid-cols-2">{safeProgrammeStatuses().map((status) => <article key={status.key} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:bg-white hover:shadow-lg"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">{status.classification}</p><h3 className="mt-3 text-lg font-black text-[#06172f]">{status.label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{status.detail}</p></article>)}</div></div></section>;
}

function ProgrammeResourcesSection() {
  return <section id="programme-resources" aria-labelledby="programme-resources-title" className="border-y border-slate-200 bg-[#f7f9fc] px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">Programme resources</p><h2 id="programme-resources-title" className="mt-3 text-4xl font-black tracking-tight text-[#06172f] sm:text-5xl">Evidence, references and public programme materials.</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Published resources link to existing public pages. Scheduled publications are identified without fake downloads or dead files.</p></div><Link href={lcdboPublicHref("/resources")} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-[#06172f] shadow-sm transition hover:-translate-y-0.5 hover:border-[#008751]/30 hover:text-[#008751]">View resource centre</Link></div><div className="mt-9 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{safePublicResources().slice(0, 6).map((resource) => <article key={resource.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-lg"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#008751]">{resource.category}</p><h3 className="mt-3 text-xl font-black text-[#06172f]">{resource.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{resource.description}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{resource.status === "published" ? "Published" : resource.status === "scheduled" ? "Publication scheduled" : resource.status}</span>{resource.href ? <Link href={resource.href} className="text-sm font-black text-[#008751] transition hover:text-[#005f39]">Open resource</Link> : <span className="text-sm font-bold text-slate-400">No public download</span>}</div></article>)}</div></div></section>;
}

function FinalCta() {
  return <section className="group relative isolate overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-28"><Image src="/images/lcdbo/export-containers.jpg" alt="International container port representing Nigeria's export ambition" fill sizes="100vw" className="object-cover transition duration-[1400ms] group-hover:scale-[1.025]" /><div className="absolute inset-0 bg-[#031226]/90" /><div className="absolute inset-0 bg-gradient-to-r from-[#020d1d]/98 via-[#03152b]/91 to-[#03152b]/65" /><div className="relative mx-auto max-w-7xl"><div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#efc85d]">RMRDC-led industrial transformation</p><h2 className="mt-4 text-4xl font-black tracking-tight drop-shadow-lg sm:text-6xl lg:text-7xl">Build productive capacity beyond oil.</h2><p className="mt-5 text-xl font-bold text-white sm:text-2xl">Connect raw materials, enterprises, clusters, capital and markets through LCDBO.</p><div className="mt-6 grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200 sm:flex sm:flex-wrap sm:gap-x-6"><span>Raw-material value addition</span><span className="hidden text-[#efc85d] sm:inline">•</span><span>Industrial clusters</span><span className="hidden text-[#efc85d] sm:inline">•</span><span>Market access</span></div><div className="mt-8 flex flex-col gap-3 sm:flex-row"><PrimaryLink href={LCDBO_REGISTER_HREF}>Register Your Business</PrimaryLink><SecondaryLink href={LCDBO_PARTNER_HREF}>Partner With LCDBO</SecondaryLink></div></div></div></section>;
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="group/button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] shadow-lg shadow-black/15 transition duration-300 hover:-translate-y-0.5 hover:bg-[#efc85d] hover:shadow-xl">{children}<ArrowRight className="h-4 w-4 transition group-hover/button:translate-x-0.5" /></Link>; }
function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/12">{children}</Link>; }
