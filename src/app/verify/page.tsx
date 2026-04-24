import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { searchPublicVerificationRecords } from "@/lib/data/public-verification";

const trustChips = [
  "Instant QR verification",
  "Independent business registry",
  "Built for partners and institutions",
];

const trustCards = [
  {
    title: "Verify legitimacy",
    text: "Confirm that a business identity exists and matches available registry data.",
  },
  {
    title: "Confirm trust status",
    text: "Review verification status before onboarding, procurement, or partnership.",
  },
  {
    title: "Reduce onboarding risk",
    text: "Give partners, lenders, and marketplaces a faster way to confirm business credibility.",
  },
];

export default async function VerifySearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const hasSearch = query.length > 0;
  const results = hasSearch ? await searchPublicVerificationRecords(query) : [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar />

      <section className="relative overflow-hidden border-b border-emerald-900/30 bg-gradient-to-br from-emerald-950 via-emerald-950 to-emerald-900 px-6 pb-24 pt-14 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_38%)]" />
        <div className="pointer-events-none absolute -right-24 top-6 h-56 w-56 rounded-full border border-emerald-400/25 bg-emerald-400/10 blur-sm" />

        <div className="relative mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
              BIN Public Verification
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-5xl">Verify a Business Identity Credential</h1>
            <p className="mt-4 max-w-2xl text-base text-emerald-50/90 md:text-lg">
              Confirm a business credential, verification status, and trust profile on the Business Identity Network.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {trustChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-50"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden rounded-3xl border border-emerald-400/25 bg-slate-950/30 p-6 shadow-2xl shadow-emerald-950/40 md:block">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">BIN Public Verification</p>
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/80 to-slate-900/70 p-5">
              <p className="text-sm text-emerald-100/90">Business Identity Network</p>
              <p className="mt-2 text-lg font-semibold text-white">Credential ready for verification</p>
              <p className="mt-3 text-sm text-emerald-100/80">Use Business ID, MSME ID, BIN ID, or Business Name.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-14 px-6 pb-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-2xl shadow-slate-400/20 backdrop-blur md:p-8">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-emerald-100 p-2 text-emerald-700" aria-hidden>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M16 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verify Business ID</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Look up a business identity</h2>
                <p className="mt-1 text-sm text-slate-600">Label: Business ID, MSME ID, BIN ID, or Business Name</p>
              </div>
            </div>

            <form className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <input
                name="q"
                defaultValue={params.q}
                placeholder="Enter Business ID, MSME ID, or business name"
                className="h-12 rounded-xl border border-slate-300 px-4 text-slate-900 outline-none ring-emerald-500 transition focus:ring-2"
              />
              <button className="h-12 rounded-xl bg-emerald-700 px-6 font-medium text-white transition hover:bg-emerald-600">Verify Credential</button>
            </form>
            <p className="mt-3 text-sm text-slate-500">Example: NDMII-LAG-108168205 or Kado Engine Works</p>
          </div>

          <section>
            {!hasSearch && (
              <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 md:items-center">
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                  <p className="text-sm font-semibold text-emerald-900">Business Identity Network</p>
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Credential preview</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">Sample Business Ltd.</p>
                    <p className="mt-1 text-xs text-slate-500">BIN ID • NDMII-LAG-108168205</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-semibold leading-tight text-slate-900">Search to view a verified business credential</h3>
                  <p className="mt-2 text-slate-600">Find and confirm a business identity record in the BIN registry.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href="/sample-id-card" className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
                      View sample ID card
                    </Link>
                    <Link href="/register/msme" className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600">
                      Register your business
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {hasSearch && results.length === 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-900">
                No matching MSME was found for “{query}”. Check the ID and try again.
              </div>
            )}

            {hasSearch && results.length > 0 && (
              <div className="space-y-4">
                {results.map((row) => (
                  <article key={`${row.id}-${row.route_id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold text-slate-900">{row.business_name}</p>
                        <p className="mt-1 text-sm text-slate-600">Business ID / MSME ID: {row.route_id}</p>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        {row.digital_status ?? row.verification_status}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Business category</dt>
                        <dd className="mt-1 font-medium text-slate-900">{row.sector}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
                        <dd className="mt-1 font-medium text-slate-900">{row.state}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Owner / Contact</dt>
                        <dd className="mt-1 font-medium text-slate-900">{row.owner_name}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      <Link href={`/verify/${encodeURIComponent(row.route_id)}`} className="font-medium text-emerald-700 hover:text-emerald-600">
                        View verification result →
                      </Link>
                      {row.qr_code_ref ? (
                        <Link href={row.qr_code_ref} className="font-medium text-emerald-700 hover:text-emerald-600">
                          QR verification link
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-center text-2xl font-semibold text-slate-900">Why verify on BIN?</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {trustCards.map((card) => (
                <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 inline-flex rounded-full bg-emerald-100 p-2 text-emerald-700" aria-hidden>
                    <span className="block h-4 w-4 rounded-full bg-emerald-600/80" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{card.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 p-7 text-white shadow-xl shadow-emerald-950/30">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold">Want your business to become verifiable?</h2>
                <p className="mt-2 text-emerald-50/90">
                  Create a BIN profile and make your business easier to discover and trust.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/register/msme" className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400">
                  Register your business
                </Link>
                <Link href="/marketplace" className="rounded-lg border border-emerald-200/30 px-4 py-2 font-medium text-white hover:bg-emerald-800/40">
                  Browse marketplace
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
