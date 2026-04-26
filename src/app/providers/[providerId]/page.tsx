import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  ChevronRight,
  Home,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  getProviderComplaintFormContext,
  getProviderPublicProfile,
  type ProviderProfile,
} from "@/lib/data/marketplace";
import { resolvePublicProviderProfile } from "@/lib/data/provider-profile-resolver";
import { buildProviderQuoteHref } from "@/lib/provider-links";
import { PublicComplaintForm } from "./public-complaint-form";
import { PublicProfileActions } from "./public-profile-actions";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devLog(message: string, payload?: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[public-complaint] ${message}`, payload ?? {});
}

function ratingPercent(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function trustLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Moderate";
  return "Needs Improvement";
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "verified" || normalized === "approved") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (normalized === "pending") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProviderPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ reported?: string; quote?: string; quote_error?: string; notice?: string }>;
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
        <section className="border-b border-emerald-900/80 bg-emerald-950 text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold tracking-tight">Digital Business Identity Network (DBIN)</Link>
            <Link href="/marketplace" className="text-sm text-emerald-100">Marketplace</Link>
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-6 py-14">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Provider not found</p>
            <h1 className="mt-2 text-2xl font-semibold text-amber-900">We could not locate this provider profile</h1>
            <p className="mt-2 text-sm text-amber-800">The provider link is invalid or this profile is no longer publicly available.</p>
            <Link href="/marketplace" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
              Return to marketplace
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const providerId = resolvedRoute.provider.id;
  const [providerResult, complaintContextResult] = await Promise.allSettled([
    getProviderPublicProfile(providerId),
    getProviderComplaintFormContext(providerId),
  ]);

  const provider = providerResult.status === "fulfilled" ? providerResult.value : null;

  const providerViewBase: ProviderProfile = provider ?? {
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
    short_description: "Verified provider listed in the DBIN marketplace.",
    verification_status: "verified",
    trust_score: 75,
    avg_rating: 0,
    review_count: 0,
    is_featured: false,
    owner_name: "Verified MSME Owner",
    contact_email: null,
    contact_phone: null,
    long_description: "This provider has a verified public profile. Additional details will appear as profile data is completed.",
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

  const providerView: ProviderProfile = {
    ...providerViewBase,
    active_complaint_count:
      complaintContextResult.status === "fulfilled"
        ? complaintContextResult.value.active_complaint_count
        : providerViewBase.active_complaint_count,
    association_name:
      complaintContextResult.status === "fulfilled"
        ? complaintContextResult.value.association_name
        : providerViewBase.association_name,
  };

  const breakdownRows = [
    { label: "5 ★", value: providerView.rating_breakdown.five },
    { label: "4 ★", value: providerView.rating_breakdown.four },
    { label: "3 ★", value: providerView.rating_breakdown.three },
    { label: "2 ★", value: providerView.rating_breakdown.two },
    { label: "1 ★", value: providerView.rating_breakdown.one },
  ];

  const profileUrl = `https://bin.gov.ng/providers/${providerView.public_slug}`;
  const verificationSummaryUrl = providerView.msme_id
    ? `/api/verification-summary/${encodeURIComponent(providerView.msme_id)}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-emerald-900 bg-emerald-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">Digital Business Identity Network (DBIN)</Link>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-emerald-50">
            <Link href="/marketplace" className="hover:text-white">Marketplace</Link>
            <Link href="/verify" className="hover:text-white">Verify Business ID</Link>
            <Link href="/resources" className="hover:text-white">Resources</Link>
            <Link href="/partners" className="hover:text-white">Partners</Link>
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </nav>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link href="/login" className="rounded-lg border border-emerald-200/60 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900">Sign in</Link>
            <Link href="/register/msme" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Register</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-slate-800"><Home className="h-4 w-4" />Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/marketplace" className="hover:text-slate-800">Marketplace</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-emerald-700">{providerView.business_name}</span>
        </nav>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="grid gap-6 xl:grid-cols-[220px_1fr_280px]">
            <div>
              <div className="relative">
                <Image
                  src={providerView.logo_url ?? "https://images.unsplash.com/photo-1556740714-a8395b3bf30f?auto=format&fit=crop&w=600&q=80"}
                  alt={providerView.business_name}
                  width={420}
                  height={420}
                  className="h-48 w-full rounded-2xl border border-slate-200 object-cover"
                />
                <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{providerView.business_name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified Provider
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{providerView.category} • {providerView.specialization ?? "General services"}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4 text-slate-500" />{providerView.state}{providerView.lga ? `, ${providerView.lga}` : ""}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{providerView.short_description || providerView.long_description}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">DBIN ID: {providerView.ndmii_id ?? providerView.msme_id ?? "Not available"}</span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-700">Public Profile</span>
                <span className={`rounded-lg border px-2.5 py-1.5 ${statusTone(providerView.verification_status)}`}>
                  {providerView.verification_status === "approved" ? "Approved" : providerView.verification_status === "verified" ? "Active" : providerView.verification_status}
                </span>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trust Score</p>
              <p className="mt-2 text-5xl font-bold text-slate-900">{providerView.trust_score}<span className="text-xl font-semibold text-slate-500">/100</span></p>
              <p className="mt-1 text-base font-semibold text-emerald-700">{trustLabel(providerView.trust_score)}</p>
              <p className="mt-2 text-xs text-slate-600">Score based on verification, reviews, complaints, and association linkage.</p>
              <p className="mt-3 text-xs font-medium text-emerald-700">How trust score is calculated →</p>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold"><Phone className="h-4 w-4 text-emerald-600" />Contact & Availability</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">Phone:</span> {providerView.contact_phone ?? "Available after quote request"}</p>
              <p><span className="font-medium text-slate-900">Email:</span> {providerView.contact_email ?? "Available after quote request"}</p>
              <p><span className="font-medium text-slate-900">Status:</span> {providerView.verification_status === "verified" ? "Open for verified engagements" : "Status update pending"}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold"><Building2 className="h-4 w-4 text-emerald-600" />Services</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {providerView.services.slice(0, 5).map((service) => (
                <li key={service.id} className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-600" />{service.title}</li>
              ))}
              {providerView.services.length === 0 && <li className="text-slate-500">No services listed yet.</li>}
            </ul>
            <Link
              href={buildProviderQuoteHref({ id: providerView.id, msme_id: providerView.msme_id, public_slug: providerView.public_slug })}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Request a Quote
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold"><Star className="h-4 w-4 text-emerald-600" />Rating Summary</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900">{providerView.avg_rating.toFixed(1)}</p>
            <p className="text-sm text-slate-500">From {providerView.review_count} reviews</p>
            <div className="mt-3 space-y-1.5">
              {breakdownRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[28px_1fr_20px] items-center gap-2 text-xs text-slate-600">
                  <span>{row.label.replace(" ★", "")}</span>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratingPercent(row.value, providerView.review_count)}%` }} /></div>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" />Verification Overview</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between"><dt className="text-slate-600">Verification Status</dt><dd className="font-semibold text-emerald-700">{providerView.verification_status === "approved" ? "Approved" : "Verified"}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-600">Profile Status</dt><dd className="font-semibold text-emerald-700">Public</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-600">DBIN Verified</dt><dd className="font-semibold text-emerald-700">Yes</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-600">Reviews Published</dt><dd className="font-semibold text-slate-700">{providerView.review_count}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-600">Last Updated</dt><dd className="font-semibold text-slate-700">{formatDate(providerView.reviews[0]?.created_at)}</dd></div>
            </dl>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1.2fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">About Business</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{providerView.long_description}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Photos & Gallery</h2>
              {providerView.gallery.length > 0 && <span className="text-xs text-emerald-700">View all</span>}
            </div>
            {providerView.gallery.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No portfolio items yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {providerView.gallery.slice(0, 4).map((asset) => (
                  <Image key={asset.id} src={asset.asset_url} alt={asset.caption ?? providerView.business_name} width={300} height={200} className="h-24 w-full rounded-lg object-cover" />
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Share this Profile</h2>
            <p className="mt-1 text-sm text-slate-600">Help others discover this verified business.</p>
            <div className="mt-3">
              <PublicProfileActions profileUrl={profileUrl} verificationSummaryUrl={verificationSummaryUrl} />
            </div>
          </article>
        </section>

        {providerView.reviews.length === 0 && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">No reviews published yet.</section>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <aside className="space-y-3">
            {query.reported === "1" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Report submitted. The issue has been logged for regulator triage.</div>}
            {query.quote === "1" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Quote request submitted. This provider can respond from their MSME quote inbox.</div>}
            {query.notice === "complaint_submitted" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Your complaint has been submitted successfully. Our team will review it.</div>}
            {query.quote_error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {query.quote_error === "missing_fields"
                  ? "Please complete your name, contact, and request details before submitting."
                  : "We could not submit your quote request right now. Please retry."}
              </div>
            )}

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold">Submit a complaint case</h3>
              <p className="mt-1 text-xs text-slate-500">Share complaint details for review, provider response, and regulatory escalation where required.</p>
              <div className="mt-3">
                <PublicComplaintForm providerSlug={providerSlug} providerProfileId={providerView.id} providerMsmeId={providerView.msme_id} />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold">Complaint posture</h3>
              <p className="mt-2 text-sm text-slate-600">Active complaints in regulator queue: {providerView.active_complaint_count}</p>
              <p className="mt-1 text-xs text-slate-500">Association: {providerView.association_name ?? "Not linked"}</p>
            </article>
          </aside>

          <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
            <p className="inline-flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" />Information on this page is provided by the business and verified by DBIN.</p>
            <p className="mt-1 text-emerald-800">For official verification documents, use the verification summary action when available.</p>
          </article>
        </section>
      </section>

      <footer className="mt-8 border-t border-emerald-900/80 bg-emerald-950 text-emerald-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs">
          <p>DBIN is an independent business identity and verification network.</p>
          <p>© 2026 Digital Business Identity Network (DBIN). All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
