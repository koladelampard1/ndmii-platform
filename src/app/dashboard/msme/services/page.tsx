import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getMsmeServicesData } from "@/lib/data/msme-services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MsmeServicesDashboard, type ServiceRecord } from "./services-dashboard";

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
  const createServiceRoute = "/dashboard/msme/services/new";
  const servicesData = await getMsmeServicesData(workspace.provider.id);

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] page-route-config", { createServiceRoute });
  }

  return (
    <MsmeServicesDashboard
      saved={Boolean(params.saved)}
      services={servicesData.services as ServiceRecord[]}
      categories={servicesData.categories}
      serviceAction={serviceAction}
      createServiceRoute={createServiceRoute}
    />
  );
}
