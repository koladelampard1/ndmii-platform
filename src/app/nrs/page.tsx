import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
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
  title: "NRS Business Formalisation & Readiness | DBIN",
  description:
    "A DBIN-powered institutional platform supporting business identification, activation, formalisation, taxpayer education, readiness and national enterprise intelligence.",
  alternates: {
    canonical: "https://nrs.dbin.ng/",
  },
  openGraph: {
    title: "NRS Business Formalisation & Readiness | DBIN",
    description:
      "Business identity, activation, readiness, education and support infrastructure for enterprise formalisation.",
    url: "https://nrs.dbin.ng/",
    siteName: "DBIN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NRS Business Formalisation & Readiness | DBIN",
    description:
      "Formalising businesses, expanding participation, and supporting privacy-safe enterprise intelligence.",
  },
};

const valuePillars = [
  { label: "Identify", description: "Recognise enterprises through trusted DBIN business identity.", icon: Fingerprint },
  { label: "Activate", description: "Move businesses from records into guided participation journeys.", icon: BadgeCheck },
  { label: "Formalise", description: "Support readiness for registration, documentation and TIN linkage.", icon: FileCheck2 },
  { label: "Educate", description: "Equip enterprises through Revenue Guide support and clear obligations.", icon: BookOpenCheck },
  { label: "Support", description: "Connect businesses to programmes, verification and partner services.", icon: Handshake },
];

const journey = [
  "Business Identified",
  "Registered",
  "BIN Issued",
  "Identity Verified",
  "TIN Linked",
  "Digitally Enabled",
  "Tax Ready",
  "Growth Supported",
];

const capabilities = [
  { title: "Business Registry", body: "A privacy-safe view of verified enterprise records and readiness context." },
  { title: "Formalisation & Readiness", body: "Structured signals for registration, documentation and digital activation." },
  { title: "Revenue Guides", body: "Operating support for outreach, education, follow-up and business assistance." },
  { title: "National Intelligence", body: "Aggregate insight across sectors, geography and participation journeys." },
  { title: "Programmes & Enablement", body: "Coordinate business support without turning DBIN into a tax filing system." },
  { title: "Verification", body: "Let institutions and partners confirm business identity securely." },
  { title: "Integrations", body: "Prepare clean handoffs to approved systems of record and partner platforms." },
  { title: "Executive Reports", body: "Institutional views for leadership briefings and operational decisions." },
];

const guideModel = [
  "Community outreach",
  "Registration support",
  "Identity and documentation support",
  "TIN readiness",
  "Taxpayer education",
  "Digital enablement",
  "Ongoing follow-up",
];

const boundaries = [
  "Minimum necessary data",
  "No private invoice visibility",
  "No revenue surveillance",
  "Aggregate intelligence",
  "Tax-specific systems remain systems of record",
];

const ecosystem = [
  "Nigeria Revenue Service",
  "Corporate Affairs Commission",
  "Approved e-invoicing partners",
  "SMEDAN",
  "Bank of Industry",
  "FCCPC",
  "State Governments",
  "Associations",
  "Banks and Development Partners",
];

