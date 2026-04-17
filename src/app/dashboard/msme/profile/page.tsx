import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDot,
  FileBadge,
  ImageIcon,
  Info,
  MapPin,
  NotebookPen,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";

const PROFILE_TABS = [
  "Business Information",
  "Contact & Address",
  "About Your Business",
  "Documents",
  "Banking Information",
] as const;

function valueOrFallback(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "Not provided";
}

function formatVerificationStatus(status: string | null | undefined) {
  const normalized = valueOrFallback(status);
  if (normalized === "Not provided") return normalized;

  return normalized
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default async function MsmeProfileOverviewPage() {
  const workspace = await getProviderWorkspaceContext();

  const location = [workspace.msme.lga, workspace.msme.state, "Nigeria"].filter(Boolean).join(", ");
  const verificationStatus = formatVerificationStatus(workspace.msme.verification_status);
  const isVerified = workspace.provider.is_verified || workspace.msme.verification_status?.toLowerCase() === "verified";

  const completionChecks = [
    {
      label: "Business information",
      complete: Boolean(workspace.msme.business_name && workspace.provider.display_name),
    },
    {
      label: "Contact information",
      complete: Boolean(workspace.msme.contact_email || workspace.provider.contact_email || workspace.provider.contact_phone),
    },
    {
      label: "Address information",
      complete: Boolean(workspace.msme.state),
    },
    {
      label: "Services added",
      complete: false,
    },
  ];

  const completedCount = completionChecks.filter((item) => item.complete).length;
  const completionPercent = Math.round((completedCount / completionChecks.length) * 100);

  const businessInfoRows = [
    { label: "Business Name", value: workspace.provider.display_name || workspace.msme.business_name },
    { label: "Business Type", value: workspace.provider.tagline },
    { label: "Industry Category", value: workspace.msme.sector },
    { label: "Sub Category", value: null },
    { label: "Year Established", value: null },
    { label: "Registration Number", value: workspace.provider.id },
    { label: "CAC Registration", value: isVerified ? "Verified" : null },
    { label: "Tax Identification Number (TIN)", value: null },
    { label: "Number of Employees", value: null },
    { label: "Business Description", value: workspace.provider.long_description || workspace.provider.short_description },
  ];

  const businessName = valueOrFallback(workspace.provider.display_name || workspace.msme.business_name);

  return (
    <section className="space-y-6 bg-slate-50/60">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">My Business Profile</h1>
          <p className="text-sm text-slate-600 md:text-base">Manage your business information and keep your profile up to date.</p>
        </div>
        <Link
          href="/dashboard/msme/settings"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-700/20 transition hover:bg-emerald-800"
        >
          <NotebookPen className="h-4 w-4" />
          Edit Profile
        </Link>
      </header>

      <article className="grid gap-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-start">
          <div className="space-y-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm">
              {workspace.provider.logo_url ? (
                <img src={workspace.provider.logo_url} alt="Business logo" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Building2 className="h-11 w-11" />
              )}
            </div>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified business
              </span>
            ) : null}
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{businessName}</h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {valueOrFallback(location)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                  <BriefcaseBusiness className="h-4 w-4 text-slate-500" />
                  {valueOrFallback(workspace.msme.sector)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">MSME ID</p>
                <p className="mt-1 font-semibold text-slate-900">{valueOrFallback(workspace.msme.msme_id)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Member Since</p>
                <p className="mt-1 font-semibold text-slate-900">Not provided</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verification Status</p>
                <p className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isVerified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {verificationStatus}
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
              <li key={item.label} className="flex items-center justify-between gap-3 text-slate-700">
                <span className="flex items-center gap-2">
                  {item.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleDot className="h-4 w-4 text-amber-500" />}
                  {item.label}
                </span>
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {PROFILE_TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                index === 0
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              aria-current={index === 0 ? "page" : undefined}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-slate-900">Business Information</h3>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Core profile data</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {businessInfoRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.label}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{valueOrFallback(row.value)}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Business Logo</h4>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-emerald-900 text-white">
                  {workspace.provider.logo_url ? <img src={workspace.provider.logo_url} alt="Business logo" className="h-full w-full object-cover" /> : <FileBadge className="h-9 w-9" />}
                </div>
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-800">Logo status</p>
                  <p>{workspace.provider.logo_url ? "Uploaded" : "No logo uploaded"}</p>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Business Cover Photo</h4>
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="h-4 w-4" />
                No cover photo uploaded
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Info className="h-4 w-4" />
              Why complete your profile?
            </h4>
            <p className="mt-2 text-sm leading-6 text-emerald-900/90">
              Complete profiles get more trust signals, stronger discovery placement, and higher conversion when buyers compare businesses.
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
