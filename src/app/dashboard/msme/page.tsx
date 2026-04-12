import Link from "next/link";
import { fetchProviderQuoteInboxCount } from "@/lib/data/provider-quote-queries";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MsmePage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const quoteCountPromise = fetchProviderQuoteInboxCount(supabase, workspace.provider.id);

  const [{ count: serviceCount }, { count: galleryCount }, quoteCount, { count: openComplaintCount }] = await Promise.all([
    supabase.from("provider_services").select("id", { count: "exact", head: true }).eq("provider_id", workspace.provider.id),
    supabase.from("provider_gallery").select("id", { count: "exact", head: true }).eq("provider_id", workspace.provider.id),
    quoteCountPromise,
    supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .or(`provider_profile_id.eq.${workspace.provider.id},provider_id.eq.${workspace.provider.id}`)
      .neq("status", "closed"),
  ]);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Provider profile</p>
          <p className="mt-1 text-lg font-semibold">{workspace.provider.display_name}</p>
          <p className="text-xs text-slate-500">ID: {workspace.msme.msme_id}</p>
        </article>
        <article className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Services listed</p>
          <p className="mt-1 text-3xl font-semibold">{serviceCount ?? 0}</p>
        </article>
        <article className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Portfolio items</p>
          <p className="mt-1 text-3xl font-semibold">{galleryCount ?? 0}</p>
        </article>
        <article className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Quote inbox</p>
          <p className="mt-1 text-3xl font-semibold">{quoteCount ?? 0}</p>
          <p className="text-xs text-slate-500">Open complaints: {openComplaintCount ?? 0}</p>
        </article>
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Operational readiness</h2>
        <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-slate-700 md:grid-cols-2">
          <li>Public provider URL: <Link className="font-medium text-indigo-700 hover:underline" href={`/providers/${workspace.provider.public_slug}`}>/providers/{workspace.provider.public_slug}</Link></li>
          <li>Verification status: <span className="font-medium uppercase">{workspace.msme.verification_status}</span></li>
          <li>Sector coverage: {workspace.msme.sector} • {workspace.msme.state}</li>
          <li>Trust score signal: <span className="font-semibold">{workspace.provider.trust_score}</span></li>
        </ul>
      </article>
    </section>
  );
}
