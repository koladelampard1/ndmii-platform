import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getMsmeServicesData, mapPriceTypeToStorageMode } from "@/lib/data/msme-services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ServiceCreateForm } from "./service-create-form";

async function createServiceAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const priceType = String(formData.get("price_type") ?? "fixed");
  const resolvedPricingMode = mapPriceTypeToStorageMode(priceType);
  const priceAmount = Number(formData.get("price_amount") ?? 0);
  const hasPriceAmount = Number.isFinite(priceAmount) && priceAmount > 0;

  const payload = {
    provider_id: workspace.provider.id,
    category: String(formData.get("category") ?? "Professional Services"),
    specialization: String(formData.get("specialization") ?? "").trim() || null,
    title: String(formData.get("title") ?? "").trim(),
    short_description: String(formData.get("short_description") ?? "").trim(),
    pricing_mode: resolvedPricingMode,
    min_price: hasPriceAmount ? priceAmount : null,
    max_price: hasPriceAmount ? priceAmount : null,
    turnaround_time: String(formData.get("turnaround_time") ?? "").trim() || null,
    vat_applicable: String(formData.get("vat_applicable") ?? "false") === "true",
    availability_status: String(formData.get("availability_status") ?? "available"),
    updated_at: new Date().toISOString(),
  };

  await supabase.from("provider_services").insert(payload);
  revalidatePath("/dashboard/msme/services");
  revalidatePath("/dashboard/msme/services/new");
  redirect("/dashboard/msme/services?saved=1");
}

export default async function MsmeCreateServicePage() {
  const workspace = await getProviderWorkspaceContext();
  const servicesData = await getMsmeServicesData(workspace.provider.id);
  const servicesRoute = "/dashboard/msme/services";
  const createServiceRoute = "/dashboard/msme/services/new";

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] create-page-data", {
      servicesSource: servicesData.servicesSource,
      categoriesSource: servicesData.categoriesSource,
      servicesCount: servicesData.services.length,
      categoriesCount: servicesData.categories.length,
      addServiceRoute: createServiceRoute,
    });
  }

  return (
    <section className="space-y-6 pb-4">
      <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">MSME Services</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Add New Service</h1>
        <p className="mt-2 text-sm text-slate-600">Create a new service listing that appears in your services dashboard and marketplace profile.</p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <ServiceCreateForm categories={servicesData.categories} createAction={createServiceAction} />
      </section>

      <div>
        <Link href={servicesRoute} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to My Services
        </Link>
      </div>
    </section>
  );
}
