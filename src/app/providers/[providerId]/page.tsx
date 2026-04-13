import Link from "next/link";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { getProviderPublicProfile, type ProviderProfile } from "@/lib/data/marketplace";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { resolveProviderPublicContext, resolvePublicProviderProfile } from "@/lib/data/provider-profile-resolver";
import { buildProviderQuoteHref } from "@/lib/provider-links";
import { getTableColumns } from "@/lib/data/commercial-ops";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devLog(message: string, payload?: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[public-complaint] ${message}`, payload ?? {});
}

function resolveFirstExistingColumn(columns: Set<string>, candidates: string[]) {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
}

type TableColumnMetadata = {
  column_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
};

async function getFreshTableColumns(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  tableName: string
) {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);

  if (error) {
    return getTableColumns(supabase, tableName);
  }

  return new Set((data ?? []).map((row) => String(row.column_name)));
}

async function getTableColumnMetadata(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  tableName: string
): Promise<TableColumnMetadata[]> {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name,is_nullable,column_default,is_identity")
    .eq("table_schema", "public")
    .eq("table_name", tableName);

  if (error) {
    devLog("complaints_column_metadata_unavailable", { tableName, error });
    return [];
  }

  return (data ?? []).map((row) => ({
    column_name: String(row.column_name),
    is_nullable: row.is_nullable === "NO" ? "NO" : "YES",
    column_default: row.column_default ? String(row.column_default) : null,
    is_identity: row.is_identity === "YES" ? "YES" : "NO",
  }));
}

function buildComplaintInsertPayload(params: {
  fullName: string;
  email: string;
  phone: string;
  preferredContactMethod: string;
  complaintCategory: string;
  priority: string;
  shortSummary: string;
  description: string;
  evidenceNote: string;
  relatedReference: string;
  providerProfileId: string;
  providerMsmePublicId: string;
  providerSlug: string;
  complaintsColumns: Set<string>;
  complaintsMetadata: TableColumnMetadata[];
}) {
  const payload: Record<string, unknown> = {
    complaint_type: params.complaintCategory,
  };
  const setColumnValue = (candidates: string[], value: unknown) => {
    const columnName = resolveFirstExistingColumn(params.complaintsColumns, candidates);
    if (columnName) payload[columnName] = value;
    return columnName;
  };

  setColumnValue(["provider_profile_id"], params.providerProfileId);
  setColumnValue(["provider_msme_id", "provider_public_id", "provider_msme_public_id"], params.providerMsmePublicId);
  setColumnValue(["provider_slug"], params.providerSlug);

  setColumnValue(["complainant_name", "reporter_name", "full_name"], params.fullName);
  setColumnValue(["complainant_email", "reporter_email", "email"], params.email || null);
  setColumnValue(["complainant_phone", "reporter_phone", "phone"], params.phone || null);
  setColumnValue(["preferred_contact_method", "contact_method"], params.preferredContactMethod);
  setColumnValue(["complaint_type"], params.complaintCategory);
  setColumnValue(["severity", "priority"], params.priority);
  setColumnValue(["summary", "title", "subject"], params.shortSummary);
  setColumnValue(["description", "details", "body"], params.description);
  setColumnValue(["evidence_note", "attachment_note", "evidence_url"], params.evidenceNote || null);
  setColumnValue(["quote_id", "invoice_id", "reference_code", "related_reference"], params.relatedReference || null);

  setColumnValue(["status"], "submitted");
  setColumnValue(["source", "source_channel"], "public_provider_page");

  // TODO(complaint-workflow): extend mapper with assigned_to/escalation_target/regulator_status/provider_response/resolution_note once workflow handlers are enabled.

  const requiredColumns = params.complaintsMetadata.filter((column) => (
    column.is_nullable === "NO" &&
    !column.column_default &&
    column.is_identity !== "YES"
  ));
  const mappedColumns = new Set(Object.keys(payload));

  for (const requiredColumn of requiredColumns) {
    if (mappedColumns.has(requiredColumn.column_name)) continue;

    if (requiredColumn.column_name === "complaint_type") {
      payload[requiredColumn.column_name] = params.complaintCategory;
      continue;
    }
    if (requiredColumn.column_name === "description") {
      payload[requiredColumn.column_name] = params.description;
      continue;
    }
    if (requiredColumn.column_name === "summary" || requiredColumn.column_name === "title" || requiredColumn.column_name === "subject") {
      payload[requiredColumn.column_name] = params.shortSummary;
      continue;
    }
    if (requiredColumn.column_name === "provider_profile_id") {
      payload[requiredColumn.column_name] = params.providerProfileId;
      continue;
    }
    if (requiredColumn.column_name === "provider_msme_id" || requiredColumn.column_name === "provider_msme_public_id" || requiredColumn.column_name === "provider_public_id") {
      payload[requiredColumn.column_name] = params.providerMsmePublicId;
      continue;
    }
  }

  return payload;
}

async function submitPublicComplaint(formData: FormData) {
  "use server";

  const providerPathSegment = String(formData.get("provider_path_segment") ?? "").trim();
  if (!providerPathSegment) {
    redirect("/search?complaint=missing_provider");
  }

  const complainant_name = String(formData.get("full_name") ?? "").trim();
  const complainant_email = String(formData.get("email") ?? "").trim();
  const complainant_phone = String(formData.get("phone") ?? "").trim();
  const preferred_contact_method = String(formData.get("preferred_contact_method") ?? "email").trim() || "email";
  const complaintTypeRaw = formData.get("complaint_type");
  const complaintType = typeof complaintTypeRaw === "string" ? complaintTypeRaw.trim() : "";
  const priority = String(formData.get("priority") ?? "").trim();
  const normalizedPriority = priority || "medium";
  const summary = String(formData.get("short_summary") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const evidence_url_or_attachment_note = String(formData.get("evidence_url_or_attachment_note") ?? "").trim();
  const related_reference = String(formData.get("related_reference") ?? "").trim();
  const consent_confirmation = String(formData.get("consent_confirmation") ?? "").trim();
  const providerProfileId = String(formData.get("provider_profile_id") ?? "").trim();
  const providerMsmePublicId = String(formData.get("provider_msme_public_id") ?? "").trim();
  const formProviderSlug = String(formData.get("provider_slug") ?? "").trim();

  if (!complaintType) {
    throw new Error("complaint_type missing from form submission");
  }

  if (!complainant_name || !description || !summary || !consent_confirmation) {
    redirect(`/providers/${providerPathSegment}?reported_error=missing_fields`);
  }

  const supabase = await createServiceRoleSupabaseClient();
  try {
    const providerContext = await resolveProviderPublicContext({
      providerRouteParam: providerPathSegment,
    });
    devLog("provider_resolution_on_submit", {
      providerPathSegment,
      found: Boolean(providerContext.provider),
      providerProfile: providerContext.provider,
      resolvedProviderProfileId: providerContext.provider_profile_id,
      resolvedProviderMsmeId: providerContext.provider_profile_msme_id,
      resolvedAssociationId: providerContext.association_id,
    });

    if (!providerContext.provider_profile_id || !providerContext.provider_profile_msme_id) {
      redirect(`/providers/${providerPathSegment}?reported_error=provider_not_found`);
    }

    const resolvedProviderId = providerContext.provider_profile_id;
    const resolvedProviderMsmeId = providerContext.provider_profile_msme_id;
    const canonicalSlug = providerContext.provider?.public_slug ?? providerPathSegment;
    const resolvedPublicSlug = canonicalSlug;

    console.log("[complaint-submit] provider_resolution", {
      providerSlug: providerPathSegment,
      resolvedProviderId,
      resolvedProviderMsmeId,
    });

    console.log("[complaint-submit] rawFormData", {
      complaint_type: formData.get("complaint_type"),
      priority: formData.get("priority"),
      summary: formData.get("summary"),
      description: formData.get("description"),
    });

    console.log("[complaint-submit] payload", {
      complainant_name,
      complainant_email,
      complainant_phone,
      preferred_contact_method,
      complaint_type: complaintType,
      priority: normalizedPriority,
      summary,
      description,
      evidence_url_or_attachment_note,
      related_reference,
      consent_confirmation,
      hidden_provider_profile_id: providerProfileId,
      hidden_provider_msme_public_id: providerMsmePublicId,
      hidden_provider_slug: formProviderSlug,
    });

    console.log("[complaint-submit] hiddenInputs", {
      providerProfileId,
      providerMsmePublicId,
    });

    const complaintsColumns = await getTableColumns(supabase, "complaints");
    console.log("[complaint-submit] complaintsColumns", complaintsColumns);

    const complaintsColumnSet = await getFreshTableColumns(supabase, "complaints");
    const complaintsMetadata = await getTableColumnMetadata(supabase, "complaints");
    const complaintsColumnsDetailed = complaintsMetadata.map((column) => ({
      column_name: column.column_name,
      is_nullable: column.is_nullable,
      column_default: column.column_default,
      is_identity: column.is_identity,
    }));
    console.log("[complaint-submit] complaints_columns", complaintsColumnsDetailed);
    const requiredComplaintFields = complaintsMetadata
      .filter((column) => column.is_nullable === "NO" && !column.column_default && column.is_identity !== "YES")
      .map((column) => column.column_name);
    console.log("[complaint-submit] requiredComplaintFields", requiredComplaintFields);

    const resolvedProviderProfileId = providerContext.provider_profile_id ?? providerProfileId;
    const resolvedProviderMsmePublicId = providerContext.provider_profile_msme_id ?? providerMsmePublicId;

    const insertPayload = buildComplaintInsertPayload({
      fullName: complainant_name,
      email: complainant_email,
      phone: complainant_phone,
      preferredContactMethod: preferred_contact_method,
      complaintCategory: complaintType,
      priority: normalizedPriority,
      shortSummary: summary,
      description,
      evidenceNote: evidence_url_or_attachment_note,
      relatedReference: related_reference,
      providerProfileId: resolvedProviderProfileId,
      providerMsmePublicId: resolvedProviderMsmePublicId,
      providerSlug: resolvedPublicSlug,
      complaintsColumns: complaintsColumnSet,
      complaintsMetadata,
    });

    console.log("[complaint-submit] normalizedPayload", insertPayload);
    console.log("[complaint-submit] insertPayload", insertPayload);

    const { data: complaintRow, error: complaintInsertError } = await supabase
      .from("complaints")
      .insert(insertPayload)
      .select()
      .single();
    console.log("[complaint-submit] insertErrorFull", complaintInsertError);

    if (complaintInsertError || !complaintRow) {
      throw new Error(
        `[complaint-submit] complaint_insert_failed:
${complaintInsertError?.message}
column=${complaintInsertError?.details}
hint=${complaintInsertError?.hint}`
      );
    }

    console.log("[complaint-submit] complaint_pipeline_related_records_skipped", {
      assignmentRouting: "skipped",
      providerNotification: "skipped",
      associationEscalation: "skipped",
      adminOrFccpcVisibility: "skipped",
      reason: "temporary simplification until main complaint insert is stable",
    });

    revalidatePath(`/providers/${providerPathSegment}`);
    if (resolvedPublicSlug !== providerPathSegment) {
      revalidatePath(`/providers/${resolvedPublicSlug}`);
    }
    redirect(`/providers/${resolvedPublicSlug}?notice=complaint_submitted`);
  } catch (error) {
    console.error("[complaint-submit] submit_pipeline_error", {
      providerPathSegment,
      error,
    });
    if (process.env.NODE_ENV !== "production") {
      throw error;
    }
    redirect(`/providers/${providerPathSegment}?reported_error=submit_failed`);
  }
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
              <form action={submitPublicComplaint} className="mt-3 space-y-2">
                <input type="hidden" name="provider_path_segment" value={providerSlug} />
                <input type="hidden" name="provider_profile_id" value={providerView.id} />
                <input type="hidden" name="provider_msme_public_id" value={providerView.msme_id} />
                <input type="hidden" name="provider_slug" value={providerView.public_slug ?? providerSlug} />
                <input name="full_name" placeholder="Full name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <input name="email" type="email" placeholder="Email address" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <input name="phone" placeholder="Phone number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <select name="preferred_contact_method" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                </select>
                <select name="complaint_type" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required>
                  <option value="general_marketplace_report">General marketplace report</option>
                  <option value="service_quality">Service quality</option>
                  <option value="fraud">Fraud</option>
                  <option value="counterfeit_products">Counterfeit products</option>
                  <option value="pricing_abuse">Pricing abuse</option>
                  <option value="delivery_dispute">Delivery dispute</option>
                </select>
                <select name="priority" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input name="short_summary" placeholder="Short summary" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <textarea name="description" placeholder="Describe the issue" className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <input
                  name="evidence_url_or_attachment_note"
                  placeholder="Evidence URL or attachment note (temporary)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input name="related_reference" placeholder="Quote, invoice, or order reference (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <input type="checkbox" name="consent_confirmation" value="yes" className="mt-0.5" required />
                  <span>I confirm that the information provided is accurate and may be used for complaint investigation and case management.</span>
                </label>
                <button className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Submit complaint</button>
              </form>
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
