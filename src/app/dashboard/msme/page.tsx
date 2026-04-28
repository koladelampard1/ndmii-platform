import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Eye,
  FileBadge2,
  ImageIcon,
  MapPin,
  MessageSquare,
  NotebookPen,
  Receipt,
  Search,
  Star,
  User,
  Users,
  Wrench,
  XCircle,
  BarChart3,
} from "lucide-react";
import { fetchProviderQuoteInboxCount } from "@/lib/data/provider-quote-queries";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActivityItem = {
  id: string;
  label: string;
  timestamp: string | null;
  href: string;
  icon: typeof ClipboardList;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function activityDateLabel(value: string | null) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(parsed);
}

function profileCompletion({
  displayName,
  description,
  logoUrl,
  services,
  portfolio,
}: {
  displayName: string | null;
  description: string | null;
  logoUrl: string | null;
  services: number;
  portfolio: number;
}) {
  const checks = [Boolean(displayName?.trim()), Boolean(description?.trim()), Boolean(logoUrl?.trim()), services > 0, portfolio > 0];
  const completed = checks.filter(Boolean).length;
  return Math.max(20, Math.round((completed / checks.length) * 100));
}

export default async function MsmePage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const quoteCountPromise = fetchProviderQuoteInboxCount(supabase, workspace.provider.id);

  const [
    { count: serviceCount },
    { count: galleryCount },
    { count: openComplaintCount },
    { count: reviewCount },
    { count: invoiceCount },
    { data: msmeMeta },
    { data: associationMembership },
    { data: quoteActivity },
    { data: reviewActivity },
    { data: invoiceActivity },
    quoteCount,
  ] = await Promise.all([
    supabase.from("provider_services").select("id", { count: "exact", head: true }).eq("provider_id", workspace.provider.id),
    supabase.from("provider_gallery").select("id", { count: "exact", head: true }).eq("provider_id", workspace.provider.id),
    supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .or(`provider_profile_id.eq.${workspace.provider.id},provider_id.eq.${workspace.provider.id}`)
      .neq("status", "closed"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("provider_id", workspace.provider.id),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("provider_profile_id", workspace.provider.id),
    supabase.from("msmes").select("created_at").eq("id", workspace.msme.id).maybeSingle(),
    supabase.from("association_members").select("associations(name)").eq("msme_id", workspace.msme.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("provider_quotes").select("id,created_at").eq("provider_profile_id", workspace.provider.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("reviews").select("id,created_at").eq("provider_id", workspace.provider.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("invoices").select("id,created_at,status").eq("provider_profile_id", workspace.provider.id).order("created_at", { ascending: false }).limit(1),
    quoteCountPromise,
  ]);

  const safeServiceCount = serviceCount ?? 0;
  const safeGalleryCount = galleryCount ?? 0;
  const safeQuoteCount = quoteCount ?? 0;
  const safeReviewCount = reviewCount ?? 0;
  const safeInvoiceCount = invoiceCount ?? 0;
  const safeComplaintCount = openComplaintCount ?? 0;

  const completion = profileCompletion({
    displayName: workspace.provider.display_name,
    description: workspace.provider.short_description ?? workspace.provider.description,
    logoUrl: workspace.provider.logo_url,
    services: safeServiceCount,
    portfolio: safeGalleryCount,
  });

  const verificationStatus = workspace.msme.verification_status?.replaceAll("_", " ") ?? "Pending review";
  const isVerified = verificationStatus.toLowerCase().includes("approved") || workspace.provider.is_verified === true;

  const quickActions = [
    { href: "/dashboard/msme/profile", label: "Edit Business Profile", icon: NotebookPen },
    { href: "/dashboard/msme/services", label: "Add Services", icon: Wrench },
    { href: "/dashboard/msme/portfolio", label: "Upload Portfolio", icon: ImageIcon },
    { href: "/dashboard/msme/reviews", label: "View Reviews", icon: Star },
    { href: "/dashboard/msme/complaints", label: "View Complaints", icon: MessageSquare },
    { href: "/dashboard/msme/id-card", label: "Download Business Identity Credential", icon: FileBadge2 },
    { href: "/dashboard/msme/finance-readiness", label: "Access to Finance Readiness", icon: BarChart3 },
  ];

  const activity: ActivityItem[] = [
    quoteActivity?.[0]
      ? {
          id: `quote-${quoteActivity[0].id}`,
          label: "New quote request received",
          timestamp: quoteActivity[0].created_at,
          href: "/dashboard/msme/quotes",
          icon: ClipboardList,
        }
      : null,
    reviewActivity?.[0]
      ? {
          id: `review-${reviewActivity[0].id}`,
          label: "A new customer review was added",
          timestamp: reviewActivity[0].created_at,
          href: "/dashboard/msme/reviews",
          icon: Star,
        }
      : null,
    invoiceActivity?.[0]
      ? {
          id: `invoice-${invoiceActivity[0].id}`,
          label: invoiceActivity[0].status === "paid" ? "An invoice payment was completed" : "An invoice was created",
          timestamp: invoiceActivity[0].created_at,
          href: "/dashboard/msme/invoices",
          icon: Receipt,
        }
      : null,
  ].filter((item): item is ActivityItem => Boolean(item));

  const associationName = (associationMembership?.associations as { name?: string } | null)?.name ?? null;
  const hasPublicProfile = Boolean(workspace.provider.public_slug);
  const profileSearchable = hasPublicProfile && Boolean(workspace.provider.is_active ?? true);
  const improveVisibilityRoute = safeServiceCount === 0 ? "/dashboard/msme/services" : "/dashboard/msme/profile";

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">My Business Dashboard</h1>
                <p className="mt-1 text-sm text-slate-600">Track your marketplace presence, business records, and verification progress in one view.</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                </button>
                <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50" aria-label="Help center">
                  <CircleHelp className="h-5 w-5" />
                </button>
                <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="max-w-[180px]">
                    <p className="truncate text-sm font-semibold text-slate-900">{workspace.msme.owner_name || "MSME User"}</p>
                    <p className="truncate text-xs text-slate-500">{workspace.provider.display_name}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/msme/public-profile"
                  className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  View Public Profile
                </Link>
              </div>
            </div>
          </header>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
            <div className="space-y-5">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr),minmax(260px,1fr)]">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-emerald-700">
                        {workspace.provider.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={workspace.provider.logo_url} alt="Business logo" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-7 w-7" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">{workspace.msme.business_name || workspace.provider.display_name}</h2>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isVerified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {isVerified ? "Verified" : "Pending Review"}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                          <MapPin className="h-4 w-4" /> {workspace.msme.state}, Nigeria
                        </p>
                        <p className="text-sm text-slate-600">{workspace.msme.sector || "Business category not set"}</p>
                        {associationName && <p className="text-xs text-emerald-700">Member of: {associationName}</p>}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">MSME ID</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{workspace.msme.msme_id}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Member Since</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(msmeMeta?.created_at ?? null)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Verification</p>
                        <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{verificationStatus}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Open Complaints</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{safeComplaintCount}</p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <p className="font-medium text-slate-700">Profile Completion</p>
                        <p className="font-semibold text-slate-700">{completion}% Complete</p>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div className="h-2.5 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="text-center text-sm font-semibold text-emerald-800">Business Identity Credential Preview</p>
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-semibold tracking-wide text-emerald-700">DBIN BUSINESS IDENTITY</p>
                      <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{workspace.provider.display_name}</p>
                      <p className="truncate text-xs text-slate-600">{workspace.msme.owner_name}</p>
                        <p className="mt-2 break-all text-xs text-slate-500">{workspace.msme.msme_id}</p>
                    </div>
                    <Link
                      href="/dashboard/msme/id-card"
                      className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Download Business Identity Credential
                    </Link>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        className="group flex min-h-[108px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <Icon className="h-5 w-5 text-emerald-700" />
                        <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                      </Link>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Business Performance</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Profile Views", value: "0", icon: Eye, tone: "text-sky-700 bg-sky-100" },
                    { label: "Search Appearances", value: "0", icon: Search, tone: "text-violet-700 bg-violet-100" },
                    { label: "Quote Requests", value: String(safeQuoteCount), icon: ClipboardList, tone: "text-emerald-700 bg-emerald-100" },
                    { label: "New Reviews", value: String(safeReviewCount), icon: Star, tone: "text-amber-700 bg-amber-100" },
                  ].map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className={`inline-flex rounded-full p-2 ${metric.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="mt-3 text-2xl font-semibold text-slate-900">{metric.value}</p>
                        <p className="text-sm text-slate-600">{metric.label}</p>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                  <Link href="/dashboard/msme/quotes" className="text-sm font-medium text-emerald-700 hover:underline">
                    View all
                  </Link>
                </div>

                <div className="divide-y divide-slate-100">
                  {activity.length > 0 ? (
                    activity.slice(0, 5).map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 py-3 transition hover:bg-slate-50/80">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex rounded-full bg-emerald-100 p-2 text-emerald-700">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                              <p className="text-xs text-slate-500">{activityDateLabel(item.timestamp)}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </Link>
                      );
                    })
                  ) : (
                    <p className="py-4 text-sm text-slate-500">No recent activity yet. New quotes, reviews, and invoices will appear here.</p>
                  )}
                </div>
              </article>
            </div>

            <aside className="space-y-5">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Marketplace Visibility</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      {hasPublicProfile ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                      Public profile is live
                    </span>
                    {!hasPublicProfile ? (
                      <Link href="/dashboard/msme/public-profile" className="text-emerald-700 hover:underline">
                        Enable
                      </Link>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      {profileSearchable ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                      Searchable in marketplace
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      {safeServiceCount > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                      {safeServiceCount > 0 ? `${safeServiceCount} services listed` : "No services listed"}
                    </span>
                    {safeServiceCount === 0 ? (
                      <Link href="/dashboard/msme/services" className="text-emerald-700 hover:underline">
                        Add services
                      </Link>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      {safeGalleryCount > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                      {safeGalleryCount > 0 ? `${safeGalleryCount} portfolio items` : "Portfolio is missing"}
                    </span>
                    {safeGalleryCount === 0 ? (
                      <Link href="/dashboard/msme/portfolio" className="text-emerald-700 hover:underline">
                        Add portfolio
                      </Link>
                    ) : null}
                  </div>
                </div>

                <Link
                  href={improveVisibilityRoute}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Improve Visibility
                </Link>
              </article>

              <article className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-6 text-white shadow-lg">
                <h3 className="text-2xl font-semibold leading-tight">Grow Your Business with NDMII</h3>
                <p className="mt-2 text-sm text-emerald-100">Complete your profile and keep your business details updated to improve trust and discoverability across Nigeria.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-emerald-100">
                  <p>
                    Services listed: <span className="font-semibold text-white">{safeServiceCount}</span>
                  </p>
                  <p>
                    Portfolio items: <span className="font-semibold text-white">{safeGalleryCount}</span>
                  </p>
                  <p>
                    Quote requests: <span className="font-semibold text-white">{safeQuoteCount}</span>
                  </p>
                  <p>
                    Invoices: <span className="font-semibold text-white">{safeInvoiceCount}</span>
                  </p>
                </div>
                <Link
                  href="/dashboard/msme/onboarding"
                  className="mt-5 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
                >
                  Complete Profile Now
                </Link>
              </article>
            </aside>
      </section>
    </section>
  );
}
