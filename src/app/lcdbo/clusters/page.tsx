import Image from "next/image";
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
  Factory,
  Filter,
  Gem,
  Landmark,
  Lightbulb,
  MapPinned,
  Network,
  PackageCheck,
  Route,
  Search,
  ShieldCheck,
  Ship,
  Sprout,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { ClusterCard } from "@/components/lcdbo/lcdbo-cards";
import { LcdboShell } from "@/components/lcdbo/lcdbo-shell";
import { LCDBO_REGISTER_HREF } from "@/lib/lcdbo/content";
import { loadLcdboPublicData } from "@/lib/lcdbo/data";
import {
  featuredStateClusterOpportunities,
  getClusterThemeOpportunities,
  searchStateClusterOpportunities,
  stateClusterOpportunities,
  stateClusterOpportunityByState,
  type ClusterThemeOpportunity,
  type ResourceCategory,
  type StateClusterOpportunity,
} from "@/lib/lcdbo/state-cluster-opportunities";

const nationalNetwork = [
  { value: "Nigeria", label: "National industrial ambition", icon: Landmark },
  { value: "36 + FCT", label: "State production systems", icon: MapPinned },
  { value: "774", label: "Local Government Areas", icon: Building2 },
  { value: "774", label: "Specialised industrial clusters", icon: Factory },
  { value: "3.8M+", label: "MSME participation ambition", icon: Users },
  { value: "One Network", label: "Connected national production", icon: Network },
] as const;

const valueChain = [
  { title: "Raw Materials", detail: "Local rubber production", icon: Boxes },
  { title: "Aggregation", detail: "Quality and volume coordination", icon: Warehouse },
  { title: "Processing", detail: "Shared industrial facilities", icon: Factory },
  { title: "Manufacturing", detail: "Higher-value finished goods", icon: PackageCheck },
  { title: "Distribution", detail: "Domestic and regional supply", icon: Truck },
  { title: "Export", detail: "Global market access", icon: Ship },
] as const;

const valueChainExamples = [
  { product: "Cocoa", path: ["Farmers", "Aggregation", "Fermentation", "Processing", "Packaging", "Export offtake"] },
  { product: "Leather", path: ["Hides", "Tanning", "Design", "Manufacturing", "Trade", "Regional markets"] },
  { product: "Rubber", path: ["Plantations", "Aggregation", "Processing", "Manufacturing", "Distribution", "Export"] },
  { product: "Rice", path: ["Growers", "Milling", "Storage", "Packaging", "Wholesale", "Institutional buyers"] },
] as const;

const featuredClusters = [
  { name: "Ondo Cocoa Cluster", sector: "Cocoa & agro-processing", state: "Ondo", opportunity: "Premium processing and export-grade cocoa products", msmes: "4,800", focus: "Aggregation · Processing · Export", image: "/images/lcdbo/agro-processing.jpg" },
  { name: "Kano Leather Cluster", sector: "Leather & light manufacturing", state: "Kano", opportunity: "Finished leather, footwear and industrial goods", msmes: "5,200", focus: "Tanning · Manufacturing · Trade", image: "/images/lcdbo/nigerian-msme-workshop-production.jpg" },
  { name: "Bayelsa Seafood Cluster", sector: "Seafood & cold chain", state: "Bayelsa", opportunity: "Processing, preservation and coastal export logistics", msmes: "3,600", focus: "Harvest · Cold chain · Distribution", image: "/images/lcdbo/export-containers.jpg" },
  { name: "Ogun Manufacturing Cluster", sector: "Light manufacturing", state: "Ogun", opportunity: "Shared facilities and supplier development", msmes: "5,000", focus: "Components · Assembly · Logistics", image: "/images/lcdbo/industrial-cluster-warehouse.jpg" },
  { name: "Aba Garment Cluster", sector: "Textiles & apparel", state: "Abia", opportunity: "Scaled garment production for national and export markets", msmes: "5,400", focus: "Textiles · Production · Distribution", image: "/images/lcdbo/nigerian-manufacturing-hero.jpg" },
  { name: "Kaduna Tomato Processing Cluster", sector: "Food processing", state: "Kaduna", opportunity: "Reduce post-harvest loss through coordinated processing", msmes: "4,250", focus: "Farming · Processing · Packaging", image: "/images/lcdbo/agro-processing.jpg" },
] as const;

