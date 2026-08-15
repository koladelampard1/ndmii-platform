import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Factory,
  Leaf,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  Shirt,
  Star,
  Timer,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { DbinBrandLogo } from "@/components/branding/dbin-brand-logo";
import { DBIN_PUBLIC_MARKETPLACE_INDICATORS, DBIN_PUBLIC_PLATFORM_PROMISE } from "@/lib/content/dbin-public-marketplace";
import { searchMarketplaceProviders, type ProviderCard } from "@/lib/data/marketplace";
import { buildProviderProfileHref, buildProviderQuoteHref } from "@/lib/provider-links";

export const metadata: Metadata = {
  title: "DBIN | Build Trust, Find Customers and Grow Your Business",
  description:
    "Create a verified business identity, showcase your products and services, manage business records and connect with trusted buyers across Nigeria through DBIN.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "DBIN | Build Trust, Find Customers and Grow Your Business",
    description:
      "Create a verified business identity, showcase your products and services, manage business records and connect with trusted buyers across Nigeria through DBIN.",
    url: "/",
    siteName: "Digital Business Identity Network",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DBIN | Build Trust, Find Customers and Grow Your Business",
    description:
      "Create a verified business identity, showcase what you offer, manage business records and connect with buyers across Nigeria.",
  },
};

