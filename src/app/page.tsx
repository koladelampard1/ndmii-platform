import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileCheck2,
  Globe2,
  Handshake,
  Landmark,
  Layers3,
  LineChart,
  LockKeyhole,
  Network,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { ProductTabShowcase } from "@/components/public/product-showcase";

export const metadata: Metadata = {
  title: "DBIN | Nigeria’s Digital Business Infrastructure",
  description:
    "DBIN provides trusted digital business identity, verification, operating tools, compliance readiness, marketplace access and institutional intelligence for Nigerian businesses and partners.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "DBIN | Nigeria’s Digital Business Infrastructure",
    description:
      "Trusted digital business identity, verification, operating readiness, marketplace access and institutional intelligence for Nigerian businesses and partners.",
    url: "/",
    siteName: "Digital Business Identity Network",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DBIN | Nigeria’s Digital Business Infrastructure",
    description:
      "Nigeria’s trusted digital infrastructure for business identity, formalisation, compliance readiness, opportunity and enterprise intelligence.",
  },
};

const TRUST_SIGNALS = [
  { label: "Business identity", value: "Live", detail: "Digital profiles and credential-ready business records." },
  { label: "Public verification", value: "Live", detail: "Business and property verification routes for public trust." },
  { label: "Marketplace discovery", value: "Live", detail: "Verified provider discovery and public business profiles." },
  { label: "Programme workspaces", value: "Pilot", detail: "LCDBO, clusters and institutional programme operations." },
];

const PROBLEMS = [
  ["Fragmented business records", "Businesses need trusted records that can travel across markets, programmes and institutions."],
  ["Verification friction", "Customers, buyers and institutions need a safer way to confirm who they are dealing with."],
  ["Informal operating systems", "Many enterprises lack practical tools for records, invoices, receipts and readiness evidence."],
  ["Opportunity mismatch", "Finance, procurement and programme opportunities struggle to reach credible businesses confidently."],
  ["Disconnected intelligence", "Government and partners need better visibility into enterprise needs, readiness and outcomes."],
];

const ECOSYSTEM_LAYERS = [
  { layer: "Business layer", title: "Identity and profile", text: "Structured business records, digital profiles and onboarding context.", href: "/for-msmes", icon: Store },
  { layer: "Trust layer", title: "Verification and credentials", text: "QR-ready credentials and public verification experiences.", href: "/verify", icon: ShieldCheck },
  { layer: "Operations layer", title: "Invoices, receipts and tools", text: "Practical operating records that help businesses become institution-ready.", href: "/resources", icon: ReceiptText },
  { layer: "Compliance layer", title: "Readiness and evidence", text: "Support for compliance posture, tax readiness and regulatory engagement.", href: "/for-government", icon: ClipboardCheck },
  { layer: "Opportunity layer", title: "Markets, procurement and finance", text: "Discovery pathways for buyers, lenders and programme partners.", href: "/marketplace", icon: WalletCards },
  { layer: "Programme layer", title: "LCDBO, clusters and workspaces", text: "Reusable infrastructure for structured programme delivery.", href: "/lcdbo", icon: Factory },
  { layer: "Intelligence layer", title: "Business and impact insight", text: "Designed to support reporting, institutional decisions and programme monitoring.", href: "/partners", icon: BarChart3 },
];

const JOURNEY = [
  "Register",
  "Build Your Profile",
  "Get Verified",
  "Receive Your Credential",
  "Structure Operations",
  "Become Compliance Ready",
  "Access Markets and Programmes",
  "Grow",
];

const CAPABILITIES = [
  {
    title: "Digital Business Identity",
    status: "Live",
    benefit: "Businesses create a structured digital profile that can support trust, discovery and formalisation.",
    institution: "Institutions gain a more reliable business record for onboarding and programme use.",
    icon: BadgeCheck,
  },
  {
    title: "Public Verification and Credentials",
    status: "Live",
    benefit: "Customers and partners can verify approved business credentials through public routes.",
    institution: "Verification reduces friction for procurement, onboarding and trust checks.",
    icon: QrCode,
  },
  {
    title: "Business Operating Tools",
    status: "Available",
    benefit: "Invoices, receipts and support tools help enterprises keep better operating records.",
    institution: "Cleaner records improve readiness for finance, tax, procurement and programmes.",
    icon: ReceiptText,
  },
  {
    title: "Compliance and Tax Readiness",
    status: "Pilot",
    benefit: "Businesses can prepare evidence and improve readiness for regulatory engagement.",
    institution: "Regulators and revenue teams can work from clearer, consent-aware business signals.",
    icon: FileCheck2,
  },
  {
    title: "Marketplace and Procurement",
    status: "Live",
    benefit: "Verified businesses become easier for customers and buyers to discover.",
    institution: "Procurement and buyer teams gain a trust-led discovery layer.",
    icon: Search,
  },
  {
    title: "Finance and Investment Readiness",
    status: "Programme capability",
    benefit: "MSMEs can build the credibility needed for finance and growth support.",
    institution: "Financial partners gain clearer readiness and pipeline signals.",
    icon: Landmark,
  },
  {
    title: "Programme Delivery",
    status: "Pilot",
    benefit: "Businesses can participate in structured national and sector programmes.",
    institution: "Programme teams can manage enrolment, clusters, reviews and reporting.",
    icon: Network,
  },
  {
    title: "Business and Impact Intelligence",
    status: "Programme capability",
    benefit: "Decision-makers can understand readiness, coverage and outcomes more clearly.",
    institution: "Partners can monitor programmes with auditable snapshots and indicators.",
    icon: LineChart,
  },
];

