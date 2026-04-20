import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { searchPublicVerificationRecords } from "@/lib/data/public-verification";

export default async function VerifySearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const hasSearch = query.length > 0;
  const results = hasSearch ? await searchPublicVerificationRecords(query) : [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar />
      <section className="px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <header className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg shadow-slate-300/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">NDMII Public Verification</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">Verify an MSME digital identity</h1>
            <p className="mt-2 text-slate-600">Enter a digital ID or business name to confirm official registry status.</p>

            <form className="mx-auto mt-6 grid max-w-2xl gap-2 md:grid-cols-[1fr_auto]">
              <input
                name="q"
                defaultValue={params.q}
                placeholder="NDMII-LAG-000001 or business name"
                className="h-12 rounded-xl border border-slate-300 px-4 text-slate-900 outline-none ring-emerald-500 transition focus:ring-2"
              />
              <button className="h-12 rounded-xl bg-slate-900 px-6 font-medium text-white transition hover:bg-slate-800">Verify</button>
            </form>
          </header>

          <section className="mx-auto mt-8 max-w-3xl">
            {!hasSearch && (
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-center text-sm text-slate-600 shadow-sm">
                Search to view a verification result.
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  <Link href="/sample-id-card" className="font-medium text-emerald-700 hover:text-emerald-800">View sample ID card</Link>
                  <Link href="/register/msme" className="font-medium text-emerald-700 hover:text-emerald-800">Register your business</Link>
                </div>
              </div>
            )}

            {hasSearch && results.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-900">
                No matching MSME was found for “{query}”. Check the ID and try again.
              </div>
            )}

            {hasSearch && results.length > 0 && (
              <div className="space-y-3">
                {results.map((row) => (
                  <article key={`${row.id}-${row.route_id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-lg font-semibold text-slate-900">{row.business_name}</p>
                    <p className="text-sm text-slate-600">ID: {row.route_id}</p>
                    <p className="mt-2 text-sm text-slate-600">{row.state} • {row.sector} • Status: {row.digital_status ?? row.verification_status}</p>
                    <Link
                      href={`/verify/${encodeURIComponent(row.route_id)}`}
                      className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-600"
                    >
                      View verification result →
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
