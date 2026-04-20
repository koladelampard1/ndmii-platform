import Link from "next/link";
import { BadgeCheck, CheckCircle2, MapPin, Search, ShieldCheck, Star } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { searchMarketplaceProviders } from "@/lib/data/marketplace";

const MARKETPLACE_QUICK_CATEGORIES = [
  "Mechanics",
  "Electricians",
  "Tailors",
  "Fabricators",
  "POS Agents",
  "Plumbers",
  "Transporters",
  "Caterers",
  "ICT Support",
  "Agriculture",
];

const DISCOVERY_CATEGORIES = [
  "Automotive",
  "Construction",
  "Repairs",
  "ICT Services",
  "Agriculture",
  "Retail",
  "Beauty",
  "Food Vendors",
  "Transport",
  "Manufacturing",
];

const STAKEHOLDER_PANELS = [
  {
    title: "For MSMEs",
    body: "Register and verify your business to access opportunities and build trust.",
    href: "/for-msmes",
    cta: "Explore MSME guide",
  },
  {
    title: "For Associations",
    body: "Onboard members, issue digital IDs, and track verification.",
    href: "/for-associations",
    cta: "Association onboarding",
  },
  {
    title: "For Government",
    body: "Strengthen compliance and improve visibility of verified MSMEs.",
    href: "/for-government",
    cta: "Government overview",
  },
  {
    title: "For Financial Institutions",
    body: "Reduce risk and onboard verified MSMEs with confidence.",
    href: "/for-financial-institutions",
    cta: "Institution playbook",
  },
];

