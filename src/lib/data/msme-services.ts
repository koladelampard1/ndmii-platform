import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ServiceRecord } from "@/app/dashboard/msme/services/services-dashboard";

const PROVIDER_SERVICES_COLUMN_CANDIDATES = [
  "provider_id",
  "title",
  "short_description",
  "category",
  "specialization",
  "pricing_mode",
  "min_price",
  "max_price",
  "currency",
  "vat_applicable",
  "turnaround_days",
  "availability_status",
  "provider_profile_id",
  "service_name",
  "description",
  "price_min",
  "price_max",
  "pricing_model",
  "is_active",
] as const;

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
};

let providerServicesColumnCache: Set<string> | null = null;

function dedupeCategoryNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value && value.length > 0))),
  ).sort((a, b) => a.localeCompare(b));
}

async function probeProviderServiceColumns(supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>) {
  const detected = new Set<string>();

  for (const column of PROVIDER_SERVICES_COLUMN_CANDIDATES) {
    const { error } = await supabase.from("provider_services").select(column).limit(1);
    if (!error) detected.add(column);
  }

  return detected;
}

export async function getProviderServicesColumns() {
  if (providerServicesColumnCache) return providerServicesColumnCache;

  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("provider_services").select("*").limit(1);

  if (!error && data?.[0]) {
    providerServicesColumnCache = new Set(Object.keys(data[0]));
    return providerServicesColumnCache;
  }

  providerServicesColumnCache = await probeProviderServiceColumns(supabase);
  return providerServicesColumnCache;
}

export function filterProviderServicesPayload<T extends Record<string, unknown>>(payload: T, columns: Set<string>) {
  return Object.fromEntries(Object.entries(payload).filter(([column]) => columns.has(column)));
}

export async function getMsmeServicesData({ providerId }: MsmeServicesQueryScope): Promise<MsmeServicesData> {
  const supabase = await createServiceRoleSupabaseClient();

  const [{ data: servicesData, error: servicesError }, { data: categoryRows, error: categoriesError }] = await Promise.all([
    supabase.from("provider_services").select("*").eq("provider_id", providerId).order("created_at", { ascending: false }),
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
        column: "provider_id",
        value: providerId,
      },
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