const STAKEHOLDERS = [
  { title: "MSMEs and Entrepreneurs", text: "Register, verify, organise records and become easier to trust.", href: "/for-msmes", cta: "Start your journey", icon: Store },
  { title: "Associations and Cooperatives", text: "Coordinate member onboarding, visibility and readiness support.", href: "/for-associations", cta: "Support members", icon: Users },
  { title: "Government and Regulators", text: "Support formalisation, compliance visibility and programme delivery.", href: "/for-government", cta: "Explore public-sector use", icon: Landmark },
  { title: "Financial Institutions and DFIs", text: "Engage verified MSME pipelines with stronger readiness signals.", href: "/for-financial-institutions", cta: "Partner for finance", icon: WalletCards },
  { title: "Procurement Teams and Buyers", text: "Find providers with public trust signals and verification pathways.", href: "/marketplace", cta: "Find providers", icon: Building2 },
  { title: "Development Partners", text: "Coordinate evidence-led enterprise and impact programmes.", href: "/partners", cta: "Request briefing", icon: Handshake },
  { title: "Investors and Industrial Programmes", text: "Understand cluster, readiness and participation pathways.", href: "/lcdbo/opportunities", cta: "Explore opportunities", icon: Factory },
  { title: "General Public and Consumers", text: "Verify businesses and property credentials before important decisions.", href: "/verify", cta: "Verify now", icon: Globe2 },
];

const PROGRAMMES = [
  { title: "LCDBO", status: "Public programme surface", text: "Local Content Development Beyond Oil workspace for MSME participation, clusters and partner coordination.", href: "/lcdbo" },
  { title: "Industrial Clusters", status: "Programme capability", text: "Cluster participation and production-readiness pathways for coordinated industrial growth.", href: "/lcdbo/clusters" },
  { title: "Revenue Guide model", status: "Readiness resource", text: "A practical pathway for business records, compliance posture and revenue-readiness engagement.", href: "/resources" },
  { title: "Property and Land Intelligence", status: "Public verification surface", text: "Privacy-safe public property search and NPIN verification through the DLPI experience.", href: "/property" },
];

const MARKETPLACE_PROOF = [
  { title: "Verified food processor", location: "Lagos", category: "Food Processing", status: "Verified profile", href: "/marketplace?q=Food%20Processing" },
  { title: "Industrial services provider", location: "FCT", category: "Manufacturing", status: "Credential-ready", href: "/marketplace?q=Manufacturing" },
  { title: "Retail and supply operator", location: "Kano", category: "Retail", status: "Public discovery", href: "/marketplace?q=Retail" },
  { title: "Creative business studio", location: "Rivers", category: "Creative Services", status: "Verified listing", href: "/marketplace?q=Creative" },
];

