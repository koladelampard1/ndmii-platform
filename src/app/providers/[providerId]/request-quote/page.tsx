import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { getProviderPublicProfile } from "@/lib/data/marketplace";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveProviderProfileRow } from "@/lib/data/provider-profiles";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devQuoteLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[public-quote] ${message}`, payload);
}

const PROVIDER_PROFILE_SELECT = "id,msme_id,display_name,business_name,slug,public_slug";


async function submitProviderQuoteRequest(formData: FormData) {
  "use server";

  const providerPathSegment = String(formData.get("provider_path_segment") ?? "").trim();
  const submittedProviderProfileId = String(formData.get("provider_profile_id") ?? "").trim();
  const submittedProviderMsmeId = String(formData.get("provider_msme_id") ?? "").trim();

  if (!providerPathSegment) {
    redirect("/search?quote_error=missing_provider");
  }

  devQuoteLog("quote_submission_route_param_received", { providerPathSegment });

  const requesterName = String(formData.get("requester_name") ?? "").trim();
  const requesterEmail = String(formData.get("requester_email") ?? "").trim();
  const requesterPhone = String(formData.get("requester_phone") ?? "").trim();
  const requestSummary = String(formData.get("request_summary") ?? "").trim();
  const requestDetails = String(formData.get("request_details") ?? "").trim();
  const budgetMinRaw = String(formData.get("budget_min") ?? "").trim();
  const budgetMaxRaw = String(formData.get("budget_max") ?? "").trim();

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

  const providerProfile = await resolveProviderProfileRow({
    providerPathSegment,
    providerId: submittedProviderProfileId || undefined,
    msmePublicId: submittedProviderMsmeId || undefined,
  });

  devQuoteLog("quote_submission_provider_resolved", {
    providerPathSegment,
    providerProfile: providerProfile
      ? {
          id: providerProfile.id,
          msmeId: providerProfile.msme_id,
          slug: providerProfile.slug ?? null,
          publicSlug: providerProfile.public_slug ?? null,
          businessName: providerProfile.business_name ?? null,
        }
      : null,
  });

  if (!providerProfile?.id) {
    redirect(`/providers/${providerPathSegment}/request-quote?error=provider_not_found`);
  }

  const providerProfileId = providerProfile.id;
  devQuoteLog("quote_submission_provider_uuid_for_insert", { providerPathSegment, providerProfileId });

  const supabase = await createServiceRoleSupabaseClient();

  const payload = {
    provider_profile_id: providerProfileId,
    requester_name: requesterName,
    requester_email: requesterEmail,
    requester_phone: requesterPhone,
    request_summary: requestSummary,
    request_details: requestDetails,
    budget_min: budgetMin,
    budget_max: budgetMax,
    status: "new",
  };

  devQuoteLog("quote_submission_attempt", { providerPathSegment, providerProfileId, requesterEmail, hasBudget: budgetMin !== null || budgetMax !== null });

  const { error } = await supabase.from("provider_quotes").insert(payload);

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

  devQuoteLog("quote_submission_success", { providerPathSegment, providerProfileId, requesterEmail });

  revalidatePath(`/providers/${providerPathSegment}`);
  revalidatePath(`/providers/${providerPathSegment}/request-quote`);
  redirect(`/providers/${providerPathSegment}?quote=1`);
}

export default async function PublicProviderRequestQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { providerId: providerSlug } = await params;
  const query = await searchParams;

  devQuoteLog("provider_slug_received", { providerSlug });
  devQuoteLog("provider_lookup_query_target", {
    table: "provider_profiles",
    select: PROVIDER_PROFILE_SELECT,
    filter: `public_slug.eq.${providerSlug},slug.eq.${providerSlug}`,
  });
  const resolvedByPublicSlug = await resolveProviderProfileRow({
    providerPathSegment: providerSlug,
    providerId: providerSlug,
  });
  const providerId = resolvedByPublicSlug?.id ?? null;
  devQuoteLog("provider_lookup_result", {
    providerSlug,
    providerId,
    found: Boolean(providerId),
    providerProfilePublicSlug: resolvedByPublicSlug?.public_slug ?? null,
    providerProfileSlug: resolvedByPublicSlug?.slug ?? null,
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
            <Link href="/search" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
              Return to provider search
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const provider = await getProviderPublicProfile(providerId);
  devQuoteLog("provider_profile_loaded", { providerSlug, providerId, found: Boolean(provider) });
  if (!provider) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <section className="mx-auto max-w-3xl px-6 py-14">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Provider not found</p>
            <h1 className="mt-2 text-2xl font-semibold text-amber-900">This provider profile could not be loaded</h1>
            <p className="mt-2 text-sm text-amber-800">Please reopen the provider profile and try again.</p>
            <Link href="/search" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
              Return to provider search
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const resolvedProviderProfileRow = await resolveProviderProfileRow({
    providerPathSegment: providerSlug,
    providerId,
    msmePublicId: provider.msme_id,
  });

  devQuoteLog("provider_profile_row_for_quote_loaded", {
    providerSlug,
    providerId,
    found: Boolean(resolvedProviderProfileRow?.id),
    providerProfileId: resolvedProviderProfileRow?.id ?? null,
    providerProfileMsmeId: resolvedProviderProfileRow?.msme_id ?? null,
    providerProfilePublicSlug: resolvedProviderProfileRow?.public_slug ?? null,
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/providers/${providerSlug}`} className="text-sm font-medium text-indigo-700 hover:underline">
          ← Back to provider profile
        </Link>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">NDMII marketplace</p>
          <h1 className="mt-2 text-3xl font-semibold">Request a quote from {provider.business_name}</h1>
          <p className="mt-2 text-sm text-slate-600">Share your project scope and budget range. The provider receives this instantly in their operations quote workspace.</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p><span className="font-semibold">Provider:</span> {provider.business_name}</p>
            <p><span className="font-semibold">MSME ID:</span> {provider.msme_id}</p>
            <p><span className="font-semibold">Location:</span> {provider.state}{provider.lga ? `, ${provider.lga}` : ""}</p>
          </div>

          {query.error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {query.error === "missing_fields"
                ? "Please complete all required fields before submitting your request."
                : query.error === "budget_invalid"
                  ? "Budget values must be valid numbers."
                  : query.error === "provider_not_found"
                    ? "This provider is visible publicly but has no provider profile row yet."
                  : "Budget minimum cannot be greater than budget maximum."}
            </div>
          )}

          {!resolvedProviderProfileRow ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This provider is visible publicly but has no provider profile row yet.
            </div>
          ) : (
            <form action={submitProviderQuoteRequest} className="mt-5 grid gap-4">
              <input type="hidden" name="provider_path_segment" value={providerSlug} />
              <input type="hidden" name="provider_profile_id" value={resolvedProviderProfileRow.id} />
              <input type="hidden" name="provider_msme_id" value={resolvedProviderProfileRow.msme_id} />

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
