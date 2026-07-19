import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Handshake,
  Landmark,
  LockKeyhole,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { PublicFooter } from "@/components/layout/public-footer";
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

const TRUST_SIGNALS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Trusted Business Identity", icon: BadgeCheck },
  { label: "Public Verification", icon: QrCode },
  { label: "Business Operating Tools", icon: ReceiptText },
  { label: "Programme Workspaces", icon: Building2 },
];

const ECOSYSTEM_STAGES = [
  "Identity",
  "Verification",
  "Tools",
  "Readiness",
  "Markets",
  "Programmes",
];

const PRODUCT_STORIES = [
  {
    eyebrow: "For businesses",
    title: "Build a business people can trust.",
    text: "Create a verified profile, keep better records and become easier to discover.",
    href: "/platform/business-tools",
    cta: "Explore Business Tools",
    kind: "identity" as const,
    image: "/images/lcdbo/woman-entrepreneur.jpg",
    alt: "Nigerian business owner in a professional enterprise setting",
  },
  {
    eyebrow: "For institutions",
    title: "See and support real businesses.",
    text: "Verify records, coordinate programmes and make decisions with clearer data.",
    href: "/for-government",
    cta: "Explore Institutional Solutions",
    kind: "impact" as const,
    image: "/images/lcdbo/investment-partnership.jpg",
    alt: "Institutional partners reviewing business programme information",
  },
  {
    eyebrow: "For programmes",
    title: "Launch on reusable infrastructure.",
    text: "Run cohorts, clusters and readiness journeys without rebuilding the rails.",
    href: "/programmes",
    cta: "Explore Programmes",
    kind: "clusters" as const,
    image: "/images/lcdbo/industrial-cluster-warehouse.jpg",
    alt: "Industrial warehouse and coordinated production environment",
  },
];

const WHY_DBIN: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Identity", icon: BadgeCheck },
  { label: "Trust", icon: ShieldCheck },
  { label: "Operations", icon: ReceiptText },
  { label: "Compliance", icon: ClipboardCheck },
  { label: "Opportunity", icon: WalletCards },
  { label: "Intelligence", icon: BarChart3 },
];

const AUDIENCES: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Businesses", href: "/for-msmes", icon: Store },
  { label: "Government", href: "/for-government", icon: Landmark },
  { label: "Financial Institutions", href: "/for-financial-institutions", icon: WalletCards },
  { label: "Associations", href: "/for-associations", icon: Users },
  { label: "Programme Partners", href: "/partners", icon: Handshake },
  { label: "Public & Buyers", href: "/marketplace", icon: Search },
];

const PROGRAMMES = [
  {
    title: "LCDBO",
    status: "Pilot workspace",
    text: "Grow local production beyond oil.",
    href: "/lcdbo",
    image: "/images/lcdbo/factory-operations.jpg",
    alt: "Factory operations representing productive-sector growth",
  },
  {
    title: "Industrial Clusters",
    status: "Programme pathway",
    text: "Coordinate shared production capacity.",
    href: "/lcdbo/clusters",
    image: "/images/lcdbo/industrial-cluster-warehouse.jpg",
    alt: "Industrial cluster warehouse and production infrastructure",
  },
  {
    title: "Revenue Guide Model",
    status: "Readiness model",
    text: "Help businesses organise and comply.",
    href: "/resources",
    image: "/images/lcdbo/nigerian-msme-workshop-production.jpg",
    alt: "Nigerian MSME workshop and production team",
  },
  {
    title: "Property Intelligence",
    status: "Public verification",
    text: "Verify property credentials safely.",
    href: "/property",
    image: "/images/lcdbo/industrial-landscape-cta.jpg",
    alt: "Nigerian industrial landscape and infrastructure",
  },
];

const TRUST_ITEMS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Secure Verification", icon: QrCode },
  { label: "Controlled Data Sharing", icon: LockKeyhole },
  { label: "Role-Based Access", icon: ShieldCheck },
  { label: "Auditable Workflows", icon: ClipboardCheck },
];

