import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  FileCheck2,
  Landmark,
  Network,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { NationalRevenueMap } from "@/components/nrs/national-revenue-map";
import { nrsWorkspaceDisclosure } from "@/lib/nrs/access";
import type { NrsBusinessSummary, NrsFilters, NrsFormalisationWorkspace, NrsSection } from "@/lib/data/nrs-formalisation";
import { paginateNrsItems } from "@/lib/data/nrs-formalisation";

const SECTION_COPY: Record<NrsSection, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "Executive dashboard",
    title: "National Formalisation & Readiness Workspace",
    description: "Identify, activate, formalise, educate and support businesses entering the formal economy through DBIN readiness infrastructure.",
  },
  businesses: {
    eyebrow: "Business registry",
    title: "Privacy-safe Business Registry",
    description: "Business identity, activation, verification, TIN linkage, readiness and support priorities without invoice or transaction visibility.",
  },
  readiness: {
    eyebrow: "Formalisation readiness",
    title: "Business & Tax Readiness",
    description: "Tax readiness is one dimension of a wider enablement journey covering identity, documentation, digital adoption and partner-system preparedness.",
  },
  intelligence: {
    eyebrow: "National intelligence",
    title: "Aggregate Business Intelligence",
    description: "State, LGA, sector, activation and readiness trends for support planning. No turnover or liability estimates are shown.",
  },
  "revenue-guides": {
    eyebrow: "Enablement operations",
    title: "Revenue Guide Operations",
    description: "Revenue Guides support education, activation, TIN linkage, digital adoption and formalisation follow-up. They are not enforcement officers.",
  },
  programmes: {
    eyebrow: "Programmes and enablement",
    title: "Formalisation Programmes",
    description: "Campaigns and support programmes for TIN activation, tax education, business structuring, digital enablement and partner referrals.",
  },
  reports: {
    eyebrow: "Reports and analytics",
    title: "Formalisation Reports",
    description: "Executive reporting focused on business formalisation, readiness, guide coverage, programme performance and support gaps.",
  },
  verification: {
    eyebrow: "Verification",
    title: "Business Verification",
    description: "Verify BIN, business identity, registration posture, TIN linkage status, sector, location and consented partner-linkage state.",
  },
  integrations: {
    eyebrow: "Partner-system boundary",
    title: "Integrations",
    description: "DBIN orchestrates identity, readiness, consent and referrals. Partner systems own statutory invoicing, filing, remittance and enforcement.",
  },
};

function humanize(value: string | null | undefined) {
  return String(value ?? "Unavailable").replace(/[_-]/g, " ");
}

function statusTone(value: string | null | undefined) {
  const normalised = String(value ?? "").toLowerCase();
  if (["verified", "linked", "ready", "activated", "formalised", "active"].some((item) => normalised.includes(item))) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["pending", "support", "required", "configuration"].some((item) => normalised.includes(item))) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tone ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>{children}</span>;
}

export function NrsWorkspacePage({ workspace, section }: { workspace: NrsFormalisationWorkspace; section: NrsSection }) {
  return (
    <section className="space-y-6">
      <Hero section={section} />
      {section === "dashboard" && <Dashboard workspace={workspace} />}
      {section === "businesses" && <BusinessRegistry workspace={workspace} />}
      {section === "readiness" && <Readiness workspace={workspace} />}
      {section === "intelligence" && <Intelligence workspace={workspace} />}
      {section === "revenue-guides" && <RevenueGuides workspace={workspace} />}
      {section === "programmes" && <Programmes workspace={workspace} />}
      {section === "reports" && <Reports workspace={workspace} />}
      {section === "verification" && <Verification workspace={workspace} />}
      {section === "integrations" && <Integrations workspace={workspace} />}
    </section>
  );
}

function Hero({ section }: { section: NrsSection }) {
  const copy = SECTION_COPY[section];
  return (
    <header className="rounded-3xl border bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 text-white shadow-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Nigeria Revenue Service • DBIN Formalisation Layer</p>
      <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">{copy.title}</h1>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-emerald-50/90">{copy.description}</p>
      <p className="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-emerald-50">{nrsWorkspaceDisclosure()}</p>
    </header>
  );
}

