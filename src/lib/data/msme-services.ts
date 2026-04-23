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

export type MsmeServicesQueryScope = {
  providerId: string;
  msmeDatabaseId?: string;
  msmePublicId?: string;
};

function dedupeCategoryNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value && value.length > 0))),
  ).sort((a, b) => a.localeCompare(b));
}

export async function getMsmeServicesData({ providerId, msmeDatabaseId, msmePublicId }: MsmeServicesQueryScope): Promise<MsmeServicesData> {
  const supabase = await createServiceRoleSupabaseClient();
  const msmeReferenceValues = dedupeCategoryNames([msmeDatabaseId, msmePublicId]);

  const [{ data: providerByIdRows, error: providerByIdError }, { data: providerByMsmeRows, error: providerByMsmeError }] = await Promise.all([
    supabase.from("provider_profiles").select("id,msme_id").eq("id", providerId).limit(20),
    msmeReferenceValues.length
      ? supabase.from("provider_profiles").select("id,msme_id").in("msme_id", msmeReferenceValues).limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const providerProfileIds = Array.from(
    new Set([
      providerId,
      ...(providerByIdRows ?? []).map((row) => row.id),
      ...(providerByMsmeRows ?? []).map((row) => row.id),
    ]),
  );

  const [{ data: servicesData, error: servicesError }, { data: categoryRows, error: categoriesError }] = await Promise.all([
    supabase.from("provider_services").select("*").in("provider_profile_id", providerProfileIds).order("created_at", { ascending: false }),
    supabase.from("service_categories").select("name").eq("is_active", true).order("name"),
  ]);

  const services = (servicesData ?? []) as ServiceRecord[];
  const categoriesFromTable = dedupeCategoryNames((categoryRows ?? []).map((category) => category.name));

  let categories = categoriesFromTable;
  let categoriesSource = "service_categories";

  if (!categories.length) {
    categories = FALLBACK_SERVICE_CATEGORIES;
    categoriesSource = "fallback_static_categories";
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] resolved-data-sources", {
      servicesSource: "provider_services",
      servicesReadFilter: {
        column: "provider_profile_id",
        values: providerProfileIds,
      },
      providerProfilesReadTable: "provider_profiles",
      providerProfilesByIdError: providerByIdError?.message ?? null,
      providerProfilesByMsmeRefError: providerByMsmeError?.message ?? null,
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
