import Link from "next/link";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MsmeComplaintsPage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id,summary,severity,status,created_at,reporter_name")
    .or(`provider_profile_id.eq.${workspace.provider.id},provider_id.eq.${workspace.provider.id}`)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Provider complaint log</h2>
      <p className="mt-1 text-sm text-slate-500">Read-only visibility into public complaints routed to regulators.</p>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Summary</th><th className="px-3 py-2">Reporter</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th></tr></thead>
          <tbody>
            {(complaints ?? []).map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.summary ?? "Complaint report"}</td>
                <td className="px-3 py-2">{item.reporter_name ?? "Public user"}</td>
                <td className="px-3 py-2 uppercase">{item.severity ?? "medium"}</td>
                <td className="px-3 py-2">{item.status ?? "open"}</td>
                <td className="px-3 py-2 text-xs">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {(!complaints || complaints.length === 0) && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No complaints currently linked to this provider profile.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">For escalation workflows use <Link href="/dashboard/fccpc" className="text-indigo-700 hover:underline">FCCPC Workspace</Link>.</p>
    </section>
  );
}
