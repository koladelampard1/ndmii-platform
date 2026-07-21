import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Fingerprint,
  Handshake,
  Landmark,
  LockKeyhole,
  Network,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { Button } from "@/components/ui/button";

const nrsLoginHref = "/login?workspace=nrs&next=/dashboard/nrs";

export const metadata: Metadata = {
  title: "Nigeria Revenue Service Business Formalisation Platform | DBIN",
  description:
    "A DBIN-powered platform supporting business identification, activation, formalisation, taxpayer education, readiness, Revenue Guide operations and privacy-safe national enterprise intelligence.",
  alternates: {
    canonical: "https://nrs.dbin.ng/",
  },
  openGraph: {
    title: "Nigeria Revenue Service Business Formalisation Platform | DBIN",
    description:
      "Identity, activation, readiness and education infrastructure for business formalisation.",
    url: "https://nrs.dbin.ng/",
    siteName: "Nigeria Revenue Service Business Formalisation Platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nigeria Revenue Service Business Formalisation Platform | DBIN",
    description:
      "Formalising businesses, expanding participation and supporting privacy-safe enterprise intelligence.",
  },
};

const trustSignals = [
  { label: "Privacy-first architecture", icon: ShieldCheck },
  { label: "Identity-led formalisation", icon: Fingerprint },
  { label: "Aggregate national intelligence", icon: Network },
  { label: "No private revenue surveillance", icon: LockKeyhole },
  { label: "Connects to approved systems", icon: Handshake },
];

const valueFlow = [
  { title: "Problem", body: "Fragmented identity, registration and readiness records limit outreach and support." },
  { title: "Formalisation", body: "Businesses become visible, structured and easier to support." },
  { title: "Readiness", body: "Documentation, TIN linkage and digital enablement gaps are surfaced." },
  { title: "Participation", body: "Enterprises can connect to education, finance, programmes and partners." },
  { title: "Growth", body: "Better support improves conversion, resilience and institutional visibility." },
];

const journey = [
  "Identified",
  "Registered",
  "Activated",
  "BIN Issued",
  "Identity Verified",
  "TIN Linked",
  "Digitally Enabled",
  "Tax Educated",
  "Tax Ready",
  "Finance Ready",
  "Growth Supported",
];

const guideModel = [
  "Discover",
  "Register",
  "Verify",
  "Link TIN",
  "Educate",
  "Digitally Enable",
  "Refer",
  "Follow Up",
];

const guideOutcomes = [
  "More businesses activated",
  "Fewer documentation gaps",
  "Improved taxpayer education",
  "Stronger state and LGA coverage",
];

const ecosystemLayers = [
  {
    title: "Businesses",
    items: ["Informal enterprises", "MSMEs", "Associations", "Industrial clusters"],
    icon: Building2,
  },
  {
    title: "DBIN Formalisation Layer",
    items: ["Business identity", "Activation", "Verification", "Readiness", "Revenue Guides", "Education", "Consent and referrals", "Aggregate intelligence"],
    icon: Fingerprint,
  },
  {
    title: "Approved Government and Partner Systems",
    items: ["NRS taxpayer services", "Approved e-invoicing systems", "CAC", "SMEDAN", "BOI", "FCCPC", "Banks", "State revenue services"],
    icon: Landmark,
  },
  {
    title: "Statutory and Institutional Outcomes",
    items: ["Taxpayer account activation", "E-invoicing", "Filing", "Assessment", "Finance", "Procurement", "Programme participation"],
    icon: BadgeCheck,
  },
];

const shows = ["Business identity", "Formalisation status", "Readiness indicators", "Programme activity", "Partner connection status", "Aggregate intelligence"];
const doesNotShow = ["Private invoices", "Customer-level transactions", "Business revenue", "Bank transactions", "Unofficial tax liabilities", "Private payment histories"];

const capabilities = [
  ["Business Registry", "See verified enterprise records and formalisation context."],
  ["Formalisation & Readiness", "Track documentation, activation and TIN-linkage readiness."],
  ["Revenue Guides", "Coordinate outreach, education and enterprise follow-up."],
  ["National Intelligence", "Understand aggregate sector and geography patterns."],
  ["Programmes & Enablement", "Connect businesses to relevant support pathways."],
  ["Verification", "Confirm business identity through trusted DBIN records."],
  ["Integrations", "Prepare clean referrals to approved systems of record."],
  ["Executive Reports", "Support leadership decisions with concise institutional views."],
];

const partnerGroups = [
  "Federal institutions",
  "State governments",
  "Revenue services",
  "Business associations",
  "Financial institutions",
  "E-invoicing partners",
  "Development partners",
  "Industrial programmes",
];

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{children}</p>;
}

