import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ArrowUpDown,
  Calendar,
  Check,
  Clock3,
  Download,
  MessageCircle,
  Search,
  Share2,
  Smile,
  Star,
} from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";

async function submitReply(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("review_id") ?? "");
  const providerId = String(formData.get("provider_id") ?? "");
  const replyText = String(formData.get("reply_text") ?? "").trim();

  if (!reviewId || !providerId || !replyText) {
    redirect("/dashboard/msme/reviews?error=missing_fields");
  }

  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();

  if (ctx.role !== "msme" && ctx.role !== "admin") {
    redirect("/access-denied");
  }

  const workspace = ctx.role === "msme" ? await getProviderWorkspaceContext() : null;

  let providerQuery = supabase.from("provider_profiles").select("id").eq("id", providerId).limit(1);
  if (workspace) {
    providerQuery = providerQuery.in("msme_id", [workspace.msme.id, workspace.msme.msme_id]);
  }

  const { data: provider } = await providerQuery.maybeSingle();
  if (!provider) {
    redirect("/access-denied");
  }

  const { data: review } = await supabase
    .from("reviews")
    .select("id,provider_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review || review.provider_id !== providerId) {
    redirect("/dashboard/msme/reviews?error=ownership_scope");
  }

  const { error, data: updatedRows } = await supabase
    .from("reviews")
    .update({
      provider_reply: replyText,
      provider_reply_at: new Date().toISOString(),
      provider_reply_by: ctx.appUserId,
    })
    .select("id")
    .eq("id", reviewId)
    .eq("provider_id", providerId);

  if (error || !updatedRows?.length) {
    redirect("/dashboard/msme/reviews?error=save_failed");
  }

  revalidatePath("/dashboard/msme/reputation");
  revalidatePath("/dashboard/msme/reviews");
  revalidatePath(`/providers/${providerId}`);
  revalidatePath("/search");
  revalidatePath("/");
  redirect("/dashboard/msme/reviews?saved=1");
}

