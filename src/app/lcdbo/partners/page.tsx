import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Factory,
  Filter,
  Globe2,
  GraduationCap,
  Handshake,
  Landmark,
  Network,
  PackageCheck,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LCDBO_PARTNER_HREF } from "@/lib/lcdbo/content";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";

type Partner = Awaited<ReturnType<typeof loadLcdboPublicData>>["partners"][number];

const ecosystemNodes = [
  "Federal Government",
  "State Governments",
  "Development Finance",
  "Manufacturers",
  "Industrial Associations",
  "Universities",
  "Engineering Bodies",
  "Export Partners",
  "Technology",
  "Investors",
  "Research Institutions",
  "Standards Bodies",
  "Cluster Operators",
] as const;

const architecturePillars = [
  {
    title: "Policy & Government",
    icon: Landmark,
    actors: ["Federal Ministries", "RMRDC", "BOI", "SMEDAN", "SON", "NEPC", "NITDA", "State Governments", "LGA Authorities"],
    contribution: "Align industrial policy, standards, public-sector coordination and state-level execution.",
    impact: "Clear mandates, faster mobilisation and stronger national delivery discipline.",
  },
  {
    title: "Industrial Development",
    icon: Factory,
    actors: ["Manufacturers", "Industrial Parks", "Clusters", "NASME", "NASSI", "Chambers of Commerce"],
    contribution: "Organise producers, facilities, cluster operators and industrial associations around production capacity.",
    impact: "Higher MSME productivity, shared infrastructure and stronger local value chains.",
  },
  {
    title: "Finance",
    icon: Banknote,
    actors: ["Banks", "BOI", "DFIs", "Private Equity", "Impact Investors", "Infrastructure Funds", "Pension Funds", "Export Finance"],
    contribution: "Convert cluster needs into visible pipelines for debt, equity, guarantees and infrastructure capital.",
    impact: "More bankable opportunities and better capital deployment into industrial growth.",
  },
  {
    title: "Knowledge & Innovation",
    icon: GraduationCap,
    actors: ["Universities", "Polytechnics", "Research Centres", "Innovation Hubs", "Technology Companies", "DBIN", "Engineering Institutions"],
    contribution: "Bring research, technical capability, digital trust and innovation into production ecosystems.",
    impact: "Commercialised research, skilled technical support and measurable readiness improvement.",
  },
  {
    title: "Trade & Export",
    icon: Ship,
    actors: ["AfCFTA", "NEPC", "Export Councils", "Offtakers", "International Buyers", "Commodity Exchanges", "Ports"],
    contribution: "Connect local production to domestic offtake, continental trade and export-market access.",
    impact: "Stronger market access, export pathways and demand-led production planning.",
  },
  {
    title: "Delivery Partners",
    icon: Wrench,
    actors: ["Roseate Forte", "Implementation Partners", "NGOs", "Development Agencies", "Programme Management", "Technical Consultants"],
    contribution: "Coordinate execution, technical assistance, programme operations and measurable delivery support.",
    impact: "Operational consistency, accountable implementation and scalable programme governance.",
  },
] as const;

const featuredPartnerProfiles = [
  { key: "rmrdc", name: "RMRDC", role: "Industrial raw materials and cluster development", why: "Connects Nigeria's resource base to industrial value-chain strategy.", contribution: "Technical leadership on raw materials, processing opportunities and resource-led cluster focus." },
  { key: "afcfta", name: "AfCFTA", role: "Continental market access", why: "Provides the pathway from local production to African trade opportunities.", contribution: "Market-access alignment, export readiness and continental trade positioning." },
  { key: "boi", name: "BOI", role: "Industrial financing", why: "Turns organised production ecosystems into more financeable industrial pipelines.", contribution: "Development finance, MSME growth capital and investment-readiness partnership." },
  { key: "dbin", name: "DBIN", role: "Digital trust infrastructure", why: "Gives partners verified identities, traceability and participation intelligence.", contribution: "Verification, supplier trust, governance data and impact reporting infrastructure." },
  { key: "roseate", name: "Roseate Forte", role: "Programme coordination", why: "Supports the operational bridge between strategy, stakeholders and delivery.", contribution: "Programme coordination, platform delivery and execution support." },
  { key: "nse", name: "NSE", role: "Engineering standards", why: "Industrial clusters require credible technical standards and engineering capability.", contribution: "Engineering support, standards, technical review and industrial capability development." },
  { key: "nassi", name: "NASSI", role: "MSME mobilisation", why: "The industrial network only works when small-scale industrialists are organised and visible.", contribution: "MSME mobilisation, association channels and cluster participation support." },
] as const;

