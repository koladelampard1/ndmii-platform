import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ServiceRecord } from "@/app/dashboard/msme/services/services-dashboard";

const FALLBACK_SERVICE_CATEGORIES = [
  "Professional Services",
  "Business Registration",
  "Accounting & Tax",
  "Legal & Compliance",
  "Digital Marketing",
  "Logistics & Delivery",
  "Manufacturing Support",
  "IT & Software",
];

export type MsmeServicesData = {
  services: ServiceRecord[];
  categories: string[];
  servicesSource: string;
  categoriesSource: string;
};

function dedupeCategoryNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value && value.length > 0))),
  ).sort((a, b) => a.localeCompare(b));
}

export async function getMsmeServicesData(providerId: string): Promise<MsmeServicesData> {
  const supabase = await createServiceRoleSupabaseClient();
  const [{ data: servicesData, error: servicesError }, { data: categoryRows, error: categoriesError }] = await Promise.all([
    supabase.from("provider_services").select("*").eq("provider_id", providerId).order("created_at", { ascending: false }),
    supabase.from("service_categories").select("name").eq("is_active", true).order("name"),
  ]);

  const services = (servicesData ?? []) as ServiceRecord[];
  const categoriesFromTable = dedupeCategoryNames((categoryRows ?? []).map((category) => category.name));
  const categoriesFromServices = dedupeCategoryNames(services.map((service) => service.category));

  let categories = categoriesFromTable;
  let categoriesSource = "service_categories";

  if (!categories.length && categoriesFromServices.length) {
    categories = categoriesFromServices;
    categoriesSource = "provider_services.category";
  } else if (!categories.length) {
    categories = FALLBACK_SERVICE_CATEGORIES;
    categoriesSource = "fallback_static_categories";
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] resolved-data-sources", {
      servicesSource: "provider_services",
      categoriesSource,
      servicesCount: services.length,
      categoriesCount: categories.length,
      servicesError: servicesError?.message ?? null,
      categoriesError: categoriesError?.message ?? null,
    });
  }

  return {
    services,
    categories,
    servicesSource: "provider_services",
    categoriesSource,
  };
}

export function mapPriceTypeToStorageMode(priceType: string): "fixed" | "range" | "negotiable" {
  if (priceType === "fixed") return "fixed";
  if (priceType === "starting_from") return "range";
  return "negotiable";
}