const investorBenefits = [
  { title: "Source products by state", icon: MapPinned },
  { title: "Identify production clusters", icon: Factory },
  { title: "Find verified businesses", icon: BadgeCheck },
  { title: "Map value-chain gaps", icon: Route },
  { title: "Discover infrastructure opportunities", icon: Banknote },
  { title: "Connect to DBIN-verified participants", icon: ShieldCheck },
] as const;

const nationalOutcomes = [
  { value: "774", label: "Cluster ambition", detail: "One specialised ecosystem per LGA", icon: Factory },
  { value: "3.8M+", label: "MSME pathway", detail: "Coordinated participation at national scale", icon: BriefcaseBusiness },
  { value: "36 + FCT", label: "National coverage", detail: "Connected state production economies", icon: Landmark },
  { value: "5,000", label: "MSMEs per cluster", detail: "Long-term enablement target", icon: Users },
  { value: "8", label: "Ecosystem layers", detail: "From production to investment and markets", icon: Network },
  { value: "1", label: "Production network", detail: "A stronger industrial economy beyond oil", icon: Ship },
] as const;

const clusterParticipants = [
  { title: "Producers", icon: Users },
  { title: "Processors", icon: Factory },
  { title: "Manufacturers", icon: Building2 },
  { title: "Exporters", icon: Ship },
  { title: "Logistics Providers", icon: Truck },
  { title: "Finance Partners", icon: Banknote },
] as const;

function clean(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed && trimmed !== "all" ? trimmed : "";
}

