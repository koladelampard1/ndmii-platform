import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

export default async function DigitalIdRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; sector?: string; status?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,state,sector,verification_status,issued_at")
    .order("issued_at", { ascending: false, nullsFirst: false });
  let rows = data ?? [];

  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((row) => row.msme_id.toLowerCase().includes(q) || row.business_name.toLowerCase().includes(q));
  }
  if (params.state) rows = rows.filter((row) => row.state === params.state);
  if (params.sector) rows = rows.filter((row) => row.sector === params.sector);
  if (params.status) rows = rows.filter((row) => row.verification_status === params.status);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Digital ID Registry</h1>
        <p className="text-sm text-slate-600">Search and inspect all generated MSME digital identities.</p>
      </div>
      <form className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-5">
        <input name="q" placeholder="MSME ID or business" defaultValue={params.q} className="rounded border px-3 py-2" />
        <input name="state" placeholder="State" defaultValue={params.state} className="rounded border px-3 py-2" />
        <input name="sector" placeholder="Sector" defaultValue={params.sector} className="rounded border px-3 py-2" />
        <input name="status" placeholder="Status" defaultValue={params.status} className="rounded border px-3 py-2" />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">MSME ID</th>
              <th className="px-3 py-2">Business name</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Sector</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                  No digital IDs match the selected filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-medium">{row.msme_id}</td>
                <td className="px-3 py-2">{row.business_name}</td>
                <td className="px-3 py-2">{row.state}</td>
                <td className="px-3 py-2">{row.sector}</td>
                <td className="px-3 py-2 capitalize">{row.verification_status}</td>
                <td className="px-3 py-2">{row.issued_at ? new Date(row.issued_at).toLocaleDateString() : "Not issued"}</td>
                <td className="px-3 py-2">
                  <Link className="text-emerald-700 hover:underline" href={`/dashboard/msme/id-card/${encodeURIComponent(row.msme_id)}`}>
                    Open card
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
