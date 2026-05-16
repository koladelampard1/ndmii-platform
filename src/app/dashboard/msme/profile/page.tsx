import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  ExternalLink,
  FileBadge,
  ImageIcon,
  Info,
  Landmark,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { PassportPhoto } from "@/components/msme/passport-photo";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getTableColumns, pickExistingColumns } from "@/lib/data/commercial-ops";
import { bankingProfileConfigured, buildInvoiceBankingReadiness, loadMsmeBankingProfile, verificationStatusLabel } from "@/lib/data/msme-banking";

const PROFILE_SECTIONS = [
  { id: "business-information", label: "Business Information" },
  { id: "contact-address", label: "Contact & Address" },
  { id: "about-business", label: "About Your Business" },
  { id: "documents", label: "Documents" },
  { id: "banking-information", label: "Banking Information" },
] as const;

type ProfileDetails = {
  business_type: string | null;
  address: string | null;
  cac_number: string | null;
  tin: string | null;
  contact_phone: string | null;
  created_at: string | null;
  issued_at: string | null;
};

type DigitalIdSummary = {
  ndmii_id: string | null;
  status: string | null;
  issued_at: string | null;
};

type ComplianceSummary = {
  overall_status: string | null;
  nin_status: string | null;
  bvn_status: string | null;
  cac_status: string | null;
  tin_status: string | null;
};

