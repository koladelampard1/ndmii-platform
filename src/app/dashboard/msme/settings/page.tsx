import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleHelp, ExternalLink, Info, Upload } from "lucide-react";
import { filterPayloadByColumns, getTableColumns } from "@/lib/data/commercial-ops";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const SETTINGS_SECTIONS = [
  {
    id: "profile-information",
    title: "Profile Information",
    description: "Business and personal details",
  },
  {
    id: "business-information",
    title: "Business Information",
    description: "Update business details",
  },
  {
    id: "contact-address",
    title: "Contact & Address",
    description: "Contact person and address",
  },
  {
    id: "banking-information",
    title: "Banking Information",
    description: "Bank account details",
  },
  {
    id: "tax-information",
    title: "Tax Information",
    description: "TIN, VAT and tax details",
  },
  {
    id: "verification-documents",
    title: "Verification Documents",
    description: "View and update documents",
  },
  {
    id: "notification-preferences",
    title: "Notification Preferences",
    description: "Manage email and alerts",
  },
  {
    id: "account-security",
    title: "Account & Security",
    description: "Password and security",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connected services",
  },
  {
    id: "activity-log",
    title: "Activity Log",
    description: "Recent account activity",
  },
] as const;

type CompletenessItem = {
  label: string;
  complete: boolean;
};

type SettingsErrorCode =
  | "read_failed"
  | "provider_save_failed"
  | "msme_save_failed"
  | "unknown_save_error";

const SETTINGS_ERROR_MESSAGES: Record<SettingsErrorCode, string> = {
  read_failed: "We could not load your current settings. Please refresh and try again.",
  provider_save_failed: "Your business profile changes could not be saved. Please try again.",
  msme_save_failed: "Your MSME settings could not be saved. Please try again.",
  unknown_save_error: "Something went wrong while saving. Please retry.",
};

function deriveProfileCompleteness(workspace: Awaited<ReturnType<typeof getProviderWorkspaceContext>>) {
  const items: CompletenessItem[] = [
    {
      label: "Business Information",
      complete: Boolean(workspace.msme.business_name && workspace.provider.display_name && workspace.msme.sector),
    },
    {
      label: "Contact & Address",
      complete: Boolean(workspace.msme.owner_name && workspace.msme.contact_email && workspace.provider.contact_phone),
    },
    {
      label: "Banking Information",
      complete: false,
    },
    {
      label: "Tax Information",
      complete: false,
    },
    {
      label: "Verification Documents",
      complete: workspace.msme.verification_status !== "draft",
    },
    {
      label: "Business Description",
      complete: Boolean(workspace.provider.description && workspace.provider.description.trim().length > 0),
    },
  ];

  const completeCount = items.filter((item) => item.complete).length;
  const percentage = Math.round((completeCount / items.length) * 100);

  return {
    items,
    percentage,
    completeCount,
  };
}

