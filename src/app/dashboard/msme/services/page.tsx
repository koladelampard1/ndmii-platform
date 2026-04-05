import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function serviceAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const kind = String(formData.get("kind") ?? "create");
  const serviceId = String(formData.get("service_id") ?? "");
  const payload = {
    provider_id: workspace.provider.id,
    category: String(formData.get("category") ?? "Professional Services"),
    specialization: String(formData.get("specialization") ?? "").trim() || null,
    title: String(formData.get("title") ?? ""),
    short_description: String(formData.get("short_description") ?? ""),
    pricing_mode: String(formData.get("pricing_mode") ?? "range"),
    min_price: Number(formData.get("min_price") ?? 0) || 0,
    max_price: Number(formData.get("max_price") ?? 0) || 0,
    turnaround_time: String(formData.get("turnaround_time") ?? "").trim() || null,
    vat_applicable: String(formData.get("vat_applicable") ?? "false") === "true",
    availability_status: String(formData.get("availability_status") ?? "available"),
    updated_at: new Date().toISOString(),
  };

  if (kind === "delete" && serviceId) {
    await supabase.from("provider_services").delete().eq("id", serviceId).eq("provider_id", workspace.provider.id);
  } else if (kind === "update" && serviceId) {
    await supabase.from("provider_services").update(payload).eq("id", serviceId).eq("provider_id", workspace.provider.id);
  } else {
    await supabase.from("provider_services").insert(payload);
  }

  revalidatePath("/dashboard/msme/services");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/services?saved=1");
}

export default async function MsmeServicesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const [{ data: services }, { data: categories }] = await Promise.all([
    supabase.from("provider_services").select("*").eq("provider_id", workspace.provider.id).order("created_at", { ascending: false }),
    supabase.from("service_categories").select("name").eq("is_active", true).order("name"),
  ]);

  return (
    <section className="space-y-4">
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Service catalog updated.</p>}

      <form action={serviceAction} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-3">
        <input type="hidden" name="kind" value="create" />
        <select name="category" className="rounded border px-2 py-2 text-sm">
          {(categories ?? []).map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
        </select>
        <input name="specialization" placeholder="Specialization" className="rounded border px-2 py-2 text-sm" />
        <input name="title" required placeholder="Service title" className="rounded border px-2 py-2 text-sm" />
        <input name="short_description" required placeholder="Short description" className="rounded border px-2 py-2 text-sm md:col-span-3" />
        <select name="pricing_mode" className="rounded border px-2 py-2 text-sm"><option value="fixed">fixed</option><option value="range">range</option><option value="negotiable">negotiable</option></select>
        <input name="min_price" type="number" min={0} step="0.01" placeholder="Minimum price" className="rounded border px-2 py-2 text-sm" />
        <input name="max_price" type="number" min={0} step="0.01" placeholder="Maximum price" className="rounded border px-2 py-2 text-sm" />
        <input name="turnaround_time" placeholder="Turnaround e.g. 5 days" className="rounded border px-2 py-2 text-sm" />
        <select name="vat_applicable" className="rounded border px-2 py-2 text-sm"><option value="false">VAT not applicable</option><option value="true">VAT applicable</option></select>
        <select name="availability_status" className="rounded border px-2 py-2 text-sm"><option value="available">available</option><option value="limited">limited</option><option value="unavailable">unavailable</option></select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add service</button>
      </form>

      <div className="space-y-3">
        {(services ?? []).map((service) => (
          <article key={service.id} className="rounded-xl border bg-white p-4">
            <form action={serviceAction} className="grid gap-2 md:grid-cols-3">
              <input type="hidden" name="kind" value="update" />
              <input type="hidden" name="service_id" value={service.id} />
              <input name="category" defaultValue={service.category} className="rounded border px-2 py-2 text-sm" />
              <input name="specialization" defaultValue={service.specialization ?? ""} className="rounded border px-2 py-2 text-sm" />
              <input name="title" defaultValue={service.title} className="rounded border px-2 py-2 text-sm" />
              <input name="short_description" defaultValue={service.short_description} className="rounded border px-2 py-2 text-sm md:col-span-3" />
              <input name="pricing_mode" defaultValue={service.pricing_mode} className="rounded border px-2 py-2 text-sm" />
              <input name="min_price" type="number" step="0.01" defaultValue={service.min_price ?? 0} className="rounded border px-2 py-2 text-sm" />
              <input name="max_price" type="number" step="0.01" defaultValue={service.max_price ?? 0} className="rounded border px-2 py-2 text-sm" />
              <input name="turnaround_time" defaultValue={service.turnaround_time ?? ""} className="rounded border px-2 py-2 text-sm" />
              <select name="vat_applicable" defaultValue={String(Boolean(service.vat_applicable))} className="rounded border px-2 py-2 text-sm"><option value="false">VAT not applicable</option><option value="true">VAT applicable</option></select>
              <select name="availability_status" defaultValue={service.availability_status} className="rounded border px-2 py-2 text-sm"><option value="available">available</option><option value="limited">limited</option><option value="unavailable">unavailable</option></select>
              <button className="rounded bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">Save</button>
            </form>
            <form action={serviceAction} className="mt-2">
              <input type="hidden" name="kind" value="delete" />
              <input type="hidden" name="service_id" value={service.id} />
              <button className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-700">Delete</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
