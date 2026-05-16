import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { getMsmeServicesData } from "@/lib/data/msme-services";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MsmeServicesDashboard, type ServiceRecord } from "./services-dashboard";

function serviceErrorRedirect(message: string): never {
  redirect(`/dashboard/msme/services?error=${encodeURIComponent(message)}`);
}

async function serviceAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();
  const providerId = workspace.provider.id;

  const kind = String(formData.get("kind") ?? "create");
  const serviceId = String(formData.get("service_id") ?? "");
  const availabilityStatus = String(formData.get("availability_status") ?? "").trim();
  const validStatuses = new Set(["available", "limited", "unavailable"]);

  if (!serviceId) serviceErrorRedirect("Service not found.");

  if (kind === "archive") {
    const { error } = await supabase
      .from("provider_services")
      .update({ availability_status: "unavailable" })
      .eq("id", serviceId)
      .eq("provider_id", providerId);
    if (error) serviceErrorRedirect("We could not archive this service. Please try again.");
  } else if (kind === "update") {
    if (!validStatuses.has(availabilityStatus)) serviceErrorRedirect("Choose a valid availability status.");
    const { error } = await supabase
      .from("provider_services")
      .update({ availability_status: availabilityStatus })
      .eq("id", serviceId)
      .eq("provider_id", providerId);
    if (error) serviceErrorRedirect("We could not update this service. Please try again.");
  } else {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] write-table", {
      writeTable: "provider_services",
      writeProviderId: providerId,
      writeKind: kind,
      wroteServiceId: serviceId || null,
      finalUpdatePayload: kind === "archive" ? { availability_status: "unavailable" } : { availability_status: availabilityStatus },
    });
  }

  revalidatePath("/dashboard/msme/services");
  revalidatePath(`/providers/${workspace.provider.id}`);
  if (workspace.provider.public_slug) revalidatePath(`/providers/${workspace.provider.public_slug}`);
  redirect("/dashboard/msme/services?saved=1");
}

export default async function MsmeServicesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const createServiceRoute = "/dashboard/msme/services/new";
  const servicesData = await getMsmeServicesData({
    providerId: workspace.provider.id,
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
      error={params.error}
      services={servicesData.services as ServiceRecord[]}
      categories={servicesData.categories}
      serviceAction={serviceAction}
      createServiceRoute={createServiceRoute}
    />
  );
}
