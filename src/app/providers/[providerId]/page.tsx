import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { getProviderPublicProfile } from "@/lib/data/marketplace";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function submitPublicComplaint(formData: FormData) {
  "use server";

  const providerId = String(formData.get("provider_id") ?? "");
  if (!providerId) return;

  const reporterName = String(formData.get("reporter_name") ?? "Anonymous User").trim() || "Anonymous User";
  const reporterEmail = String(formData.get("reporter_email") ?? "").trim();
  const complaintType = String(formData.get("complaint_type") ?? "marketplace_report");
  const summary = String(formData.get("summary") ?? "Provider complaint report").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!description) return;

  const supabase = await createServerSupabaseClient();

  const { data: provider } = await supabase
    .from("marketplace_provider_search")
    .select("provider_id,msme_row_id,state,sector,business_name")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (!provider) return;

  await supabase.from("complaints").insert({
    msme_id: provider.msme_row_id,
    provider_id: provider.provider_id,
    complaint_type: complaintType,
    summary: summary || `Public report for ${provider.business_name}`,
    description,
    status: "open",
    severity: "medium",
    state: provider.state,
    sector: provider.sector,
    reporter_name: reporterName,
    reporter_email: reporterEmail || null,
    source_channel: "marketplace_public_profile",
  });

  revalidatePath(`/providers/${providerId}`);
  redirect(`/providers/${providerId}?reported=1`);
}

function ratingPercent(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

export default async function ProviderPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ reported?: string }>;
}) {
  const { providerId } = await params;
  const query = await searchParams;
  const provider = await getProviderPublicProfile(providerId);

  if (!provider) {
    notFound();
  }

  const breakdownRows = [
    { label: "5 ★", value: provider.rating_breakdown.five },
    { label: "4 ★", value: provider.rating_breakdown.four },
    { label: "3 ★", value: provider.rating_breakdown.three },
    { label: "2 ★", value: provider.rating_breakdown.two },
    { label: "1 ★", value: provider.rating_breakdown.one },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[220px_1fr]">
          <div>
            <Image
              src={provider.logo_url ?? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80"}
              alt={provider.business_name}
              width={600}
              height={320}
              className="h-44 w-full rounded-2xl object-cover"
            />
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Verification badge</p>
              <p className="mt-1">NDMII approved provider</p>
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-sm text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-wide">{provider.trust_badge}</p>
              <p className="mt-1 text-3xl font-bold">{provider.trust_score}</p>
              <p className="text-xs">Trust score based on verification, reviews, complaints, and association linkage.</p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold">{provider.business_name}</h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {provider.category} • {provider.specialization ?? "General services"}
            </p>
            <p className="text-sm text-slate-500">
              {provider.state}
              {provider.lga ? `, ${provider.lga}` : ""}
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Service description</h2>
              <p className="mt-2 text-sm text-slate-700">{provider.long_description}</p>
            </div>

            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-600">Rating summary</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{provider.avg_rating.toFixed(1)}</p>
                <p className="text-sm text-slate-500">From {provider.review_count} reviews</p>
              </div>
              <div className="space-y-2 text-xs">
                {breakdownRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-slate-500">
                      <span>{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${ratingPercent(row.value, provider.review_count)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trust diagnostics</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {provider.trust_factors.map((factor) => (
                  <div key={factor.label} className="rounded-lg bg-white px-3 py-2 text-xs">
                    <p className="font-semibold text-slate-700">{factor.label}</p>
                    <p className={factor.impact === "positive" ? "text-emerald-700" : "text-amber-700"}>{factor.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-xl font-semibold">Recent reviews</h2>
            <div className="mt-3 space-y-3">
              {provider.reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{review.review_title}</p>
                    <p className="text-sm text-slate-500">{review.rating.toFixed(1)} / 5</p>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{review.reviewer_name}</p>
                  <p className="mt-2 text-sm text-slate-600">{review.review_body}</p>
                  {review.provider_reply && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="text-xs font-semibold uppercase tracking-wide">Provider reply</p>
                      <p className="mt-1">{review.provider_reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            {query.reported === "1" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Report submitted. The issue has been logged for FCCPC regulator triage.
              </div>
            )}
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold">Report this provider</h3>
              <p className="mt-1 text-xs text-slate-500">For service quality, fraud, counterfeit products, pricing abuse, or delivery disputes.</p>
              <form action={submitPublicComplaint} className="mt-3 space-y-2">
                <input type="hidden" name="provider_id" value={provider.id} />
                <input name="reporter_name" placeholder="Your name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input name="reporter_email" type="email" placeholder="Email (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <select name="complaint_type" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="marketplace_report">General marketplace report</option>
                  <option value="service_quality">Service quality issue</option>
                  <option value="pricing_dispute">Pricing or billing dispute</option>
                  <option value="identity_concern">Identity or trust concern</option>
                </select>
                <input name="summary" placeholder="Short summary" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <textarea name="description" placeholder="Describe the issue" className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <button className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Submit report</button>
              </form>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold">Complaint posture</h3>
              <p className="mt-2 text-sm text-slate-600">Active complaints in regulator queue: {provider.active_complaint_count}</p>
              <p className="mt-1 text-xs text-slate-500">Association: {provider.association_name ?? "Not linked"}</p>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}
