import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { getProviderPublicProfile, type ProviderProfile } from "@/lib/data/marketplace";
import { resolvePublicProviderProfile } from "@/lib/data/provider-profile-resolver";
import { buildProviderQuoteHref } from "@/lib/provider-links";
import { PublicComplaintForm } from "./public-complaint-form";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devLog(message: string, payload?: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[public-complaint] ${message}`, payload ?? {});
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
  searchParams: Promise<{ reported?: string; reported_error?: string; quote?: string; quote_error?: string; notice?: string }>;
}) {
  const { providerId: providerSlug } = await params;
  const query = await searchParams;
  const resolvedRoute = await resolvePublicProviderProfile({
    providerRouteParam: providerSlug,
  });
  devLog("provider_resolution_on_form_load", {
    providerSlug,
    resolvedProviderId: resolvedRoute.provider?.id ?? null,
    resolvedProviderMsmeId: resolvedRoute.provider?.msme_id ?? null,
    canonicalSlug: resolvedRoute.redirectToCanonicalSlug,
  });

  if (resolvedRoute.redirectToCanonicalSlug && resolvedRoute.redirectToCanonicalSlug !== providerSlug) {
    redirect(`/providers/${resolvedRoute.redirectToCanonicalSlug}`);
  }

  if (!resolvedRoute.provider?.id) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <section className="mx-auto max-w-3xl px-6 py-14">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Provider not found</p>
            <h1 className="mt-2 text-2xl font-semibold text-amber-900">We could not locate this provider profile</h1>
            <p className="mt-2 text-sm text-amber-800">
              The provider link is invalid or the provider is no longer publicly available.
            </p>
            <Link href="/search" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
              Return to provider search
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const providerId = resolvedRoute.provider.id;
  const provider = await getProviderPublicProfile(providerId);

  const providerView: ProviderProfile = provider ?? {
    id: resolvedRoute.provider.id,
    public_slug: resolvedRoute.provider.public_slug,
    msme_id: resolvedRoute.provider.msme_id,
    display_name: resolvedRoute.provider.display_name,
    ndmii_id: null,
    business_name: resolvedRoute.provider.display_name ?? "Verified provider",
    logo_url: null,
    category: "General Services",
    specialization: null,
    state: "Nigeria",
    lga: null,
    short_description: "Verified NDMII provider listed in the public marketplace.",
    verification_status: "verified",
    trust_score: 75,
    avg_rating: 0,
    review_count: 0,
    is_featured: false,
    owner_name: "Verified MSME Owner",
    long_description: "This provider has a verified public profile. Additional service details will appear as profile data is completed.",
    gallery: [],
    services: [],
    reviews: [],
    rating_breakdown: { five: 0, four: 0, three: 0, two: 0, one: 0 },
    trust_badge: "Verified Trust",
    trust_factors: [
      { label: "Verification status", value: "Verified", impact: "positive" },
      { label: "Public profile", value: "Active", impact: "positive" },
      { label: "Additional fields", value: "Pending profile completion", impact: "neutral" },
    ],
    active_complaint_count: 0,
    association_name: null,
  };

  const breakdownRows = [
    { label: "5 ★", value: providerView.rating_breakdown.five },
    { label: "4 ★", value: providerView.rating_breakdown.four },
    { label: "3 ★", value: providerView.rating_breakdown.three },
    { label: "2 ★", value: providerView.rating_breakdown.two },
    { label: "1 ★", value: providerView.rating_breakdown.one },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[220px_1fr]">
          <div>
            <Image
              src={providerView.logo_url ?? "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80"}
              alt={providerView.business_name}
              width={600}
              height={320}
              className="h-44 w-full rounded-2xl object-cover"
            />
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Verification badge</p>
              <p className="mt-1">NDMII approved provider</p>
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-sm text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-wide">{providerView.trust_badge}</p>
              <p className="mt-1 text-3xl font-bold">{providerView.trust_score}</p>
              <p className="text-xs">Trust score based on verification, reviews, complaints, and association linkage.</p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold">{providerView.business_name}</h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {providerView.category} • {providerView.specialization ?? "General services"}
            </p>
            <p className="text-sm text-slate-500">
              {providerView.state}
              {providerView.lga ? `, ${providerView.lga}` : ""}
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Service description</h2>
              <p className="mt-2 text-sm text-slate-700">{providerView.long_description}</p>
            </div>

            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-600">Rating summary</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{providerView.avg_rating.toFixed(1)}</p>
                <p className="text-sm text-slate-500">From {providerView.review_count} reviews</p>
              </div>
              <div className="space-y-2 text-xs">
                {breakdownRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-slate-500">
                      <span>{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${ratingPercent(row.value, providerView.review_count)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trust diagnostics</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {providerView.trust_factors.map((factor) => (
                  <div key={factor.label} className="rounded-lg bg-white px-3 py-2 text-xs">
                    <p className="font-semibold text-slate-700">{factor.label}</p>
                    <p className={factor.impact === "positive" ? "text-emerald-700" : "text-amber-700"}>{factor.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Services</h2>
            <div className="mt-3 space-y-2">
              {providerView.services.map((service) => (
                <div key={service.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{service.title}</p>
                  <p className="text-xs text-slate-500">{service.category} • {service.specialization ?? "General"}</p>
                  <p className="mt-1 text-slate-700">{service.short_description}</p>
                  <p className="mt-1 text-xs text-slate-600">{service.pricing_mode} • ₦{Number(service.min_price ?? 0).toLocaleString()} - ₦{Number(service.max_price ?? 0).toLocaleString()} • {service.turnaround_time ?? "Turnaround on request"}</p>
                  <p className="text-xs text-slate-500">{service.vat_applicable ? "VAT applicable" : "VAT not applicable"} • {service.availability_status}</p>
                </div>
              ))}
              {providerView.services.length === 0 && <p className="text-sm text-slate-500">No services listed yet.</p>}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Portfolio gallery</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {providerView.gallery.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-slate-200 p-2">
                  <Image src={asset.asset_url} alt={asset.caption ?? providerView.business_name} width={420} height={220} className="h-28 w-full rounded-lg object-cover" />
                  <p className="mt-2 text-xs text-slate-600">{asset.caption ?? "Project sample"}</p>
                  {asset.is_featured && <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Featured</p>}
                </div>
              ))}
              {providerView.gallery.length === 0 && <p className="text-sm text-slate-500">No portfolio items yet.</p>}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-xl font-semibold">Recent reviews</h2>
            <div className="mt-3 space-y-3">
              {providerView.reviews.map((review) => (
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
                Report submitted. The issue has been logged for regulator triage.
              </div>
            )}
            {query.quote === "1" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Quote request submitted. This provider can respond from their MSME quote inbox.
              </div>
            )}
            {query.notice === "complaint_submitted" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Your complaint has been submitted successfully. Our team will review it.
              </div>
            )}
            {query.quote_error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {query.quote_error === "missing_fields"
                  ? "Please complete your name, contact, and request details before submitting."
                  : "We could not submit your quote request right now. Please retry."}
              </div>
            )}
            {query.reported_error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {query.reported_error === "missing_fields"
                  ? "Please complete all required complaint fields and confirm consent before submitting."
                  : query.reported_error === "file_too_large"
                    ? "Evidence file is too large. Maximum allowed size is 10 MB."
                  : query.reported_error === "unsupported_file_type"
                    ? "Unsupported evidence file type. Allowed formats: PDF, PNG, JPG, JPEG, DOC, DOCX."
                  : query.reported_error === "provider_not_found"
                    ? "Provider profile could not be resolved. Please reopen this provider page and try again."
                  : "We could not submit your complaint right now. Please retry."}
              </div>
            )}
            <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
              <h3 className="text-base font-semibold text-indigo-950">Request a quote</h3>
              <p className="mt-1 text-xs text-indigo-900">Use the structured request form to share your scope, budget, and contact details with this provider.</p>
              <Link
                href={buildProviderQuoteHref({
                  id: providerView.id,
                  msme_id: providerView.msme_id,
                  public_slug: providerView.public_slug,
                })}
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-indigo-900 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
              >
                Open quote request form
              </Link>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold">Submit a complaint case</h3>
              <p className="mt-1 text-xs text-slate-500">Share complaint details for review, provider response, and possible regulatory escalation.</p>
              <PublicComplaintForm
                providerSlug={providerSlug}
                providerProfileId={providerView.id}
                providerMsmePublicId={providerView.msme_id}
              />
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold">Complaint posture</h3>
              <p className="mt-2 text-sm text-slate-600">Active complaints in regulator queue: {providerView.active_complaint_count}</p>
              <p className="mt-1 text-xs text-slate-500">Association: {providerView.association_name ?? "Not linked"}</p>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}