export default async function LcdboClustersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; opportunityState?: string; state?: string; sector?: string; clusterType?: string; status?: string }>;
}) {
  const params = await searchParams;
  const data = await loadLcdboPublicData();
  const query = clean(params.q);
  const opportunityState = clean(params.opportunityState);
  const state = clean(params.state);
  const sector = clean(params.sector);
  const clusterType = clean(params.clusterType);
  const status = clean(params.status);
  const normalizedQuery = query.toLowerCase();
  const clusters = data.clusters.filter((cluster) => {
    if (state && cluster.state !== state) return false;
    if (sector && cluster.sector !== sector) return false;
    if (clusterType && cluster.clusterType !== clusterType) return false;
    if (status && cluster.status !== status) return false;
    if (normalizedQuery) {
      const searchable = [cluster.name, cluster.sector, cluster.clusterType, cluster.state, cluster.lga, cluster.description, cluster.locationDescription].join(" ").toLowerCase();
      if (!searchable.includes(normalizedQuery)) return false;
    }
    return true;
  });
  const states = [...new Set(data.clusters.map((cluster) => cluster.state))].sort();
  const sectors = [...new Set(data.clusters.map((cluster) => cluster.sector))].sort();
  const clusterTypes = [...new Set(data.clusters.map((cluster) => cluster.clusterType))].sort();
  const statuses = [...new Set(data.clusters.map((cluster) => cluster.status))].sort();
  const isFiltered = Boolean(query || state || sector || clusterType || status);
  const opportunityMatches = searchStateClusterOpportunities(query, opportunityState);
  const selectedOpportunity = opportunityState ? stateClusterOpportunityByState.get(opportunityState) : undefined;
  const featuredStateNames = new Set(featuredStateClusterOpportunities.map((item) => item.state));
  const themeOpportunities = getClusterThemeOpportunities().filter((theme) => {
    if (opportunityState && theme.state !== opportunityState) return false;
    if (!opportunityState && !normalizedQuery && !featuredStateNames.has(theme.state)) return false;
    if (!normalizedQuery) return true;
    return [theme.theme, theme.state, theme.resourceBase, theme.valueChainPotential, theme.investorRelevance, theme.msmeOpportunity, theme.category]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <LcdboShell landing>
      <ClustersHero />
      <NationalNetworkSection />
      <StateResourceDiscoverySection
        query={query}
        selectedState={opportunityState}
        selectedOpportunity={selectedOpportunity}
        opportunities={opportunityMatches}
        themeOpportunities={themeOpportunities}
      />
      <ClusterModelSection />
      <FeaturedClustersSection />
      <ClusterDiscoverySection
        clusters={clusters}
        query={query}
        state={state}
        sector={sector}
        clusterType={clusterType}
        status={status}
        states={states}
        sectors={sectors}
        clusterTypes={clusterTypes}
        statuses={statuses}
        isFiltered={isFiltered}
      />
      <InvestorSection />
      <DbinTrustSection />
      <NationalImpactSection />
      <ClusterProfilePreview />
      <FinalCta />
    </LcdboShell>
  );
}

function ClustersHero() {
  return (
    <section className="relative isolate min-h-[620px] overflow-hidden bg-[#06172f] text-white">
      <Image src="/images/lcdbo/industrial-landscape-cta.jpg" alt="Large industrial production and logistics facility representing Nigeria's national cluster network" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#031226]/[0.98] via-[#041a35]/90 to-[#041a35]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#031226]/90 via-transparent to-[#031226]/30" />
      <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-4 py-16 sm:px-6">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#efc85d]/35 bg-[#efc85d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#efc85d] backdrop-blur"><Network className="h-4 w-4" />National Industrial Opportunity Map</p>
          <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.2rem]">Nigeria&apos;s Industrial Clusters Start With <span className="text-[#efc85d]">Local Economic Advantage.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">Explore Nigeria&apos;s production opportunities by state, product, mineral and value chain. LCDBO organises local strengths into clusters that connect MSMEs, investors, buyers and export markets.</p>
          <p className="mt-4 max-w-2xl text-sm font-bold text-emerald-200">774 Industrial Clusters. One National Production Network.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="#state-opportunities" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Explore State Opportunities <ArrowDown className="h-4 w-4" /></Link>
            <Link href="/lcdbo/opportunities" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">View Opportunities <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function NationalNetworkSection() {
  return (
    <section className="bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading dark eyebrow="The national architecture" title="From local advantage to national industrial strength." description="A connected production system designed to organise local enterprise into investable, market-ready ecosystems." />
        <div className="mt-10 grid gap-3 lg:grid-cols-6">
          {nationalNetwork.map((item, index) => {
            const Icon = item.icon;
            return <div key={item.value + item.label} className="relative"><article className="group flex min-h-44 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.055] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#efc85d]/40 hover:bg-white/[0.08]"><Icon className="h-6 w-6 text-emerald-400" /><div><p className="text-2xl font-black tracking-tight text-white">{item.value}</p><p className="mt-2 text-xs font-bold leading-5 text-slate-300">{item.label}</p></div></article>{index < nationalNetwork.length - 1 ? <ArrowDown className="mx-auto my-2 h-5 w-5 text-[#efc85d] lg:absolute lg:-right-5 lg:top-1/2 lg:z-10 lg:m-0 lg:-translate-y-1/2 lg:-rotate-90" /> : null}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

function StateResourceDiscoverySection({
  query,
  selectedState,
  selectedOpportunity,
  opportunities,
  themeOpportunities,
}: {
  query: string;
  selectedState: string;
  selectedOpportunity?: StateClusterOpportunity;
  opportunities: StateClusterOpportunity[];
  themeOpportunities: ClusterThemeOpportunity[];
}) {
  const visibleStates = query || selectedState ? opportunities : featuredStateClusterOpportunities;
  const hasSearch = Boolean(query || selectedState);

  return (
    <section id="state-opportunities" className="scroll-mt-24 bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <SectionHeading eyebrow="State resource discovery" title="Discover Cluster Opportunities by State" description="Use state, product, mineral and value-chain data to identify resource-led cluster potential before moving into active or seeded programme records." />
          <form className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70 sm:p-6">
            <label className="block text-xs font-black uppercase tracking-[0.13em] text-[#06172f]">Search product, mineral or value chain<div className="relative mt-2"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#008751]" /><input name="q" defaultValue={query} placeholder="Try cocoa, rubber, leather, rice, cassava, gold, limestone, bitumen or fisheries" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008751] focus:ring-4 focus:ring-emerald-100" /></div></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Select name="opportunityState" label="State opportunity selector" value={selectedState} options={stateClusterOpportunities.map((item) => item.state)} />
              <button className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#0B2E59] px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#123f72]"><Filter className="h-4 w-4" />Find opportunities</button>
            </div>
            {hasSearch ? <Link href="/lcdbo/clusters#state-opportunities" className="mt-4 inline-flex text-sm font-black text-[#008751]">Clear resource filters</Link> : null}
          </form>
        </div>

        {selectedOpportunity ? <SelectedStatePanel opportunity={selectedOpportunity} /> : null}

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#008751]">{hasSearch ? "Matching resource locations" : "High-potential state examples"}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-[#06172f]">{visibleStates.length} state {visibleStates.length === 1 ? "opportunity" : "opportunities"}</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">Indicative opportunity data</span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {visibleStates.slice(0, 8).map((opportunity) => <StateOpportunityCard key={opportunity.state} opportunity={opportunity} />)}
              {!visibleStates.length ? <EmptyOpportunityState /> : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#008751]">Indicative Cluster Opportunities</p>
                <h3 className="mt-2 text-2xl font-black text-[#06172f]">Generated cluster themes</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Themes are derived from the spreadsheet and should be treated as proposed production focus areas, not officially launched clusters.</p>
              </div>
              <Lightbulb className="h-8 w-8 text-[#D4A017]" />
            </div>
            <div className="mt-5 space-y-3">
              {themeOpportunities.slice(0, 7).map((theme) => <ThemeOpportunityCard key={theme.id} theme={theme} />)}
              {!themeOpportunities.length ? <EmptyOpportunityState compact /> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedStatePanel({ opportunity }: { opportunity: StateClusterOpportunity }) {
  return (
    <article className="mt-10 overflow-hidden rounded-[30px] border border-[#0B2E59]/10 bg-white shadow-2xl shadow-slate-200/80">
      <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
        <div className="bg-[#07172e] p-6 text-white sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efc85d]">Selected state profile</p>
          <h3 className="mt-3 text-4xl font-black tracking-tight">{opportunity.state}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{opportunity.headlineOpportunity}</p>
          <div className="mt-6 grid gap-3">
            {opportunity.prioritySectors.map((sector) => <span key={sector} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-emerald-200">{sector}</span>)}
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:p-8 lg:grid-cols-3">
          <ResourceColumn icon={Sprout} title="Agricultural resources" resources={opportunity.agriculturalResources} />
          <ResourceColumn icon={Gem} title="Solid minerals" resources={opportunity.solidMinerals} />
          <ResourceColumn icon={BarChart3} title="Other opportunities" resources={opportunity.otherOpportunities} />
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 lg:col-span-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Suggested cluster themes</p>
            <div className="mt-3 flex flex-wrap gap-2">{opportunity.suggestedClusterThemes.map((theme) => <span key={theme} className="rounded-full bg-[#008751]/10 px-3 py-1.5 text-xs font-black text-[#075b3b]">{theme}</span>)}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">MSME participation opportunities</p>
            <p className="mt-2 text-sm leading-6 text-emerald-950">Production, aggregation, processing, packaging, services, logistics and supplier participation around the state&apos;s dominant resource base.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">Investor opportunities</p>
            <p className="mt-2 text-sm leading-6 text-amber-950">Processing infrastructure, shared facilities, offtake, cold-chain, logistics and market-access capital.</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function StateOpportunityCard({ opportunity }: { opportunity: StateClusterOpportunity }) {
  return (
    <article className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/25 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#008751]">Resource-led cluster potential</p>
          <h3 className="mt-2 text-2xl font-black text-[#06172f]">{opportunity.state}</h3>
        </div>
        <MapPinned className="h-6 w-6 text-[#D4A017]" />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{opportunity.headlineOpportunity}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {opportunity.agriculturalResources.slice(0, 3).map((resource) => <ResourcePill key={resource} category="Agriculture" label={resource} />)}
        {opportunity.solidMinerals.slice(0, 2).map((resource) => <ResourcePill key={resource} category="Solid minerals" label={resource} />)}
        {opportunity.otherOpportunities.slice(0, 2).map((resource) => <ResourcePill key={resource} category="Other opportunities" label={resource} />)}
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Suggested cluster themes</p>
        <p className="mt-1 text-xs font-black leading-5 text-[#06172f]">{opportunity.suggestedClusterThemes.slice(0, 4).join(" · ")}</p>
      </div>
    </article>
  );
}

function ThemeOpportunityCard({ theme }: { theme: ClusterThemeOpportunity }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Proposed cluster theme</p>
          <h4 className="mt-1 text-lg font-black text-[#06172f]">{theme.theme}</h4>
        </div>
        <ResourcePill category={theme.category} label={theme.category} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{theme.valueChainPotential}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MiniNote label="Investor relevance" value={theme.investorRelevance} />
        <MiniNote label="MSME opportunity" value={theme.msmeOpportunity} />
      </div>
    </article>
  );
}

function ResourceColumn({ icon: Icon, title, resources }: { icon: LucideIcon; title: string; resources: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-[#008751]" />
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">{resources.map((resource) => <span key={resource} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{resource}</span>)}</div>
    </div>
  );
}

function MiniNote({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{value}</p></div>;
}

function ResourcePill({ category, label }: { category: ResourceCategory; label: string }) {
  const styles: Record<ResourceCategory, string> = {
    Agriculture: "bg-emerald-50 text-emerald-800",
    "Solid minerals": "bg-amber-50 text-amber-800",
    "Other opportunities": "bg-blue-50 text-blue-800",
  };
  return <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${styles[category]}`}>{label}</span>;
}

function EmptyOpportunityState({ compact = false }: { compact?: boolean }) {
  return <div className={`rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center ${compact ? "" : "md:col-span-2"}`}><MapPinned className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-black text-[#06172f]">No indicative opportunities match this view.</p><p className="mt-1 text-xs leading-5 text-slate-500">Try a broader product, mineral or state search.</p></div>;
}

function ClusterModelSection() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <SectionHeading eyebrow="How a cluster works" title="One product. An entire value chain." description="A cluster is not merely a location. It coordinates production, processing, services, finance, logistics, market access and investment around a shared economic strength." />
          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-[#f7f9fc] p-5 shadow-xl shadow-slate-200/60 sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#008751]">Illustrative cluster model</p><h3 className="mt-2 text-2xl font-black text-[#06172f]">Rubber Cluster</h3></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B2E59] text-white"><Factory className="h-6 w-6" /></span></div><div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">{valueChain.map((step, index) => { const Icon = step.icon; return <div key={step.title} className="relative"><article className="h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"><Icon className="h-5 w-5 text-[#008751]" /><p className="mt-5 text-sm font-black text-[#06172f]">{step.title}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{step.detail}</p></article>{index < valueChain.length - 1 ? <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#D4A017] xl:absolute xl:-right-3 xl:top-1/2 xl:z-10 xl:m-0 xl:-translate-y-1/2 xl:-rotate-90" /> : null}</div>; })}</div></div>
            <div className="grid gap-3 md:grid-cols-2">
              {valueChainExamples.map((example) => <article key={example.product} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-black text-[#06172f]">{example.product} value chain</p><div className="mt-3 flex flex-wrap gap-2">{example.path.map((step, index) => <span key={step} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-600">{index + 1}. {step}</span>)}</div></article>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedClustersSection() {
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Indicative cluster opportunities" title="Specialised ecosystems built around local advantage." description="Illustrative profiles show how priority sectors can become coordinated production, investment and market-access platforms." />
        <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredClusters.map((cluster) => <article key={cluster.name} className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-500 hover:-translate-y-1.5 hover:shadow-2xl"><div className="relative h-52 overflow-hidden"><Image src={cluster.image} alt={`${cluster.name} proposed cluster opportunity`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#041226]/80 to-transparent" /><span className="absolute left-4 top-4 rounded-full border border-white/15 bg-[#06172f]/80 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#efc85d] backdrop-blur">Proposed cluster theme</span><div className="absolute inset-x-0 bottom-0 p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">{cluster.sector}</p><h3 className="mt-1 text-2xl font-black text-white">{cluster.name}</h3></div></div><div className="p-5"><div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><MapPinned className="h-4 w-4 text-[#008751]" />{cluster.state} State</span><span>Est. {cluster.msmes} MSMEs</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{cluster.opportunity}</p><div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Value-chain focus</p><p className="mt-1 text-xs font-black text-[#06172f]">{cluster.focus}</p></div></div></article>)}
        </div>
      </div>
    </section>
  );
}

function ClusterDiscoverySection({ clusters, query, state, sector, clusterType, status, states, sectors, clusterTypes, statuses, isFiltered }: {
  clusters: Awaited<ReturnType<typeof loadLcdboPublicData>>["clusters"];
  query: string;
  state: string;
  sector: string;
  clusterType: string;
  status: string;
  states: string[];
  sectors: string[];
  clusterTypes: string[];
  statuses: string[];
  isFiltered: boolean;
}) {
  return (
    <section id="cluster-discovery" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Active / Seeded Clusters" title="Discover live programme clusters by product, sector and place." description="Search the current LCDBO pipeline by cluster name, product, state or value-chain focus, then refine the result with programme filters." />
        <form className="mt-9 rounded-[26px] border border-slate-200 bg-[#f8fafc] p-4 shadow-lg shadow-slate-200/50 sm:p-6">
          <label className="block text-xs font-black uppercase tracking-[0.13em] text-[#06172f]">Search cluster, product or value chain<div className="relative mt-2"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#008751]" /><input name="q" defaultValue={query} placeholder="Try cocoa, leather, rubber, rice, seafood, textiles or technology" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008751] focus:ring-4 focus:ring-emerald-100" /></div></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Select name="state" label="State" value={state} options={states} /><Select name="sector" label="Sector" value={sector} options={sectors} /><Select name="clusterType" label="Cluster type" value={clusterType} options={clusterTypes} /><Select name="status" label="Status" value={status} options={statuses} /><button className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#0B2E59] px-4 text-sm font-black text-white transition hover:bg-[#123f72]"><Filter className="h-4 w-4" />Discover clusters</button></div>
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-slate-500"><span className="font-black text-[#06172f]">{clusters.length}</span> cluster{clusters.length === 1 ? "" : "s"} match the current view</p>{isFiltered ? <Link href="/lcdbo/clusters#cluster-discovery" className="text-sm font-black text-[#008751]">Clear all filters</Link> : null}</div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">{clusters.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} />)}{!clusters.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-[#f8fafc] p-10 text-center lg:col-span-3"><MapPinned className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-4 text-lg font-black text-[#0B2E59]">No clusters match this search</h2><p className="mt-2 text-sm text-slate-500">Try a broader product, sector or location, or return to the national pipeline.</p></div> : null}</div>
      </div>
    </section>
  );
}

function InvestorSection() {
  return (
    <section className="relative overflow-hidden bg-[#07172e] px-4 py-16 text-white sm:px-6 lg:py-20"><div className="absolute -right-36 -top-40 h-96 w-96 rounded-full bg-[#008751]/20 blur-3xl" /><div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div><SectionHeading dark eyebrow="For investors and buyers" title="Discover production ecosystems—not isolated businesses." description="Source through coordinated clusters organised around specific products and sectors, with clearer pipeline visibility, stronger capacity signals and measurable market opportunity." /><Link href="/lcdbo/opportunities" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#efc85d] transition hover:gap-3">Explore investment opportunities <ArrowRight className="h-4 w-4" /></Link></div><div className="grid gap-3 sm:grid-cols-2">{investorBenefits.map((benefit, index) => { const Icon = benefit.icon; return <article key={benefit.title} className={`group rounded-2xl border border-white/10 bg-white/[0.055] p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[0.08] ${index === investorBenefits.length - 1 ? "sm:col-span-2" : ""}`}><Icon className="h-6 w-6 text-emerald-400" /><h3 className="mt-5 text-lg font-black">{benefit.title}</h3></article>; })}</div></div></section>
  );
}

function DbinTrustSection() {
  const benefits = ["Verified businesses", "Trusted supplier discovery", "End-to-end traceability", "Transparent participation", "Stronger investor confidence"];
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] border border-slate-200 bg-[#f7f9fc] shadow-xl shadow-slate-200/60"><div className="grid lg:grid-cols-[0.8fr_1.2fr]"><div className="flex flex-col justify-between bg-[#0B2E59] p-7 text-white sm:p-10"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#efc85d]">Powered by trusted business identity</p><div className="mt-6 inline-flex rounded-2xl bg-white p-4"><DbinBrandLogo /></div></div><ShieldCheck className="mt-12 h-16 w-16 text-emerald-400" /></div><div className="p-7 sm:p-10"><h2 className="text-3xl font-black tracking-tight text-[#06172f] sm:text-4xl">Trust infrastructure for every cluster participant.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Every cluster participant can be verified through the Digital Business Identity Network (DBIN), giving programme partners, buyers and investors a consistent foundation for discovery, diligence and confidence.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{benefits.map((benefit) => <div key={benefit} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><BadgeCheck className="h-5 w-5 shrink-0 text-[#008751]" /><p className="text-sm font-black text-[#06172f]">{benefit}</p></div>)}</div></div></div></div></section>
  );
}

function NationalImpactSection() {
  // Programme targets shown here require formal source, methodology, ownership,
  // and approval validation before production launch.
  return (
    <section className="bg-[#f3f6f9] px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="National industrial impact" title="Local production. National outcomes." description="The cluster network is designed to accelerate industrialisation, job creation, import substitution, export growth, MSME scale and investment attraction." /><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{nationalOutcomes.map((outcome) => { const Icon = outcome.icon; return <article key={outcome.label} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#008751]/30 hover:shadow-xl"><Icon className="h-5 w-5 text-[#008751]" /><p className="mt-6 text-3xl font-black tracking-tight text-[#06172f]">{outcome.value}</p><h3 className="mt-2 text-sm font-black text-[#06172f]">{outcome.label}</h3><p className="mt-2 text-[11px] leading-5 text-slate-500">{outcome.detail}</p></article>; })}</div></div></section>
  );
}

function ClusterProfilePreview() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-center"><SectionHeading eyebrow="Inside a cluster profile" title="See the complete production ecosystem." description="Each profile brings participants, capacity, infrastructure, market pathways and investment needs into one view for programme stakeholders." /><div className="rounded-[28px] border border-slate-200 bg-[#07172e] p-5 text-white shadow-2xl sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Demonstration profile</p><h3 className="mt-2 text-3xl font-black">Ondo Cocoa Cluster</h3><p className="mt-2 text-sm text-slate-300">Cocoa production, processing and export ecosystem</p></div><span className="rounded-full border border-[#efc85d]/30 bg-[#efc85d]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#efc85d]">Value-chain view</span></div><div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{clusterParticipants.map((participant) => { const Icon = participant.icon; return <article key={participant.title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 transition hover:border-emerald-300/30 hover:bg-white/[0.08]"><Icon className="h-5 w-5 text-emerald-400" /><p className="mt-4 text-sm font-black">{participant.title}</p></article>; })}<div className="pointer-events-none absolute inset-0 hidden place-items-center lg:grid"><span className="grid h-20 w-20 place-items-center rounded-full border-4 border-[#07172e] bg-[#D4A017] text-center text-[10px] font-black uppercase leading-4 text-[#06172f] shadow-xl">Cluster<br />Hub</span></div></div></div></div></section>
  );
}

function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-[#06172f] px-4 py-20 text-white sm:px-6 lg:py-24"><Image src="/images/lcdbo/export-containers.jpg" alt="Export logistics network supporting Nigerian industrial production" fill sizes="100vw" className="object-cover" /><div className="absolute inset-0 bg-[#031226]/90" /><div className="relative mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Build beyond oil</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Join Nigeria&apos;s Industrial Production Network.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">Bring your business, capital, market access or technical capability into a coordinated national ecosystem for production and growth.</p></div><div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Link href={LCDBO_REGISTER_HREF} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-5 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#efc85d]">Register Your Business <ArrowRight className="h-4 w-4" /></Link><Link href="/lcdbo/opportunities" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">Explore Opportunities</Link></div></div></section>
  );
}

function SectionHeading({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) {
  return <div className="max-w-3xl"><p className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-[#efc85d]" : "text-[#008751]"}`}>{eyebrow}</p><h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-[#06172f]"}`}>{title}</h2><p className={`mt-4 text-base leading-7 sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{description}</p></div>;
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return <label className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}<select name={name} defaultValue={value || "all"} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#008751] focus:ring-4 focus:ring-emerald-100"><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
