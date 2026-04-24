import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, Info } from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LogoUploadCard } from "@/app/dashboard/msme/settings/logo-upload-card";
import { ProfileCompletenessCard, type ProfileCompletenessSignals } from "@/app/dashboard/msme/settings/profile-completeness-card";

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

const SAFE_SCHEMA_COLUMNS = {
  provider_profiles: ["display_name", "description", "tagline", "contact_email", "contact_phone", "website", "updated_at"] as const,
  msmes: ["business_name", "owner_name", "sector", "business_type", "contact_email", "contact_phone", "cac_number", "address"] as const,
  activity_logs: ["created_at", "action", "actor_user_id", "actor", "entity_type", "msme_id"] as const,
} as const;

function pickAllowedPayload<T extends Record<string, unknown>, K extends readonly (keyof T)[]>(payload: T, allowedKeys: K) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => (allowedKeys as readonly string[]).includes(key)));
}

function SectionStatusBadge({
  tone,
  children,
}: {
  tone: "editable" | "read-only" | "deep-link" | "coming-soon";
  children: React.ReactNode;
}) {
  const toneClasses = {
    editable: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "read-only": "border-slate-200 bg-slate-100 text-slate-700",
    "deep-link": "border-blue-200 bg-blue-50 text-blue-700",
    "coming-soon": "border-amber-200 bg-amber-50 text-amber-700",
  } as const;

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{children}</span>;
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function deriveProfileCompletenessSignals(params: {
  msme: {
    business_name: string | null;
    sector: string | null;
    business_type: string | null;
    cac_number: string | null;
    owner_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    passport_photo_url: string | null;
  };
  provider: { id: string | null; description: string | null; logo_url: string | null };
}): ProfileCompletenessSignals {
  const signals = {
    businessNamePresent: hasText(params.msme.business_name),
    categoryPresent: hasText(params.msme.sector),
    subCategoryPresent: hasText(params.msme.business_type),
    cacPresent: hasText(params.msme.cac_number),
    ownerNamePresent: hasText(params.msme.owner_name),
    contactInfoPresent: hasText(params.msme.contact_email) && hasText(params.msme.contact_phone),
    addressPresent: hasText(params.msme.address),
    descriptionPresent: hasText(params.provider.description),
    logoUploaded: hasText(params.provider.logo_url) || hasText(params.msme.passport_photo_url),
    providerProfileExists: hasText(params.provider.id),
  } satisfies ProfileCompletenessSignals;

  console.info("[profile-completion] recomputed");
  return signals;
}

type ActivityLogRow = {
  timestamp: string;
  action: string;
  actor: string;
  entityType: string;
};

async function loadSettingsActivityLog(params: {
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>;
  workspace: Awaited<ReturnType<typeof getProviderWorkspaceContext>>;
}): Promise<ActivityLogRow[]> {
  console.info("[msme-settings][safe-schema-mode]", { activityLogs: SAFE_SCHEMA_COLUMNS.activity_logs });

  const { data, error } = await params.supabase
    .from("activity_logs")
    .select(SAFE_SCHEMA_COLUMNS.activity_logs.join(","))
    .eq("msme_id", params.workspace.msme.msme_id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("[activity-log][read-skipped]", { message: error.message, code: error.code ?? null });
    return [];
  }

  console.info("[activity-log][read-success]", { rowCount: data?.length ?? 0 });

  const rows = ((data ?? []) as unknown[]).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  const actorUserIds = rows
    .map((row) => String(row.actor_user_id ?? "").trim())
    .filter((value) => value.length > 0);

  const actorByUserId = new Map<string, string>();
  if (actorUserIds.length > 0) {
    const { data: usersData } = await params.supabase.from("users").select("id,full_name,email").in("id", actorUserIds);
    const users = ((usersData ?? []) as unknown[]).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    for (const user of users) {
      const userId = String(user.id ?? "").trim();
      if (!userId) continue;
      const fullName = String(user.full_name ?? "").trim();
      const email = String(user.email ?? "").trim();
      actorByUserId.set(userId, fullName || email || userId);
    }
  }

  return rows.map((row) => {
    const actorUserId = String(row.actor_user_id ?? "").trim();
    const actorFromUserTable = actorByUserId.get(actorUserId);
    const actorFromRow = String(row.actor ?? "").trim();
    return {
      timestamp: String(row.created_at ?? ""),
      action: String(row.action ?? "unknown"),
      actor: actorFromUserTable || actorFromRow || actorUserId || "System",
      entityType: String(row.entity_type ?? "unknown"),
    };
  });
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

  console.info("[msme-settings][safe-schema-mode]", {
    providerProfiles: SAFE_SCHEMA_COLUMNS.provider_profiles,
    msmes: SAFE_SCHEMA_COLUMNS.msmes,
    activityLogs: SAFE_SCHEMA_COLUMNS.activity_logs,
  });

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
    tagline: String(formData.get("business_tagline") ?? workspace.provider.tagline ?? "").trim() || null,
    contact_email: String(formData.get("contact_email") ?? existingMsme.contact_email ?? workspace.provider.contact_email ?? "").trim() || null,
    contact_phone: String(formData.get("contact_phone") ?? existingMsme.contact_phone ?? workspace.provider.contact_phone ?? "").trim() || null,
    website: String(formData.get("website") ?? workspace.provider.website ?? "").trim() || null,
    updated_at: nowIso,
  };
  const providerPayload = pickAllowedPayload(providerRawPayload, SAFE_SCHEMA_COLUMNS.provider_profiles);

  console.info("[msme-settings][write-before]", {
    ...saveContext,
    section: "profile-information,contact-address,about-business",
    table: "provider_profiles",
    lookupKeys: { id: workspace.provider.id, msme_id: workspace.provider.msme_id },
    allowedColumns: SAFE_SCHEMA_COLUMNS.provider_profiles,
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
  const safeMsmePayload = pickAllowedPayload(msmePayload, SAFE_SCHEMA_COLUMNS.msmes);

  console.info("[msme-settings][write-before]", {
    ...saveContext,
    section: "business-information,contact-address",
    table: "msmes",
    lookupKeys: { id: workspace.msme.id },
    payload: safeMsmePayload,
  });

  const { data: msmeUpdateRows, error: msmeUpdateError } = await supabase
    .from("msmes")
    .update(safeMsmePayload)
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
      payload: safeMsmePayload,
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
    "id,business_name,owner_name,sector,business_type,contact_email,contact_phone,address,cac_number,tin,passport_photo_url";
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

  const completenessSignals = deriveProfileCompletenessSignals({
    msme: msmeSettings,
    provider: { id: workspace.provider.id, description: workspace.provider.description, logo_url: workspace.provider.logo_url },
  });
  const activityRows = await loadSettingsActivityLog({ supabase, workspace });
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Business Logo / Profile Image</h3>
              <SectionStatusBadge tone="editable">Editable</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">This will be displayed on your profile and ID card.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-[200px,minmax(0,1fr)]">
              <LogoUploadCard initialLogoUrl={workspace.provider.logo_url ?? msmeSettings.passport_photo_url} />

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
                  <span className="block text-xs text-slate-500">Field will be enabled when regulatory schema activated.</span>
                </label>
              </div>
            </div>
          </section>

          <section id="contact-address" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Business Owner / Contact Person</h3>
              <SectionStatusBadge tone="editable">Editable</SectionStatusBadge>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">About Your Business</h3>
              <SectionStatusBadge tone="editable">Editable</SectionStatusBadge>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Banking Information</h3>
              <SectionStatusBadge tone="deep-link">Deep-link</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Managed elsewhere: Bank account details are maintained in the payments workspace.</p>
            <div className="mt-3">
              <Link href="/dashboard/payments" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Manage banking and VAT profile <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section id="tax-information" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Tax Information</h3>
              <div className="flex items-center gap-2">
                <SectionStatusBadge tone="read-only">Read-only</SectionStatusBadge>
                <SectionStatusBadge tone="deep-link">Deep-link</SectionStatusBadge>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-600">Managed elsewhere: Tax and VAT fields are updated in the Tax / VAT workspace.</p>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Verification Documents</h3>
              <SectionStatusBadge tone="deep-link">Deep-link</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Managed elsewhere: Your KYC and verification records are handled in compliance.</p>
            <Link href="/dashboard/msme/compliance" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800">
              Open verification workspace <ExternalLink className="h-4 w-4" />
            </Link>
          </section>

          <section id="notification-preferences" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Notification Preferences</h3>
              <SectionStatusBadge tone="coming-soon">Coming soon</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Notification preferences configurable in future release.</p>
          </section>

          <section id="account-security" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Account & Security</h3>
              <SectionStatusBadge tone="read-only">Read-only</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Password managed through authentication provider.</p>
          </section>

          <section id="integrations" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Integrations</h3>
              <SectionStatusBadge tone="read-only">Read-only</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Status summary only (managed elsewhere).</p>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">NIN Adapter: Connected (simulated)</li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">BVN Adapter: Connected (simulated)</li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">CAC Adapter: Connected (simulated)</li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">TIN Adapter: Connected (simulated)</li>
            </ul>
          </section>

          <section id="activity-log" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Activity Log</h3>
              <SectionStatusBadge tone="read-only">Read-only</SectionStatusBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Latest settings-adjacent activity in your MSME workspace.</p>
            {activityRows.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No recent activity yet</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Timestamp</th>
                      <th className="px-3 py-2 font-semibold">Action</th>
                      <th className="px-3 py-2 font-semibold">Actor</th>
                      <th className="px-3 py-2 font-semibold">Entity Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((row) => (
                      <tr key={`${row.timestamp}-${row.action}-${row.actor}`} className="border-t border-slate-200">
                        <td className="px-3 py-2 text-slate-700">{row.timestamp ? new Date(row.timestamp).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{row.action}</td>
                        <td className="px-3 py-2 text-slate-700">{row.actor}</td>
                        <td className="px-3 py-2 text-slate-700">{row.entityType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
          <ProfileCompletenessCard initialSignals={completenessSignals} />

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Tips</h3>
            <p className="mt-2 text-sm text-slate-600">Keeping your information updated helps you stay verified and unlock more opportunities.</p>
            <p className="mt-4 text-xs font-medium text-emerald-700">Managed elsewhere: Guidance links are available in the Help Center module.</p>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Need Help?</h3>
            <p className="mt-2 text-sm text-slate-600">If you need assistance updating your information, our support team is ready to help.</p>
            <p className="mt-4 text-xs font-medium text-blue-700">Coming soon: in-app support request flow.</p>
          </section>
        </aside>
      </form>

      <footer className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Your information is secure and encrypted. We follow strict security measures to protect your data.
      </footer>
    </section>
  );
}