function valueOrFallback(value: string | null | undefined, fallback = "Not yet provided") {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function humanize(value: string | null | undefined) {
  const normalized = valueOrFallback(value, "");
  if (!normalized) return "";
  return normalized
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatMonthYear(value: string | null | undefined) {
  if (!value) return "Not yet available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet available";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function maskIdentifier(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "Not yet provided";
  if (normalized.length <= 4) return normalized;
  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

function ownerInitials(value: string | null | undefined) {
  const words = (value ?? "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "DB";
}

function normalizeProfileStatus(input: {
  msmeStatus: string | null | undefined;
  complianceStatus?: string | null;
  digitalIdStatus?: string | null;
}) {
  const raw = (input.complianceStatus || input.digitalIdStatus || input.msmeStatus || "pending_review").toLowerCase().replace(/\s+/g, "_");
  if (["verified", "approved", "active", "compliant"].includes(raw)) {
    return { key: "verified", label: raw === "approved" ? "Approved" : "Verified", tone: "emerald" as const };
  }
  if (["changes_requested", "needs_changes", "requires_update"].includes(raw)) {
    return { key: "changes_requested", label: "Changes Requested", tone: "amber" as const };
  }
  if (["rejected", "declined", "failed"].includes(raw)) {
    return { key: "rejected", label: "Rejected", tone: "rose" as const };
  }
  if (["suspended", "blocked"].includes(raw)) {
    return { key: "suspended", label: "Suspended", tone: "slate" as const };
  }
  if (["draft", "not_submitted"].includes(raw)) {
    return { key: "draft", label: "Draft", tone: "slate" as const };
  }
  return { key: "pending_review", label: "Pending Review", tone: "amber" as const };
}

function statusClasses(tone: "emerald" | "amber" | "rose" | "slate") {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  } as const;
  return classes[tone];
}

function ActionPrompt({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
}

function DataCard({
  label,
  value,
  prompt,
  href = "/dashboard/msme/settings",
}: {
  label: string;
  value: string | null | undefined;
  prompt?: string;
  href?: string;
}) {
  const present = hasText(value);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold leading-6 ${present ? "text-slate-900" : "text-slate-500"}`}>
        {present ? value : "Not yet provided"}
      </p>
      {!present && prompt ? <ActionPrompt href={href}>{prompt}</ActionPrompt> : null}
    </div>
  );
}

async function loadProfileDetails(msmeId: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const msmeColumns = await getTableColumns(supabase, "msmes");
  const msmeSelect = pickExistingColumns(msmeColumns, [
    "business_type",
    "address",
    "cac_number",
    "tin",
    "contact_phone",
    "created_at",
    "issued_at",
  ]);

  let details: ProfileDetails = {
    business_type: null,
    address: null,
    cac_number: null,
    tin: null,
    contact_phone: null,
    created_at: null,
    issued_at: null,
  };

  if (msmeSelect.length > 0) {
    const { data } = await supabase.from("msmes").select(msmeSelect.join(",")).eq("id", msmeId).maybeSingle();
    const row = (data ?? {}) as Partial<ProfileDetails>;
    details = { ...details, ...row };
  }

  let digitalId: DigitalIdSummary | null = null;
  const digitalIdColumns = await getTableColumns(supabase, "digital_ids");
  const digitalIdSelect = pickExistingColumns(digitalIdColumns, ["ndmii_id", "status", "issued_at", "created_at"]);
  if (digitalIdSelect.includes("ndmii_id")) {
    let digitalIdQuery = supabase
      .from("digital_ids")
      .select(digitalIdSelect.join(","))
      .eq("msme_id", msmeId)
      .limit(1);
    if (digitalIdSelect.includes("issued_at")) {
      digitalIdQuery = digitalIdQuery.order("issued_at", { ascending: false });
    } else if (digitalIdSelect.includes("created_at")) {
      digitalIdQuery = digitalIdQuery.order("created_at", { ascending: false });
    }
    const { data } = await digitalIdQuery.maybeSingle();
    const row = (data ?? null) as (DigitalIdSummary & { created_at?: string | null }) | null;
    digitalId = row
      ? {
          ndmii_id: row.ndmii_id ?? null,
          status: row.status ?? null,
          issued_at: row.issued_at ?? row.created_at ?? null,
        }
      : null;
  }

  let compliance: ComplianceSummary | null = null;
  const complianceColumns = await getTableColumns(supabase, "compliance_profiles");
  const complianceSelect = pickExistingColumns(complianceColumns, [
    "overall_status",
    "nin_status",
    "bvn_status",
    "cac_status",
    "tin_status",
    "last_reviewed_at",
    "updated_at",
  ]);
  if (complianceSelect.includes("overall_status")) {
    let complianceQuery = supabase
      .from("compliance_profiles")
      .select(complianceSelect.join(","))
      .eq("msme_id", msmeId)
      .limit(1);
    if (complianceSelect.includes("last_reviewed_at")) {
      complianceQuery = complianceQuery.order("last_reviewed_at", { ascending: false });
    } else if (complianceSelect.includes("updated_at")) {
      complianceQuery = complianceQuery.order("updated_at", { ascending: false });
    }
    const { data } = await complianceQuery.maybeSingle();
    compliance = (data ?? null) as ComplianceSummary | null;
  }

  const bankingProfile = await loadMsmeBankingProfile(supabase, msmeId);

  return { details, digitalId, compliance, bankingProfile };
}

export default async function MsmeProfileOverviewPage() {
  const workspace = await getProviderWorkspaceContext();
  const { details, digitalId, compliance, bankingProfile } = await loadProfileDetails(workspace.msme.id);

  const location = [workspace.msme.lga, workspace.msme.state, "Nigeria"].filter(Boolean).join(", ");
  const profileStatus = normalizeProfileStatus({
    msmeStatus: workspace.msme.verification_status,
    complianceStatus: compliance?.overall_status,
    digitalIdStatus: digitalId?.status,
  });
  const isVerified = profileStatus.key === "verified";
  const logoUrl = workspace.provider.logo_url;
  const passportPhotoUrl = workspace.msme.passport_photo_url;
  const businessName = valueOrFallback(workspace.provider.display_name || workspace.msme.business_name, "Business profile");
  const businessType = humanize(details.business_type) || humanize(workspace.msme.sector);
  const description = workspace.provider.description || workspace.provider.long_description || workspace.provider.short_description;
  const memberSince = formatMonthYear(digitalId?.issued_at || details.issued_at || details.created_at);
  const contactEmail = workspace.provider.contact_email || workspace.msme.contact_email;
  const contactPhone = workspace.provider.contact_phone || details.contact_phone;
  const hasVerificationSubmission = !["draft", "not_submitted", "pending"].includes((workspace.msme.verification_status ?? "").toLowerCase());
  const hasDocumentSignal = Boolean(compliance || digitalId || hasVerificationSubmission);
  const bankingReady = bankingProfileConfigured(bankingProfile);
  const invoiceBankingReadiness = buildInvoiceBankingReadiness(bankingProfile);

  const completionChecks = [
    {
      label: "Business information completed",
      complete: hasText(workspace.msme.business_name) && hasText(workspace.msme.sector),
      href: "/dashboard/msme/settings#business-information",
    },
    {
      label: "Contact information completed",
      complete: hasText(contactEmail) && hasText(contactPhone),
      href: "/dashboard/msme/settings#contact-address",
    },
    {
      label: "Address information completed",
      complete: hasText(details.address) && hasText(workspace.msme.state),
      href: "/dashboard/msme/settings#contact-address",
    },
    {
      label: "Business type/category completed",
      complete: hasText(details.business_type) || hasText(workspace.msme.sector),
      href: "/dashboard/msme/settings#business-information",
    },
    {
      label: "Logo uploaded",
      complete: hasText(logoUrl),
      href: "/dashboard/msme/settings#business-information",
    },
    {
      label: "Owner photo uploaded",
      complete: hasText(passportPhotoUrl),
      href: "/dashboard/msme/settings#contact-address",
    },
    {
      label: "Description/public profile completed",
      complete: hasText(description),
      href: "/dashboard/msme/settings#about-business",
    },
    {
      label: "Banking profile configured",
      complete: bankingReady,
      href: "/dashboard/msme/settings#banking-information",
    },
    {
      label: "Required documents available or linked",
      complete: hasDocumentSignal,
      href: "/dashboard/msme/compliance",
    },
    {
      label: "Verification submitted or approved",
      complete: hasVerificationSubmission || isVerified,
      href: "/dashboard/msme/compliance",
    },
  ];

  const completedCount = completionChecks.filter((item) => item.complete).length;
  const completionPercent = Math.round((completedCount / completionChecks.length) * 100);

  const documentRows = [
    { label: "Business Registration", status: compliance?.cac_status, fallback: details.cac_number ? "Provided" : "Not connected" },
    { label: "Owner Identity", status: compliance?.nin_status, fallback: "Managed in verification" },
    { label: "Tax Identification", status: compliance?.tin_status, fallback: details.tin ? "Provided" : "Not connected" },
  ];

  return (
    <section className="space-y-6 bg-slate-50/60">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">My Business Profile</h1>
          <p className="text-sm text-slate-600 md:text-base">Manage your business information and keep your profile ready for verification, buyers, and partners.</p>
        </div>
        <Link
          href="/dashboard/msme/settings"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-700/20 transition hover:bg-emerald-800"
        >
          <NotebookPen className="h-4 w-4" />
          Edit Profile
        </Link>
      </header>

      <article className="grid gap-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-start">
          <div className="space-y-3">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm">
              {logoUrl ? <img src={logoUrl} alt="Business logo" className="h-full w-full object-cover" /> : <Building2 className="h-11 w-11" />}
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(profileStatus.tone)}`}>
              <BadgeCheck className="h-3.5 w-3.5" />
              {profileStatus.label}
            </span>
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{businessName}</h2>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {valueOrFallback(location)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                  <BriefcaseBusiness className="h-4 w-4 text-slate-500" />
                  {valueOrFallback(businessType)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">MSME ID</p>
                <p className="mt-1 break-all font-semibold text-slate-900">{valueOrFallback(workspace.msme.msme_id)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Member Since</p>
                <p className="mt-1 font-semibold text-slate-900">{memberSince}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verification Status</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(profileStatus.tone)}`}>
                    {profileStatus.label}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Profile Completion</h3>
            <p className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">{completionPercent}% Complete</p>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${completionPercent}%` }} />
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {completionChecks.map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-3 text-slate-700">
                <Link href={item.href} className="flex items-start gap-2 hover:text-emerald-800">
                  {item.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <CircleDot className="mt-0.5 h-4 w-4 text-amber-500" />}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/msme/settings"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Complete Your Profile
          </Link>
        </aside>
      </article>

      <nav className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm" aria-label="Business profile sections">
        <div className="flex min-w-max gap-1">
          {PROFILE_SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <article id="business-information" className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-900">Business Information</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Core profile data</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DataCard label="Business Name" value={workspace.provider.display_name || workspace.msme.business_name} prompt="Add business name" />
              <DataCard label="Business Type" value={businessType} prompt="Add business type" href="/dashboard/msme/settings#business-information" />
              <DataCard label="Industry Category" value={humanize(workspace.msme.sector)} prompt="Add category" href="/dashboard/msme/settings#business-information" />
              <DataCard label="CAC Registration Number" value={details.cac_number} prompt="Add CAC number" href="/dashboard/msme/settings#business-information" />
              <DataCard label="Tax Identification Number" value={details.tin ? maskIdentifier(details.tin) : null} prompt="Add TIN in Tax / VAT" href="/dashboard/msme/payments" />
              <DataCard label="Digital Credential ID" value={digitalId?.ndmii_id} prompt="Open identity credential" href="/dashboard/msme/id-card" />
            </div>
          </article>

          <article id="contact-address" className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-900">Contact & Address</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Private workspace data</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DataCard label="Owner / Contact Person" value={workspace.msme.owner_name} prompt="Add contact person" href="/dashboard/msme/settings#contact-address" />
              <DataCard label="Email Address" value={contactEmail} prompt="Add email address" href="/dashboard/msme/settings#contact-address" />
              <DataCard label="Phone Number" value={contactPhone} prompt="Add phone number" href="/dashboard/msme/settings#contact-address" />
              <DataCard label="State / LGA" value={[workspace.msme.state, workspace.msme.lga].filter(Boolean).join(" / ")} prompt="Add location" href="/dashboard/msme/settings#contact-address" />
              <DataCard label="Business Address" value={details.address} prompt="Add address" href="/dashboard/msme/settings#contact-address" />
              <DataCard label="Website" value={workspace.provider.website} prompt="Add website" href="/dashboard/msme/settings#profile-information" />
            </div>
          </article>

          <article id="about-business" className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-900">About Your Business</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Public profile content</span>
            </div>
            <div className="grid gap-3">
              <DataCard label="Tagline" value={workspace.provider.tagline} prompt="Add profile tagline" href="/dashboard/msme/settings#about-business" />
              <DataCard label="Business Description" value={description} prompt="Complete business description" href="/dashboard/msme/settings#about-business" />
            </div>
          </article>

          <article id="documents" className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-900">Documents</h3>
              <Link href="/dashboard/msme/compliance" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                Open Verification Status
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-sm leading-6 text-slate-600">Documents are managed under Verification Status. This profile shows the latest safe status summary where available.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {documentRows.map((item) => {
                const label = humanize(item.status) || item.fallback;
                const verified = ["verified", "approved", "match"].includes((item.status ?? "").toLowerCase()) || item.fallback === "Provided";
                return (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {verified ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <CircleAlert className="h-3.5 w-3.5 text-amber-500" />}
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
            {!hasDocumentSignal ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">No verification document status is connected yet.</p>
                <ActionPrompt href="/dashboard/msme/compliance">Submit verification documents</ActionPrompt>
              </div>
            ) : null}
          </article>

          <article id="banking-information" className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-900">Banking Information</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                bankingProfile?.verification_status === "verified"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {verificationStatusLabel(bankingProfile?.verification_status)}
              </span>
            </div>
            {bankingProfile ? (
              <div className="grid gap-3 md:grid-cols-2">
                <DataCard label="Bank Name" value={invoiceBankingReadiness.bank_name} />
                <DataCard label="Account Name" value={invoiceBankingReadiness.account_name} />
                <DataCard label="Account Number" value={invoiceBankingReadiness.account_number_masked} />
                <DataCard label="Currency" value={invoiceBankingReadiness.currency} />
                <DataCard label="Preferred Payment Method" value={humanize(bankingProfile.preferred_payment_method)} />
                <DataCard label="Verification Status" value={verificationStatusLabel(bankingProfile.verification_status)} />
                <DataCard label="Payout Readiness" value={invoiceBankingReadiness.payout_ready ? "Ready" : "Pending internal review"} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Landmark className="h-4 w-4 text-slate-500" />
                  No banking profile configured
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add secure banking details to prepare invoices, quotations, procurement records, VAT profile data, and future payout reviews.
                </p>
                <ActionPrompt href="/dashboard/msme/settings#banking-information">Add banking profile</ActionPrompt>
              </div>
            )}
            <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs leading-5 text-blue-900">
              Safe summary only. Full account numbers and BVN are not exposed on profile or public verification pages.
            </p>
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Owner / Representative Photo</h4>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-2xl border-2 border-emerald-700 bg-white p-1 shadow-sm">
                  <PassportPhoto
                    src={passportPhotoUrl}
                    alt="Owner or representative passport photo"
                    className="h-24 w-20 rounded-xl object-cover"
                    placeholderClassName="flex h-24 w-20 items-center justify-center rounded-xl bg-emerald-50 text-xl font-bold text-emerald-800"
                    placeholderText={ownerInitials(workspace.msme.owner_name)}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-800">Credential portrait</p>
                  <p>{passportPhotoUrl ? "Uploaded" : "Initials fallback active"}</p>
                  {!passportPhotoUrl ? <ActionPrompt href="/dashboard/msme/settings#contact-address">Upload passport photo</ActionPrompt> : null}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Business Logo</h4>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-emerald-900 text-white">
                  {logoUrl ? <img src={logoUrl} alt="Business logo" className="h-full w-full object-cover" /> : <FileBadge className="h-9 w-9" />}
                </div>
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-800">Logo status</p>
                  <p>{logoUrl ? "Uploaded" : "No logo uploaded"}</p>
                  {!logoUrl ? <ActionPrompt href="/dashboard/msme/settings#business-information">Upload business logo</ActionPrompt> : null}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Business Cover Photo</h4>
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="h-4 w-4" />
                Cover photo is not connected yet
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Quick Contact</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                {valueOrFallback(contactEmail)}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                {valueOrFallback(contactPhone)}
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Info className="h-4 w-4" />
              Why complete your profile?
            </h4>
            <p className="mt-2 text-sm leading-6 text-emerald-900/90">
              Complete profiles improve verification readiness, buyer trust, and institutional review quality.
            </p>
          </article>
        </aside>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Trusted Business",
            description: "Build buyer confidence with a complete and verified profile.",
            icon: ShieldCheck,
          },
          {
            title: "Increased Visibility",
            description: "Complete fields improve your discoverability in searches.",
            icon: TrendingUp,
          },
          {
            title: "More Customers",
            description: "Professional business details attract higher intent leads.",
            icon: Users,
          },
          {
            title: "Higher Credibility",
            description: "Showcase readiness and compliance to stand out quickly.",
            icon: Star,
          },
        ].map((benefit) => (
          <article key={benefit.title} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-2 inline-flex rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <benefit.icon className="h-4 w-4" />
            </div>
            <h5 className="text-sm font-semibold text-slate-900">{benefit.title}</h5>
            <p className="mt-1 text-xs leading-5 text-slate-600">{benefit.description}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
