import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Factory,
  Landmark,
  Leaf,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Users,
} from "lucide-react";
import { searchMarketplaceProviders } from "@/lib/data/marketplace";

const CATEGORY_CHIPS = [
  "Automotive",
  "Construction",
  "Repairs",
  "ICT Services",
  "Agriculture",
  "Retail",
  "Beauty",
  "Food Vendors",
  "Manufacturing",
  "Transport",
];

const TRUST_ECOSYSTEM = [
  { label: "MSMEs", sublabel: "Grow and get verified", icon: Store },
  { label: "Trade Associations", sublabel: "Onboard and manage members", icon: Users },
  { label: "Financial Institutions", sublabel: "Verify and reduce risk", icon: Landmark },
  { label: "Procurement Teams", sublabel: "Find reliable suppliers", icon: Building2 },
  { label: "Public Institutions", sublabel: "Strengthen service delivery", icon: ShieldCheck },
  { label: "Development Partners", sublabel: "Support ecosystem growth", icon: Leaf },
];

const BENEFITS = [
  "Verified Business Identity",
  "Marketplace Visibility",
  "Partner & Association Readiness",
  "Trust for Finance and Procurement",
  "QR-based Verification",
  "Digital Credential Sharing",
];

const HOW_IT_WORKS = [
  "Register your business",
  "Complete business profile",
  "Verify identity and compliance records",
  "Receive your Business Identity Credential",
  "Get discovered by customers and partners",
];

const STAKEHOLDERS = [
  "For MSMEs",
  "For Associations",
  "For Marketplaces",
  "For Financial Institutions",
  "For Public Institutions",
  "For Development Partners",
];

const METRICS = [
  "12,842+ Businesses profiled",
  "38+ Associations onboarded",
  "11 State coverage configurable",
  "6 Partner institution integrations",
  "98.7% Verification accuracy rate (demo)",
];

