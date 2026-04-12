import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; provider?: string; association?: string; from?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase
    .from("complaints")
    .select("id,complaint_reference,title,status,priority,provider_business_name,association_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.status) query = query.eq("status", params.status);
  if (params.provider) query = query.ilike("provider_business_name", `%${params.provider}%`);
  if (params.association) query = query.eq("association_id", params.association);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00.000Z`);

  const { data: complaints } = await query;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <h1 className="text-2xl font-semibold">Admin complaints monitor</h1>
        <p className="mt-1 text-sm text-slate-600">National view of complaint submissions, assignments, and unresolved queues.</p>
      </header>
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-5">
        <input name="provider" defaultValue={params.provider} placeholder="Provider name" className="rounded border px-2 py-2 text-sm" />
        <input name="association" defaultValue={params.association} placeholder="Association ID" className="rounded border px-2 py-2 text-sm" />
        <input name="from" type="date" defaultValue={params.from} className="rounded border px-2 py-2 text-sm" />
        <select name="status" defaultValue={params.status} className="rounded border px-2 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="submitted">submitted</option>
          <option value="under_review">under_review</option>
          <option value="awaiting_msme_response">awaiting_msme_response</option>
          <option value="awaiting_complainant_response">awaiting_complainant_response</option>
          <option value="association_follow_up">association_follow_up</option>
          <option value="regulator_review">regulator_review</option>
          <option value="resolved">resolved</option>
          <option value="closed">closed</option>
          <option value="escalated">escalated</option>
          <option value="dismissed">dismissed</option>
        </select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Action</th></tr></thead>
          <tbody>
            {(complaints ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 text-xs font-semibold">{row.complaint_reference ?? String(row.id).slice(0, 8)}</td>
                <td className="px-3 py-2">{row.provider_business_name ?? "Provider"}</td>
                <td className="px-3 py-2">{row.title ?? "Complaint"}</td>
                <td className="px-3 py-2 uppercase">{row.priority ?? "medium"}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 text-xs">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2"><Link href={`/dashboard/executive/complaints/${row.id}`} className="text-indigo-700 hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
