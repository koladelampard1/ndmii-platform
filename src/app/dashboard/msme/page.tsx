import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Eye,
  FileBadge2,
  FileText,
  ImageIcon,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  NotebookPen,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Star,
  User,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { fetchProviderQuoteInboxCount } from "@/lib/data/provider-quote-queries";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActivityItem = {
  id: string;
  label: string;
  timestamp: string | null;
  href: string;
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
  const checks = [
    Boolean(displayName?.trim()),
    Boolean(description?.trim()),
    Boolean(logoUrl?.trim()),
    services > 0,
    portfolio > 0,
  ];

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
    { href: "/dashboard/msme/id-card", label: "Download Digital ID", icon: FileBadge2 },
  ];

  const sidebarSections = [
    {
      title: "",
      links: [{ href: "/dashboard/msme", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Business Management",
      links: [
        { href: "/dashboard/msme/profile", label: "My Business Profile", icon: User },
        { href: "/dashboard/msme/services", label: "My Services", icon: Wrench },
        { href: "/dashboard/msme/portfolio", label: "Portfolio Gallery", icon: ImageIcon },
        { href: "/dashboard/msme/reviews", label: "Customer Reviews", icon: Star },
        { href: "/dashboard/msme/complaints", label: "Complaints", icon: MessageSquare },
        { href: "/dashboard/msme/quotes", label: "Quote Requests", icon: ClipboardList },
        { href: "/dashboard/msme/invoices", label: "Invoices", icon: Receipt },
      ],
    },
    {
      title: "Identity & Verification",
      links: [
        { href: "/dashboard/msme/id-card", label: "My Digital ID Card", icon: FileBadge2 },
        { href: "/dashboard/compliance", label: "Verification Status", icon: ShieldCheck },
        { href: "/dashboard/payments", label: "Tax / VAT", icon: FileText },
      ],
    },
    {
      title: "Settings",
      links: [{ href: "/dashboard/msme/settings", label: "Settings", icon: Settings }],
    },
  ];

  const activity: ActivityItem[] = [
    quoteActivity?.[0]
      ? {
          id: `quote-${quoteActivity[0].id}`,
          label: "New quote request received",
          timestamp: quoteActivity[0].created_at,
          href: "/dashboard/msme/quotes",
        }
      : null,
    reviewActivity?.[0]
      ? {
          id: `review-${reviewActivity[0].id}`,
          label: "A new customer review was added",
          timestamp: reviewActivity[0].created_at,
          href: "/dashboard/msme/reviews",
        }
      : null,
    invoiceActivity?.[0]
      ? {
          id: `invoice-${invoiceActivity[0].id}`,
          label: invoiceActivity[0].status === "paid" ? "An invoice payment was completed" : "An invoice was created",
          timestamp: invoiceActivity[0].created_at,
          href: "/dashboard/msme/invoices",
        }
      : null,
  ].filter((item): item is ActivityItem => Boolean(item));

  const hasPublicProfile = Boolean(workspace.provider.public_slug);
  const profileSearchable = hasPublicProfile && Boolean(workspace.provider.is_active ?? true);
  const improveVisibilityRoute = safeServiceCount === 0 ? "/dashboard/msme/services" : "/dashboard/msme/profile";

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-100/70">
      <div className="mx-auto grid max-w-[1600px] gap-4 p-3 lg:grid-cols-[280px,1fr] lg:p-6">
        <aside className="rounded-3xl bg-emerald-950 p-4 text-emerald-50 shadow-xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="mb-5 border-b border-emerald-900/80 pb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">NDMII</p>
            <h2 className="mt-1 text-xl font-semibold">My Workspace</h2>
          </div>
          <nav className="space-y-5">
            {sidebarSections.map((section) => (
              <div key={section.title || "dashboard"}>
                {section.title ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/90">{section.title}</p> : null}
                <div className="space-y-1.5">
                  {section.links.map((item) => {
                    const Icon = item.icon;
                    const isDashboard = item.href === "/dashboard/msme";
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                          isDashboard
                            ? "bg-emerald-800 text-white"
                            : "text-emerald-100/90 hover:bg-emerald-900/70 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-emerald-800 bg-emerald-900/50 p-4">
            <p className="text-lg font-semibold">Need Help?</p>
            <p className="mt-1 text-sm text-emerald-100/90">Our support team is ready to assist your MSME dashboard operations.</p>
            <Link
              href="/dashboard/msme/settings"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Contact Support
            </Link>
          </div>
        </aside>

        <main className="space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">My Business Dashboard</h1>
            <div className="flex items-center gap-3">
              <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Notifications">
                <Bell className="h-5 w-5" />
              </button>
              <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Help center">
                <CircleHelp className="h-5 w-5" />
              </button>
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{workspace.msme.owner_name || "MSME User"}</p>
                  <p className="text-xs text-slate-500">{workspace.provider.display_name}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Welcome back</p>
                    <h2 className="text-2xl font-semibold text-slate-900">{workspace.provider.display_name || workspace.msme.business_name}</h2>
                  </div>
                  <Link
                    href="/dashboard/msme/public-profile"
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    View Public Profile
                  </Link>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),320px]">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 text-emerald-700">
                        {workspace.provider.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={workspace.provider.logo_url} alt="Business logo" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-7 w-7" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xl font-semibold text-slate-900">{workspace.msme.business_name || workspace.provider.display_name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isVerified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {isVerified ? "Verified" : "Pending Review"}
                          </span>
                        </div>
                        <p className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4" /> {workspace.msme.state}, Nigeria</p>
                        <p className="text-sm text-slate-600">{workspace.msme.sector || "Business category not set"}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">MSME ID</p>
                        <p className="text-sm font-semibold text-slate-900">{workspace.msme.msme_id}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Member Since</p>
                        <p className="text-sm font-semibold text-slate-900">{formatDate(msmeMeta?.created_at ?? null)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Verification Status</p>
                        <p className="text-sm font-semibold capitalize text-slate-900">{verificationStatus}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Open Complaints</p>
                        <p className="text-sm font-semibold text-slate-900">{safeComplaintCount}</p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <p className="font-medium text-slate-700">Profile Completion</p>
                        <p className="font-semibold text-slate-700">{completion}% Complete</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-center text-sm font-semibold text-emerald-800">Your Digital ID Card</p>
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-semibold text-emerald-700">NDMII DIGITAL MSME</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{workspace.provider.display_name}</p>
                      <p className="text-xs text-slate-600">{workspace.msme.owner_name}</p>
                      <p className="mt-2 text-xs text-slate-500">{workspace.msme.msme_id}</p>
                    </div>
                    <Link
                      href="/dashboard/msme/id-card"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Download Digital ID Card
                    </Link>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        className="group rounded-xl border border-slate-200 bg-white px-3 py-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <Icon className="h-5 w-5 text-emerald-700" />
                        <p className="mt-2 text-sm font-semibold text-slate-800">{action.label}</p>
                      </Link>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Business Performance (This Month)</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Profile Views", value: "0", icon: Eye, tone: "text-sky-700 bg-sky-100" },
                    { label: "Search Appearances", value: "0", icon: Search, tone: "text-violet-700 bg-violet-100" },
                    { label: "Quote Requests", value: String(safeQuoteCount), icon: ClipboardList, tone: "text-emerald-700 bg-emerald-100" },
                    { label: "New Reviews", value: String(safeReviewCount), icon: Star, tone: "text-amber-700 bg-amber-100" },
                  ].map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className={`inline-flex rounded-full p-2 ${metric.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{metric.value}</p>
                        <p className="text-sm text-slate-600">{metric.label}</p>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                  <Link href="/dashboard/msme/quotes" className="text-sm font-medium text-emerald-700 hover:underline">View all</Link>
                </div>
                <div className="divide-y divide-slate-100">
                  {activity.length > 0 ? (
                    activity.slice(0, 4).map((item) => (
                      <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-slate-50">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="text-xs text-slate-500">{activityDateLabel(item.timestamp)}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="py-4 text-sm text-slate-500">No recent activity yet. New quotes, reviews, and invoices will appear here.</p>
                  )}
                </div>
              </article>
            </div>

            <aside className="space-y-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Marketplace Visibility</h3>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      {hasPublicProfile ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                      Public profile is live
                    </span>
                    {!hasPublicProfile ? <Link href="/dashboard/msme/public-profile" className="text-emerald-700 hover:underline">Enable</Link> : null}
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
                    {safeServiceCount === 0 ? <Link href="/dashboard/msme/services" className="text-emerald-700 hover:underline">Add services</Link> : null}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      {safeGalleryCount > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                      {safeGalleryCount > 0 ? `${safeGalleryCount} portfolio items` : "Portfolio is missing"}
                    </span>
                    {safeGalleryCount === 0 ? <Link href="/dashboard/msme/portfolio" className="text-emerald-700 hover:underline">Add portfolio</Link> : null}
                  </div>
                </div>
                <Link
                  href={improveVisibilityRoute}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Improve Visibility
                </Link>
              </article>

              <article className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-5 text-white shadow-lg">
                <h3 className="text-2xl font-semibold leading-tight">Grow Your Business with NDMII</h3>
                <p className="mt-2 text-sm text-emerald-100">Complete your profile and keep your services updated to improve trust and discoverability across Nigeria.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-emerald-100">
                  <p>Services listed: <span className="font-semibold text-white">{safeServiceCount}</span></p>
                  <p>Portfolio items: <span className="font-semibold text-white">{safeGalleryCount}</span></p>
                  <p>Quote requests: <span className="font-semibold text-white">{safeQuoteCount}</span></p>
                  <p>Invoices: <span className="font-semibold text-white">{safeInvoiceCount}</span></p>
                </div>
                <Link
                  href="/dashboard/msme/onboarding"
                  className="mt-5 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
                >
                  Complete Profile Now
                </Link>
              </article>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
