import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getMsmeServicesData, mapPriceTypeToStorageMode } from "@/lib/data/msme-services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ServiceCreateForm } from "./service-create-form";

const PROVIDER_SERVICES_INSERT_COLUMNS = [
  "provider_profile_id",
  "service_name",
  "description",
  "price_min",
  "price_max",
  "pricing_model",
  "is_active",
  "created_at",
] as const;

async function createServiceAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const providerProfileId = workspace.provider.id;

  const priceType = String(formData.get("price_type") ?? "fixed");
  const resolvedPricingMode = mapPriceTypeToStorageMode(priceType);
  const parsedMinPrice = Number(formData.get("price_min") ?? "");
  const parsedMaxPrice = Number(formData.get("price_max") ?? "");
  const hasMinPrice = Number.isFinite(parsedMinPrice) && parsedMinPrice >= 0;
  const hasMaxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0;
  const resolvedMinPrice = hasMinPrice ? parsedMinPrice : null;
  const resolvedMaxPrice = hasMaxPrice ? parsedMaxPrice : resolvedMinPrice;

  const payload = {
    provider_profile_id: providerProfileId,
    service_name: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("short_description") ?? "").trim(),
    price_min: resolvedMinPrice,
    price_max: resolvedMaxPrice,
    pricing_model: resolvedPricingMode,
    is_active: String(formData.get("is_active") ?? "true") !== "false",
  };

  const { data: insertedRow, error } = await supabase
    .from("provider_services")
    .insert(payload)
    .select("id")
    .single();

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] write-table", {
      writeTable: "provider_services",
      writeProviderProfileId: providerProfileId,
      providerServicesSchemaUsed: PROVIDER_SERVICES_INSERT_COLUMNS,
      finalInsertPayload: payload,
      insertedServiceId: insertedRow?.id ?? null,
      writeError: error?.message ?? null,
    });
  }

  if (error) {
    throw new Error(`Failed to create service: ${error.message}`);
  }

  const { count: servicesCountAfterSave, error: servicesCountError } = await supabase
    .from("provider_services")
    .select("id", { count: "exact", head: true })
    .eq("provider_profile_id", providerProfileId);

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] post-save-count", {
      providerProfileId,
      servicesCountAfterSave: servicesCountAfterSave ?? 0,
      servicesCountError: servicesCountError?.message ?? null,
    });
  }

  revalidatePath("/dashboard/msme/services");
  revalidatePath("/dashboard/msme/services/new");
  redirect("/dashboard/msme/services?saved=1");
}

export default async function MsmeCreateServicePage() {
  const workspace = await getProviderWorkspaceContext();
  const servicesData = await getMsmeServicesData({
    providerId: workspace.provider.id,
    msmeDatabaseId: workspace.msme.id,
    msmePublicId: workspace.msme.msme_id,
  });
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
