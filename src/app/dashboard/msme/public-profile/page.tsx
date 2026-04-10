import Image from "next/image";
import Link from "next/link";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MsmePublicProfilePreviewPage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const [{ data: services }, { data: gallery }] = await Promise.all([
    supabase.from("provider_services").select("id,title,category,availability_status,min_price,max_price").eq("provider_id", workspace.provider.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("provider_gallery").select("id,asset_url,caption,is_featured").eq("provider_id", workspace.provider.id).order("sort_order", { ascending: true }).limit(4),
  ]);

  return (
    <section className="space-y-4">
      <article className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Public profile preview</h2>
          <Link href={`/providers/${workspace.provider.public_slug}`} className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Open public page</Link>
        </div>
        <p className="mt-1 text-sm text-slate-600">This is what public buyers will evaluate before sending a quote request.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <Image
            src={workspace.provider.logo_url ?? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80"}
            alt={workspace.provider.display_name}
            width={420}
            height={260}
            className="h-40 w-full rounded-xl object-cover"
          />
          <div>
            <h3 className="text-xl font-semibold">{workspace.provider.display_name}</h3>
            <p className="text-sm text-slate-500">{workspace.msme.sector} • {workspace.msme.state}</p>
            <p className="mt-2 text-sm text-slate-700">{workspace.provider.short_description ?? "No short description yet."}</p>
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Live services</h3>
          <div className="mt-2 space-y-2 text-sm">
            {(services ?? []).map((service) => (
              <div key={service.id} className="rounded-lg border bg-slate-50 p-2">
                <p className="font-medium">{service.title}</p>
                <p className="text-xs text-slate-500">{service.category} • {service.availability_status}</p>
                <p className="text-xs text-slate-600">₦{Number(service.min_price ?? 0).toLocaleString()} - ₦{Number(service.max_price ?? 0).toLocaleString()}</p>
              </div>
            ))}
            {(!services || services.length === 0) && <p className="text-xs text-slate-500">No services listed yet.</p>}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Gallery</h3>
          <div className="mt-2 grid gap-2 grid-cols-2">
            {(gallery ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-2">
                <p className="truncate text-xs text-slate-600">{item.caption ?? "Portfolio asset"}</p>
                {item.is_featured && <p className="text-[10px] font-semibold uppercase text-amber-700">Featured</p>}
              </div>
            ))}
            {(!gallery || gallery.length === 0) && <p className="col-span-2 text-xs text-slate-500">No gallery assets yet.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