export default async function LandingPage() {
  const verifiedProviders = (await searchMarketplaceProviders({ verification: "verified", sort: "top-rated" })).slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-6 pt-10 md:pt-16">
        <div className="grid gap-8 rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#111827_45%,#052e2b_100%)] p-8 text-white md:grid-cols-2 md:items-center md:p-12">
          <div>
            <p className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              National MSME identity + marketplace
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">
              Register your MSME identity and find verified businesses across Nigeria.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-200 md:text-base">
              Build trust with a government-grade digital MSME ID, then discover trusted providers by category, specialization, and location.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register/msme" className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-500 px-4 text-sm font-medium text-slate-950 transition hover:bg-emerald-400">
                Register Your Business
              </Link>
              <Link href="/marketplace" className="inline-flex h-11 items-center justify-center rounded-md border border-white/40 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10">
                Find Trusted Businesses
              </Link>
            </div>
          </div>

          <article className="mx-auto w-full max-w-md rounded-2xl border border-white/25 bg-white p-4 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">NDMII ID card</p>
                <h2 className="text-lg font-semibold">Abuja AutoCare Services Ltd.</h2>
                <p className="text-sm text-slate-600">Owner: Ibrahim Usman</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            </div>
            <div className="mt-4 grid grid-cols-[88px_1fr] gap-4">
              <div className="flex h-24 w-22 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">PHOTO</div>
              <dl className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between gap-4"><dt>Business Category</dt><dd className="font-medium text-slate-900">Automotive Services</dd></div>
                <div className="flex justify-between gap-4"><dt>Location</dt><dd className="font-medium text-slate-900">Abuja, FCT</dd></div>
                <div className="flex justify-between gap-4"><dt>NDMII ID</dt><dd className="font-medium text-slate-900">NDMII-LAG-108168205</dd></div>
              </dl>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-5 py-4 text-xs font-medium text-slate-700 md:text-sm">
          <span className="font-semibold text-slate-900">Trusted and used by:</span>
          {[
            { label: "Trade Associations", href: "/for-associations" },
            { label: "Government Agencies", href: "/for-government" },
            { label: "Financial Institutions", href: "/for-financial-institutions" },
            { label: "Procurement Platforms", href: "/partners" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm transition hover:bg-emerald-50">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-center text-2xl font-semibold text-slate-900">Find Trusted Businesses Near You</h2>
          <form action="/marketplace" className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input name="q" placeholder="What service do you need?" className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <input name="location" placeholder="Location (e.g. Abuja)" className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </div>
            <Button type="submit" className="h-11 bg-emerald-600 text-white hover:bg-emerald-700">Search</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {MARKETPLACE_QUICK_CATEGORIES.map((category) => (
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
            <CheckCircle2 className="h-4 w-4" /> Showing verified MSMEs only
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Verified Businesses You Can Trust</h2>
          <Link href="/marketplace" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">View all businesses</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {verifiedProviders.map((provider) => (
            <article key={provider.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-36 bg-slate-100">
                {provider.logo_url ? (
                  <img src={provider.logo_url} alt={provider.business_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">No photo</div>
                )}
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              </div>
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{provider.business_name}</h3>
                <p className="text-xs text-slate-600">{provider.lga ? `${provider.lga}, ` : ""}{provider.state}</p>
                <p className="text-xs text-slate-600">{provider.category}</p>
                <p className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {provider.avg_rating.toFixed(1)}</p>
                <Link href={`/providers/${provider.public_slug}`} className="block text-sm font-medium text-emerald-700 hover:text-emerald-800">View Profile</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-12 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Get a Verified Business Identity", body: "Stand out as a legitimate and trustworthy business.", href: "/register/msme", cta: "Register your MSME" },
          { icon: BadgeCheck, title: "Access Opportunities Faster", body: "Unlock access to contracts, markets, funding, and support.", href: "/resources", cta: "Explore resources" },
          { icon: CheckCircle2, title: "Build Customer Trust Nationwide", body: "Show customers and institutions that you are verified.", href: "/verify", cta: "Open verifier" },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <item.icon className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            <Link href={item.href} className="mt-3 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800">
              {item.cta}
            </Link>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-slate-900">Verify an MSME Instantly</h2>
            <Link href="/verify" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Open verifier</Link>
          </div>
          <form action="/verify" className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input name="q" placeholder="Enter MSME ID (e.g. NDMII-LAG-108168205)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <Button type="submit" className="h-11 bg-emerald-600 hover:bg-emerald-700">Verify Now</Button>
          </form>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-12 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">How NDMII works</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">One Identity. Unlimited Opportunities.</h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            {["Register your business", "Verify your information", "Get your digital ID", "Unlock opportunities"].map((step, idx) => (
              <li key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="font-semibold text-slate-900">{idx + 1}.</span> {step}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/for-msmes" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">MSME onboarding guide</Link>
            <Link href="/resources" className="text-sm font-medium text-slate-600 hover:text-slate-900">Learn more resources</Link>
          </div>
        </article>
        <article className="rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#065f46_100%)] p-6 text-white shadow-sm">
          <h2 className="text-2xl font-semibold">Your Digital ID Card. Your Competitive Advantage.</h2>
          <ul className="mt-4 space-y-2 text-sm text-emerald-100">
            <li>• Tamper-proof digital credential</li>
            <li>• Instantly verifiable with QR code</li>
            <li>• Recognized by partners & institutions</li>
            <li>• Boosts trust and business credibility</li>
          </ul>
          <Link href="/sample-id-card" className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-white/40 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20">View Sample ID Card</Link>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">Browse Services by Category</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DISCOVERY_CATEGORIES.map((category) => (
            <Link key={category} href={`/marketplace?q=${encodeURIComponent(category)}`} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50">
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">Built for Every Stakeholder</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STAKEHOLDER_PANELS.map((panel) => (
            <article key={panel.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{panel.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{panel.body}</p>
              <Link href={panel.href} className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800">{panel.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid gap-4 rounded-2xl bg-emerald-900 p-6 text-white md:grid-cols-5">
          {[
            `${Math.max(12842, verifiedProviders.length * 150)}+ MSMEs Verified`,
            "38+ Associations Onboarded",
            "11 States Activated",
            "6 Partner Institutions",
            "98.7% Verification Accuracy",
          ].map((metric) => (
            <p key={metric} className="text-sm font-semibold">{metric}</p>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {["With NDMII, verifying vendors is now fast and reliable.", "Our members now access opportunities previously locked out.", "The identity recognition model improved trust for MSMEs."].map((quote) => (
            <blockquote key={quote} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
              “{quote}”
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Aligned with Nigeria&apos;s National Priorities</h2>
          <p className="mt-2 text-sm text-slate-600">
            Supporting MSME formalization and digital transformation through identity, verification, and marketplace visibility.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/about" className="font-medium text-emerald-700 hover:text-emerald-800">Learn more</Link>
            <Link href="/partners" className="font-medium text-slate-600 hover:text-slate-900">Partner with us</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl bg-[linear-gradient(135deg,#064e3b_0%,#022c22_100%)] p-8 text-white md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">Ready to verify your MSME and unlock new markets?</h2>
          <p className="mt-3 max-w-2xl text-sm text-emerald-100 md:text-base">
            Join the NDMII platform to build digital trust, gain visibility, and connect with verified opportunities nationwide.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register/msme" className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-400 px-4 text-sm font-medium text-slate-950 transition hover:bg-emerald-300">Register now</Link>
            <Link href="/verify" className="inline-flex h-10 items-center justify-center rounded-md border border-white/40 bg-transparent px-4 text-sm font-medium text-white transition hover:bg-white/10">Verify MSME ID</Link>
            <Link href="/partners" className="inline-flex h-10 items-center justify-center rounded-md border border-white/40 bg-transparent px-4 text-sm font-medium text-white transition hover:bg-white/10">Partner With Us</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
