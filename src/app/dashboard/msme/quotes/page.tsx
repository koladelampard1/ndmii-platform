import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getTableColumns } from "@/lib/data/commercial-ops";
import { getOwnedProviderQuoteIdsForWorkspace, getProviderQuoteOwnershipColumns } from "@/lib/data/provider-quote-ownership";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const STATUS_OPTIONS = ["new", "in_review", "accepted", "converted", "closed", "declined"] as const;

function statusClasses(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === "new") return "bg-blue-100 text-blue-700";
  if (normalizedStatus === "in_review") return "bg-amber-100 text-amber-700";
  if (normalizedStatus === "accepted") return "bg-emerald-100 text-emerald-700";
  if (normalizedStatus === "converted") return "bg-violet-100 text-violet-700";
  if (normalizedStatus === "declined") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default async function MsmeQuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; saved?: string }> }) {
  const params = await searchParams;
  const currentUser = await getCurrentUserContext();
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const quoteColumns = await getTableColumns(supabase, "provider_quotes");
  const ownershipColumns = getProviderQuoteOwnershipColumns(quoteColumns);
  const selectFields = Array.from(
    new Set([
      "id",
      "requester_name",
      "requester_email",
      "requester_phone",
      "request_summary",
      "budget_min",
      "budget_max",
      "status",
      "created_at",
      ...ownershipColumns,
    ])
  );

  let query = supabase
    .from("provider_quotes")
    .select(selectFields.join(","))
    .order("created_at", { ascending: false });

  if (params.status && STATUS_OPTIONS.includes(params.status as (typeof STATUS_OPTIONS)[number])) {
    query = query.eq("status", params.status);
  }

  const { data: fetchedQuotes, error } = await query;
  if (error) throw new Error(error.message);
  const quoteRows = ((fetchedQuotes ?? []) as unknown) as Array<Record<string, unknown>>;
  const ownership = getOwnedProviderQuoteIdsForWorkspace(quoteRows, workspace, {
    quoteColumns,
    linkedMsmeId: currentUser.linkedMsmeId ?? null,
    linkedProviderId: currentUser.linkedProviderId ?? null,
  });
  const quotes = quoteRows.filter((quote) => ownership.ownedIds.has(String(quote.id ?? ""))) as Array<any>;

  if (process.env.NODE_ENV !== "production") {
    for (const quote of quotes) {
      const quoteId = String(quote.id ?? "");
      const resolution = ownership.resolutionByQuoteId.get(quoteId);
      console.info("[quote-list-ownership]", {
        quoteId,
        quoteRow: quote,
        workspaceKeys: resolution?.workspaceKeys ?? null,
        quoteKeys: resolution?.quoteKeys ?? null,
        matchReason: resolution?.matchReason ?? "missing_resolution",
        isOwned: resolution?.isOwned ?? false,
      });
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <h2 className="text-xl font-semibold">Quote workspace</h2>
        <p className="text-sm text-slate-600">Track incoming quote requests, review status, and convert approved requests into invoices.</p>
      </header>

      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote updated successfully.</p>}

      <form className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <select name="status" defaultValue={params.status ?? ""} className="rounded border px-2 py-2 text-sm">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button className="rounded border px-3 py-2 text-sm">Apply filter</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2">Requester</th>
              <th className="px-3 py-2">Summary</th>
              <th className="px-3 py-2">Budget</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(quotes ?? []).length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  No quote requests found.
                </td>
              </tr>
            )}
            {(quotes ?? []).map((quote) => {
              const normalizedStatus = String(quote.status ?? "").toLowerCase();
              return (
                <tr key={quote.id} className="border-t">
                <td className="px-3 py-3">
                  <p className="font-medium">{quote.requester_name}</p>
                  <p className="text-xs text-slate-500">{quote.requester_email ?? quote.requester_phone ?? "No contact"}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{quote.request_summary}</p>
                  <p className="text-xs text-slate-500">{new Date(quote.created_at).toLocaleString("en-NG")}</p>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">
                  ₦{Number(quote.budget_min ?? 0).toLocaleString()} - ₦{Number(quote.budget_max ?? 0).toLocaleString()}
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs uppercase ${statusClasses(normalizedStatus)}`}>{normalizedStatus}</span>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/dashboard/msme/quotes/${quote.id}`} className="text-indigo-700 hover:underline">
                    Open workflow
                  </Link>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