function Dashboard({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return (
    <>
      <KpiGrid workspace={workspace} />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Executive insights" eyebrow="What requires attention" icon={<Network className="h-5 w-5" />}>
          <InsightList rows={[
            `${workspace.topStates[0]?.label ?? "Priority states"} show the strongest formalisation activity in the current records.`,
            `${workspace.topSectors[0]?.label ?? "Priority sectors"} represent the strongest sector concentration.`,
            `${workspace.businesses.filter((item) => item.tinStatus === "pending").length.toLocaleString("en-NG")} businesses require TIN linkage support.`,
            `${workspace.businesses.filter((item) => item.nextAction !== "Maintain partner-system readiness").length.toLocaleString("en-NG")} businesses require enablement follow-up.`,
          ]} />
        </Panel>
        <Panel title="Product boundary" eyebrow="Purpose limitation" icon={<ShieldCheck className="h-5 w-5" />}>
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>DBIN shows business identity, readiness, consent, guide operations and aggregate intelligence.</p>
            <p>Digitax and approved e-invoicing partners own statutory invoice exchange and transaction reporting.</p>
            <p>NRS core systems own filing, assessment, liability, remittance and enforcement.</p>
          </div>
        </Panel>
      </div>
      <NationalRevenueMap states={workspace.stateMetrics} />
      <BusinessTable businesses={workspace.businesses.slice(0, 8)} compact />
    </>
  );
}

function KpiGrid({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {workspace.kpis.map((kpi) => (
        <article key={kpi.label} className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{kpi.value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{kpi.detail}</p>
        </article>
      ))}
    </div>
  );
}

function BusinessRegistry({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  const page = paginateNrsItems(workspace.filteredBusinesses, workspace.filters.page, 12);
  return (
    <>
      <FilterBar filters={workspace.filters} businesses={workspace.businesses} />
      <BusinessTable businesses={page.items} />
      <Pagination filters={workspace.filters} {...page} />
    </>
  );
}

function FilterBar({ filters, businesses }: { filters: NrsFilters; businesses: NrsBusinessSummary[] }) {
  const states = [...new Set(businesses.map((item) => item.state).filter((item) => item !== "Unavailable"))].sort();
  const sectors = [...new Set(businesses.map((item) => item.sector).filter((item) => item !== "Unavailable"))].sort();
  const stages = [...new Set(businesses.map((item) => item.formalisationStage))].sort();
  const readiness = [...new Set(businesses.map((item) => item.readinessStatus))].sort();
  return (
    <form className="grid gap-3 rounded-3xl border bg-white p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input name="q" defaultValue={filters.q} placeholder="Search business, BIN, state or sector" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-300 focus:bg-white" />
      </label>
      <Select name="state" value={filters.state} options={states} placeholder="All states" />
      <Select name="sector" value={filters.sector} options={sectors} placeholder="All sectors" />
      <Select name="stage" value={filters.stage} options={stages} placeholder="Stage" />
      <Select name="readiness" value={filters.readiness} options={readiness} placeholder="Readiness" />
      <button className="h-10 rounded-xl bg-emerald-800 px-4 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-emerald-900">Apply</button>
    </form>
  );
}

function Select({ name, value, options, placeholder }: { name: string; value?: string; options: string[]; placeholder: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:bg-white">
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function BusinessTable({ businesses, compact = false }: { businesses: NrsBusinessSummary[]; compact?: boolean }) {
  return (
    <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Business Registry</p>
          <h2 className="text-base font-black text-slate-950">Formalisation and readiness records</h2>
        </div>
        <Building2 className="h-5 w-5 text-slate-400" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
            <tr><th className="px-5 py-3">Business</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">TIN</th><th className="px-5 py-3">Stage</th>{!compact && <th className="px-5 py-3">Next action</th>}<th className="px-5 py-3">Profile</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {businesses.length === 0 && <tr><td colSpan={compact ? 5 : 6} className="px-5 py-10 text-center text-slate-500">No businesses match the selected filters.</td></tr>}
            {businesses.map((business) => (
              <tr key={business.internalId} className="align-top">
                <td className="px-5 py-4"><p className="font-black text-slate-950">{business.businessName}</p><p className="mt-1 text-xs text-slate-500">BIN: {business.bin}</p><Badge tone={statusTone(business.verificationStatus)}>{humanize(business.verificationStatus)}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{business.state}<p className="text-xs text-slate-500">{business.lga} · {business.sector}</p></td>
                <td className="px-5 py-4"><Badge tone={statusTone(business.tinStatus)}>{business.tinStatus}</Badge></td>
                <td className="px-5 py-4"><Badge tone={statusTone(business.readinessStatus)}>{business.formalisationStage}</Badge><p className="mt-1 text-xs text-slate-500">{business.readinessStatus}</p></td>
                {!compact && <td className="px-5 py-4 text-slate-600">{business.nextAction}</td>}
                <td className="px-5 py-4"><Link href={`/dashboard/nrs/businesses/${encodeURIComponent(business.bin)}`} className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-900">Open profile <ArrowRight className="h-3 w-3" /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Pagination({ filters, page, pageCount, total, from, to }: { filters: NrsFilters; page: number; pageCount: number; total: number; from: number; to: number }) {
  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value && key !== "page") params.set(key, value);
    params.set("page", String(targetPage));
    return `/dashboard/nrs/businesses?${params.toString()}`;
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <Link href={hrefFor(Math.max(1, page - 1))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Previous</Link>
        <span className="text-xs font-bold text-slate-500">Page {page} of {pageCount}</span>
        <Link href={hrefFor(Math.min(pageCount, page + 1))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${page >= pageCount ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Next</Link>
      </div>
    </div>
  );
}

function Readiness({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Readiness distribution" eyebrow="Business readiness" icon={<BadgeCheck className="h-5 w-5" />}><Ranked rows={workspace.readinessDistribution} /></Panel>
      <Panel title="Businesses requiring support" eyebrow="Next-best intervention" icon={<UsersRound className="h-5 w-5" />}>
        <div className="space-y-3">{workspace.businesses.filter((item) => item.nextAction !== "Maintain partner-system readiness").slice(0, 10).map((item) => <SummaryRow key={item.internalId} title={item.businessName} meta={`${item.nextAction} · ${item.state}`} />)}</div>
      </Panel>
    </div>
  );
}

function Intelligence({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return <div className="space-y-4"><NationalRevenueMap states={workspace.stateMetrics} /><div className="grid gap-4 md:grid-cols-2"><Panel title="Top states" eyebrow="Formalisation activity" icon={<Landmark className="h-5 w-5" />}><Ranked rows={workspace.topStates} /></Panel><Panel title="Top sectors" eyebrow="Business density" icon={<Building2 className="h-5 w-5" />}><Ranked rows={workspace.topSectors} /></Panel></div></div>;
}

function RevenueGuides({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return <Panel title="Guide coverage by state/LGA" eyebrow="Education and enablement" icon={<UsersRound className="h-5 w-5" />}><Ranked rows={workspace.guideCoverage} /></Panel>;
}

function Programmes({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{workspace.programmes.length === 0 ? <Empty text="No formalisation programmes are currently configured." /> : workspace.programmes.map((programme) => <article key={programme.id} className="rounded-3xl border bg-white p-5 shadow-sm"><BookOpenCheck className="h-6 w-6 text-emerald-700" /><h2 className="mt-4 text-lg font-black text-slate-950">{programme.name}</h2><p className="mt-2 text-sm text-slate-500">{programme.targetSectors.length ? programme.targetSectors.join(", ") : "All eligible sectors"}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(programme.status)}>{programme.status}</Badge><Badge>{programme.enrolledBusinesses.toLocaleString("en-NG")} businesses in wider registry</Badge></div></article>)}</div>;
}

function Reports({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return <div className="grid gap-4 md:grid-cols-2">{workspace.reports.map((report) => <article key={report.title} className="rounded-3xl border bg-white p-5 shadow-sm"><FileCheck2 className="h-6 w-6 text-emerald-700" /><h2 className="mt-4 text-lg font-black text-slate-950">{report.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{report.description}</p><Badge>{report.scope}</Badge></article>)}</div>;
}

function Verification({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]"><Panel title="Verification coverage" eyebrow="Business identity" icon={<ShieldCheck className="h-5 w-5" />}><InsightList rows={["BIN verification", "Business identity status", "TIN linkage status", "CAC linkage status where available", "Consented partner-linkage status"]} /></Panel><BusinessTable businesses={workspace.businesses.filter((item) => item.verificationStatus !== "verified" || item.tinStatus === "pending").slice(0, 8)} compact /></div>;
}

function Integrations({ workspace }: { workspace: NrsFormalisationWorkspace }) {
  return <div className="grid gap-4 md:grid-cols-2">{workspace.integrations.map((integration) => <article key={integration.name} className="rounded-3xl border bg-white p-5 shadow-sm"><Network className="h-6 w-6 text-emerald-700" /><h2 className="mt-4 text-lg font-black text-slate-950">{integration.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{integration.purpose}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(integration.status)}>{integration.status}</Badge><Badge>{integration.consent}</Badge></div><p className="mt-3 text-xs text-slate-500">Data categories: {integration.categories.join(", ")}</p></article>)}</div>;
}

export function NrsBusinessProfile({ business }: { business: NrsBusinessSummary | null }) {
  if (!business) return <Empty text="Business formalisation profile not found." />;
  const stages = ["Registered", "BIN Issued", "Identity Verified", "TIN Linked", "Tax Ready", "Growth Supported"];
  const currentIndex = Math.max(0, stages.indexOf(business.formalisationStage));
  return (
    <section className="space-y-5">
      <Link href="/dashboard/nrs/businesses" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><ArrowLeft className="h-4 w-4" /> Back to Business Registry</Link>
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Business Formalisation Profile</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{business.businessName}</h1>
        <p className="mt-2 text-sm text-slate-600">BIN {business.bin} · {business.state}{business.lga !== "Unavailable" ? ` / ${business.lga}` : ""} · {business.sector}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Info label="Verification" value={humanize(business.verificationStatus)} />
          <Info label="TIN linkage" value={business.tinStatus} />
          <Info label="Activation" value={business.activationStatus} />
          <Info label="Readiness" value={business.readinessStatus} />
          <Info label="Next action" value={business.nextAction} />
        </div>
      </header>
      <Panel title="Formalisation journey" eyebrow="Progress" icon={<BadgeCheck className="h-5 w-5" />}>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{stages.map((stage, index) => <div key={stage} className={`rounded-2xl border p-3 ${index <= currentIndex ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><p className="text-sm font-black text-slate-950">{stage}</p><p className="mt-1 text-xs text-slate-500">{index <= currentIndex ? "Complete or current" : "Future"}</p></div>)}</div>
      </Panel>
      <Panel title="Partner-system connection status" eyebrow="Interoperability" icon={<Network className="h-5 w-5" />}>
        <InsightList rows={["Taxpayer-service referral: available after consent", "E-invoicing partner connection: status only", "Official filing and remittance: handled by NRS core systems", "Business operations records remain owned by the business"]} />
      </Panel>
    </section>
  );
}

function Panel({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: ReactNode; children: ReactNode }) {
  return <article className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">{icon}</span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2></div></div><div className="mt-4">{children}</div></article>;
}

function Ranked({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return <div className="space-y-2">{rows.length === 0 ? <p className="text-sm text-slate-500">Available as formalisation records grow.</p> : rows.map((row) => <SummaryRow key={row.label} title={row.label} meta={`${row.value.toLocaleString("en-NG")} businesses`} />)}</div>;
}

function InsightList({ rows }: { rows: string[] }) {
  return <div className="space-y-3">{rows.map((row) => <p key={row} className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-950">{row}</p>)}</div>;
}

function SummaryRow({ title, meta }: { title: string; meta: string }) {
  return <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="font-bold text-slate-950">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-base font-semibold capitalize text-slate-950">{value}</p></div>;
}
