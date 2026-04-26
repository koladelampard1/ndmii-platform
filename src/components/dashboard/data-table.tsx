import Link from "next/link";

export function DataTable({ rows }: { rows: { msme_id: string; state: string; sector: string; verification_status: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-[640px] w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3">MSME ID</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Sector</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Card</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="px-4 py-5 text-center text-slate-500" colSpan={5}>No MSME records available.</td></tr>
          )}
          {rows.map((row) => (
            <tr key={row.msme_id} className="border-t">
              <td className="px-4 py-3">{row.msme_id}</td>
              <td className="px-4 py-3">{row.state}</td>
              <td className="px-4 py-3">{row.sector}</td>
              <td className="px-4 py-3">{row.verification_status}</td>
              <td className="px-4 py-3"><Link href={`/dashboard/msme/id-card/${encodeURIComponent(row.msme_id)}`} className="text-emerald-700 hover:underline">View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
