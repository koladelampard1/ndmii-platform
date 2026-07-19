import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Handshake,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { DbinProductExperience } from "@/components/public/dbin-product-experience";
import { ProductFrame } from "@/components/public/product-showcase";

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

const HERO_STEPS = [
  "Business Registered",
  "Identity Issued",
  "Verification Complete",
  "Invoice Created",
  "Buyer Verified",
  "Programme Joined",
  "Finance Ready",
  "Growth",
];

const JOURNEY = ["Register", "Verify", "Operate", "Comply", "Markets", "Finance", "Programmes", "Grow"];

const WORKSPACE_EXPERIENCES = [
  { title: "Business profile", kind: "identity" as const },
  { title: "Invoice record", kind: "operations" as const },
  { title: "Marketplace profile", kind: "finance" as const },
  { title: "Programme dashboard", kind: "clusters" as const },
  { title: "Property verification", kind: "property" as const },
];

const PERSONAS = [
  {
    title: "Businesses",
    text: "Credible and easier to find.",
    href: "/for-msmes",
    cta: "Start",
    image: "/images/lcdbo/woman-entrepreneur.jpg",
    alt: "Nigerian entrepreneur in a business environment",
  },
  {
    title: "Government",
    text: "Verify and support businesses.",
    href: "/for-government",
    cta: "Explore",
    image: "/images/lcdbo/investment-partnership.jpg",
    alt: "Institutional business engagement in Nigeria",
  },
  {
    title: "Financial Institutions",
    text: "See readiness signals.",
    href: "/for-financial-institutions",
    cta: "Partner",
    image: "/images/lcdbo/nigerian-msme-workshop-production.jpg",
    alt: "Nigerian MSME production team at work",
  },
  {
    title: "Associations",
    text: "Digitise member trust.",
    href: "/for-associations",
    cta: "Support",
    image: "/images/lcdbo/women-briquette-production.jpg",
    alt: "Women-led Nigerian production group",
  },
  {
    title: "Development Partners",
    text: "Coordinate enterprise programmes.",
    href: "/partners",
    cta: "Briefing",
    image: "/images/lcdbo/agro-processing.jpg",
    alt: "Agro-processing production environment",
  },
  {
    title: "Investors",
    text: "See credible pipelines.",
    href: "/lcdbo/opportunities",
    cta: "View",
    image: "/images/lcdbo/export-containers.jpg",
    alt: "Export logistics and containers",
  },
];

const PROGRAMMES = [
  { title: "LCDBO", href: "/lcdbo", image: "/images/lcdbo/factory-operations.jpg", text: "Productive-sector participation." },
  { title: "Industrial Clusters", href: "/lcdbo/clusters", image: "/images/lcdbo/industrial-cluster-warehouse.jpg", text: "Shared production capacity." },
  { title: "Revenue Guide", href: "/resources", image: "/images/lcdbo/nigerian-msme-workshop-production.jpg", text: "Readiness field support." },
  { title: "DLPI", href: "/property", image: "/images/lcdbo/industrial-landscape-cta.jpg", text: "Public property verification." },
  { title: "Impact Intelligence", href: "/platform/intelligence", image: "/images/lcdbo/brick-factory-workers.jpg", text: "Programme evidence and insight." },
];

const TRUST_PILLARS: Array<{ title: string; icon: LucideIcon }> = [
  { title: "Privacy", icon: LockKeyhole },
  { title: "Verification", icon: QrCode },
  { title: "Audit", icon: ClipboardCheck },
  { title: "Role-based Access", icon: ShieldCheck },
];

const PARTNER_CATEGORIES = [
  "Federal Agencies",
  "State Governments",
  "Banks",
  "DFIs",
  "Associations",
  "International Partners",
  "Programme Partners",
  "Technical Partners",
];

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-300 px-5 text-sm font-black text-emerald-950 transition hover:-translate-y-0.5 hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
    >
      {children}
    </Link>
  );
}

