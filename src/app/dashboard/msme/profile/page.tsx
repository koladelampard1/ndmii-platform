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

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Business Profile</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your business information and keep your profile up to date.</p>
        </div>
        <Link
          href="/dashboard/msme/settings"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          <NotebookPen className="h-4 w-4" />
          Edit Profile
        </Link>
      </header>

      <article className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <div className="flex flex-col items-start gap-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-900 text-white">
              <Building2 className="h-12 w-12" />
            </div>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{valueOrFallback(workspace.provider.display_name || workspace.msme.business_name)}</h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {valueOrFallback(location)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                  {valueOrFallback(workspace.msme.sector)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-500">MSME ID</p>
                <p className="font-semibold text-slate-900">{valueOrFallback(workspace.msme.msme_id)}</p>
              </div>
              <div>
                <p className="text-slate-500">Member Since</p>
                <p className="font-semibold text-slate-900">Not provided</p>
              </div>
              <div>
                <p className="text-slate-500">Verification Status</p>
                <p>
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

        <aside className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Profile Completion</h3>
            <p className="text-sm font-semibold text-slate-700">{completionPercent}% Complete</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
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
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Complete Your Profile
          </Link>
        </aside>
      </article>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {PROFILE_TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              index === 0
                ? "border-b-2 border-emerald-600 text-emerald-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
            aria-current={index === 0 ? "page" : undefined}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Business Information</h3>
          <dl className="mt-5 divide-y divide-slate-100">
            {businessInfoRows.map((row) => (
              <div key={row.label} className="grid gap-2 py-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                <dt className="text-sm font-medium text-slate-500">{row.label}</dt>
                <dd className="text-sm font-semibold text-slate-900">{valueOrFallback(row.value)}</dd>
              </div>
            ))}
          </dl>
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900">Business Logo</h4>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-emerald-900 text-white">
                {workspace.provider.logo_url ? <img src={workspace.provider.logo_url} alt="Business logo" className="h-full w-full rounded-xl object-cover" /> : <FileBadge className="h-10 w-10" />}
              </div>
              <div className="text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Logo status</p>
                <p>{workspace.provider.logo_url ? "Uploaded" : "Not provided"}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900">Business Cover Photo</h4>
            <div className="mt-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon className="h-4 w-4" />
                Not provided
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Info className="h-4 w-4" />
              Why complete your profile?
            </h4>
            <p className="mt-2 text-sm text-emerald-800">
              A complete profile helps build trust with customers and increases your visibility in the marketplace.
            </p>
          </article>
        </aside>
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Trusted Business",
            description: "Your business appears more trustworthy when your profile is complete.",
            icon: ShieldCheck,
          },
          {
            title: "Increased Visibility",
            description: "Complete business details improve discoverability in searches.",
            icon: TrendingUp,
          },
          {
            title: "More Customers",
            description: "Professional profiles convert visitors into serious buyers faster.",
            icon: Users,
          },
          {
            title: "Higher Credibility",
            description: "Strong profile quality signals reliability and compliance.",
            icon: Star,
          },
        ].map((benefit) => (
          <article key={benefit.title} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 inline-flex rounded-full bg-emerald-100 p-2 text-emerald-700">
              <benefit.icon className="h-4 w-4" />
            </div>
            <h5 className="text-sm font-semibold text-slate-900">{benefit.title}</h5>
            <p className="mt-1 text-xs text-slate-600">{benefit.description}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