const contributionFlow = [
  { stage: "Policy", partners: "Government, regulators, standards bodies", icon: Landmark },
  { stage: "Clusters", partners: "States, LGAs, industrial parks, operators", icon: Factory },
  { stage: "Businesses", partners: "Associations, MSMEs, manufacturers", icon: Users },
  { stage: "Investment", partners: "BOI, banks, DFIs, investors", icon: Banknote },
  { stage: "Production", partners: "Engineers, technical partners, suppliers", icon: Wrench },
  { stage: "Exports", partners: "AfCFTA, NEPC, buyers, ports", icon: Ship },
  { stage: "Jobs", partners: "Training institutions and employers", icon: BadgeCheck },
  { stage: "Economic Growth", partners: "The national industrial ecosystem", icon: TrendingUp },
] as const;

const dbinInfrastructure = [
  "Digital identities",
  "Trust and verification",
  "Organisation management",
  "Partner onboarding",
  "Reporting and monitoring",
  "Impact measurement",
  "Programme governance",
] as const;

const partnershipBenefits = [
  { title: "Government", detail: "Industrial intelligence", icon: Landmark },
  { title: "MSMEs", detail: "Production opportunities", icon: Factory },
  { title: "Investors", detail: "Verified opportunities", icon: Banknote },
  { title: "Universities", detail: "Research commercialisation", icon: GraduationCap },
  { title: "Engineering Firms", detail: "Projects and standards", icon: Wrench },
  { title: "Development Partners", detail: "Impact reporting", icon: Globe2 },
  { title: "Banks", detail: "Pipeline visibility", icon: Building2 },
  { title: "Export Buyers", detail: "Verified suppliers", icon: PackageCheck },
  { title: "States", detail: "Industrial growth", icon: Network },
] as const;

const directoryCategories = ["Government", "Finance", "Technology", "Engineering", "Trade", "Development", "Research", "Associations", "International"] as const;

function clean(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed && trimmed !== "all" ? trimmed : "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase();
}

function classifyPartner(partner: Partner) {
  const text = [partner.name, partner.category, partner.institutionType, partner.description].join(" ").toLowerCase();
  if (text.includes("afcfta") || text.includes("continental") || text.includes("trade") || text.includes("export")) return "Trade";
  if (text.includes("boi") || text.includes("finance") || text.includes("fund") || text.includes("investment") || text.includes("bank")) return "Finance";
  if (text.includes("engineering") || text.includes("nse") || text.includes("standards") || text.includes("technical")) return "Engineering";
  if (text.includes("association") || text.includes("nassi") || text.includes("nasme") || text.includes("chamber")) return "Associations";
  if (text.includes("technology") || text.includes("digital") || text.includes("dbin") || text.includes("platform")) return "Technology";
  if (text.includes("research") || text.includes("raw materials") || text.includes("rmrdc") || text.includes("university")) return "Research";
  if (text.includes("development") || text.includes("agency") || text.includes("partner")) return "Development";
  if (text.includes("international") || text.includes("africa") || text.includes("world")) return "International";
  return "Government";
}

function sortPartners(partners: Partner[], sort: string) {
  return [...partners].sort((a, b) => {
    if (sort === "category") return `${classifyPartner(a)} ${a.name}`.localeCompare(`${classifyPartner(b)} ${b.name}`);
    if (sort === "type") return `${a.institutionType} ${a.name}`.localeCompare(`${b.institutionType} ${b.name}`);
    return a.name.localeCompare(b.name);
  });
}