async function updateProviderProfile(formData: FormData) {
  "use server";
  const providerId = String(formData.get("provider_id") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const shortDescription = String(formData.get("short_description") ?? "").trim();

  if (!providerId || !displayName || !shortDescription) {
    redirect("/dashboard/msme/reviews?error=missing_fields");
  }

  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" && ctx.role !== "admin") {
    redirect("/access-denied");
  }
  const workspace = ctx.role === "msme" ? await getProviderWorkspaceContext() : null;

  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase.from("provider_profiles").select("id").eq("id", providerId).limit(1);
  if (workspace) {
    query = query.in("msme_id", [workspace.msme.id, workspace.msme.msme_id]);
  }

  const { data: provider } = await query.maybeSingle();
  if (!provider) {
    redirect("/dashboard/msme/reviews?error=ownership_scope");
  }

  const { error } = await supabase
    .from("provider_profiles")
    .update({
      display_name: displayName,
      tagline: shortDescription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", providerId);

  if (error) {
    redirect("/dashboard/msme/reviews?error=save_failed");
  }

  revalidatePath("/dashboard/msme/reviews");
  revalidatePath("/search");
  revalidatePath("/");
  redirect("/dashboard/msme/reviews?saved=1");
}

type PageSearchParams = {
  saved?: string;
  error?: string;
  q?: string;
  rating?: string;
  service?: string;
  time?: string;
  sort?: string;
};

export default async function MsmeReputationPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" && ctx.role !== "admin") redirect("/access-denied");
  const workspace = ctx.role === "msme" ? await getProviderWorkspaceContext() : null;

  const params = await searchParams;
  const supabase = await createServiceRoleSupabaseClient();

  let providerQuery = supabase
    .from("provider_profiles")
    .select("id,display_name,tagline,description,public_slug,msme_id,msmes(msme_id,business_name,owner_name)")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (workspace) {
    providerQuery = providerQuery.in("msme_id", [workspace.msme.id, workspace.msme.msme_id]);
  }

  const { data: providers } = await providerQuery;
  const providerIds = (providers ?? []).map((row) => row.id);
  const { data: providerMetrics } = await supabase
    .from("marketplace_provider_search")
    .select("provider_id,avg_rating,review_count,trust_score")
    .in("provider_id", providerIds.length ? providerIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id,provider_id,reviewer_name,rating,review_title,review_body,provider_reply,created_at")
    .in("provider_id", providerIds.length ? providerIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false })
    .limit(200);

  const providerById = new Map((providers ?? []).map((row) => [row.id, row]));
  const metricsByProviderId = new Map((providerMetrics ?? []).map((row) => [row.provider_id, row]));

  const searchTerm = (params.q ?? "").trim().toLowerCase();
  const ratingFilter = params.rating ?? "all";
  const serviceFilter = params.service ?? "all";
  const timeFilter = params.time ?? "all";
  const sortFilter = params.sort ?? "newest";

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const filteredReviews = (reviews ?? []).filter((review) => {
    const provider = providerById.get(review.provider_id);
    const reviewDate = review.created_at ? new Date(review.created_at) : null;

    const matchesSearch =
      !searchTerm ||
      review.reviewer_name?.toLowerCase().includes(searchTerm) ||
      review.review_title?.toLowerCase().includes(searchTerm) ||
      review.review_body?.toLowerCase().includes(searchTerm) ||
      provider?.display_name?.toLowerCase().includes(searchTerm);

    const matchesRating = ratingFilter === "all" || String(Math.round(Number(review.rating ?? 0))) === ratingFilter;

    const matchesService = serviceFilter === "all" || review.provider_id === serviceFilter;

    const matchesTime =
      timeFilter === "all" ||
      (timeFilter === "30" && !!reviewDate && now.getTime() - reviewDate.getTime() <= 30 * dayMs) ||
      (timeFilter === "90" && !!reviewDate && now.getTime() - reviewDate.getTime() <= 90 * dayMs) ||
      (timeFilter === "365" && !!reviewDate && now.getTime() - reviewDate.getTime() <= 365 * dayMs);

    return matchesSearch && matchesRating && matchesService && matchesTime;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (sortFilter === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (sortFilter === "highest") {
      return Number(b.rating ?? 0) - Number(a.rating ?? 0);
    }
    if (sortFilter === "lowest") {
      return Number(a.rating ?? 0) - Number(b.rating ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalReviews = sortedReviews.length;
  const averageRating = totalReviews
    ? sortedReviews.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) / totalReviews
    : 0;
  const positiveReviews = sortedReviews.filter((row) => Number(row.rating ?? 0) >= 4).length;
  const pendingReplies = sortedReviews.filter((row) => !row.provider_reply?.trim()).length;

  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: sortedReviews.filter((row) => Math.round(Number(row.rating ?? 0)) === rating).length,
  }));

  const serviceOptions = (providers ?? []).map((provider) => ({
    id: provider.id,
    label: provider.display_name || "Unnamed Service",
  }));

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customer Reviews</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            See what your customers are saying about your services and respond to reviews.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          <Download className="h-4 w-4" />
          Export Reviews
        </button>
      </header>

      {params.saved === "1" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Reply published successfully.
        </p>
      )}
      {params.error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {params.error === "ownership_scope"
            ? "Reply could not be saved because this review is outside your provider scope."
            : params.error === "missing_fields"
              ? "Reply could not be saved. Please enter a response before publishing."
              : "Reply could not be saved right now. Please retry."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Star,
            value: averageRating.toFixed(1),
            label: "Average Rating",
            subtext: `Based on ${totalReviews} reviews`,
          },
          {
            icon: MessageCircle,
            value: String(totalReviews),
            label: "Total Reviews",
            subtext: "All time",
          },
          {
            icon: Smile,
            value: String(positiveReviews),
            label: "Positive Reviews",
            subtext: "(4–5 stars)",
          },
          {
            icon: Clock3,
            value: String(pendingReplies),
            label: "Pending Replies",
            subtext: "Need your response",
          },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-4xl font-bold tracking-tight text-slate-900">{card.value}</p>
            <p className="mt-1 text-base font-semibold text-slate-700">{card.label}</p>
            <p className="text-sm text-slate-500">{card.subtext}</p>
          </article>
        ))}
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[2fr_repeat(4,minmax(0,1fr))]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search reviews..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-emerald-100 transition focus:border-emerald-400 focus:ring"
          />
        </label>
        <select
          name="rating"
          defaultValue={ratingFilter}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-100 transition focus:border-emerald-400 focus:ring"
        >
          <option value="all">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
        <select
          name="service"
          defaultValue={serviceFilter}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-100 transition focus:border-emerald-400 focus:ring"
        >
          <option value="all">All Services</option>
          {serviceOptions.map((service) => (
            <option key={service.id} value={service.id}>
              {service.label}
            </option>
          ))}
        </select>
        <select
          name="time"
          defaultValue={timeFilter}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-100 transition focus:border-emerald-400 focus:ring"
        >
          <option value="all">All Time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 12 months</option>
        </select>
        <div className="flex gap-2">
          <select
            name="sort"
            defaultValue={sortFilter}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-100 transition focus:border-emerald-400 focus:ring"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="highest">Sort: Highest Rating</option>
            <option value="lowest">Sort: Lowest Rating</option>
          </select>
          <button className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-600 hover:bg-slate-100" aria-label="Apply filters">
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_320px]">
        <div>
          {sortedReviews.length === 0 ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <MessageCircle className="h-14 w-14" />
                </div>
                <h2 className="text-4xl font-bold tracking-tight text-slate-900">No reviews yet</h2>
                <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
                  You haven&apos;t received any reviews yet. Once customers review your service, they&apos;ll appear here.
                </p>
                <button type="button" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
                  <Share2 className="h-4 w-4" />
                  Share Your Services
                </button>
              </div>
            </article>
          ) : (
            <div className="space-y-4">
              {sortedReviews.map((review) => {
                const provider = providerById.get(review.provider_id);
                const providerMsme = provider?.msmes as { msme_id?: string | null; owner_name?: string | null; business_name?: string | null } | null;
                const initial = (review.reviewer_name || "A").charAt(0).toUpperCase();

                return (
                  <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                          {initial}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{review.reviewer_name || "Anonymous Reviewer"}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {Number(review.rating ?? 0).toFixed(1)}
                            </span>
                            <span>{provider?.display_name ?? "Service"}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {review.created_at ? new Date(review.created_at).toLocaleDateString() : "Unknown date"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          review.provider_reply?.trim() ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {review.provider_reply?.trim() ? "Replied" : "Pending reply"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-800">{review.review_title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{review.review_body}</p>
                    <p className="mt-2 text-xs text-slate-500">Owner: {providerMsme?.owner_name ?? "MSME Owner"} • MSME ID: {providerMsme?.msme_id ?? "N/A"}</p>

                    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Provider profile quick edit
                      </summary>
                      <form action={updateProviderProfile} className="mt-3 space-y-2">
                        <input type="hidden" name="provider_id" value={review.provider_id} />
                        <input
                          name="display_name"
                          defaultValue={provider?.display_name ?? ""}
                          placeholder="Provider display name"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        <textarea
                          name="short_description"
                          defaultValue={provider?.tagline ?? provider?.description ?? ""}
                          placeholder="Short provider description"
                          className="min-h-16 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                          Save profile details
                        </button>
                      </form>
                    </details>

                    <form action={submitReply} className="mt-4 space-y-2">
                      <input type="hidden" name="review_id" value={review.id} />
                      <input type="hidden" name="provider_id" value={review.provider_id} />
                      <textarea
                        name="reply_text"
                        defaultValue={review.provider_reply ?? ""}
                        placeholder="Reply publicly to this review"
                        className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <button className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                        {review.provider_reply?.trim() ? "Update reply" : "Publish reply"}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Rating Breakdown</h3>
            <div className="mt-4 space-y-3">
              {ratingCounts.map((row) => {
                const percentage = totalReviews ? Math.round((row.count / totalReviews) * 100) : 0;
                return (
                  <div key={row.rating} className="grid grid-cols-[56px_1fr_auto] items-center gap-2 text-sm">
                    <span className="text-slate-600">{row.rating} Star{row.rating === 1 ? "" : "s"}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{row.count} ({percentage}%)</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-700">
              <span>Total</span>
              <span>{totalReviews}</span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Tips to Get More Reviews</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {[
                "Provide excellent customer service",
                "Deliver high-quality work",
                "Ask satisfied customers for reviews",
                "Respond to all reviews",
                "Share your review link",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 p-5 text-white shadow-sm">
            <h3 className="text-xl font-semibold leading-tight">Build Trust. Get More Customers.</h3>
            <p className="mt-2 text-sm text-emerald-100">
              Reviews help you stand out in the marketplace and win more jobs.
            </p>
            <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
              <Share2 className="h-4 w-4" />
              Share Your Services
            </button>
            <div className="mt-4 flex items-center justify-end text-emerald-100">
              <div className="rounded-full bg-white/15 p-2">
                <MessageCircle className="h-5 w-5" />
              </div>
            </div>
          </article>
        </aside>
      </div>

      {providerIds.length > 0 && (
        <p className="text-xs text-slate-500">
          Service trust metrics loaded for {providerIds.length} provider profile{providerIds.length === 1 ? "" : "s"}. Average trust score: {Number(
            Array.from(metricsByProviderId.values()).reduce((acc, row) => acc + Number(row.trust_score ?? 0), 0) / Math.max(metricsByProviderId.size, 1),
          ).toFixed(1)}.
        </p>
      )}
    </section>
  );
}
