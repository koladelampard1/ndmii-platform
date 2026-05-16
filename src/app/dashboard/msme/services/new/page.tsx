import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import {
  filterProviderServicesPayload,
  getMsmeServicesData,
  getProviderServicesColumns,
  mapPriceTypeToStorageMode,
} from "@/lib/data/msme-services";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { ServiceCreateForm } from "./service-create-form";

const PROVIDER_SERVICES_INSERT_COLUMNS = [
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
] as const;

const VALID_PRICING_MODES = new Set(["fixed", "range", "negotiable"]);

function safeSupabaseDetails(details?: string | null) {
  if (!details) return null;
  if (details.toLowerCase().includes("failing row contains")) return "redacted_failing_row";
  return details;
}

function logCreateServiceDiagnostics(payload: {
  operation: "create_provider_service";
  providerId: string;
  attemptedColumns: string[];
  validationErrorKey?: string;
  error?: {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  } | null;
}) {
  console.error("[msme-services] create-service-failure", {
    operation: payload.operation,
    providerId: payload.providerId,
    attemptedColumns: payload.attemptedColumns,
    validationErrorKey: payload.validationErrorKey ?? null,
    supabaseErrorCode: payload.error?.code ?? null,
    supabaseMessage: payload.error?.message ?? null,
    supabaseDetails: safeSupabaseDetails(payload.error?.details),
    supabaseHint: payload.error?.hint ?? null,
  });
}

function createServiceErrorRedirect(message: string): never {
  redirect(`/dashboard/msme/services/new?error=${encodeURIComponent(message)}`);
}

function createValidationErrorRedirect(params: {
  message: string;
  validationErrorKey: string;
  providerId: string;
  attemptedColumns?: string[];
}): never {
  logCreateServiceDiagnostics({
    operation: "create_provider_service",
    providerId: params.providerId,
    attemptedColumns: params.attemptedColumns ?? [],
    validationErrorKey: params.validationErrorKey,
  });
  createServiceErrorRedirect(params.message);
}

function parseOptionalMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function parseOptionalPositiveInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

