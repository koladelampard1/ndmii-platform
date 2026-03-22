import Link from "next/link";
import { searchMsme } from "@/lib/data/ndmii";

export default async function VerifySearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const results = await searchMsme(params.q ?? "");

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">Public MSME Verification Portal</h1>
        <p className="mt-2 text-slate-600">Search by MSME ID or business name for live regulatory verification status.</p>
      </header>
      <form className="flex gap-2 rounded-xl border bg-white p-4 shadow-sm">
        <input name="q" defaultValue={params.q} placeholder="e.g. NDMII-LAG-0001 or Eko Fresh" className="flex-1 rounded border px-3 py-2" />
        <button className="rounded bg-slate-900 px-4 py-2 text-white">Search</button>
      </form>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">MSME ID</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {results.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No matching MSMEs found.</td></tr>}
            {results.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.msme_id}</td>
                <td className="px-3 py-2">{row.business_name}</td>
                <td className="px-3 py-2">{row.state}</td>
                <td className="px-3 py-2">{row.verification_status}</td>
                <td className="px-3 py-2"><Link href={`/verify/${row.msme_id}`} className="text-emerald-700 hover:underline">View details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
