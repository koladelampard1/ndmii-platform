import Link from "next/link";
import { searchMsme } from "@/lib/data/ndmii";

export default async function VerifySearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const results = await searchMsme(params.q ?? "");
  const featured = results[0];

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-14">
      <header className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold">Public MSME Verification Portal</h1>
        <p className="mt-2 text-slate-600">Search NDMII digital IDs to confirm validation and issuance status.</p>
        <form className="mx-auto mt-5 grid max-w-2xl gap-2 md:grid-cols-[1fr_auto]">
          <input name="q" defaultValue={params.q} placeholder="Enter Digital ID or business name" className="rounded-xl border px-4 py-3" />
          <button className="rounded-xl bg-slate-900 px-5 py-3 text-white">Verify</button>
        </form>
      </header>

      {featured && (
        <article className="rounded-2xl border bg-gradient-to-r from-slate-950 to-emerald-800 p-6 text-white">
          <p className="text-xs uppercase tracking-wider text-emerald-200">Digital ID preview</p>
          <h2 className="mt-2 text-2xl font-semibold">{featured.business_name}</h2>
          <p className="mt-1 text-sm text-slate-200">{featured.msme_id} • {featured.state} • {featured.sector}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-emerald-300/50 px-3 py-1">Status: {featured.digital_status ?? featured.verification_status}</span>
            <span className="rounded-full border border-emerald-300/50 px-3 py-1">Registry: Federal issuer</span>
          </div>
          <Link href={`/verify/${featured.msme_id}`} className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900">Open verification snapshot</Link>
        </article>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {results.length === 0 && <p className="col-span-full rounded-xl border bg-white p-8 text-center text-slate-500">No matching MSMEs found.</p>}
        {results.map((row) => (
          <article key={row.id} className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold">{row.business_name}</p>
            <p className="text-xs text-slate-500">{row.msme_id}</p>
            <p className="mt-2 text-xs text-slate-600">{row.state} • {row.sector} • {row.digital_status ?? row.verification_status}</p>
            <Link href={`/verify/${row.msme_id}`} className="mt-3 inline-block text-sm text-emerald-700 hover:underline">View verification result →</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
