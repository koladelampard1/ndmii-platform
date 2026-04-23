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
  const providerProfileId = workspace.provider.id;

  const kind = String(formData.get("kind") ?? "create");
  const serviceId = String(formData.get("service_id") ?? "");
  const payload = {
    is_active: String(formData.get("is_active") ?? "true") !== "false",
  };

  if (kind === "delete" && serviceId) {
    await supabase.from("provider_services").delete().eq("id", serviceId).eq("provider_profile_id", providerProfileId);
  } else if (kind === "update" && serviceId) {
    await supabase.from("provider_services").update(payload).eq("id", serviceId).eq("provider_profile_id", providerProfileId);
  } else {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] write-table", {
      writeTable: "provider_services",
      writeProviderProfileId: providerProfileId,
      writeKind: kind,
      wroteServiceId: serviceId || null,
      finalUpdatePayload: payload,
    });
  }

  revalidatePath("/dashboard/msme/services");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/services?saved=1");
}

export default async function MsmeServicesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const createServiceRoute = "/dashboard/msme/services/new";
  const servicesData = await getMsmeServicesData({
    providerId: workspace.provider.id,
    msmeDatabaseId: workspace.msme.id,
    msmePublicId: workspace.msme.msme_id,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] page-route-config", {
      createServiceRoute,
      summaryReadTable: servicesData.servicesSource,
      categoriesSource: servicesData.categoriesSource,
      servicesCount: servicesData.services.length,
    });
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