const NAV_GROUPS = [
  {
    label: "For Businesses",
    links: [
      { label: "Register a business", href: "/register" },
      { label: "Business identity", href: "/platform/business-identity" },
      { label: "Business tools", href: "/platform/business-tools" },
      { label: "Verification", href: "/verify" },
    ],
  },
  {
    label: "Marketplace",
    links: [
      { label: "Explore verified businesses", href: "/marketplace" },
      { label: "Food & Agro-processing", href: "/marketplace?category=Food%20Processing" },
      { label: "Professional Services", href: "/marketplace?category=Professional%20Services" },
      { label: "Manufacturing", href: "/marketplace?category=Manufacturing" },
    ],
  },
  {
    label: "Business Tools",
    links: [
      { label: "Operating records", href: "/platform/business-tools" },
      { label: "Compliance readiness", href: "/platform/compliance" },
      { label: "Public verification", href: "/verify" },
    ],
  },
  {
    label: "Programmes",
    links: [
      { label: "Programme pathways", href: "/programmes" },
      { label: "Business growth support", href: "/resources" },
      { label: "Partner with DBIN", href: "/partners" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Guides", href: "/resources" },
      { label: "About DBIN", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const;

const CATEGORY_CARDS: Array<{
  label: string;
  category: string;
  image: string;
  alt: string;
  icon: LucideIcon;
}> = [
  {
    label: "Food & Agro-processing",
    category: "Food Processing",
    image: "/images/lcdbo/agro-processing.jpg",
    alt: "Packaged agro-processing products in a Nigerian production environment",
    icon: Leaf,
  },
  {
    label: "Fashion & Textiles",
    category: "Fashion & Textiles",
    image: "/images/lcdbo/woman-entrepreneur.jpg",
    alt: "Nigerian fashion and textile entrepreneur in a workshop",
    icon: Shirt,
  },
  {
    label: "Professional Services",
    category: "Professional Services",
    image: "/images/lcdbo/investment-partnership.jpg",
    alt: "Nigerian professional services adviser working with business records",
    icon: BriefcaseBusiness,
  },
  {
    label: "Manufacturing",
    category: "Manufacturing",
    image: "/images/lcdbo/factory-operations.jpg",
    alt: "Industrial manufacturing activity in a production facility",
    icon: Factory,
  },
  {
    label: "Logistics",
    category: "Logistics",
    image: "/images/lcdbo/export-containers.jpg",
    alt: "Logistics and export containers representing Nigerian supply chains",
    icon: Truck,
  },
  {
    label: "Construction & Artisans",
    category: "Construction & Artisan",
    image: "/images/lcdbo/brick-factory-workers.jpg",
    alt: "Construction and artisan production team at work",
    icon: Wrench,
  },
];

const CATEGORY_IMAGE_BY_NAME = [
  { match: ["food", "agro", "agriculture"], image: "/images/lcdbo/agro-processing.jpg" },
  { match: ["fashion", "textile", "creative"], image: "/images/lcdbo/woman-entrepreneur.jpg" },
  { match: ["manufactur", "factory", "industrial"], image: "/images/lcdbo/factory-operations.jpg" },
  { match: ["logistics", "transport", "export"], image: "/images/lcdbo/export-containers.jpg" },
  { match: ["construction", "artisan", "repair"], image: "/images/lcdbo/brick-factory-workers.jpg" },
  { match: ["professional", "service", "consult"], image: "/images/lcdbo/investment-partnership.jpg" },
];

const ASSURANCE_ITEMS: Array<{ title: string; text: string; icon: LucideIcon }> = [
  {
    title: "Verified & trusted",
    text: "Every listed business is verified through the DBIN trust framework.",
    icon: ShieldCheck,
  },
  {
    title: "Connect & grow",
    text: "Businesses can connect with customers and build commercial relationships.",
    icon: MessageCircle,
  },
  {
    title: "Access opportunities",
    text: "Businesses can discover contracts, programmes and growth pathways.",
    icon: Banknote,
  },
  {
    title: "Your data, your control",
    text: "Businesses control what information is made public.",
    icon: LockKeyhole,
  },
];

const FOOTER_LINKS = [
  { label: "For Businesses", href: "/for-msmes" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Business Identity", href: "/platform/business-identity" },
  { label: "Business Tools", href: "/platform/business-tools" },
  { label: "Programmes", href: "/programmes" },
  { label: "Resources", href: "/resources" },
  { label: "About DBIN", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Sign in", href: "/login" },
  { label: "Register Business", href: "/register" },
] as const;

function categoryHref(category: string) {
  return `/marketplace?category=${encodeURIComponent(category)}&verification=verified_or_approved`;
}

function providerImage(provider: ProviderCard) {
  const category = [provider.category, provider.specialization, provider.short_description].join(" ").toLowerCase();
  return CATEGORY_IMAGE_BY_NAME.find((item) => item.match.some((needle) => category.includes(needle)))?.image ?? "/images/lcdbo/nigerian-msme-workshop-production.jpg";
}

function displayLocation(provider: ProviderCard) {
  return [provider.lga, provider.state].filter((value) => value && value !== "Nigeria").join(", ") || provider.state || "Nigeria";
}

function isCompleteHomepageProvider(provider: ProviderCard) {
  return Boolean(
    provider.public_slug &&
      provider.business_name &&
      provider.category &&
      provider.state &&
      provider.state !== "Nigeria" &&
      provider.short_description &&
      !provider.short_description.toLowerCase().includes("verified ndmii provider listed"),
  );
}

async function getFeaturedHomepageProviders() {
  try {
    const providers = await searchMarketplaceProviders({ verification: "verified_or_approved", sort: "featured" });
    return providers.filter(isCompleteHomepageProvider).slice(0, 3);
  } catch {
    return [];
  }
}

function HeaderNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#001615] text-white shadow-sm">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-emerald-950"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
          <DbinBrandLogo
            compactOnMobile={false}
            iconClassName="h-14 w-14 rounded-full"
            textClassName="max-w-[10.5rem] whitespace-normal text-[13px] font-black leading-tight text-white"
          />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 xl:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="group relative">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-white/92 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {group.label}
                <ArrowRight className="h-3.5 w-3.5 rotate-90" aria-hidden="true" />
              </button>
              <div className="invisible absolute left-0 top-full w-72 translate-y-2 rounded-2xl border border-emerald-100/15 bg-white p-2 text-slate-950 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-xl px-3 py-2.5 text-sm font-bold transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          <Link href="/login" className="rounded-xl px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            Sign in
          </Link>
          <Link href="/register" className="rounded-xl bg-[#67F3A5] px-5 py-3 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-[#8DF7BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
            Register Business
          </Link>
        </div>

        <details className="group relative xl:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Open navigation</span>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-14 max-h-[calc(100svh-6rem)] w-[min(88vw,24rem)] overflow-y-auto rounded-2xl border border-emerald-100/15 bg-[#001f1b] p-4 shadow-2xl">
            <nav aria-label="Mobile navigation" className="grid gap-4">
              {NAV_GROUPS.map((group) => (
                <section key={group.label}>
                  <h2 className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">{group.label}</h2>
                  <div className="mt-2 grid gap-1">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm font-bold text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
              <div className="grid gap-2 border-t border-white/10 pt-4">
                <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-black text-white">
                  Sign in
                </Link>
                <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#67F3A5] px-4 text-sm font-black text-emerald-950">
                  Register Business
                </Link>
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}

function MarketplaceSearch() {
  return (
    <form action="/marketplace" method="get" className="grid overflow-hidden rounded-2xl border border-white/25 bg-white shadow-2xl shadow-emerald-950/25 sm:grid-cols-[1fr_0.72fr_auto]">
      <label className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 text-slate-700 sm:border-b-0 sm:border-r">
        <Search className="h-5 w-5 shrink-0 text-emerald-900" aria-hidden="true" />
        <span className="sr-only">What do you need?</span>
        <input
          name="q"
          placeholder="What do you need?"
          className="min-h-11 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500"
        />
      </label>
      <label className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 text-slate-700 sm:border-b-0 sm:border-r">
        <MapPin className="h-5 w-5 shrink-0 text-emerald-900" aria-hidden="true" />
        <span className="sr-only">Where?</span>
        <input
          name="location"
          placeholder="Where?"
          className="min-h-11 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500"
        />
      </label>
      <input type="hidden" name="verification" value="verified_or_approved" />
      <button type="submit" className="min-h-16 bg-[#67F3A5] px-6 text-sm font-black text-emerald-950 transition hover:bg-[#8DF7BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-950">
        Search marketplace
      </button>
    </form>
  );
}

function HeroCollage() {
  return (
    <div className="relative min-h-[33rem] lg:min-h-[40rem]">
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-none lg:rounded-bl-[2rem]">
        <div className="relative row-span-2 min-h-[28rem]">
          <Image
            src="/images/lcdbo/agro-processing.jpg"
            alt="Nigerian agro-processing business owner with packaged food products"
            fill
            priority
            sizes="(min-width:1024px) 30vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="relative">
          <Image
            src="/images/lcdbo/woman-entrepreneur.jpg"
            alt="Nigerian fashion entrepreneur in a tailoring workspace"
            fill
            priority
            sizes="(min-width:1024px) 28vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="relative">
          <Image
            src="/images/lcdbo/investment-partnership.jpg"
            alt="Nigerian business professional using a phone for customer enquiries"
            fill
            priority
            sizes="(min-width:1024px) 28vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-950/10 to-transparent" />
      <div className="absolute bottom-5 right-4 grid w-[min(15rem,78vw)] gap-2 sm:right-8">
        {[
          { label: "Verified business", icon: ShieldCheck },
          { label: "Open for enquiries", icon: MessageCircle },
          { label: "Responds quickly", icon: Timer },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-emerald-200/35 bg-emerald-950/80 px-4 py-3 text-sm font-black text-white shadow-lg backdrop-blur">
            <Icon className="h-4 w-4 shrink-0 text-emerald-200" aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofStrip() {
  return (
    <section aria-label="DBIN public indicators" className="border-b border-emerald-950/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-0 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
        {DBIN_PUBLIC_MARKETPLACE_INDICATORS.map((item, index) => {
          const Icon = index === 0 ? Users : index === 1 ? Building2 : MapPin;
          return (
            <div key={item.key} className="flex items-center gap-4 border-b border-slate-200 py-4 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-950 text-white">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-2xl font-black tracking-[-0.04em] text-emerald-950">{item.value}</p>
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-4 py-4 md:px-6">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#9B7A22]/30 bg-[#fff7dc] text-[#8a6412]">
            <PackageCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold leading-7 text-slate-800">{DBIN_PUBLIC_PLATFORM_PROMISE}</p>
        </div>
      </div>
    </section>
  );
}

function CategoryDiscovery() {
  return (
    <section className="bg-[#fbfaf5] py-14 sm:py-16" aria-labelledby="business-discovery">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 id="business-discovery" className="text-3xl font-black tracking-[-0.04em] text-emerald-950 sm:text-4xl">
            Discover trusted Nigerian businesses
          </h2>
          <p className="mt-3 text-base font-medium text-slate-600">Search by what you need, where you need it.</p>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORY_CARDS.map(({ label, category, image, alt, icon: Icon }) => (
            <Link
              key={label}
              href={categoryHref(category)}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <div className="relative h-44 overflow-hidden sm:h-56 lg:h-64">
                <Image src={image} alt={alt} fill sizes="(min-width:1024px) 16vw, (min-width:768px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
              </div>
              <div className="relative -mt-7 flex flex-col items-center px-3 pb-5 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-emerald-900 text-white shadow-lg">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-black leading-5 text-emerald-950 sm:text-base">{label}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BusinessCard({ provider }: { provider: ProviderCard }) {
  const profileHref = buildProviderProfileHref(provider);
  const quoteHref = buildProviderQuoteHref(provider);
  const ratingLabel = provider.review_count > 0 ? `${provider.avg_rating.toFixed(1)}` : "Newly verified";

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/70 transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative h-56 overflow-hidden">
        <Image
          src={providerImage(provider)}
          alt={`Representative image for ${provider.category || "a verified DBIN business"}`}
          fill
          sizes="(min-width:1024px) 33vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-black text-white shadow">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Verified business
        </div>
        {provider.review_count === 0 ? (
          <div className="absolute right-4 top-4 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 shadow">Newly verified</div>
        ) : null}
      </div>
      <div className="p-5">
        <h3 className="flex items-center gap-2 text-xl font-black tracking-[-0.025em] text-slate-950">
          {provider.display_name ?? provider.business_name}
          <CheckCircle2 className="h-4 w-4 shrink-0 fill-emerald-600 text-white" aria-label="Verified" />
        </h3>
        <p className="mt-1 text-sm font-semibold text-slate-700">{provider.category || "General Services"}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {displayLocation(provider)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 font-black text-slate-800">
            {provider.review_count > 0 ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" /> : null}
            {ratingLabel}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <Timer className="h-4 w-4" aria-hidden="true" />
            Response time available on enquiry
          </span>
        </div>
        <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600">{provider.short_description}</p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Open for enquiries
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href={profileHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/30 px-4 text-sm font-black text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
            View profile
          </Link>
          <Link href={quoteHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
            Request quote
          </Link>
        </div>
      </div>
    </article>
  );
}

function FeaturedBusinesses({ providers }: { providers: ProviderCard[] }) {
  return (
    <section className="bg-[#fbfaf5] pb-14 sm:pb-16" aria-labelledby="featured-businesses">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="featured-businesses" className="text-3xl font-black tracking-[-0.04em] text-emerald-950">
          Businesses ready to work with you
        </h2>
        {providers.length ? (
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {providers.map((provider) => (
              <BusinessCard key={provider.id} provider={provider} />
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-black text-emerald-950">Verified marketplace profiles are being prepared for homepage display.</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              DBIN will show only complete, public, approved business profiles here. You can still explore the live marketplace.
            </p>
            <Link href="/marketplace" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
              Explore marketplace
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function AssuranceStrip() {
  return (
    <section className="relative overflow-hidden bg-[#003b2d] text-white">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[#b58a2a]/35" aria-hidden="true" />
      <div className="absolute -bottom-16 right-8 h-40 w-40 rounded-full border border-[#b58a2a]/35" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {ASSURANCE_ITEMS.map(({ title, text, icon: Icon }) => (
          <article key={title} className="flex gap-4 border-white/10 py-3 lg:border-r lg:pr-6 lg:last:border-r-0">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-emerald-200/30 text-emerald-200">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-black">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-emerald-50/82">{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#001615] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <DbinBrandLogo compactOnMobile={false} iconClassName="h-12 w-12 rounded-full" textClassName="max-w-[11rem] whitespace-normal text-sm font-black leading-tight text-white" />
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-[#67F3A5] px-4 text-sm font-black text-emerald-950 transition hover:bg-[#8DF7BA]">
              Register Business
            </Link>
          </div>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/72">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-white/45">© {new Date().getFullYear()} Digital Business Identity Network. Trusted business identity, records and marketplace access for Nigerian enterprise.</p>
      </div>
    </footer>
  );
}

export default async function LandingPage() {
  const featuredProviders = await getFeaturedHomepageProviders();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Digital Business Identity Network",
    alternateName: "DBIN",
    url: "https://www.dbin.ng",
    description:
      "Create a verified business identity, showcase products and services, manage business records and connect with trusted buyers across Nigeria.",
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfaf5] text-slate-950">
      <HeaderNav />
      <main id="main-content">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <section className="relative overflow-hidden bg-[#003b2d] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(103,243,165,0.18),transparent_30%),linear-gradient(115deg,#003b2d_0%,#003325_46%,#001615_100%)]" />
          <div className="absolute inset-y-0 left-0 w-1/2 opacity-[0.08] [background-image:linear-gradient(135deg,#fff_1px,transparent_1px)] [background-size:18px_18px]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl lg:grid-cols-[0.86fr_1.14fr]">
            <div className="px-4 pb-9 pt-12 sm:px-6 sm:pb-12 sm:pt-16 lg:px-8 lg:pb-16 lg:pt-20">
              <h1 className="max-w-2xl text-5xl font-black leading-[1.04] tracking-[-0.06em] sm:text-6xl xl:text-7xl">
                Build trust.
                <br />
                Find customers.
                <br />
                <span className="text-[#67F3A5]">Grow your business.</span>
              </h1>
              <p className="mt-7 max-w-lg text-lg font-medium leading-8 text-emerald-50">
                Create a verified business identity, showcase what you offer, manage your records and connect with buyers across Nigeria.
              </p>
              <div className="mt-9 flex flex-col gap-3 min-[430px]:flex-row">
                <Link href="/register" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[#67F3A5] px-7 text-sm font-black text-emerald-950 shadow-xl shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-[#8DF7BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                  Register your business
                </Link>
                <Link href="/marketplace" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/45 px-7 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                  Explore verified businesses
                </Link>
              </div>
            </div>
            <HeroCollage />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:-mt-10 lg:px-8">
            <div className="max-w-4xl">
              <MarketplaceSearch />
            </div>
          </div>
        </section>
        <ProofStrip />
        <CategoryDiscovery />
        <FeaturedBusinesses providers={featuredProviders} />
        <AssuranceStrip />
      </main>
      <Footer />
    </div>
  );
}