function QuietLink({ href, children, inverse = false }: { href: string; children: React.ReactNode; inverse?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 ${
        inverse
          ? "border border-white/25 text-white hover:bg-white/10 focus-visible:ring-emerald-100"
          : "border border-slate-200 bg-white text-slate-950 hover:border-emerald-300 hover:shadow-sm focus-visible:ring-emerald-700"
      }`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

function SectionLabel({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <p className={`text-xs font-black uppercase tracking-[0.18em] ${inverse ? "text-emerald-300" : "text-emerald-700"}`}>
      {children}
    </p>
  );
}

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Digital Business Identity Network",
    alternateName: "DBIN",
    url: "https://dbin.ng",
    description: "Nigeria’s digital business infrastructure for trusted identity, verification and enterprise readiness.",
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf7] text-slate-950">
      <Navbar />
      <main id="main-content">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

        <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-slate-950 text-white">
          <Image
            src="/images/lcdbo/nigerian-manufacturing-hero.jpg"
            alt="Nigerian manufacturing team and production activity"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.38),transparent_32%),linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.82)_46%,rgba(2,6,23,0.42)_100%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-20">
            <div>
              <SectionLabel inverse>Digital Business Identity Network</SectionLabel>
              <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                The infrastructure powering trusted businesses.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-emerald-50/90">Identity, records, verification, markets and programmes.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <PrimaryLink href="/register">Register Business</PrimaryLink>
                <QuietLink href="/platform" inverse>Explore Platform</QuietLink>
                <QuietLink href="#journey" inverse>Watch Platform Journey</QuietLink>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 rounded-[3rem] bg-emerald-300/20 blur-3xl" />
              <div className="relative rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-slate-950/80 p-4">
                  <div className="mb-4 flex items-center justify-between gap-4 text-xs font-bold text-slate-400">
                    <span>DBIN journey</span>
                    <span>platform experience</span>
                  </div>
                  <ol className="grid gap-3">
                    {HERO_STEPS.map((step, index) => (
                      <li
                        key={step}
                        className="dbin-journey-step flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-3"
                        style={{ animationDelay: `${index * 0.55}s` }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300 text-xs font-black text-emerald-950">
                          {index + 1}
                        </span>
                        <span className="text-sm font-black text-white">{step}</span>
                        <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-200" aria-hidden="true" />
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16" aria-labelledby="product-experience">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 max-w-2xl">
                <SectionLabel>Product experience</SectionLabel>
                <h2 id="product-experience" className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                Feel DBIN.
              </h2>
            </div>
            <DbinProductExperience />
          </div>
        </section>

        <section id="journey" className="bg-[#edf7f1] py-16" aria-labelledby="business-journey">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionLabel>Journey</SectionLabel>
            <h2 id="business-journey" className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              From record to growth.
            </h2>
            <ol className="mt-10 flex snap-x gap-3 overflow-x-auto pb-4 [scrollbar-width:thin]">
              {JOURNEY.map((step, index) => (
                <li key={step} className="group min-w-[13rem] snap-start rounded-[1.75rem] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <span className="text-xs font-black text-emerald-700">0{index + 1}</span>
                  <p className="mt-16 text-2xl font-black tracking-[-0.035em] text-slate-950">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-16" aria-labelledby="platform-experiences">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <SectionLabel>Workspaces</SectionLabel>
                <h2 id="platform-experiences" className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                  The platform in motion.
                </h2>
              </div>
                  <QuietLink href="/platform">Explore</QuietLink>
            </div>
            <div className="grid gap-6">
              {WORKSPACE_EXPERIENCES.map((experience, index) => (
                <article key={experience.title} className="grid gap-5 rounded-[2rem] bg-white p-4 shadow-sm lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:p-6">
                  <div>
                    <span className="text-xs font-black text-emerald-700">0{index + 1}</span>
                    <h3 className="mt-3 text-3xl font-black tracking-[-0.04em]">{experience.title}</h3>
                  </div>
                  <ProductFrame kind={experience.kind} title={experience.title} className="shadow-2xl" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 py-16 text-white" aria-labelledby="who-uses">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionLabel inverse>Users</SectionLabel>
            <h2 id="who-uses" className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Built for the ecosystem.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {PERSONAS.map((persona) => (
                <Link key={persona.title} href={persona.href} className="group overflow-hidden rounded-[2rem] bg-white/10 transition hover:-translate-y-1 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                  <div className="relative h-64 overflow-hidden">
                    <Image src={persona.image} alt={persona.alt} fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover opacity-90 transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-2xl font-black">{persona.title}</h3>
                    <p className="mt-2 text-sm font-bold text-slate-300">{persona.text}</p>
                    <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-300">
                      {persona.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16" aria-labelledby="national-programmes">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionLabel>Programmes</SectionLabel>
            <h2 id="national-programmes" className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              One infrastructure. Many surfaces.
            </h2>
            <div className="mt-10 grid gap-5">
              {PROGRAMMES.map((programme) => (
                <Link key={programme.title} href={programme.href} className="group grid overflow-hidden rounded-[2rem] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="relative min-h-[18rem] overflow-hidden">
                    <Image src={programme.image} alt="" fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <div className="flex flex-col justify-center p-6">
                    <h3 className="text-4xl font-black tracking-[-0.045em]">{programme.title}</h3>
                    <p className="mt-3 text-base font-bold text-slate-600">{programme.text}</p>
                    <p className="mt-6 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
                      Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#edf7f1] py-16" aria-labelledby="nigeria-map">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <SectionLabel>Nigeria view</SectionLabel>
              <h2 id="nigeria-map" className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                A national layer, illustrated.
              </h2>
              <p className="mt-4 max-w-xl text-base font-bold leading-7 text-slate-600">Businesses, clusters, programmes and property signals.</p>
            </div>
            <div className="rounded-[2.5rem] bg-white p-6 shadow-xl">
              <svg viewBox="0 0 760 430" role="img" aria-label="Illustrative Nigeria map showing DBIN programme, business and property signals" className="h-auto w-full">
                <path d="M160 78 300 48l133 35 112 3 58 78-12 91 42 84-80 44-116-8-91 38-88-55-112 10-55-83 34-87-24-62Z" fill="#dcfce7" stroke="#047857" strokeWidth="6" />
                <path d="M300 48 318 180 258 358M433 83 405 220l32 155M160 78l130 125-164-5M545 86 405 220l186 35M258 358l147-138 148 163" fill="none" stroke="#86efac" strokeWidth="3" />
                {[
                  [260, 170, "Business"],
                  [408, 222, "Cluster"],
                  [545, 256, "Programme"],
                  [318, 328, "Property"],
                  [496, 128, "Finance"],
                ].map(([x, y, label]) => (
                  <g key={label as string}>
                    <circle cx={x as number} cy={y as number} r="16" fill="#047857" />
                    <circle cx={x as number} cy={y as number} r="26" fill="none" stroke="#10b981" strokeWidth="4" opacity="0.35" />
                    <text x={(x as number) + 26} y={(y as number) + 5} fill="#064e3b" fontSize="20" fontWeight="800">{label as string}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </section>

        <section className="py-16" aria-labelledby="trust">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionLabel>Trust</SectionLabel>
            <h2 id="trust" className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Why institutions trust DBIN.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {TRUST_PILLARS.map(({ title, icon: Icon }) => (
                <div key={title} className="rounded-[2rem] bg-white p-6 shadow-sm">
                  <Icon className="h-7 w-7 text-emerald-700" aria-hidden="true" />
                  <p className="mt-16 text-2xl font-black tracking-[-0.035em]">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-slate-950 py-16 text-white" aria-labelledby="partners">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
              <SectionLabel inverse>Partners</SectionLabel>
                <h2 id="partners" className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Built with institutions.</h2>
              </div>
              <QuietLink href="/partners" inverse>Partner With DBIN</QuietLink>
            </div>
          </div>
          <div className="mt-10 flex gap-4 overflow-hidden">
            <div className="dbin-logo-wall flex min-w-full gap-4">
              {PARTNER_CATEGORIES.map((partner) => (
                <div key={partner} className="min-w-[15rem] rounded-2xl border border-white/10 bg-white/10 p-5 text-center">
                  <Handshake className="mx-auto h-5 w-5 text-emerald-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black">{partner}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 py-16 text-white sm:px-6">
          <Image src="/images/lcdbo/export-containers.jpg" alt="Export logistics and industrial opportunity" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-950/38" />
          <div className="relative mx-auto max-w-7xl py-16">
            <h2 className="max-w-4xl text-5xl font-black leading-[1] tracking-[-0.055em] sm:text-6xl">
              Start building a trusted business future.
            </h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <PrimaryLink href="/register">Start Your Business</PrimaryLink>
              <QuietLink href="/partners" inverse>Partner With DBIN</QuietLink>
              <QuietLink href="/verify" inverse>Verify a Business</QuietLink>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
