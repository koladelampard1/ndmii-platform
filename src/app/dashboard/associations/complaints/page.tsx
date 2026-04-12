import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export default async function AssociationComplaintsPage() {
  const ctx = await getCurrentUserContext();
  if (!["association_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase
    .from("complaints")
    .select("id,complaint_reference,title,status,priority,provider_business_name,association_id,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (ctx.role === "association_officer") {
    query = query.eq("association_id", ctx.linkedAssociationId ?? "");
  }

  const { data: complaints } = await query;

  return (
    <section className="rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">Association complaints workspace</h1>
      <p className="mt-1 text-sm text-slate-600">Track complaints for member providers in your association and escalate when needed.</p>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Action</th></tr></thead>
          <tbody>
            {(complaints ?? []).map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 text-xs font-semibold">{item.complaint_reference ?? String(item.id).slice(0, 8)}</td>
                <td className="px-3 py-2">{item.provider_business_name ?? "Provider"}</td>
                <td className="px-3 py-2">{item.title ?? "Complaint"}</td>
                <td className="px-3 py-2 uppercase">{item.priority ?? "medium"}</td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2 text-xs">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2"><Link className="text-indigo-700 hover:underline" href={`/dashboard/associations/complaints/${item.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