export default async function LandingPage() {
  const verifiedProviders = (await searchMarketplaceProviders({ verification: "verified", sort: "top-rated" })).slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,#0f766e_0%,#064e3b_35%,#022c22_70%,#012018_100%)] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_15%,rgba(16,185,129,0.12)_45%,transparent_75%)]" />
        <div className="pointer-events-none absolute -left-20 top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 top-8 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        <header className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/90 text-lg font-extrabold">DBIN</span>
            <span className="text-sm font-semibold leading-tight md:text-base">Digital Business Identity Network (DBIN)</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-emerald-50/90 lg:flex">
            <Link href="/marketplace" className="transition hover:text-white">Marketplace</Link>
            <Link href="/verify" className="transition hover:text-white">Verify Business ID</Link>
            <Link href="/resources" className="transition hover:text-white">Resources</Link>
            <Link href="/partners" className="transition hover:text-white">Partners</Link>
            <Link href="/about" className="transition hover:text-white">About</Link>
            <Link href="/contact" className="transition hover:text-white">Contact</Link>
          </nav>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link href="/login" className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-white/30 px-3 text-sm font-medium text-white transition hover:bg-white/10 sm:flex-none">Sign in</Link>
            <Link href="/register" className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-emerald-400 px-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 sm:flex-none">Register</Link>
          </div>
        </header>

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-16">
          <div>
            <p className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-100">
              TRUSTED • VERIFIED • SHAREABLE
            </p>
            <h1 className="mt-5 text-3xl font-semibold leading-[1.08] sm:text-4xl md:text-6xl">
              Verify businesses.
              <br />
              Build trust.
              <br />
              <span className="text-emerald-300">Unlock opportunities.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm text-emerald-50/90 md:text-base">
              Digital Business Identity Network (DBIN) helps MSMEs, associations, marketplaces, lenders, and institutions create trusted business identities, verify credentials, and connect with reliable businesses.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-emerald-400 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 sm:w-auto">Register Your Business</Link>
              <Link href="/marketplace" className="inline-flex h-11 w-full items-center justify-center rounded-md border border-white/35 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15 sm:w-auto">Find Verified Businesses</Link>
              <Link href="/verify" className="inline-flex h-11 w-full items-center justify-center gap-1 rounded-md border border-white/35 bg-transparent px-4 text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto">
                Verify a Business ID <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <article className="relative overflow-hidden rounded-3xl border border-emerald-200/35 bg-white/10 p-5 shadow-2xl backdrop-blur-xl md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200">Official Business Identity Credential</p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" /> DBIN VERIFIED
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-100">DBIN</span>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-emerald-200/25 bg-emerald-950/30 p-4 sm:grid-cols-[84px_1fr_auto]">
              <div className="flex h-24 w-20 items-center justify-center rounded-xl bg-gradient-to-b from-cyan-100 to-emerald-100 text-emerald-950">
                <Users className="h-7 w-7" />
              </div>
              <div className="min-w-0 space-y-1 text-sm">
                <h2 className="text-base font-semibold text-white">Kado Engine Works Limited</h2>
                <p className="text-emerald-100">Category: Automobile</p>
                <p className="text-emerald-100">Business Type: Rewiring</p>
                <p className="text-emerald-100">Business ID: NDMII-FCT-406488769</p>
                <p className="text-emerald-100">Owner: Tunde Adeyemi</p>
                <p className="inline-flex items-center gap-1 text-emerald-200"><BadgeCheck className="h-4 w-4" /> Status: Verified</p>
              </div>
              <div className="grid place-items-start gap-2 sm:place-items-center">
                <div className="rounded-lg bg-white p-2 text-slate-900">
                  <QrCode className="h-12 w-12" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-100">Scan to verify</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-emerald-100">
              <p>Verified • Trusted • Shareable</p>
              <p>Expiry: Apr 2027</p>
            </div>
          </article>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Built for an ecosystem of trust</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {TRUST_ECOSYSTEM.map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <item.icon className="mx-auto h-5 w-5 text-emerald-700" />
                <h2 className="mt-2 text-sm font-semibold">{item.label}</h2>
                <p className="mt-1 text-xs text-slate-600">{item.sublabel}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <h2 className="text-center text-2xl font-semibold">Find verified businesses near you</h2>
          <form action="/marketplace" className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input name="q" placeholder="What service do you need?" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3">
              <MapPin className="h-4 w-4 text-slate-400" />
              <input name="location" placeholder="Location (e.g. Abuja)" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <button type="submit" className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700">Search</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_CHIPS.map((category) => (
              <Link
                key={category}
                href={`/marketplace?q=${encodeURIComponent(category)}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                {category}
              </Link>
            ))}
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Showing verified businesses only
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Verified businesses you can trust</h2>
          <Link href="/marketplace" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">View all businesses</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {verifiedProviders.map((provider) => (
            <article key={provider.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-36 bg-slate-100">
                {provider.logo_url ? (
                  <img src={provider.logo_url} alt={provider.business_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-100 to-slate-200 text-emerald-800">
                    <Factory className="h-8 w-8" />
                  </div>
                )}
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              </div>
              <div className="space-y-1.5 p-4">
                <h3 className="line-clamp-2 text-sm font-semibold">{provider.business_name}</h3>
                <p className="text-xs text-slate-600">{provider.lga ? `${provider.lga}, ` : ""}{provider.state}</p>
                <p className="text-xs text-slate-600">{provider.category}</p>
                <p className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {provider.avg_rating.toFixed(1)}</p>
                <Link href={`/providers/${provider.public_slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                  View profile <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-center text-2xl font-semibold">Why join Digital Business Identity Network (DBIN)?</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((item) => (
            <article key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              <h3 className="mt-3 text-base font-semibold">{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-center text-2xl font-semibold">How Digital Business Identity Network (DBIN) works</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-5">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Step {index + 1}</p>
              <p className="mt-2 font-medium text-slate-800">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-center text-2xl font-semibold">Built for every stakeholder</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAKEHOLDERS.map((item) => (
            <article key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">{item}</h3>
              <p className="mt-2 text-sm text-slate-600">Built for practical verification, discovery, and trusted collaboration.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid gap-4 rounded-2xl bg-emerald-950 p-6 text-white md:grid-cols-5">
          {METRICS.map((metric) => (
            <p key={metric} className="text-sm font-semibold text-emerald-50">{metric}</p>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-3xl bg-[linear-gradient(130deg,#064e3b_0%,#022c22_100%)] p-8 text-white md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">Ready to make your business easier to verify and trust?</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex h-10 items-center rounded-md bg-emerald-300 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200">Register your business</Link>
            <Link href="/verify" className="inline-flex h-10 items-center rounded-md border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10">Verify Business ID</Link>
            <Link href="/partners" className="inline-flex h-10 items-center rounded-md border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10">Partner with DBIN</Link>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="inline-flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-lg font-extrabold text-white">DBIN</span>
              <span className="font-semibold text-white">Digital Business Identity Network (DBIN)</span>
            </div>
            <p className="mt-4 max-w-md text-sm text-slate-400">
              An independent business identity and verification network for MSMEs, associations, marketplaces, lenders, and institutions.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Platform</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li><Link href="/marketplace" className="hover:text-white">Marketplace</Link></li>
                <li><Link href="/verify" className="hover:text-white">Verify Business ID</Link></li>
                <li><Link href="/for-associations" className="hover:text-white">For Associations</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Resources</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li><Link href="/resources" className="hover:text-white">Resource center</Link></li>
                <li><Link href="/verify" className="hover:text-white">Verification guide</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Company</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/partners" className="hover:text-white">Partners</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Legal</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li><Link href="/terms" className="hover:text-white">Terms of use</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Stay updated</h3>
              <form className="mt-3 flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 placeholder:text-slate-500"
                />
                <button type="button" className="h-9 rounded-md bg-emerald-500 px-3 text-xs font-semibold text-emerald-950">Go</button>
              </form>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