function ArrowLink({ href, children, inverse = false }: { href: string; children: React.ReactNode; inverse?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 ${
        inverse
          ? "border border-white/20 text-white hover:bg-white/10 focus-visible:ring-emerald-200"
          : "border border-slate-200 bg-white text-slate-950 hover:border-emerald-300 hover:shadow-sm focus-visible:ring-emerald-600"
      }`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

function SectionIntro({
  eyebrow,
  title,
  text,
  inverse = false,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  inverse?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${inverse ? "text-emerald-300" : "text-emerald-700"}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl lg:text-5xl ${inverse ? "text-white" : "text-slate-950"}`}>
        {title}
      </h2>
      {text ? <p className={`mt-4 text-base leading-7 ${inverse ? "text-emerald-50/80" : "text-slate-600"}`}>{text}</p> : null}
    </div>
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
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf7] text-slate-950">
      <Navbar />
      <main id="main-content">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }} />

        <section className="relative overflow-hidden bg-[#051710] text-white">
          <div className="absolute inset-0">
            <Image
              src="/images/lcdbo/nigerian-manufacturing-hero.jpg"
              alt="Nigerian manufacturing workers and production activity"
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.32),transparent_34%),linear-gradient(90deg,rgba(5,23,16,0.98)_0%,rgba(5,23,16,0.9)_42%,rgba(5,23,16,0.58)_100%)]" />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-bold tracking-[0.22em] text-emerald-100">
                DIGITAL BUSINESS IDENTITY NETWORK
              </p>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl xl:text-7xl">
                Nigeria’s Digital Infrastructure for Trusted Business Growth
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50/90 sm:text-lg">
                DBIN helps businesses become trusted, organised and opportunity-ready—while giving institutions better ways to verify, support and understand them.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Register Your Business
                </Link>
                <Link href="/platform" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Explore DBIN
                </Link>
                <Link href="/verify" className="inline-flex h-12 items-center justify-center rounded-xl px-2 text-sm font-bold text-emerald-100 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  Verify a Business
                </Link>
              </div>
            </div>

            <div className="relative lg:pl-6">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-emerald-300/20 blur-3xl" />
              <article className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/12 p-4 shadow-2xl backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-slate-950/80 p-3">
                  <ProductFrame kind="identity" title="DBIN business workspace" status="Live" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {["Verified profile", "Operating records", "Opportunity-ready"].map((label) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                      <p className="mt-2 text-xs font-black text-white">{label}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {TRUST_SIGNALS.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <p className="text-sm font-black text-slate-950">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative min-h-[22rem] overflow-hidden rounded-[2rem] bg-slate-900 shadow-xl">
            <Image
              src="/images/lcdbo/women-briquette-production.jpg"
              alt="Nigerian production team at work"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 text-xl font-black text-white">
              Active businesses need visible trust signals.
            </p>
          </div>
          <div>
            <SectionIntro
              eyebrow="Why DBIN exists"
              title="Millions of businesses are active—but difficult to trust, support or finance."
              text="Fragmented records and limited visibility keep credible businesses outside markets, finance and public programmes."
            />
            <div className="mt-6">
              <ArrowLink href="/about">See Why DBIN Exists</ArrowLink>
            </div>
          </div>
        </section>

        <section id="ecosystem" className="bg-[#edf7f1] py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <SectionIntro
                eyebrow="Platform journey"
                title="One platform. Connected business journeys."
                text="Move from trusted identity to better records, readiness, markets and programme participation."
              />
              <ArrowLink href="/platform">Explore the Platform</ArrowLink>
            </div>
            <ol className="grid gap-3 md:grid-cols-6">
              {ECOSYSTEM_STAGES.map((stage, index) => (
                <li key={stage} className="relative rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <span className="text-xs font-black text-emerald-700">0{index + 1}</span>
                  <p className="mt-8 text-lg font-black text-slate-950">{stage}</p>
                  {index < ECOSYSTEM_STAGES.length - 1 ? (
                    <ArrowRight className="absolute right-4 top-5 hidden h-4 w-4 text-emerald-600 md:block" aria-hidden="true" />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-8">
            <SectionIntro
              eyebrow="Product stories"
              title="Practical trust, not another portal."
              text="DBIN connects the people who build businesses with the institutions that help them grow."
            />
          </div>
          <div className="grid gap-8">
            {PRODUCT_STORIES.map((story, index) => (
              <article key={story.title} className={`grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2 lg:items-center lg:p-7 ${index % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div className="relative min-h-[19rem] overflow-hidden rounded-[1.5rem] bg-slate-900">
                  <Image
                    src={story.image}
                    alt={story.alt}
                    fill
                    sizes="(min-width: 1024px) 44vw, 100vw"
                    className="object-cover transition duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <ProductFrame kind={story.kind} title={story.title} className="shadow-2xl" />
                  </div>
                </div>
                <div className="p-1 sm:p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{story.eyebrow}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 md:text-5xl">{story.title}</h3>
                  <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{story.text}</p>
                  <div className="mt-6">
                    <ArrowLink href={story.href}>{story.cta}</ArrowLink>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <SectionIntro
                eyebrow="Why DBIN"
                title="From informal activity to trusted business growth."
                text="Register, get verified, run better, access opportunities and grow."
              />
              <ArrowLink href="/for-msmes">Start Your Journey</ArrowLink>
            </div>
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {WHY_DBIN.map(({ label, icon: Icon }) => (
                  <Link key={label} href="/platform" className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    <Icon className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                    <p className="mt-4 text-lg font-black text-slate-950">{label}</p>
                  </Link>
                ))}
              </div>
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Who it serves</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {AUDIENCES.map(({ label, href, icon: Icon }) => (
                    <Link key={label} href={href} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                      <Icon className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                      <p className="mt-4 text-sm font-black text-slate-950">{label}</p>
                      <ArrowRight className="mt-4 h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#061711] py-14 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <SectionIntro
                eyebrow="Programme proof"
                title="Reusable rails for national programmes."
                text="Support productive sectors, readiness journeys and privacy-safe public verification."
                inverse
              />
              <ArrowLink href="/programmes" inverse>Explore All Programmes</ArrowLink>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PROGRAMMES.map((programme) => (
                <Link key={programme.title} href={programme.href} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/10 transition hover:-translate-y-1 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                  <div className="relative h-44 overflow-hidden">
                    <Image
                      src={programme.image}
                      alt={programme.alt}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover opacity-80 transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-100 backdrop-blur">
                      {programme.status}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-black">{programme.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-emerald-50/80">{programme.text}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionIntro
              eyebrow="Trust and security"
              title="Built for trust. Designed for privacy."
              text="Share confidence without exposing private business records."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <ArrowLink href="/privacy">Read About Privacy</ArrowLink>
              <ArrowLink href="/partners">Partner With DBIN</ArrowLink>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRUST_ITEMS.map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                <p className="mt-4 text-base font-black text-slate-950">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#008751_0%,#064e3b_54%,#061711_100%)] p-6 text-white shadow-2xl sm:p-8 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Build trust. Expand opportunity.</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.035em] md:text-5xl">
              Start building a more trusted business ecosystem.
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <Link href="/register" className="rounded-2xl bg-white p-5 text-slate-950 transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">For businesses</p>
                <p className="mt-2 text-xl font-black">Register Your Business</p>
              </Link>
              <Link href="/verify" className="rounded-2xl bg-white/10 p-5 text-white ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">For the public</p>
                <p className="mt-2 text-xl font-black">Verify a Business</p>
              </Link>
              <Link href="/partners" className="rounded-2xl bg-white/10 p-5 text-white ring-1 ring-white/15 transition hover:-translate-y-1 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
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