async function createServiceAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const providerId = workspace.provider.id;

  const priceType = String(formData.get("price_type") ?? "fixed");
  const resolvedPricingMode = mapPriceTypeToStorageMode(priceType);
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const shortDescription = String(formData.get("short_description") ?? "").trim();
  const specialization = String(formData.get("specialization") ?? "").trim();
  const currency = String(formData.get("currency") ?? "NGN").trim().toUpperCase() || "NGN";
  const availabilityStatus = String(formData.get("availability_status") ?? "available").trim() || "available";
  const parsedMinPrice = parseOptionalMoney(formData.get("min_price"));
  const parsedMaxPrice = parseOptionalMoney(formData.get("max_price"));
  const turnaroundDays = parseOptionalPositiveInteger(formData.get("turnaround_days"));

  if (!title) {
    createValidationErrorRedirect({ message: "Service title is required.", validationErrorKey: "title_required", providerId });
  }
  if (!category) {
    createValidationErrorRedirect({ message: "Service category is required.", validationErrorKey: "category_required", providerId });
  }
  if (!VALID_PRICING_MODES.has(resolvedPricingMode)) {
    createValidationErrorRedirect({ message: "Choose a valid pricing mode.", validationErrorKey: "invalid_pricing_mode", providerId });
  }
  if (!["available", "limited", "unavailable"].includes(availabilityStatus)) {
    createValidationErrorRedirect({ message: "Choose a valid availability status.", validationErrorKey: "invalid_availability_status", providerId });
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    createValidationErrorRedirect({ message: "Currency must be a 3-letter code.", validationErrorKey: "invalid_currency", providerId });
  }
  if (Number.isNaN(parsedMinPrice) || Number.isNaN(parsedMaxPrice)) {
    createValidationErrorRedirect({ message: "Price values must be valid positive numbers.", validationErrorKey: "invalid_price", providerId });
  }
  if (Number.isNaN(turnaroundDays)) {
    createValidationErrorRedirect({ message: "Turnaround days must be a whole number.", validationErrorKey: "invalid_turnaround_days", providerId });
  }
  if ((resolvedPricingMode === "fixed" || resolvedPricingMode === "range") && parsedMinPrice === null) {
    createValidationErrorRedirect({ message: "Minimum price is required for fixed and range pricing.", validationErrorKey: "minimum_price_required", providerId });
  }
  if (resolvedPricingMode === "fixed" && parsedMaxPrice === null) {
    createValidationErrorRedirect({ message: "Maximum price is required for fixed pricing.", validationErrorKey: "maximum_price_required", providerId });
  }
  if (parsedMinPrice !== null && parsedMaxPrice !== null && parsedMaxPrice < parsedMinPrice) {
    createValidationErrorRedirect({ message: "Maximum price cannot be lower than minimum price.", validationErrorKey: "maximum_price_below_minimum", providerId });
  }

  const resolvedMaxPrice = parsedMaxPrice ?? (resolvedPricingMode === "fixed" ? parsedMinPrice : null);

  const canonicalPayload = {
    provider_id: providerId,
    title,
    short_description: shortDescription,
    category,
    specialization: specialization || null,
    pricing_mode: resolvedPricingMode,
    min_price: parsedMinPrice,
    max_price: resolvedMaxPrice,
    currency,
    vat_applicable: String(formData.get("vat_applicable") ?? "false") === "true",
    turnaround_days: turnaroundDays,
    availability_status: availabilityStatus,
  };
  const compatibilityPayload = {
    provider_profile_id: providerId,
    service_name: title,
    description: shortDescription,
    price_min: parsedMinPrice,
    price_max: resolvedMaxPrice,
    pricing_model: resolvedPricingMode,
    is_active: ["available", "limited"].includes(availabilityStatus),
  };
  const providerServicesColumns = await getProviderServicesColumns();
  const payload = filterProviderServicesPayload(
    {
      ...canonicalPayload,
      ...compatibilityPayload,
    },
    providerServicesColumns,
  );
  const attemptedColumns = Object.keys(payload);

  const { data: insertedRow, error } = await supabase
    .from("provider_services")
    .insert(payload)
    .select("id")
    .single();

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] write-table", {
      writeTable: "provider_services",
      writeProviderId: providerId,
      providerServicesSchemaUsed: PROVIDER_SERVICES_INSERT_COLUMNS,
      attemptedColumns,
      compatibilityColumnsUsed: Object.keys(compatibilityPayload).filter((column) => attemptedColumns.includes(column)),
      skippedColumns: [...PROVIDER_SERVICES_INSERT_COLUMNS].filter((column) => !attemptedColumns.includes(column)),
      insertedServiceId: insertedRow?.id ?? null,
      writeError: error?.message ?? null,
    });
  }

  if (error) {
    logCreateServiceDiagnostics({
      operation: "create_provider_service",
      providerId,
      attemptedColumns,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    });
    createServiceErrorRedirect("We could not create this service. Please review the details and try again.");
  }

  const { count: servicesCountAfterSave, error: servicesCountError } = await supabase
    .from("provider_services")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId);

  if (process.env.NODE_ENV !== "production") {
    console.info("[msme-services] post-save-count", {
      providerId,
      servicesCountAfterSave: servicesCountAfterSave ?? 0,
      servicesCountError: servicesCountError?.message ?? null,
    });
  }

  revalidatePath("/dashboard/msme/services");
  revalidatePath("/dashboard/msme/services/new");
  revalidatePath(`/providers/${workspace.provider.id}`);
  if (workspace.provider.public_slug) revalidatePath(`/providers/${workspace.provider.public_slug}`);
  redirect("/dashboard/msme/services?saved=1");
}

export default async function MsmeCreateServicePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const servicesData = await getMsmeServicesData({
    providerId: workspace.provider.id,
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
        {query.error ? (
          <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800">
            {query.error}
          </p>
        ) : null}
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