function enrichFeaturedPartners(partners: Partner[]) {
  return featuredPartnerProfiles.map((profile) => {
    const match = partners.find((partner) => [partner.slug, partner.id, partner.name].join(" ").toLowerCase().includes(profile.key));
    return {
      ...profile,
      website: match?.website,
      category: match?.category ?? (profile.key === "dbin" ? "Digital Infrastructure" : "Strategic Partner"),
    };
  });
}

export default async function LcdboPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const data = await loadLcdboPublicData();
  const params = await searchParams;
  const query = clean(params.q);
  const category = clean(params.category);
  const sort = clean(params.sort);
  const normalizedQuery = query.toLowerCase();

  const filteredPartners = sortPartners(
    data.partners.filter((partner) => {
      const partnerCategory = classifyPartner(partner);
      if (category && partnerCategory !== category) return false;
      if (!normalizedQuery) return true;
      const searchable = [partner.name, partner.slug, partner.category, partner.institutionType, partner.description, partnerCategory].join(" ").toLowerCase();
      return searchable.includes(normalizedQuery);
    }),
    sort,
  );

  return (
    <LcdboShell landing>
      <PartnersHero />
      <EcosystemSection />
      <ArchitectureSection />
      <FeaturedPartnersSection partners={enrichFeaturedPartners(data.partners)} />
      <ContributionFlowSection />
      <DbinInfrastructureSection />
      <BenefitsSection />
      <PartnerDirectorySection partners={filteredPartners} query={query} category={category} sort={sort} />
      <PartnerCta />
    </LcdboShell>
  );
}

