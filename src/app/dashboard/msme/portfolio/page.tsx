import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function galleryAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const kind = String(formData.get("kind") ?? "create");
  const itemId = String(formData.get("item_id") ?? "");

  const payload = {
    provider_id: workspace.provider.id,
    asset_url: String(formData.get("asset_url") ?? ""),
    caption: String(formData.get("caption") ?? "").trim() || null,
    is_featured: String(formData.get("is_featured") ?? "false") === "true",
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    updated_at: new Date().toISOString(),
  };

  if (kind === "delete" && itemId) {
    await supabase.from("provider_gallery").delete().eq("id", itemId).eq("provider_id", workspace.provider.id);
  } else if (kind === "update" && itemId) {
    await supabase.from("provider_gallery").update(payload).eq("id", itemId).eq("provider_id", workspace.provider.id);
  } else {
    await supabase.from("provider_gallery").insert(payload);
  }

  revalidatePath("/dashboard/msme/portfolio");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/portfolio?saved=1");
}

export default async function MsmePortfolioPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const { data: gallery } = await supabase
    .from("provider_gallery")
    .select("id,asset_url,caption,is_featured,sort_order")
    .eq("provider_id", workspace.provider.id)
    .order("sort_order", { ascending: true });

  return (
    <section className="space-y-4">
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Portfolio updated.</p>}

      <form action={galleryAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
        <input type="hidden" name="kind" value="create" />
        <input name="asset_url" required placeholder="Image URL" className="rounded border px-2 py-2 text-sm md:col-span-2" />
        <input name="caption" placeholder="Caption" className="rounded border px-2 py-2 text-sm" />
        <input name="sort_order" type="number" defaultValue={0} className="rounded border px-2 py-2 text-sm" />
        <select name="is_featured" className="rounded border px-2 py-2 text-sm"><option value="false">Normal</option><option value="true">Featured</option></select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add portfolio item</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {(gallery ?? []).map((item) => (
          <article key={item.id} className="rounded-xl border bg-white p-4">
            <form action={galleryAction} className="space-y-2">
              <input type="hidden" name="kind" value="update" />
              <input type="hidden" name="item_id" value={item.id} />
              <input name="asset_url" defaultValue={item.asset_url} className="w-full rounded border px-2 py-2 text-sm" />
              <input name="caption" defaultValue={item.caption ?? ""} className="w-full rounded border px-2 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input name="sort_order" type="number" defaultValue={item.sort_order ?? 0} className="rounded border px-2 py-2 text-sm" />
                <select name="is_featured" defaultValue={String(Boolean(item.is_featured))} className="rounded border px-2 py-2 text-sm"><option value="false">Normal</option><option value="true">Featured</option></select>
              </div>
              <button className="rounded bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">Save</button>
            </form>
            <form action={galleryAction} className="mt-2">
              <input type="hidden" name="kind" value="delete" />
              <input type="hidden" name="item_id" value={item.id} />
              <button className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-700">Delete</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