async function settingsAction(formData: FormData) {
  "use server";

  const route = "/dashboard/msme/settings";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const nowIso = new Date().toISOString();
  const saveContext = {
    route,
    providerProfileId: workspace.provider.id,
    providerMsmeReference: workspace.provider.msme_id,
    msmeRowId: workspace.msme.id,
    msmePublicId: workspace.msme.msme_id,
  };
  let firstFailedWrite: string | null = null;

  const settingsReadSelect = "id,msme_id,business_name,owner_name,sector,contact_email,contact_phone,address,cac_number,tin,business_type";
  const { data: existingMsme, error: existingMsmeError } = await supabase
    .from("msmes")
    .select(settingsReadSelect)
    .eq("id", workspace.msme.id)
    .maybeSingle();

  console.info("[msme-settings][read-source]", {
    ...saveContext,
    table: "msmes",
    filters: { id: workspace.msme.id },
    select: settingsReadSelect.split(","),
    error: existingMsmeError?.message ?? null,
    found: Boolean(existingMsme),
  });

  if (existingMsmeError || !existingMsme) {
    console.error("[msme-settings][read-failed]", {
      ...saveContext,
      table: "msmes",
      dbResponse: {
        message: existingMsmeError?.message ?? "owned_msme_not_found",
        details: existingMsmeError?.details ?? null,
        hint: existingMsmeError?.hint ?? null,
        code: existingMsmeError?.code ?? null,
      },
    });
    redirect("/dashboard/msme/settings?error=read_failed");
  }

  // Source of truth for editable fields:
  // - Canonical business/contact data lives in `msmes` and is always written there.
  // - `provider_profiles` is only updated for display-facing mirror fields (display_name/contact/description)
  //   to keep public profile views in sync while tolerating schema drift.
  const providerRawPayload = {
    display_name: String(formData.get("business_name") ?? existingMsme.business_name ?? workspace.provider.display_name).trim() || null,
    description: String(formData.get("business_description") ?? workspace.provider.description ?? "").trim() || null,
    contact_email: String(formData.get("contact_email") ?? existingMsme.contact_email ?? workspace.provider.contact_email ?? "").trim() || null,
    contact_phone: String(formData.get("contact_phone") ?? existingMsme.contact_phone ?? workspace.provider.contact_phone ?? "").trim() || null,
    updated_at: nowIso,
  };
  const providerColumns = await getTableColumns(supabase, "provider_profiles");
  const providerPayload = filterPayloadByColumns(providerRawPayload, providerColumns);

  console.info("[msme-settings][write-before]", {
    ...saveContext,
    section: "profile-information,contact-address,about-business",
    table: "provider_profiles",
    lookupKeys: { id: workspace.provider.id, msme_id: workspace.provider.msme_id },
    availableColumns: Array.from(providerColumns).sort(),
    payload: providerPayload,
  });

  let providerUpdateRows: { id: string }[] | null = null;
  let providerUpdateError: { message?: string; details?: string; hint?: string; code?: string } | null = null;
  if (Object.keys(providerPayload).length > 0) {
    const providerUpdateResult = await supabase
      .from("provider_profiles")
      .update(providerPayload)
      .eq("id", workspace.provider.id)
      .eq("msme_id", workspace.provider.msme_id)
      .select("id");
    providerUpdateRows = providerUpdateResult.data as { id: string }[] | null;
    providerUpdateError = providerUpdateResult.error;
  } else {
    console.warn("[msme-settings][provider-write-skipped]", {
      ...saveContext,
      reason: "no_mutable_provider_profile_columns",
      providerRawPayloadKeys: Object.keys(providerRawPayload),
    });
  }

  console.info("[msme-settings][write-after]", {
    ...saveContext,
    section: "profile-information,contact-address,about-business",
    table: "provider_profiles",
    success: !providerUpdateError && (Object.keys(providerPayload).length === 0 || Boolean(providerUpdateRows?.length)),
    returnedRowCount: providerUpdateRows?.length ?? 0,
    skippedWrite: Object.keys(providerPayload).length === 0,
    dbResponse: {
      message: providerUpdateError?.message ?? null,
      details: providerUpdateError?.details ?? null,
      hint: providerUpdateError?.hint ?? null,
      code: providerUpdateError?.code ?? null,
    },
  });

  if (providerUpdateError || (Object.keys(providerPayload).length > 0 && !providerUpdateRows?.length)) {
    firstFailedWrite = firstFailedWrite ?? "provider_profiles";
    console.error("[msme-settings][save-failed]", {
      ...saveContext,
      firstFailedWrite,
      table: "provider_profiles",
      lookupKeys: { id: workspace.provider.id, msme_id: workspace.provider.msme_id },
      payload: providerPayload,
      dbResponse: {
        message: providerUpdateError?.message ?? "no_rows_updated",
        details: providerUpdateError?.details ?? null,
        hint: providerUpdateError?.hint ?? null,
        code: providerUpdateError?.code ?? null,
      },
    });
    redirect("/dashboard/msme/settings?error=provider_save_failed");
  }

  const msmePayload = {
    // Canonical: msmes.business_name (mirrored into provider_profiles.display_name above when available)
    business_name: String(formData.get("business_name") ?? existingMsme.business_name).trim() || existingMsme.business_name,
    // Canonical: msmes.owner_name
    owner_name: String(formData.get("owner_name") ?? existingMsme.owner_name).trim() || existingMsme.owner_name,
    // Canonical: msmes.sector
    sector: String(formData.get("business_category") ?? existingMsme.sector).trim() || existingMsme.sector,
    // Canonical: msmes.business_type
    business_type: String(formData.get("business_sub_category") ?? existingMsme.business_type ?? "").trim() || null,
    // Canonical: msmes.contact_email (mirrored into provider_profiles.contact_email above when available)
    contact_email: String(formData.get("contact_email") ?? existingMsme.contact_email ?? "").trim() || null,
    // Canonical: msmes.contact_phone (mirrored into provider_profiles.contact_phone above when available)
    contact_phone: String(formData.get("contact_phone") ?? existingMsme.contact_phone ?? "").trim() || null,
    // Canonical: msmes.cac_number
    cac_number: String(formData.get("cac_number") ?? existingMsme.cac_number ?? "").trim() || null,
    // Canonical: msmes.address
    address: String(formData.get("address") ?? existingMsme.address ?? "").trim() || null,
  };

  console.info("[msme-settings][write-before]", {
    ...saveContext,
    section: "business-information,contact-address",
    table: "msmes",
    lookupKeys: { id: workspace.msme.id },
    payload: msmePayload,
  });

  const { data: msmeUpdateRows, error: msmeUpdateError } = await supabase
    .from("msmes")
    .update(msmePayload)
    .eq("id", workspace.msme.id)
    .select("id");

  console.info("[msme-settings][write-after]", {
    ...saveContext,
    section: "business-information,contact-address",
    table: "msmes",
    success: !msmeUpdateError && Boolean(msmeUpdateRows?.length),
    returnedRowCount: msmeUpdateRows?.length ?? 0,
    dbResponse: {
      message: msmeUpdateError?.message ?? null,
      details: msmeUpdateError?.details ?? null,
      hint: msmeUpdateError?.hint ?? null,
      code: msmeUpdateError?.code ?? null,
    },
  });

  if (msmeUpdateError || !msmeUpdateRows?.length) {
    firstFailedWrite = firstFailedWrite ?? "msmes";
    console.error("[msme-settings][save-failed]", {
      ...saveContext,
      firstFailedWrite,
      table: "msmes",
      lookupKeys: { id: workspace.msme.id },
      payload: msmePayload,
      dbResponse: {
        message: msmeUpdateError?.message ?? "no_rows_updated",
        details: msmeUpdateError?.details ?? null,
        hint: msmeUpdateError?.hint ?? null,
        code: msmeUpdateError?.code ?? null,
      },
    });
    redirect("/dashboard/msme/settings?error=msme_save_failed");
  }

  const revalidationTargets = ["/dashboard/msme/settings", "/dashboard/msme/profile", `/providers/${workspace.provider.id}`];
  console.info("[msme-settings][revalidation-targets]", { ...saveContext, revalidationTargets });
  revalidatePath("/dashboard/msme/settings");
  revalidatePath("/dashboard/msme/profile");
  revalidatePath(`/providers/${workspace.provider.id}`);
  redirect("/dashboard/msme/settings?saved=1");
}

