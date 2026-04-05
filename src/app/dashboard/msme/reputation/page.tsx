import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export default async function MsmeReputationPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
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
    .limit(30);

  const providerById = new Map((providers ?? []).map((row) => [row.id, row]));
  const metricsByProviderId = new Map((providerMetrics ?? []).map((row) => [row.provider_id, row]));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reputation & Review Replies</h1>
      </div>
      {params.saved === "1" && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Reply published successfully.</p>}
      {params.error && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {params.error === "ownership_scope"
            ? "Reply could not be saved because this review is outside your provider scope."
            : params.error === "missing_fields"
              ? "Reply could not be saved. Please enter a response before publishing."
              : "Reply could not be saved right now. Please retry."}
        </p>
      )}

      <article className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Trust performance snapshot</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(providers ?? []).map((provider) => {
            const metrics = metricsByProviderId.get(provider.id);
            const providerMsme = provider.msmes as { msme_id?: string | null; owner_name?: string | null; business_name?: string | null } | null;
            return (
              <div key={provider.id} className="rounded-lg border bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{provider.display_name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Owned by {providerMsme?.owner_name ?? "MSME Owner"} • {providerMsme?.msme_id ?? "Unmapped MSME"}
                </p>
                <p className="mt-1 text-xs text-slate-600">Rating {Number(metrics?.avg_rating ?? 0).toFixed(1)} • {Number(metrics?.review_count ?? 0)} reviews</p>
                <p className="text-xs text-slate-600">Trust score {Number(metrics?.trust_score ?? 0)}</p>
              </div>
            );
          })}
          {(providers ?? []).length === 0 && <p className="text-sm text-slate-500">No linked marketplace profile found for your account yet.</p>}
        </div>
      </article>

      <div className="space-y-3">
        {(reviews ?? []).map((review) => {
          const provider = providerById.get(review.provider_id);
          const providerMsme = provider?.msmes as { msme_id?: string | null; owner_name?: string | null; business_name?: string | null } | null;
          return (
            <article key={review.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{review.review_title}</p>
                <p className="text-xs text-slate-500">{Number(review.rating).toFixed(1)} / 5</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{provider?.display_name ?? "Provider"} • by {review.reviewer_name}</p>
              <p className="mt-1 text-xs text-slate-500">Owner: {providerMsme?.owner_name ?? "MSME Owner"} • MSME ID: {providerMsme?.msme_id ?? "N/A"}</p>
              <p className="mt-2 text-sm text-slate-700">{review.review_body}</p>

              <form action={updateProviderProfile} className="mt-3 space-y-2 rounded-lg border bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider profile quick edit</p>
                <input type="hidden" name="provider_id" value={review.provider_id} />
                <input
                  name="display_name"
                  defaultValue={provider?.display_name ?? ""}
                  placeholder="Provider display name"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <textarea
                  name="short_description"
                  defaultValue={provider?.tagline ?? provider?.description ?? ""}
                  placeholder="Short provider description"
                  className="min-h-16 w-full rounded border px-3 py-2 text-sm"
                />
                <button className="rounded bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">Save profile details</button>
              </form>

              <form action={submitReply} className="mt-3 space-y-2">
                <input type="hidden" name="review_id" value={review.id} />
                <input type="hidden" name="provider_id" value={review.provider_id} />
                <textarea
                  name="reply_text"
                  defaultValue={review.provider_reply ?? ""}
                  placeholder="Reply publicly to this review"
                  className="min-h-20 w-full rounded border px-3 py-2 text-sm"
                />
                <button className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Publish reply</button>
              </form>
            </article>
          );
        })}
        {(reviews ?? []).length === 0 && <p className="rounded border bg-white p-4 text-sm text-slate-500">No reviews available for your provider profile yet.</p>}
      </div>
    </section>
  );
}
