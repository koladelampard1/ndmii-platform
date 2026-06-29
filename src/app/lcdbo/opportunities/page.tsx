import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Factory,
  Filter,
  Globe2,
  GraduationCap,
  Landmark,
  PackageCheck,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LCDBO_INVESTOR_HREF, LCDBO_PARTNER_HREF, LCDBO_REGISTER_HREF } from "@/lib/lcdbo/content";

type OpportunityCategory = "MSME" | "Investor" | "State" | "Technical Partner" | "Buyer" | "Finance" | "Export" | "Research" | "Diaspora" | "Cluster";

const marketplaceFlow = [
  { label: "MSMEs", icon: Users },
  { label: "Clusters", icon: Factory },
  { label: "Production", icon: Boxes },
  { label: "Investment", icon: Banknote },
  { label: "Markets", icon: PackageCheck },
  { label: "Exports", icon: Ship },
  { label: "Jobs", icon: BadgeCheck },
] as const;

const opportunityTracks = [
  {
    title: "MSME Registration & Participation",
    audience: "Manufacturers, artisans, processors, cooperatives and service providers.",
    value: "Enter LCDBO through business registration, identity readiness and structured participation pathways.",
    status: "Available foundation route",
    category: "MSME",
    cta: "Register Your Business",
    href: LCDBO_REGISTER_HREF,
    icon: BriefcaseBusiness,
  },
  {
    title: "Cluster Participation",
    audience: "Businesses seeking production clusters and shared industrial ecosystems.",
    value: "Explore cluster opportunities, express interest and connect to local production ecosystems.",
    status: "Pilot pipeline",
    category: "Cluster",
    cta: "Explore Clusters",
    href: "/lcdbo/clusters",
    icon: Factory,
  },
  {
    title: "Investment Readiness",
    audience: "Growth-stage MSMEs preparing for capital, finance, diligence and funder review.",
    value: "Build readiness signals around identity, compliance, capacity, finance and market participation.",
    status: "Foundation stage",
    category: "Finance",
    cta: "Start Readiness",
    href: LCDBO_REGISTER_HREF,
    icon: TrendingUp,
  },
  {
    title: "Investor & DFI Partnership",
    audience: "Investors, DFIs, banks, funds and impact capital.",
    value: "Discover organised industrial pipelines, verified participants and value-chain gaps.",
    status: "Emerging investment track",
    category: "Investor",
    cta: "View Investment Track",
    href: LCDBO_INVESTOR_HREF,
    icon: Banknote,
  },
  {
    title: "State Government Participation",
    audience: "States aligning local economic strengths with cluster development.",
    value: "Translate state product strengths into cluster pipelines, MSME mobilisation and investment cases.",
    status: "Partner intake",
    category: "State",
    cta: "Partner With LCDBO",
    href: LCDBO_PARTNER_HREF,
    icon: Landmark,
  },
  {
    title: "Technical & Engineering Partnership",
    audience: "Engineering bodies, consultants, technology providers, QA and infrastructure specialists.",
    value: "Support machinery, standards, infrastructure, quality assurance and industrial capability building.",
    status: "Partner intake",
    category: "Technical Partner",
    cta: "Join as Partner",
    href: LCDBO_PARTNER_HREF,
    icon: Wrench,
  },
  {
    title: "Off-taker & Buyer Access",
    audience: "Local and international buyers seeking verified supply chains.",
    value: "Discover cluster-based supply opportunities, product pipelines and verified supplier networks.",
    status: "Planned market-access pathway",
    category: "Buyer",
    cta: "Discover Supply Opportunities",
    href: "/lcdbo/model",
    icon: PackageCheck,
  },
  {
    title: "Research, Innovation & Skills",
    audience: "Universities, research centres, polytechnics, skills providers and innovation hubs.",
    value: "Commercialise research, strengthen production capability and support workforce development.",
    status: "Emerging capability track",
    category: "Research",
    cta: "Support Industrial Capability",
    href: LCDBO_PARTNER_HREF,
    icon: GraduationCap,
  },
  {
    title: "Diaspora & Strategic Capital",
    audience: "Diaspora investors and global partners seeking structured industrial participation.",
    value: "Connect capital, expertise and market access to productive local economies.",
    status: "Planned strategic pathway",
    category: "Diaspora",
    cta: "Explore Strategic Opportunities",
    href: LCDBO_INVESTOR_HREF,
    icon: Globe2,
  },
] as const;