export default async function MsmeSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const settingsReadSelect =
    "id,business_name,owner_name,sector,business_type,contact_email,contact_phone,address,cac_number,tin";
  const { data: msmeSettings, error: msmeSettingsError } = await supabase
    .from("msmes")
    .select(settingsReadSelect)
    .eq("id", workspace.msme.id)
    .maybeSingle();

  console.info("[msme-settings][read-page]", {
    route: "/dashboard/msme/settings",
    providerProfileId: workspace.provider.id,
    msmeRowId: workspace.msme.id,
    table: "msmes",
    select: settingsReadSelect.split(","),
    error: msmeSettingsError?.message ?? null,
    found: Boolean(msmeSettings),
  });

  if (msmeSettingsError || !msmeSettings) {
    console.error("[msme-settings][read-page-failed]", {
      route: "/dashboard/msme/settings",
      providerProfileId: workspace.provider.id,
      msmeRowId: workspace.msme.id,
      dbResponse: {
        message: msmeSettingsError?.message ?? "settings_row_not_found",
        details: msmeSettingsError?.details ?? null,
        hint: msmeSettingsError?.hint ?? null,
        code: msmeSettingsError?.code ?? null,
      },
    });
    redirect("/dashboard/msme/settings?error=read_failed");
  }

  const completeness = deriveProfileCompleteness(workspace);
  const errorCode: SettingsErrorCode = (params.error as SettingsErrorCode) || "unknown_save_error";
  const errorMessage = SETTINGS_ERROR_MESSAGES[errorCode] ?? SETTINGS_ERROR_MESSAGES.unknown_save_error;

  return (
    <section className="space-y-5 pb-6">
      {params.saved && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Your settings were saved successfully.</p>
      )}
      {params.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage} ({params.error})
        </p>
      )}

      <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Manage your account, business profile, and preferences.</p>
      </header>

      <form action={settingsAction} className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr),280px]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="space-y-1" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((section, index) => {
              const isActive = index === 0;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={`block rounded-xl border px-3 py-2 transition ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold">{section.title}</p>
                  <p className="text-xs text-slate-500">{section.description}</p>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-4">
          <section id="profile-information" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Profile Information</h2>
                <p className="mt-1 text-sm text-slate-600">Update your account and business contact information.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
                <Info className="h-4 w-4 text-slate-400" aria-hidden />
              </div>
            </div>
          </section>

          <section id="business-information" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Business Logo / Photo</h3>
            <p className="mt-1 text-sm text-slate-600">This will be displayed on your profile and ID card.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-[200px,minmax(0,1fr)]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400">
                  <Upload className="h-6 w-6" />
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Upload Logo
                </button>
                <p className="mt-2 text-xs text-slate-500">PNG, JPG or SVG. Max size 2MB.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-slate-600">Business Name</span>
                  <input
                    name="business_name"
                    defaultValue={msmeSettings.business_name ?? workspace.provider.display_name ?? workspace.msme.business_name}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Business Category</span>
                  <input
                    name="business_category"
                    defaultValue={msmeSettings.sector ?? workspace.msme.sector ?? ""}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Business Sub-category</span>
                  <input
                    name="business_sub_category"
                    defaultValue={msmeSettings.business_type ?? ""}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">CAC Registration Number</span>
                  <input
                    name="cac_number"
                    defaultValue={msmeSettings.cac_number ?? ""}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Date of Incorporation</span>
                  <input
                    type="date"
                    name="date_of_incorporation"
                    defaultValue=""
                    disabled
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-500 outline-none ring-emerald-200 transition focus:ring"
                  />
                  <span className="block text-xs text-slate-500">Not editable here yet (no mapped schema column in this workspace).</span>
                </label>
              </div>
            </div>
          </section>

          <section id="contact-address" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Business Owner / Contact Person</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Full Name</span>
                <input
                  name="owner_name"
                  defaultValue={msmeSettings.owner_name ?? workspace.msme.owner_name ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Email Address</span>
                <input
                  name="contact_email"
                  defaultValue={msmeSettings.contact_email ?? workspace.provider.contact_email ?? workspace.msme.contact_email ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Phone Number</span>
                <input
                  name="contact_phone"
                  defaultValue={msmeSettings.contact_phone ?? workspace.provider.contact_phone ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Alternate Phone (Optional)</span>
                <input
                  name="alternate_phone"
                  defaultValue=""
                  disabled
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
                <span className="block text-xs text-slate-500">Not editable here yet (no mapped schema column in this workspace).</span>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Designation / Role</span>
                <input
                  name="designation"
                  defaultValue="Owner / CEO"
                  disabled
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
                <span className="block text-xs text-slate-500">Not editable here yet (no mapped schema column in this workspace).</span>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Business Address</span>
                <input
                  name="address"
                  defaultValue={msmeSettings.address ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
              </label>
            </div>
          </section>

          <section id="about-business" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">About Your Business</h3>
            <p className="mt-1 text-sm text-slate-600">Tell us more about your business.</p>
            <label className="mt-4 block space-y-1">
              <span className="text-xs font-medium text-slate-600">Business Description</span>
              <textarea
                name="business_description"
                defaultValue={workspace.provider.description ?? ""}
                maxLength={500}
                className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
              />
              <span className="block text-right text-xs text-slate-400">{(workspace.provider.description ?? "").length}/500</span>
            </label>
          </section>

          <section id="banking-information" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Banking Information</h3>
            <p className="mt-1 text-sm text-slate-600">Bank account details are managed in your tax and compliance workspace.</p>
            <div className="mt-3">
              <Link href="/dashboard/payments" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Manage banking and VAT profile <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section id="tax-information" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Tax Information</h3>
            <p className="mt-1 text-sm text-slate-600">Tax and VAT fields are managed in the dedicated Tax / VAT workspace.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">TIN (read-only here)</span>
                <input
                  name="tin"
                  defaultValue={msmeSettings.tin ?? ""}
                  disabled
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-emerald-200 transition focus:ring"
                />
                <span className="block text-xs text-slate-500">Use the Tax / VAT workspace to update TIN and tax settings.</span>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">VAT & Tax Workspace (link-out)</span>
                <Link
                  href="/dashboard/payments"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Open Tax / VAT Settings
                </Link>
              </label>
            </div>
          </section>

          <section id="verification-documents" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Verification Documents</h3>
            <p className="mt-1 text-sm text-slate-600">Your KYC and verification records can be reviewed and updated in compliance.</p>
            <Link href="/dashboard/msme/compliance" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800">
              Open verification workspace <ExternalLink className="h-4 w-4" />
            </Link>
          </section>

          <section id="notification-preferences" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Notification Preferences</h3>
            <p className="mt-1 text-sm text-slate-600">Visual-only section for now. Notification delivery channels are coming soon.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">No local save action is wired for this section yet.</p>
          </section>

          <section id="account-security" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Account & Security</h3>
            <p className="mt-1 text-sm text-slate-600">For password updates, use your account access settings from your sign-in provider.</p>
          </section>

          <section id="integrations" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Integrations</h3>
            <p className="mt-1 text-sm text-slate-600">NIN, BVN, CAC, and TIN integrations are connected through simulation adapters.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">Read-only status summary; configuration is managed in module workspaces.</p>
          </section>

          <section id="activity-log" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Activity Log</h3>
            <p className="mt-1 text-sm text-slate-600">Recent account activity is tracked automatically across onboarding and compliance flows.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">This section is informational and does not submit with Save Changes.</p>
          </section>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Link
              href="/dashboard/msme"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Save Changes
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Profile Completeness</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-600 text-lg font-semibold text-slate-900">
                {completeness.percentage}%
              </div>
              <p className="text-sm text-slate-600">Your profile is almost complete.</p>
            </div>
            <ul className="mt-4 space-y-2">
              {completeness.items.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm">
                  {item.complete ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 text-amber-500" />
                  )}
                  <span className={item.complete ? "text-slate-700" : "text-slate-500"}>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Tips</h3>
            <p className="mt-2 text-sm text-slate-600">Keeping your information updated helps you stay verified and unlock more opportunities.</p>
            <button
              type="button"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Learn More <ExternalLink className="h-4 w-4" />
            </button>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Need Help?</h3>
            <p className="mt-2 text-sm text-slate-600">If you need assistance updating your information, our support team is ready to help.</p>
            <button
              type="button"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Contact Support <CircleHelp className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </form>

      <footer className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Your information is secure and encrypted. We follow strict security measures to protect your data.
      </footer>
    </section>
  );
}
