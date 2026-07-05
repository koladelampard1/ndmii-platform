import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, FileSearch, Landmark, MapPin, Search, ShieldCheck } from "lucide-react";
import type { PublicPropertySummary, PublicPropertyVerificationResult } from "@/lib/data/public-property-explorer";

export function PropertyPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06172f]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/property" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#008751]"><Landmark className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-black">DLPI</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">Powered by DBIN</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-bold text-slate-200 md:flex">
            <Link href="/property/explorer">Explorer</Link>
            <Link href="/property/search">Search</Link>
            <Link href="/property/verify">Verify</Link>
            <Link href="/property/resources">Resources</Link>
            <Link href="/property/help">Help</Link>
          </nav>
          <Link href="/dashboard/property" className="rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white">Registry Login</Link>
        </div>
      </header>
      {children}
    </main>
  );
}

export function PropertyHero({
  eyebrow = "Digital Land Intelligence Platform",
  title,
  description,
  searchDefault,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  searchDefault?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#06172f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,135,81,0.35),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(212,160,23,0.22),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
        <div>
          <p className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{description}</p>
          <form action="/property/search" className="mt-8 grid max-w-3xl gap-3 rounded-3xl border border-white/10 bg-white/10 p-3 shadow-2xl backdrop-blur md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={searchDefault} placeholder="Search by NPIN, state, LGA, property type or keyword" className="h-14 w-full rounded-2xl border border-white/10 bg-white px-12 text-sm font-semibold text-slate-900 outline-none ring-[#008751] transition focus:ring-2" />
            </label>
            <button className="h-14 rounded-2xl bg-[#D4A017] px-6 text-sm font-black text-[#06172f] transition hover:-translate-y-0.5 hover:bg-[#f2c76b]">Search Registry</button>
          </form>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
          <div className="rounded-[1.5rem] bg-white p-5 text-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#008751]">Public trust record</p>
            <div className="mt-5 space-y-3">
              {["NPIN lookup", "Credential status", "Registry authority", "Privacy-safe profile"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <ShieldCheck className="h-5 w-5 text-[#008751]" />
                  <span className="text-sm font-black text-[#06172f]">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-500">Public records intentionally exclude owner names, internal comments, private documents, phone numbers and emails.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-black text-[#06172f]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

export function PropertyCard({ property }: { property: PublicPropertySummary }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">{property.npin}</p>
          <h3 className="mt-2 text-xl font-black text-[#06172f]">{property.title}</h3>
          <p className="mt-2 text-sm capitalize text-slate-500">{property.category} · {property.propertyType}</p>
        </div>
        <StatusPill value={property.verificationStatus} />
      </div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <Info label="Location" value={`${property.lga}, ${property.state}`} />
        <Info label="Registry" value={property.registryStatus} />
        <Info label="Area" value={property.area ?? "Not published"} />
        <Info label="Credential" value={property.credentialStatus ?? "Unavailable"} />
      </div>
      <Link href={`/property/${encodeURIComponent(property.npin)}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#06172f] px-4 py-3 text-sm font-black text-white">
        View public profile
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

export function VerificationPanel({ result }: { result: PublicPropertyVerificationResult }) {
  const valid = result.status === "valid";
  return (
    <section className={`rounded-[2rem] border p-6 shadow-sm ${valid ? "border-emerald-200 bg-emerald-50" : result.status === "unknown" ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Verification result</p>
          <h2 className="mt-2 text-3xl font-black text-[#06172f]">{result.label}</h2>
          <p className="mt-2 text-sm text-slate-600">Checked at {new Date(result.verifiedAt).toLocaleString("en-NG")}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${valid ? "bg-emerald-700 text-white" : "bg-slate-900 text-white"}`}>
          <BadgeCheck className="h-4 w-4" />
          {result.status}
        </span>
      </div>
      {result.credential ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Info label="NPIN" value={result.credential.npin} />
          <Info label="Credential" value={result.credential.credentialReference} />
          <Info label="Status" value={result.credential.status} />
        </div>
      ) : null}
      {result.property ? <div className="mt-5"><PropertyCard property={result.property} /></div> : null}
      <p className="mt-5 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-600">{result.registryDisclaimer}</p>
    </section>
  );
}

export function PrivacyNotice() {
  return (
    <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <p className="text-xs font-black uppercase tracking-[0.16em]">Privacy-safe public registry</p>
      <h2 className="mt-2 text-2xl font-black">Ownership and sensitive case data are not public.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6">DLPI public pages show registry status, general location, property category and credential validity. Owner names, private addresses, phone numbers, emails, ownership percentages, internal comments, case history and private documents are intentionally withheld.</p>
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-1 font-black capitalize text-[#06172f]">{value}</div>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone = value === "verified" || value === "valid" ? "bg-emerald-100 text-emerald-800" : value === "approved" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

export const propertyTypeIcons = {
  industrial: Building2,
  agricultural: MapPin,
  government: Landmark,
  institutional: ShieldCheck,
  commercial: FileSearch,
};