export default function NrsPublicLandingPage() {
  return (
    <main className="min-h-screen bg-[#f7faf4] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/95 supports-[backdrop-filter]:bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/nrs" className="flex items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="inline-flex h-11 w-14 items-center justify-center rounded-xl bg-emerald-950 text-sm font-black tracking-[0.18em] text-white shadow-sm">
              NRS
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-black text-slate-950">Business Formalisation Platform</span>
              <span className="block text-xs font-semibold text-slate-500">Powered by DBIN</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-700 lg:flex">
            <a href="#overview" className="transition hover:text-emerald-800">Overview</a>
            <a href="#formalisation" className="transition hover:text-emerald-800">Formalisation</a>
            <a href="#guides" className="transition hover:text-emerald-800">Revenue Guides</a>
            <a href="#ecosystem" className="transition hover:text-emerald-800">Platform</a>
            <a href="#partnerships" className="transition hover:text-emerald-800">Partnerships</a>
            <Link href="/verify" className="transition hover:text-emerald-800">Verification</Link>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <DbinBrandLogo showText={false} iconClassName="h-9 w-12 rounded-lg" />
            <Link href={nrsLoginHref}>
              <Button className="bg-emerald-800 text-white hover:bg-emerald-900">Access Authorized Portal</Button>
            </Link>
          </div>

          <details className="group relative lg:hidden">
            <summary className="list-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              Menu
            </summary>
            <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              {[
                ["Overview", "#overview"],
                ["Formalisation", "#formalisation"],
                ["Revenue Guides", "#guides"],
                ["Platform", "#ecosystem"],
                ["Partnerships", "#partnerships"],
                ["Verification", "/verify"],
              ].map(([label, href]) => (
                <Link key={label} href={href} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900">
                  {label}
                </Link>
              ))}
              <Link href={nrsLoginHref} className="mt-2 block rounded-xl bg-emerald-800 px-3 py-2 text-center text-sm font-bold text-white">
                Access Authorized Portal
              </Link>
            </div>
          </details>
        </div>
      </header>

      <section id="overview" className="relative overflow-hidden bg-emerald-950 text-white">
        <div className="absolute inset-0">
          <Image
            src="/images/lcdbo/nigerian-msme-workshop-production.jpg"
            alt="Nigerian enterprise team preparing goods in a production workspace"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-900/35" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-emerald-200/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
              Nigeria Revenue Service · Business Formalisation Platform
            </p>
            <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              Formalising businesses. Expanding participation. Building a stronger economy.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50/90 sm:text-lg">
              DBIN provides the identity, activation, readiness, education and support infrastructure that helps informal enterprises become visible, structured and ready to participate in the formal economy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={nrsLoginHref}>
                <Button className="h-11 w-full bg-white px-5 text-emerald-950 hover:bg-emerald-50 sm:w-auto">
                  Access Authorized Portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#ecosystem">
                <Button variant="secondary" className="h-11 w-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 sm:w-auto">
                  Explore the Formalisation Platform
                </Button>
              </a>
              <Link href="/register">
                <Button variant="secondary" className="h-11 w-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 sm:w-auto">
                  Register a Business
                </Button>
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-emerald-950/30" aria-label="NRS and DBIN platform summary">
            <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Institutional lockup</p>
                  <h2 className="mt-2 text-2xl font-black">Nigeria Revenue Service</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Business Formalisation & Readiness Platform</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">Powered by DBIN</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {["Business identity", "Readiness indicators", "Revenue Guide activity", "Aggregate intelligence"].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <p className="mt-3 text-sm font-bold text-slate-900">{item}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-2xl bg-emerald-950 p-4 text-xs font-semibold leading-5 text-emerald-50">
                DBIN prepares and connects businesses. Authorized tax and e-invoicing systems remain the systems of record for statutory transactions.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-label="NRS trust signals">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {trustSignals.map(({ label, icon: Icon }) => (
            <div key={label} className="flex min-h-20 items-center gap-3 rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-sm">
              <Icon className="h-5 w-5 shrink-0 text-emerald-800" />
              <p className="text-sm font-black text-slate-800">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <SectionLabel>Why this platform exists</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A practical pathway from informal activity to structured participation.</h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {valueFlow.map((item, index) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <span className="text-sm font-black text-emerald-700">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="formalisation" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <SectionLabel>Formalisation journey</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Formalisation is a supported journey, not a single registration event.</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-600">Each stage helps businesses become more visible, credible and ready for support.</p>
        </div>
        <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-11" aria-label="Business formalisation journey stages">
          {journey.map((step, index) => (
            <li key={step} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:min-h-32">
              <span className="text-xs font-black text-emerald-700">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-sm font-black leading-5 text-slate-950">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="guides" className="bg-emerald-950 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Revenue Guide model</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Trusted field support for activation and education.</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/85">
              Revenue Guides support businesses through discovery, documentation, TIN readiness, taxpayer education and follow-up. They are not enforcement or collection officers.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {guideOutcomes.map((outcome) => (
                <p key={outcome} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-emerald-50">{outcome}</p>
              ))}
            </div>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Revenue Guide operating model">
            {guideModel.map((step, index) => (
              <li key={step} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <UsersRound className="h-5 w-5 text-emerald-200" />
                <p className="mt-4 text-xs font-black text-emerald-200">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 text-base font-black">{step}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ecosystem" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <SectionLabel>Revenue ecosystem</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">How DBIN fits into the revenue ecosystem.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            DBIN prepares and connects businesses. Authorized tax and e-invoicing systems remain the systems of record for statutory transactions.
          </p>
        </div>
        <div className="mt-9 grid gap-4 lg:grid-cols-4" role="list" aria-label="Revenue ecosystem architecture">
          {ecosystemLayers.map(({ title, items, icon: Icon }, index) => (
            <article key={title} className="relative rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm" role="listitem">
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-7 w-7 rounded-xl bg-emerald-50 p-1.5 text-emerald-800" />
                <span className="text-xs font-black text-slate-400">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
              <ul className="mt-4 space-y-2 text-sm leading-5 text-slate-600">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <SectionLabel>Privacy boundary</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Formalisation without financial surveillance.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The NRS workspace is designed for identity, readiness and support coordination—not private transaction monitoring.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="text-lg font-black text-emerald-950">DBIN shows</h3>
              <ul className="mt-4 space-y-2 text-sm font-semibold text-emerald-900">
                {shows.map((item) => <li key={item}>✓ {item}</li>)}
              </ul>
            </article>
            <article className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-black text-slate-950">DBIN does not show</h3>
              <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
                {doesNotShow.map((item) => <li key={item}>— {item}</li>)}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <SectionLabel>Platform capabilities</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Core services for formalisation operations.</h2>
        </div>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-950/10">
              <h3 className="text-base font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="partnerships" className="bg-[#edf7ef]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <SectionLabel>Partnership model</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Built for shared formalisation campaigns.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              DBIN supports onboarding, referrals, education, readiness tracking, privacy-safe reporting and partner-system connectivity.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact">
                <Button className="h-11 w-full bg-emerald-800 px-5 text-white hover:bg-emerald-900 sm:w-auto">Request Institutional Engagement</Button>
              </Link>
              <Link href="/verify">
                <Button variant="secondary" className="h-11 w-full px-5 sm:w-auto">Verify a Business</Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {partnerGroups.map((group) => (
              <div key={group} className="rounded-2xl border border-emerald-950/10 bg-white px-4 py-4 text-sm font-black text-slate-800 shadow-sm">
                {group}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Authorized workspace</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Proceed securely into the NRS workspace.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Authorized users can access business registry signals, formalisation readiness, Revenue Guide operations, reports and integrations.
            </p>
          </div>
          <div className="grid content-start gap-3">
            <Link href={nrsLoginHref}>
              <Button className="h-11 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Access Authorized Portal</Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" className="h-11 w-full border-white/15 bg-white/10 text-white hover:bg-white/20">Register a Business</Button>
            </Link>
            <Link href="/contact">
              <Button variant="secondary" className="h-11 w-full border-white/15 bg-white/10 text-white hover:bg-white/20">Partner with the Programme</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1fr_1.4fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-12 items-center justify-center rounded-xl bg-emerald-950 text-xs font-black tracking-[0.18em] text-white">NRS</span>
              <div>
                <p className="text-sm font-black text-slate-950">Nigeria Revenue Service Formalisation Platform</p>
                <p className="text-xs font-semibold text-slate-500">Powered by DBIN</p>
              </div>
            </div>
          </div>
          <nav className="grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-3" aria-label="NRS footer navigation">
            <a href="#overview" className="hover:text-emerald-800">Overview</a>
            <a href="#formalisation" className="hover:text-emerald-800">Formalisation</a>
            <a href="#guides" className="hover:text-emerald-800">Revenue Guides</a>
            <Link href="/verify" className="hover:text-emerald-800">Verification</Link>
            <a href="#partnerships" className="hover:text-emerald-800">Partnerships</a>
            <Link href="/privacy" className="hover:text-emerald-800">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-800">Terms</Link>
            <Link href={nrsLoginHref} className="hover:text-emerald-800">Authorized Portal</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