function PartnersHero() {
  return (
    <section className="relative isolate min-h-[640px] overflow-hidden bg-[#06172f] text-white">
      <Image src="/images/lcdbo/industrial-landscape-cta.jpg" alt="Industrial skyline, logistics and production facilities representing Nigeria's LCDBO partnership network" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#031226]/[0.98] via-[#041a35]/90 to-[#041a35]/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#031226]/90 via-transparent to-[#031226]/20" />
      <div className="relative mx-auto flex min-h-[640px] max-w-7xl items-center px-4 py-16 sm:px-6">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/35 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#efc85d] backdrop-blur"><Handshake className="h-4 w-4" />National Industrial Ecosystem</p>
          <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.4rem]">Building Nigeria&apos;s Largest <span className="text-[#efc85d]">Industrial Partnership Network.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">LCDBO brings together government, industry, finance, engineering, development institutions, trade organisations and technology platforms to coordinate industrial transformation at national scale.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={LCDBO_PARTNER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Become a Strategic Partner <ArrowRight className="h-4 w-4" /></Link>
            <Link href="#ecosystem" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">Explore the Ecosystem <ArrowDown className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function EcosystemSection() {
  return (
    <section id="ecosystem" className="scroll-mt-24 bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <SectionHeading dark eyebrow="One national ecosystem" title="Who is required to transform Nigeria into an industrial economy?" description="LCDBO is the coordination layer that aligns policy, capital, production capability, market access, technology and delivery partners around measurable industrial outcomes." />
        <div className="relative min-h-[620px] overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="absolute inset-8 rounded-full border border-emerald-300/20" />
          <div className="absolute inset-20 rounded-full border border-[#efc85d]/20" />
          <div className="absolute left-1/2 top-1/2 z-10 grid h-36 w-36 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#efc85d]/40 bg-[#06172f] text-center shadow-2xl shadow-black/40">
            <div><p className="text-3xl font-black text-[#efc85d]">LCDBO</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">Coordination Hub</p></div>
          </div>
          <div className="relative grid min-h-[560px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ecosystemNodes.map((node, index) => {
              const offset = ["self-start", "self-center", "self-end", "self-center"][index % 4];
              return <article key={node} className={`group relative rounded-2xl border border-white/10 bg-[#0a2547]/80 p-4 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#efc85d]/40 hover:bg-[#0d315e] ${offset}`}><span className="absolute left-1/2 top-1/2 hidden h-px w-16 origin-left bg-[#efc85d]/20 lg:block" /><Network className="h-5 w-5 text-emerald-400" /><h3 className="mt-5 text-sm font-black leading-5">{node}</h3></article>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Partnership architecture" title="Six executive pillars for national industrial transformation." description="The partnership model is organised around the institutions, capabilities and capital required to move from policy intent to industrial output." />
        <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {architecturePillars.map((pillar) => {
            const Icon = pillar.icon;
            return <article key={pillar.title} className="group rounded-[28px] border border-slate-200 bg-[#f8fafc] p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:bg-white hover:shadow-xl"><span className="grid h-13 w-13 place-items-center rounded-2xl bg-[#0B2E59] text-white"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-2xl font-black text-[#06172f]">{pillar.title}</h3><div className="mt-4 flex flex-wrap gap-2">{pillar.actors.map((actor) => <span key={actor} className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-600 ring-1 ring-slate-200 group-hover:bg-slate-50">{actor}</span>)}</div><div className="mt-5 grid gap-3"><MiniBlock label="Expected contribution" value={pillar.contribution} /><MiniBlock label="Impact" value={pillar.impact} /></div></article>;
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturedPartnersSection({ partners }: { partners: ReturnType<typeof enrichFeaturedPartners> }) {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Featured strategic partners" title="Institutional roles that make the ecosystem credible." description="Large-scale industrial transformation requires each partner to contribute a distinct capability: policy, markets, finance, standards, mobilisation, delivery and trust." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {partners.map((partner, index) => (
            <article key={partner.name} className={`group overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-2xl ${index === 0 ? "xl:col-span-2" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#06172f] text-sm font-black tracking-wider text-white shadow-lg">{initials(partner.name)}</span>
                <span className="rounded-full bg-[#D4A017]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#72520c]">{partner.category}</span>
              </div>
              <h3 className="mt-6 text-3xl font-black tracking-tight text-[#06172f]">{partner.name}</h3>
              <p className="mt-2 text-sm font-black text-[#008751]">{partner.role}</p>
              <div className="mt-5 grid gap-3">
                <MiniBlock label="Why it matters" value={partner.why} />
                <MiniBlock label="How it contributes" value={partner.contribution} />
              </div>
              {partner.website ? <Link href={partner.website} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0d5f42] transition hover:gap-3">Visit partner <ArrowRight className="h-4 w-4" /></Link> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContributionFlowSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="How every partner contributes" title="From policy coordination to jobs and economic growth." description="Each partner type participates at a different stage of the national industrial transformation pathway." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {contributionFlow.map((item, index) => {
            const Icon = item.icon;
            return <div key={item.stage} className="relative"><article className="h-full rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-lg"><Icon className="h-6 w-6 text-[#008751]" /><p className="mt-5 text-xl font-black text-[#06172f]">{item.stage}</p><p className="mt-2 text-xs leading-5 text-slate-600">{item.partners}</p></article>{index < contributionFlow.length - 1 ? <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#D4A017] lg:absolute lg:-right-3 lg:top-1/2 lg:z-10 lg:m-0 lg:-translate-y-1/2 lg:-rotate-90" /> : null}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

function DbinInfrastructureSection() {
  return (
    <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Enabling infrastructure</p>
          <div className="mt-6 inline-flex rounded-2xl bg-white p-4"><DbinBrandLogo /></div>
        </div>
        <div>
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">DBIN provides the trusted digital layer. LCDBO remains the industrial programme.</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">DBIN powers verification, digital identity, supplier trust and participation tracking for cluster members and partners, giving the LCDBO ecosystem a credible foundation for governance and measurable delivery.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{dbinInfrastructure.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" /><p className="text-sm font-black">{item}</p></div>)}</div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Partnership benefits" title="Distinct value for every ecosystem participant." description="LCDBO gives each institution a clearer role in the national industrial transformation alliance." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partnershipBenefits.map((benefit) => {
            const Icon = benefit.icon;
            return <article key={benefit.title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl"><Icon className="h-6 w-6 text-[#008751]" /><h3 className="mt-5 text-xl font-black text-[#06172f]">{benefit.title}</h3><p className="mt-2 text-sm font-bold text-slate-600">{benefit.detail}</p></article>;
          })}
        </div>
      </div>
    </section>
  );
}

function PartnerDirectorySection({ partners, query, category, sort }: { partners: Partner[]; query: string; category: string; sort: string }) {
  return (
    <section id="directory" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Current national ecosystem" title="Search the strategic partner directory." description="The directory preserves current partner records while presenting them as part of a broader industrial transformation ecosystem." />
        <form className="mt-9 rounded-[26px] border border-slate-200 bg-[#f8fafc] p-4 shadow-lg shadow-slate-200/50 sm:p-6">
          <label className="block text-xs font-black uppercase tracking-[0.13em] text-[#06172f]">Search partners, roles or capabilities<div className="relative mt-2"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#008751]" /><input name="q" defaultValue={query} placeholder="Try BOI, engineering, finance, export, association or digital trust" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008751] focus:ring-4 focus:ring-emerald-100" /></div></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <Select name="category" label="Ecosystem category" value={category} options={directoryCategories} />
            <Select name="sort" label="Sort" value={sort} options={["name", "category", "type"]} />
            <button className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#0B2E59] px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#123f72]"><Filter className="h-4 w-4" />Search directory</button>
          </div>
          {query || category || sort ? <Link href="/lcdbo/partners#directory" className="mt-4 inline-flex text-sm font-black text-[#008751]">Clear directory filters</Link> : null}
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-slate-500"><span className="font-black text-[#06172f]">{partners.length}</span> partner record{partners.length === 1 ? "" : "s"} in the current view</p><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#008751]">Partner database preserved</span></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {partners.map((partner) => <ModernPartnerCard key={partner.id} partner={partner} />)}
          {!partners.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-[#f8fafc] p-10 text-center md:col-span-2 xl:col-span-3"><Search className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-4 text-lg font-black text-[#0B2E59]">No partner records match this search</h3><p className="mt-2 text-sm text-slate-500">Try a broader capability, category or institution name.</p></div> : null}
        </div>
      </div>
    </section>
  );
}

function ModernPartnerCard({ partner }: { partner: Partner }) {
  const category = classifyPartner(partner);
  return (
    <article className="group rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0B2E59] text-xs font-black tracking-wider text-white">{initials(partner.name)}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#008751]">{category}</span>
      </div>
      <h3 className="mt-5 text-2xl font-black leading-tight text-[#06172f]">{partner.name}</h3>
      <p className="mt-1 text-xs font-bold capitalize text-slate-500">{partner.institutionType}</p>
      <p className="mt-4 text-sm leading-6 text-slate-600">{partner.description}</p>
      <div className="mt-4 rounded-xl bg-[#f8fafc] px-3 py-2.5"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Current partner role</p><p className="mt-1 text-xs font-black text-[#06172f]">{partner.category}</p></div>
      {partner.website ? <Link href={partner.website} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0d5f42] transition hover:gap-3">Visit partner <ArrowRight className="h-4 w-4" /></Link> : null}
    </article>
  );
}

function PartnerCta() {
  return (
    <section className="relative isolate overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-24">
      <Image src="/images/lcdbo/export-containers.jpg" alt="Export logistics and industrial infrastructure supporting LCDBO partnership delivery" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[#031226]/90" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl"><p className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/30 bg-[#efc85d]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-[#efc85d]"><Sparkles className="h-3.5 w-3.5" />Strategic alliance</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Join Nigeria&apos;s Industrial Transformation Alliance.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">Whether you are a government institution, investor, engineering body, university, development organisation or private enterprise, there is a role for you within LCDBO.</p></div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Link href={LCDBO_PARTNER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Become a Strategic Partner <ArrowRight className="h-4 w-4" /></Link><Link href="/lcdbo/contact?programme=lcdbo&source=lcdbo_public_site" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">Contact LCDBO</Link></div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) {
  return <div className="max-w-3xl"><p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-[#efc85d]" : "text-[#008751]"}`}>{eyebrow}</p><h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#06172f]"}`}>{title}</h2><p className={`mt-4 text-base leading-7 sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{description}</p></div>;
}

function MiniBlock({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{value}</p></div>;
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: readonly string[] }) {
  return <label className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}<select name={name} defaultValue={value || "all"} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#008751] focus:ring-4 focus:ring-emerald-100"><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