const PARTNER_TYPES = [
  "Government and public institutions",
  "Financial institutions",
  "Associations and cooperatives",
  "Development partners",
  "Technology and implementation partners",
  "Programme partners",
];

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
      {label}
    </span>
  );
}

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Digital Business Identity Network",
    alternateName: "DBIN",
    url: "https://dbin.ng",
    description:
      "Nigeria’s digital business infrastructure for trusted identity, verification, operating readiness and enterprise intelligence.",
  };

  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Digital Business Identity Network",
    url: "https://dbin.ng",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://dbin.ng/marketplace?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen bg-[#f7faf7] text-slate-950">
      <Navbar />
      <main id="main-content">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }} />

        <section className="relative overflow-hidden bg-[#061711] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.22),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(14,165,233,0.16),transparent_34%),linear-gradient(135deg,#061711_0%,#073824_48%,#020617_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f7faf7] to-transparent" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-24 lg:pt-16">
            <div>
              <p className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-bold tracking-[0.22em] text-emerald-100">
                DIGITAL IDENTITY • FORMALISATION • OPPORTUNITY
              </p>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
                Nigeria’s Trusted Digital Infrastructure for Business Growth
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50/90 sm:text-lg">
                DBIN gives businesses a trusted digital identity, practical operating tools, compliance readiness and access
                to markets, finance and national programmes—while enabling institutions to verify, support and understand the
                businesses they serve.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Register Your Business
                </Link>
                <Link href="/verify" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Verify a Business
                </Link>
                <Link href="#ecosystem" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Explore the DBIN Ecosystem
                </Link>
                <Link href="/partners" className="inline-flex h-12 items-center justify-center rounded-xl border border-emerald-300/40 px-5 text-sm font-bold text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Partner With DBIN
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-emerald-400/10 blur-2xl" />
              <article className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">DBIN ecosystem view</p>
                    <h2 className="mt-1 text-xl font-black">One infrastructure, many trusted journeys</h2>
                  </div>
                  <div className="rounded-2xl bg-white p-3 text-emerald-950">
                    <Layers3 className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Business Identity", BadgeCheck],
                    ["Verification", QrCode],
                    ["Business Operations", ReceiptText],
                    ["Compliance", ClipboardCheck],
                    ["Finance", WalletCards],
                    ["Markets", Store],
                    ["Government Programmes", Landmark],
                    ["Intelligence", BarChart3],
                  ].map(([label, Icon]) => {
                    const VisualIcon = Icon as typeof BadgeCheck;
                    return (
                      <div key={label as string} className="rounded-2xl border border-white/10 bg-emerald-950/35 p-4 transition hover:bg-emerald-950/50">
                        <VisualIcon className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                        <p className="mt-3 text-sm font-bold text-white">{label as string}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 p-4">
                  <p className="text-sm leading-6 text-emerald-50">
                    A business can register once, build credible records, verify publicly, and become more discoverable to
                    buyers, institutions, programmes and partners.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:px-6 md:grid-cols-4">
            {TRUST_SIGNALS.map((signal) => (
              <article key={signal.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black text-slate-950">{signal.label}</h2>
                  <StatusBadge label={signal.value} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{signal.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <ProductTabShowcase />

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">The national problem</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
              Trusted business participation needs more than a directory.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              DBIN connects identity, records, readiness and opportunity so businesses can operate with greater confidence
              and institutions can support them with better context.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {PROBLEMS.map(([title, text], index) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-emerald-700">0{index + 1}</p>
                <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="ecosystem" className="bg-[#edf7f1] py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">The DBIN ecosystem</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
                  Seven connected layers for trusted enterprise growth.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  This is business architecture, not technical jargon: each layer helps businesses become more trusted,
                  more organised and more useful to the institutions that serve them.
                </p>
              </div>
              <div className="grid gap-3">
                {ECOSYSTEM_LAYERS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.layer} href={item.href} className="group grid gap-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg sm:grid-cols-[auto_1fr_auto] sm:items-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{item.layer}</span>
                        <span className="mt-1 block text-lg font-black text-slate-950">{item.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-slate-600">{item.text}</span>
                      </span>
                      <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="rounded-[2rem] bg-[#061711] p-6 text-white shadow-xl sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">MSME growth journey</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.03em] md:text-5xl">
                  From registration to trusted participation.
                </h2>
              </div>
              <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-black text-emerald-950 transition hover:bg-emerald-200">
                Start Your Business Journey
              </Link>
            </div>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((step, index) => (
                <li key={step} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs font-black text-emerald-300">Step {index + 1}</p>
                  <p className="mt-2 text-sm font-bold text-white">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="capabilities" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Core capabilities</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
                Built for businesses and the institutions around them.
              </h2>
            </div>
            <Link href="/about" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-emerald-300">
              Platform overview <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((capability) => {
              const Icon = capability.icon;
              return (
                <article key={capability.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <StatusBadge label={capability.status} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{capability.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{capability.benefit}</p>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{capability.institution}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Who DBIN serves</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
                One platform for the full business ecosystem.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {STAKEHOLDERS.map((stakeholder) => {
                const Icon = stakeholder.icon;
                return (
                  <Link key={stakeholder.title} href={stakeholder.href} className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-lg">
                    <Icon className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-black text-slate-950">{stakeholder.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{stakeholder.text}</p>
                    <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
                      {stakeholder.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1.1fr] lg:p-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Government and institutional infrastructure</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
                Designed to support formalisation, regulation and programme delivery.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                DBIN-powered workspaces can support business formalisation programmes, regulator engagement, revenue
                readiness, verified registries, industrial clusters, impact reporting and public verification.
              </p>
              <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Programme and institutional capabilities are presented as DBIN infrastructure and controlled workspaces;
                this page does not imply formal adoption by any institution unless separately documented.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Formalisation programmes", BookOpenCheck],
                ["Regulator workspaces", ShieldCheck],
                ["Revenue readiness", ReceiptText],
                ["Programme monitoring", BarChart3],
                ["Verified registries", FileCheck2],
                ["Industrial clusters", Factory],
                ["Impact reporting", LineChart],
                ["Public verification", QrCode],
              ].map(([label, Icon]) => {
                const ItemIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={label as string} className="rounded-2xl bg-slate-50 p-4">
                    <ItemIcon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <p className="mt-3 text-sm font-black text-slate-900">{label as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#061711] py-14 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Programmes powered by DBIN</p>
                <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.03em] md:text-5xl">
                  Reusable infrastructure for national and sector programmes.
                </h2>
              </div>
              <Link href="/lcdbo" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
                Explore LCDBO <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {PROGRAMMES.map((programme) => (
                <Link key={programme.title} href={programme.href} className="rounded-3xl border border-white/10 bg-white/10 p-5 transition hover:-translate-y-1 hover:bg-white/15">
                  <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-200">{programme.status}</span>
                  <h3 className="mt-5 text-xl font-black">{programme.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-emerald-50/80">{programme.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Verification and marketplace proof</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
                Public trust, visible without exposing private records.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/marketplace" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800">
                Browse marketplace <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/verify" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-emerald-300">
                Verify credential
              </Link>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {MARKETPLACE_PROOF.map((provider) => (
              <Link key={provider.title} href={provider.href} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="relative h-32 bg-[linear-gradient(135deg,#dcfce7_0%,#f8fafc_52%,#dbeafe_100%)]">
                  <div className="absolute inset-4 rounded-2xl border border-white/70 bg-white/45" />
                  <Factory className="absolute left-5 top-5 h-8 w-8 text-emerald-800" aria-hidden="true" />
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-base font-black text-slate-950">{provider.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{provider.category} • {provider.location}</p>
                  <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{provider.status}</p>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
                    View marketplace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Security, privacy and trust</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-5xl">
                Public verification with controlled data exposure.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                DBIN is designed around role-based access, public/private data separation, auditability and controlled
                credential sharing. Public pages should verify trust without exposing sensitive records.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/privacy" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-950 transition hover:border-emerald-300">Privacy</Link>
                <Link href="/terms" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-950 transition hover:border-emerald-300">Terms</Link>
                <Link href="/cookies" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-950 transition hover:border-emerald-300">Cookies</Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Role-based access", LockKeyhole],
                ["Public/private separation", ShieldCheck],
                ["Consent-aware institutional use", Handshake],
                ["Audit-ready workflows", ClipboardCheck],
                ["Secure verification", QrCode],
                ["Privacy-conscious profiles", Users],
              ].map(([label, Icon]) => {
                const TrustIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <TrustIcon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <p className="mt-3 text-sm font-black text-slate-900">{label as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Partner ecosystem</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] md:text-5xl">
                  Built for serious institutional collaboration.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  DBIN can support public, private and development partners through a common trust layer for business
                  identity, readiness, participation and reporting.
                </p>
                <Link href="/partners" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-black text-emerald-950 transition hover:bg-emerald-200">
                  Partner With DBIN
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PARTNER_TYPES.map((partner) => (
                  <div key={partner} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <Handshake className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-black text-white">{partner}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#008751_0%,#064e3b_54%,#061711_100%)] p-6 text-white shadow-2xl sm:p-8 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Build trust. Expand opportunity. Strengthen the business ecosystem.</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.03em] md:text-5xl">
              Choose the DBIN journey that matches what you need to do today.
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <Link href="/register" className="rounded-2xl bg-white p-5 text-slate-950 transition hover:-translate-y-1 hover:shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">For businesses</p>
                <p className="mt-2 text-xl font-black">Register Your Business</p>
              </Link>
              <Link href="/verify" className="rounded-2xl bg-white/10 p-5 text-white ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/20">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">For the public</p>
                <p className="mt-2 text-xl font-black">Verify a Business</p>
              </Link>
              <Link href="/partners" className="rounded-2xl bg-white/10 p-5 text-white ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/20">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">For institutions</p>
                <p className="mt-2 text-xl font-black">Partner With DBIN</p>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
