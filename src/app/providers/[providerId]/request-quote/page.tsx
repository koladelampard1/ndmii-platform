import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { filterPayloadByColumns, getTableColumns } from "@/lib/data/commercial-ops";
import { resolvePublicProviderProfile } from "@/lib/data/provider-profile-resolver";
import { buildProviderProfileHref } from "@/lib/provider-links";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devQuoteLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[public-quote] ${message}`, payload);
}

async function submitProviderQuoteRequest(formData: FormData) {
  "use server";

  const providerPathSegment = String(formData.get("provider_path_segment") ?? "").trim();
  const submittedProviderProfileId = String(formData.get("provider_profile_id") ?? "").trim();
  const submittedProviderMsmeId = String(formData.get("provider_msme_id") ?? "").trim();

  if (!providerPathSegment) {
    redirect("/marketplace?quote_error=missing_provider");
  }

  devQuoteLog("quote_submission_route_param_received", { providerPathSegment });

  const requesterName = String(formData.get("requester_name") ?? "").trim();
  const requesterEmail = String(formData.get("requester_email") ?? "").trim();
  const requesterPhone = String(formData.get("requester_phone") ?? "").trim();
  const requestSummary = String(formData.get("request_summary") ?? "").trim();
  const requestDetails = String(formData.get("request_details") ?? "").trim();
  const budgetMinRaw = String(formData.get("budget_min") ?? "").trim();
  const budgetMaxRaw = String(formData.get("budget_max") ?? "").trim();
  const providerServiceId = String(formData.get("provider_service_id") ?? "").trim() || null;

  if (!requesterName || !requesterEmail || !requesterPhone || !requestSummary || !requestDetails) {
    redirect(`/providers/${providerPathSegment}/request-quote?error=missing_fields`);
  }

  const budgetMin = budgetMinRaw ? Number(budgetMinRaw) : null;
  const budgetMax = budgetMaxRaw ? Number(budgetMaxRaw) : null;

  if ((budgetMin !== null && Number.isNaN(budgetMin)) || (budgetMax !== null && Number.isNaN(budgetMax))) {
    redirect(`/providers/${providerPathSegment}/request-quote?error=budget_invalid`);
  }

  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    redirect(`/providers/${providerPathSegment}/request-quote?error=budget_range`);
  }

  const providerProfile = await resolvePublicProviderProfile({
    providerRouteParam: providerPathSegment,
  });

  devQuoteLog("quote_submission_provider_resolved", {
    providerPathSegment,
    providerProfile: providerProfile.provider
      ? {
          id: providerProfile.provider.id,
          msmeId: providerProfile.provider.msme_id,
          publicSlug: providerProfile.provider.public_slug ?? null,
          submittedProviderProfileId: submittedProviderProfileId || null,
          submittedProviderMsmeId: submittedProviderMsmeId || null,
        }
      : null,
  });

  if (!providerProfile.provider?.id) {
    redirect(`/providers/${providerPathSegment}/request-quote?error=provider_not_found`);
  }

  const providerProfileId = providerProfile.provider.id;
  devQuoteLog("quote_submission_provider_uuid_for_insert", { providerPathSegment, providerProfileId });

  const supabase = await createServiceRoleSupabaseClient();
  const quoteColumns = await getTableColumns(supabase, "provider_quotes");
  let serviceSnapshot: {
    id: string;
    title: string | null;
    category: string | null;
    pricing_mode: string | null;
  } | null = null;

  if (providerServiceId) {
    const { data: service, error: serviceError } = await supabase
      .from("provider_services")
      .select("id,title,category,pricing_mode")
      .eq("id", providerServiceId)
      .eq("provider_id", providerProfileId)
      .maybeSingle();

    if (serviceError || !service) {
      devQuoteLog("quote_submission_service_link_invalid", {
        providerPathSegment,
        providerProfileId,
        serviceId: providerServiceId,
        error: serviceError ? { code: serviceError.code ?? null, message: serviceError.message } : null,
      });
      redirect(`/providers/${providerPathSegment}/request-quote?error=service_not_found`);
    }

    serviceSnapshot = service;
  }

  const payload = {
    provider_profile_id: providerProfileId,
    provider_service_id: serviceSnapshot?.id ?? null,
    service_title_snapshot: serviceSnapshot?.title ?? null,
    service_category_snapshot: serviceSnapshot?.category ?? null,
    service_pricing_mode_snapshot: serviceSnapshot?.pricing_mode ?? null,
    requester_name: requesterName,
    requester_email: requesterEmail,
    requester_phone: requesterPhone,
    request_summary: requestSummary,
    request_details: requestDetails,
    budget_min: budgetMin,
    budget_max: budgetMax,
    status: "new",
  };

  devQuoteLog("quote_submission_attempt", {
    providerPathSegment,
    providerProfileId,
    serviceId: serviceSnapshot?.id ?? null,
    hasBudget: budgetMin !== null || budgetMax !== null,
  });

  const insertPayload = quoteColumns.size > 0 ? filterPayloadByColumns(payload, quoteColumns) : payload;
  const { error } = await supabase.from("provider_quotes").insert(insertPayload);

  if (error) {
    devQuoteLog("quote_submission_failed", {
      providerPathSegment,
      providerProfileId,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      code: error.code ?? null,
    });
    throw new Error(`Quote submission failed: ${error.message}`);
  }

  devQuoteLog("quote_submission_success", { providerPathSegment, providerProfileId, serviceId: serviceSnapshot?.id ?? null });

  revalidatePath(`/providers/${providerPathSegment}`);
  revalidatePath(`/providers/${providerPathSegment}/request-quote`);
  redirect(`/providers/${providerPathSegment}?quote=1`);
}

export default async function PublicProviderRequestQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ error?: string; service?: string }>;
}) {
  const { providerId: providerSlug } = await params;
  const query = await searchParams;

  devQuoteLog("provider_slug_received", { providerSlug });
  const resolvedByPublicSlug = await resolvePublicProviderProfile({
    providerRouteParam: providerSlug,
  });
  if (resolvedByPublicSlug.redirectToCanonicalSlug && resolvedByPublicSlug.redirectToCanonicalSlug !== providerSlug) {
    redirect(`/providers/${resolvedByPublicSlug.redirectToCanonicalSlug}/request-quote`);
  }
  devQuoteLog("provider_lookup_query_target", {
    table: "provider_profiles",
    select: "id,msme_id,public_slug,display_name",
    filter: `public_slug.eq.${providerSlug}`,
  });
  const providerId = resolvedByPublicSlug.provider?.id ?? null;
  devQuoteLog("provider_lookup_result", {
    providerSlug,
    providerId,
    found: Boolean(providerId),
    providerProfilePublicSlug: resolvedByPublicSlug.provider?.public_slug ?? null,
  });

  if (!providerId) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <section className="mx-auto max-w-3xl px-6 py-14">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Provider not found</p>
            <h1 className="mt-2 text-2xl font-semibold text-amber-900">We could not locate this provider profile</h1>
            <p className="mt-2 text-sm text-amber-800">
              The quote request link is invalid or the provider is no longer publicly available.
            </p>
            <Link href="/marketplace" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
              Return to provider search
            </Link>
          </div>
        </section>
      </main>
    );
  }

  devQuoteLog("provider_profile_row_for_quote_loaded", {
    providerSlug,
    providerId,
    found: Boolean(resolvedByPublicSlug.provider?.id),
    providerProfileId: resolvedByPublicSlug.provider?.id ?? null,
    providerProfileMsmeId: resolvedByPublicSlug.provider?.msme_id ?? null,
    providerProfilePublicSlug: resolvedByPublicSlug.provider?.public_slug ?? null,
  });

  const providerForQuote = {
    id: resolvedByPublicSlug.provider?.id ?? providerId,
    msme_id: resolvedByPublicSlug.provider?.msme_id ?? "Unknown",
    public_slug: resolvedByPublicSlug.provider?.public_slug ?? providerSlug,
    business_name: resolvedByPublicSlug.provider?.display_name ?? "Verified provider",
    state: "Nigeria",
    lga: null as string | null,
  };

  let selectedService: {
    id: string;
    title: string | null;
    category: string | null;
    pricing_mode: string | null;
  } | null = null;

  if (query.service) {
    const supabase = await createServiceRoleSupabaseClient();
    const { data: service } = await supabase
      .from("provider_services")
      .select("id,title,category,pricing_mode")
      .eq("id", query.service)
      .eq("provider_id", providerForQuote.id)
      .maybeSingle();
    selectedService = service ?? null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={buildProviderProfileHref({
            id: providerForQuote.id,
            msme_id: providerForQuote.msme_id,
            public_slug: providerForQuote.public_slug,
          })}
          className="text-sm font-medium text-indigo-700 hover:underline"
        >
          ← Back to provider profile
        </Link>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">NDMII marketplace</p>
          <h1 className="mt-2 text-3xl font-semibold">Request a quote from {providerForQuote.business_name}</h1>
          <p className="mt-2 text-sm text-slate-600">Share your project scope and budget range. The provider receives this instantly in their operations quote workspace.</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p><span className="font-semibold">Provider:</span> {providerForQuote.business_name}</p>
            <p><span className="font-semibold">MSME ID:</span> {providerForQuote.msme_id}</p>
            <p><span className="font-semibold">Location:</span> {providerForQuote.state}{providerForQuote.lga ? `, ${providerForQuote.lga}` : ""}</p>
          </div>

          {query.error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {query.error === "missing_fields"
                ? "Please complete all required fields before submitting your request."
                : query.error === "budget_invalid"
                  ? "Budget values must be valid numbers."
                  : query.error === "provider_not_found"
                    ? "This provider is visible publicly but has no provider profile row yet."
                    : query.error === "service_not_found"
                      ? "The selected service is no longer available. Please choose another service from the provider profile."
                      : "Budget minimum cannot be greater than budget maximum."}
            </div>
          )}

          {!resolvedByPublicSlug.provider ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This provider is visible publicly but has no provider profile row yet.
            </div>
          ) : (
            <form action={submitProviderQuoteRequest} className="mt-5 grid gap-4">
              <input type="hidden" name="provider_path_segment" value={providerSlug} />
              <input type="hidden" name="provider_profile_id" value={resolvedByPublicSlug.provider.id} />
              <input type="hidden" name="provider_msme_id" value={resolvedByPublicSlug.provider.msme_id} />
              {selectedService?.id && <input type="hidden" name="provider_service_id" value={selectedService.id} />}

              {selectedService && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">{selectedService.title ?? "Selected service"}</p>
                  <p className="mt-1 text-emerald-800">
                    {[selectedService.category, selectedService.pricing_mode?.replace("_", " ")].filter(Boolean).join(" • ")}
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Requester name *
                  <input name="requester_name" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Amina Yusuf" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Email *
                  <input name="requester_email" type="email" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="you@example.com" />
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Phone *
                <input name="requester_phone" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="0800 000 0000" />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Summary *
                <input name="request_summary" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Website redesign + onboarding support" />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Detailed request *
                <textarea name="request_details" required className="mt-1 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Describe your scope, expected deliverables, and timeline." />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Budget min (₦)
                  <input name="budget_min" type="number" min={0} step={0.01} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="50000" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Budget max (₦)
                  <input name="budget_max" type="number" min={0} step={0.01} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="250000" />
                </label>
              </div>

              <button className="rounded-xl bg-indigo-900 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800">Submit quote request</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
