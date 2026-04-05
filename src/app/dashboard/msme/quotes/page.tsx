import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function quoteAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const quoteId = String(formData.get("quote_id") ?? "");
  const kind = String(formData.get("kind") ?? "respond");

  if (kind === "respond") {
    await supabase
      .from("provider_quote_requests")
      .update({
        status: "responded",
        provider_response: String(formData.get("provider_response") ?? "").trim() || "Provider acknowledged request. Full quote workflow is being finalized.",
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .eq("provider_id", workspace.provider.id);
  }

  if (kind === "mark_review") {
    await supabase
      .from("provider_quote_requests")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("provider_id", workspace.provider.id);
  }

  revalidatePath("/dashboard/msme/quotes");
  redirect("/dashboard/msme/quotes?saved=1");
}

export default async function MsmeQuotesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const { data: quotes } = await supabase
    .from("provider_quote_requests")
    .select("id,customer_name,customer_contact,service_details,requested_date,status,provider_response,created_at")
    .eq("provider_id", workspace.provider.id)
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-4">
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote request updated.</p>}
      {(quotes ?? []).map((quote) => (
        <article key={quote.id} className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{quote.customer_name}</h2>
            <p className="rounded-full bg-slate-100 px-2 py-1 text-xs uppercase">{quote.status}</p>
          </div>
          <p className="text-sm text-slate-600">{quote.customer_contact}</p>
          <p className="mt-2 text-sm">{quote.service_details}</p>
          <p className="mt-1 text-xs text-slate-500">Requested date: {quote.requested_date ?? "Not specified"}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={quoteAction}>
              <input type="hidden" name="kind" value="mark_review" />
              <input type="hidden" name="quote_id" value={quote.id} />
              <button className="rounded border px-3 py-1 text-xs">Mark in-review</button>
            </form>
            <form action={quoteAction} className="flex flex-1 gap-2">
              <input type="hidden" name="kind" value="respond" />
              <input type="hidden" name="quote_id" value={quote.id} />
              <input name="provider_response" placeholder="Response placeholder" defaultValue={quote.provider_response ?? ""} className="min-w-56 flex-1 rounded border px-2 py-1 text-xs" />
              <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Send response placeholder</button>
            </form>
          </div>
        </article>
      ))}
      {(!quotes || quotes.length === 0) && <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">No quote requests yet. Public users can submit requests from your provider profile page.</p>}
    </section>
  );
}
