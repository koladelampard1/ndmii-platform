import Link from "next/link";
import { getMsmes } from "@/lib/data/ndmii";

export default async function MsmePage() {
  const rows = await getMsmes();
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MSME Registry</h1>
        <Link href="/dashboard/msme/onboarding" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Start onboarding</Link>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Business</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Sector</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id} className="border-t"><td className="px-3 py-2">{row.business_name}</td><td className="px-3 py-2">{row.state}</td><td className="px-3 py-2">{row.sector}</td><td className="px-3 py-2">{row.verification_status}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