const stakeholders = [
  { title: "MSMEs", detail: "Join clusters, improve readiness and access markets.", icon: Users },
  { title: "Investors", detail: "Discover structured pipelines and verified businesses.", icon: Banknote },
  { title: "State Governments", detail: "Organise local production around economic strengths.", icon: Landmark },
  { title: "Federal Agencies", detail: "Coordinate policy and national industrial outcomes.", icon: Building2 },
  { title: "DFIs/Banks", detail: "Identify finance-ready pipeline opportunities.", icon: TrendingUp },
  { title: "Technical Partners", detail: "Support machinery, standards, infrastructure and skills.", icon: Wrench },
  { title: "Buyers/Off-takers", detail: "Discover cluster-based supply opportunities.", icon: PackageCheck },
  { title: "Research Institutions", detail: "Commercialise research into industrial value chains.", icon: GraduationCap },
  { title: "Diaspora", detail: "Invest in productive local economies.", icon: Globe2 },
] as const;

const valueChainStages = [
  { stage: "Agriculture", opportunities: ["Raw material aggregation", "Input services", "Quality grading"], icon: Boxes },
  { stage: "Processing", opportunities: ["Processing facilities", "Machinery", "Working capital"], icon: Factory },
  { stage: "Manufacturing", opportunities: ["Product conversion", "Maintenance services", "QA standards"], icon: Wrench },
  { stage: "Packaging", opportunities: ["Packaging lines", "Branding", "Certification"], icon: PackageCheck },
  { stage: "Distribution", opportunities: ["Logistics", "Cold-chain", "Warehousing"], icon: Truck },
  { stage: "Export", opportunities: ["Export partnerships", "Buyer contracts", "Trade finance"], icon: Ship },
] as const;

const investorPipeline = [
  "Cluster themes",
  "Verified businesses",
  "Readiness data",
  "Value-chain gaps",
  "Infrastructure needs",
  "Potential projects",
  "Measurable outcomes",
] as const;

const stateOpportunities = [
  "State product strengths",
  "Cluster pipeline development",
  "MSME mobilisation",
  "Investment readiness",
  "Jobs and export growth",
  "Industrial intelligence",
] as const;

const featuredExamples = [
  { title: "Cocoa processing and export opportunity", sector: "Agro-processing", participants: "Farmers, processors, exporters", gap: "Processing capacity and export-grade packaging", investor: "Equipment, working capital and offtake finance" },
  { title: "Leather manufacturing and design opportunity", sector: "Leather", participants: "Tanners, designers, manufacturers", gap: "Shared finishing, design and quality systems", investor: "Industrial facilities and market access" },
  { title: "Rubber processing and industrial products opportunity", sector: "Rubber", participants: "Growers, processors, manufacturers", gap: "Processing and product conversion capacity", investor: "Machinery, production lines and buyer contracts" },
  { title: "Rice milling and packaging opportunity", sector: "Food processing", participants: "Growers, millers, cooperatives", gap: "Modern milling, storage and packaging", investor: "Mills, storage and trade finance" },
  { title: "Seafood cold-chain and export opportunity", sector: "Blue economy", participants: "Fishers, processors, logistics operators", gap: "Cold-chain, preservation and certification", investor: "Cold storage, logistics and export partnerships" },
  { title: "Solid minerals beneficiation opportunity", sector: "Solid minerals", participants: "Miners, processors, equipment providers", gap: "Beneficiation, safety and traceability", investor: "Processing plants and compliance systems" },
  { title: "Textile and garment production opportunity", sector: "Textiles", participants: "Tailors, garment factories, designers", gap: "Production scale, quality and distribution", investor: "Shared facilities and buyer offtake" },
  { title: "Machinery and maintenance services opportunity", sector: "Industrial services", participants: "Engineers, technicians, OEM partners", gap: "Repair, maintenance and uptime support", investor: "Service centres and technical training" },
] as const;

