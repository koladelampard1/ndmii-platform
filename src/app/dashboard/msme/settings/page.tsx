import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function settingsAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  await supabase
    .from("provider_profiles")
    .update({
      display_name: String(formData.get("display_name") ?? workspace.provider.display_name),
      tagline: String(formData.get("short_description") ?? "").trim() || null,
      description: String(formData.get("long_description") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspace.provider.id)
    .eq("msme_id", workspace.provider.msme_id);

  revalidatePath("/dashboard/msme/settings");
  revalidatePath(`/providers/${workspace.provider.slug}`);
  redirect("/dashboard/msme/settings?saved=1");
}

export default async function MsmeSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();

  return (
    <section className="space-y-4">
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Provider settings saved.</p>}
      <form action={settingsAction} className="grid gap-2 rounded-xl border bg-white p-4">
        <input name="display_name" defaultValue={workspace.provider.display_name} className="rounded border px-2 py-2 text-sm" />
        <input name="short_description" defaultValue={workspace.provider.short_description ?? ""} placeholder="Short description" className="rounded border px-2 py-2 text-sm" />
        <textarea name="long_description" defaultValue={workspace.provider.long_description ?? ""} className="min-h-32 rounded border px-2 py-2 text-sm" />
        <button className="w-fit rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Save settings</button>
      </form>
    </section>
  );
}