export default function NrsPublicLandingPage() {
  return (
    <main className="min-h-screen bg-[#f7faf7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/nrs" className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <DbinBrandLogo textClassName="text-slate-950" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 lg:flex">
            <a href="#overview" className="transition hover:text-emerald-800">Overview</a>
            <a href="#formalisation" className="transition hover:text-emerald-800">Formalisation</a>
            <a href="#guides" className="transition hover:text-emerald-800">Revenue Guides</a>
            <a href="#platform" className="transition hover:text-emerald-800">Platform</a>
            <a href="#partnerships" className="transition hover:text-emerald-800">Partnerships</a>
            <Link href="/verify" className="transition hover:text-emerald-800">Verification</Link>
          </nav>
          <Link href={nrsLoginHref}>
            <Button className="bg-emerald-800 text-white hover:bg-emerald-900">Sign in</Button>
          </Link>
        </div>
      </header>

      <section id="overview" className="relative overflow-hidden bg-emerald-950 text-white">
        <div className="absolute inset-0">
          <Image
            src="/images/lcdbo/nigerian-msme-workshop-production.jpg"
            alt="Nigerian enterprise production team in a workshop"
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-900/55" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-emerald-300/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100">
              NRS Formalisation Experience
            </p>
            <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              Formalising businesses. Expanding participation. Building a stronger economy.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50/90 sm:text-lg">
              DBIN provides the business identity, activation, readiness, education and support infrastructure that helps informal enterprises enter and participate confidently in the formal economy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={nrsLoginHref}>
                <Button className="h-11 w-full bg-white px-5 text-emerald-950 hover:bg-emerald-50 sm:w-auto">
                  Continue to Authorized Portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#platform">
                <Button variant="secondary" className="h-11 w-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 sm:w-auto">
                  Explore the Formalisation Platform
                </Button>
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-emerald-950/30">
            <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Workspace readiness</p>
                  <h2 className="mt-1 text-xl font-bold">Enterprise formalisation view</h2>
                </div>
                <ShieldCheck className="h-9 w-9 rounded-xl bg-emerald-50 p-2 text-emerald-800" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {["Identity verified", "TIN readiness", "Guide follow-up", "Programme referral"].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-emerald-950 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Institutional boundary</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50">
                  DBIN supports business readiness and participation. Official filing, assessment and remittance remain in authorised revenue systems.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-label="National value proposition">
        <div className="grid gap-3 md:grid-cols-5">
          {valuePillars.map(({ label, description, icon: Icon }) => (
            <article key={label} className="group rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10">
              <Icon className="h-6 w-6 text-emerald-800" />
              <h2 className="mt-4 text-lg font-bold text-slate-950">{label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="formalisation" className="border-y border-emerald-950/10 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Formalisation journey</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">From business identity to confident participation.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              A clear operating path for enterprises, field teams and institutional partners—without positioning DBIN as a tax filing or enforcement system.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {journey.map((step, index) => (
              <article key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-black text-emerald-800">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-base font-bold text-slate-950">{step}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Platform capabilities</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Built for formalisation operations and executive clarity.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The NRS workspace gives authorised teams a structured view of enterprise identity, readiness, guide activity, verification and aggregate intelligence.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((capability) => (
              <article key={capability.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-lg">
                <h3 className="text-base font-bold text-slate-950">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{capability.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="guides" className="bg-emerald-950 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Revenue Guide operating model</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Field support with institutional guardrails.</h2>
            <p className="mt-4 text-base leading-7 text-emerald-50/85">
              Revenue Guides can support education, activation and follow-up while statutory tax systems remain the authority for assessment, filing and payment.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {guideModel.map((item) => (
              <div key={item} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <UsersRound className="h-5 w-5 text-emerald-200" />
                <p className="mt-3 text-sm font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-8">
            <LockKeyhole className="h-9 w-9 rounded-2xl bg-emerald-50 p-2 text-emerald-800" />
            <h2 className="mt-5 text-2xl font-black text-slate-950">Privacy and institutional boundaries</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The NRS experience is designed around formalisation support, not private transaction monitoring or enforcement workflows.
            </p>
            <div className="mt-6 grid gap-3">
              {boundaries.map((item) => (
                <p key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  {item}
                </p>
              ))}
            </div>
          </article>
          <article id="partnerships" className="rounded-[2rem] border border-emerald-950/10 bg-[#edf7ef] p-6 shadow-sm sm:p-8">
            <Network className="h-9 w-9 rounded-2xl bg-white p-2 text-emerald-800" />
            <h2 className="mt-5 text-2xl font-black text-slate-950">Connected ecosystem</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Built to coordinate formalisation with institutions and approved partners without inventing unauthorised endorsements.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {ecosystem.map((item) => (
                <div key={item} className="rounded-xl border border-emerald-950/10 bg-white px-4 py-3 text-sm font-bold text-slate-800">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="border-t border-emerald-950/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Authorized access</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Continue into the NRS workspace.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Authorised NRS, FIRS and platform administrators can sign in to review formalisation readiness, business registry signals, Revenue Guide activity and institutional reports.
            </p>
          </div>
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
            <div className="grid gap-3">
              <Link href={nrsLoginHref}>
                <Button className="h-11 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                  Authorized NRS users: Sign in
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="secondary" className="h-11 w-full border-white/15 bg-white/10 text-white hover:bg-white/20">
                  Institutional partners: Request engagement
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="secondary" className="h-11 w-full border-white/15 bg-white/10 text-white hover:bg-white/20">
                  Businesses: Register on DBIN
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
              <p className="text-xs leading-5 text-slate-200">
                DBIN supports formalisation and readiness infrastructure. Tax filing, assessment, remittance and enforcement remain within authorised government and partner systems.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-[#f7faf7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <DbinBrandLogo textClassName="text-slate-950" />
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-emerald-800">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-800">Terms</Link>
            <Link href="/verify" className="hover:text-emerald-800">Verification</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