const filterCategories: readonly OpportunityCategory[] = ["MSME", "Investor", "State", "Technical Partner", "Buyer", "Finance", "Export", "Research", "Diaspora", "Cluster"];

function clean(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed && trimmed !== "all" ? trimmed : "";
}

export default async function LcdboOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = clean(params.q);
  const category = clean(params.category) as OpportunityCategory | "";
  const normalizedQuery = query.toLowerCase();
  const tracks = opportunityTracks.filter((track) => {
    if (category && track.category !== category) return false;
    if (!normalizedQuery) return true;
    return [track.title, track.audience, track.value, track.status, track.category, track.cta].join(" ").toLowerCase().includes(normalizedQuery);
  });

  return (
    <LcdboShell landing>
      <OpportunitiesHero />
      <MarketplacePositioningSection />
      <OpportunityTracksSection tracks={tracks} query={query} category={category} />
      <StakeholderSection />
      <ValueChainSection />
      <InvestorPipelineSection />
      <StateOpportunitySection />
      <FeaturedExamplesSection />
      <DbinTrustSection />
      <FinalCta />
    </LcdboShell>
  );
}

function OpportunitiesHero() {
  return (
    <section className="relative isolate min-h-[650px] overflow-hidden bg-[#06172f] text-white">
      <Image src="/images/lcdbo/industrial-cluster-warehouse.jpg" alt="Industrial production, logistics and investment infrastructure for LCDBO opportunities" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#031226]/[0.98] via-[#041a35]/90 to-[#041a35]/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#031226]/90 via-transparent to-[#031226]/25" />
      <div className="relative mx-auto flex min-h-[650px] max-w-7xl items-center px-4 py-16 sm:px-6">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/35 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#efc85d] backdrop-blur"><Sparkles className="h-4 w-4" />LCDBO Opportunities</p>
          <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.4rem]">Find Your Place in Nigeria&apos;s <span className="text-[#efc85d]">Industrial Transformation.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">LCDBO connects businesses, investors, governments, technical partners and buyers to structured opportunities across Nigeria&apos;s industrial clusters, value chains and production ecosystems.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Register Your Business <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/lcdbo/clusters" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">Explore Cluster Opportunities <ArrowRight className="h-4 w-4" /></Link>
            <Link href={LCDBO_PARTNER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">Partner With LCDBO <ArrowDown className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketplacePositioningSection() {
  return (
    <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <SectionHeading dark eyebrow="Opportunity marketplace" title="A Marketplace for Industrial Growth Opportunities" description="LCDBO opportunities are not ordinary grants or generic programmes. They are organised pathways for production, investment, market access, cluster development and national industrial growth." />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
            {marketplaceFlow.map((item, index) => {
              const Icon = item.icon;
              return <div key={item.label} className="relative"><article className="h-full rounded-2xl border border-white/10 bg-white/[0.055] p-4 transition hover:-translate-y-1 hover:border-[#efc85d]/40 hover:bg-white/[0.08]"><Icon className="h-5 w-5 text-emerald-400" /><p className="mt-6 text-sm font-black">{item.label}</p></article>{index < marketplaceFlow.length - 1 ? <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#efc85d] xl:absolute xl:-right-3 xl:top-1/2 xl:z-10 xl:m-0 xl:-translate-y-1/2 xl:-rotate-90" /> : null}</div>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function OpportunityTracksSection({ tracks, query, category }: { tracks: typeof opportunityTracks[number][]; query: string; category: string }) {
  return (
    <section id="tracks" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Opportunity tracks" title="Structured pathways for every participant." description="Search or filter the marketplace to find the right LCDBO pathway for your business, institution, capital or technical capability." />
        <form className="mt-9 rounded-[26px] border border-slate-200 bg-[#f8fafc] p-4 shadow-lg shadow-slate-200/50 sm:p-6">
          <label className="block text-xs font-black uppercase tracking-[0.13em] text-[#06172f]">Search opportunities<div className="relative mt-2"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#008751]" /><input name="q" defaultValue={query} placeholder="Try MSME, investor, cluster, finance, export, buyer, research or diaspora" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008751] focus:ring-4 focus:ring-emerald-100" /></div></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select name="category" label="Opportunity category" value={category} options={filterCategories} />
            <button className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#0B2E59] px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#123f72]"><Filter className="h-4 w-4" />Search marketplace</button>
          </div>
          {query || category ? <Link href="/lcdbo/opportunities#tracks" className="mt-4 inline-flex text-sm font-black text-[#008751]">Clear opportunity filters</Link> : null}
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-slate-500"><span className="font-black text-[#06172f]">{tracks.length}</span> opportunity track{tracks.length === 1 ? "" : "s"} match the current view</p><span className="rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">Foundation marketplace</span></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tracks.map((track) => <OpportunityTrackCard key={track.title} track={track} />)}
          {!tracks.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-[#f8fafc] p-10 text-center md:col-span-2 xl:col-span-3"><Search className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-4 text-lg font-black text-[#0B2E59]">No opportunity tracks match this search</h3><p className="mt-2 text-sm text-slate-500">Try a broader audience, category or pathway.</p></div> : null}
        </div>
      </div>
    </section>
  );
}

function OpportunityTrackCard({ track }: { track: typeof opportunityTracks[number] }) {
  const Icon = track.icon;
  return (
    <article className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-13 w-13 place-items-center rounded-2xl bg-[#0B2E59] text-white"><Icon className="h-6 w-6" /></span>
        <span className="rounded-full bg-[#D4A017]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#72520c]">{track.status}</span>
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#008751]">{track.category}</p>
      <h2 className="mt-2 text-2xl font-black leading-tight text-[#06172f]">{track.title}</h2>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{track.audience}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{track.value}</p>
      <Link href={track.href} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#06172f] px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#0B2E59]">{track.cta} <ArrowRight className="h-4 w-4" /></Link>
    </article>
  );
}

function StakeholderSection() {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Opportunity by stakeholder" title="Where Each Stakeholder Fits" description="LCDBO gives every stakeholder a defined role in the national industrial production network." />
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stakeholders.map((item) => {
            const Icon = item.icon;
            return <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl"><Icon className="h-6 w-6 text-[#008751]" /><h3 className="mt-5 text-xl font-black text-[#06172f]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p></article>;
          })}
        </div>
      </div>
    </section>
  );
}

function ValueChainSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Opportunity by value chain" title="From resources to export-ready production." description="Industrial opportunities emerge across the full chain: aggregation, processing, machinery, packaging, logistics, certification, working capital, export partnerships and buyer contracts." />
        <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {valueChainStages.map((stage, index) => {
            const Icon = stage.icon;
            return <div key={stage.stage} className="relative"><article className="h-full rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-lg"><Icon className="h-6 w-6 text-[#008751]" /><h3 className="mt-5 text-xl font-black text-[#06172f]">{stage.stage}</h3><div className="mt-4 space-y-2">{stage.opportunities.map((item) => <p key={item} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-slate-600">{item}</p>)}</div></article>{index < valueChainStages.length - 1 ? <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#D4A017] xl:absolute xl:-right-3 xl:top-1/2 xl:z-10 xl:m-0 xl:-translate-y-1/2 xl:-rotate-90" /> : null}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

function InvestorPipelineSection() {
  return (
    <section className="relative overflow-hidden bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#008751]/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <SectionHeading dark eyebrow="Investor pipeline" title="From Local Production to Investable Pipelines" description="LCDBO organises fragmented production ecosystems into visible pipelines that investors and DFIs can evaluate, support and scale." />
        <div className="rounded-[30px] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efc85d]">Pipeline visibility</p><span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">Powered by trust data</span></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{investorPipeline.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" /><p className="text-sm font-black">{item}</p></div>)}</div>
          <p className="mt-6 text-sm leading-6 text-slate-300">DBIN provides the trust layer for identity, verification and data confidence while LCDBO remains the industrial programme marketplace.</p>
        </div>
      </div>
    </section>
  );
}

function StateOpportunitySection() {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <SectionHeading eyebrow="State opportunity" title="Opportunities for States" description="States can use LCDBO to turn local economic advantages into organised industrial clusters, investment cases and measurable development outcomes." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stateOpportunities.map((item) => <article key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl"><Landmark className="h-5 w-5 text-[#008751]" /><p className="mt-5 text-sm font-black text-[#06172f]">{item}</p></article>)}
          <Link href="/lcdbo/clusters#state-opportunities" className="rounded-2xl border border-[#D4A017]/40 bg-[#D4A017]/15 p-5 text-sm font-black text-[#06172f] transition hover:-translate-y-1 hover:bg-[#D4A017]/25">Explore Clusters by State <ArrowRight className="mt-4 h-5 w-5" /></Link>
        </div>
      </div>
    </section>
  );
}

function FeaturedExamplesSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Indicative opportunity examples" title="Examples of opportunities the marketplace can surface." description="These examples are indicative and do not represent official approvals, guaranteed production capacity or confirmed investment availability." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featuredExamples.map((example) => <article key={example.title} className="rounded-[24px] border border-slate-200 bg-[#f8fafc] p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl"><p className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#008751]">{example.sector}</p><h3 className="mt-4 text-xl font-black leading-tight text-[#06172f]">{example.title}</h3><MiniBlock label="Potential participants" value={example.participants} /><MiniBlock label="Value-chain gap" value={example.gap} /><MiniBlock label="Investor relevance" value={example.investor} /></article>)}
        </div>
      </div>
    </section>
  );
}

function DbinTrustSection() {
  return (
    <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Verified business identity</p><div className="mt-6 inline-flex rounded-2xl bg-white p-4"><DbinBrandLogo /></div></div>
        <div><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Powered by Verified Business Identity</h2><p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">DBIN supports opportunity discovery by providing identity, verification, participation tracking, readiness data and trusted business profiles for LCDBO participants. It is the infrastructure layer; LCDBO remains the industrial opportunity marketplace.</p></div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-24">
      <Image src="/images/lcdbo/export-containers.jpg" alt="Export logistics and industrial production network for LCDBO opportunities" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[#031226]/90" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">National opportunity marketplace</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Turn Industrial Potential Into Opportunity.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">Whether you are a business, investor, government institution, buyer or technical partner, LCDBO provides a structured pathway into Nigeria&apos;s industrial production network.</p></div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Register Your Business <ArrowRight className="h-4 w-4" /></Link><Link href={LCDBO_PARTNER_HREF} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">Partner With LCDBO</Link><Link href="/lcdbo/clusters" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">Explore Clusters</Link></div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) {
  return <div className="max-w-3xl"><p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-[#efc85d]" : "text-[#008751]"}`}>{eyebrow}</p><h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#06172f]"}`}>{title}</h2><p className={`mt-4 text-base leading-7 sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{description}</p></div>;
}

function MiniBlock({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-slate-100"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{value}</p></div>;
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: readonly string[] }) {
  return <label className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}<select name={name} defaultValue={value || "all"} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#008751] focus:ring-4 focus:ring-emerald-100"><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
