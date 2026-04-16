import Link from "next/link";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MsmeComplaintsPage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const loggedInMsmeId = workspace.msme.id;
  const loggedInPublicMsmeId = workspace.msme.msme_id;
  const loggedInProviderId = workspace.provider.id;
  const loggedInAssociationId = null;
  const filterBeingUsed = "msme_id";
  const extraFiltersApplied: string[] = [];

  console.log("[msme-complaints][query-context]", {
    loggedInMsmeId,
    loggedInPublicMsmeId,
    loggedInProviderId,
    loggedInAssociationId,
    filterBeingUsed,
  });

  console.log("[msme-complaints][final-query]", {
    filterField: "msme_id",
    filterValue: loggedInMsmeId,
    extraFiltersApplied,
  });

  const { data: rows } = await supabase
    .from("complaints")
    .select("id,msme_id,complaint_reference,title,summary,priority,status,created_at,complainant_name,reporter_name")
    .eq("msme_id", loggedInMsmeId)
    .order("created_at", { ascending: false })
    .limit(50);

  console.log("[msme-complaints][result-summary]", {
    rowCount: rows?.length ?? 0,
    complaintIds: (rows ?? []).map((row) => row.id),
    msmeIds: (rows ?? []).map((row) => row.msme_id),
  });

  const complaints = rows;

  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Provider complaint log</h2>
      <p className="mt-1 text-sm text-slate-500">Track complaints raised against your provider profile and respond to move cases forward.</p>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Complainant</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Action</th></tr></thead>
          <tbody>
            {(complaints ?? []).map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 text-xs font-semibold">{item.complaint_reference ?? String(item.id).slice(0, 8)}</td>
                <td className="px-3 py-2">{item.title ?? item.summary ?? "Complaint report"}</td>
                <td className="px-3 py-2">{item.complainant_name ?? item.reporter_name ?? "Public user"}</td>
                <td className="px-3 py-2 uppercase">{item.priority ?? "medium"}</td>
                <td className="px-3 py-2">{item.status ?? "submitted"}</td>
                <td className="px-3 py-2 text-xs">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2"><Link href={`/dashboard/msme/complaints/${item.id}`} className="text-indigo-700 hover:underline">Open</Link></td>
              </tr>
            ))}
            {(!complaints || complaints.length === 0) && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No complaints currently linked to this provider profile.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">For escalation workflows use <Link href="/dashboard/fccpc" className="text-indigo-700 hover:underline">FCCPC Workspace</Link>.</p>
    </section>
  );
}
