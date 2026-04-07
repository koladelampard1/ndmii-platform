import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { getProviderPublicProfile, resolveProviderPublicId } from "@/lib/data/marketplace";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devQuoteLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[public-quote] ${message}`, payload);
}

async function submitProviderQuoteRequest(formData: FormData) {
  "use server";

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const providerPathSegment = String(formData.get("provider_path_segment") ?? "").trim();

  if (!providerId || !providerPathSegment) {
    redirect("/search?quote_error=missing_provider");
  }

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

  const supabase = await createServiceRoleSupabaseClient();
  const payload = {
    provider_profile_id: providerId,
    requester_name: requesterName,
    requester_email: requesterEmail,
    requester_phone: requesterPhone,
    request_summary: requestSummary,
    request_details: requestDetails,
    budget_min: budgetMin,
    budget_max: budgetMax,
    status: "new",
  };

  devQuoteLog("quote_submission_attempt", { providerId, requesterEmail, hasBudget: budgetMin !== null || budgetMax !== null });

  const { error } = await supabase.from("provider_quotes").insert(payload);

  if (error) {
    devQuoteLog("quote_submission_failed", {
      providerId,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      code: error.code ?? null,
    });
    throw new Error(`Quote submission failed: ${error.message}`);
  }

  devQuoteLog("quote_submission_success", { providerId, requesterEmail });

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
  const { providerId: providerPathSegment } = await params;
  const query = await searchParams;

  const providerId = await resolveProviderPublicId(providerPathSegment);
  if (!providerId) {
    notFound();
  }

  const provider = await getProviderPublicProfile(providerId);
  if (!provider) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/providers/${providerPathSegment}`} className="text-sm font-medium text-indigo-700 hover:underline">
          ← Back to provider profile
        </Link>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">NDMII marketplace</p>
          <h1 className="mt-2 text-3xl font-semibold">Request a quote from {provider.business_name}</h1>
          <p className="mt-2 text-sm text-slate-600">Share your project scope and budget range. The provider receives this instantly in their operations quote workspace.</p>

          {query.error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {query.error === "missing_fields"
                ? "Please complete all required fields before submitting your request."
                : query.error === "budget_invalid"
                  ? "Budget values must be valid numbers."
                  : "Budget minimum cannot be greater than budget maximum."}
            </div>
          )}

          <form action={submitProviderQuoteRequest} className="mt-5 grid gap-4">
            <input type="hidden" name="provider_id" value={provider.id} />
            <input type="hidden" name="provider_path_segment" value={providerPathSegment} />

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
        </div>
      </section>
    </main>
  );
}
