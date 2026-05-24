import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileText,
  Gauge,
  Home,
  Menu,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComplianceNotifications, type ComplianceNotification } from "@/components/compliance/compliance-notifications";
import { ComplianceToastBridge } from "@/components/compliance/compliance-toast-bridge";
import { ReviewQueueGuard } from "@/components/compliance/review-queue-guard";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  canReviewRegulator,
  canUseComplianceReviewQueue,
  performComplianceReviewAction,
  type ComplianceReviewAction,
} from "@/lib/data/compliance-reviews";

type SearchParams = {
  regulator?: string;
  status?: string;
  msme?: string;
  date?: string;
  date_to?: string;
  deadline?: string;
  item?: string;
  saved?: string;
  error?: string;
};

type RegulatorRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type QueueItem = {
  id: string;
  msme_id: string;
  regulator_id: string;
  status: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  updated_at: string | null;
  decision_reason: string | null;
  reviewer_user_id: string | null;
  latest_review_id: string | null;
  msmes?: { id?: string | null; msme_id?: string | null; business_name?: string | null; state?: string | null; sector?: string | null } | null;
  compliance_regulators?: RegulatorRow | RegulatorRow[] | null;
  compliance_requirement_definitions?: { code?: string | null; title?: string | null; category?: string | null; description?: string | null } | Array<{ code?: string | null; title?: string | null; category?: string | null; description?: string | null }> | null;
};

type EvidenceDocument = {
  id: string;
  compliance_item_id: string;
  document_type: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
};

type ReviewRow = {
  id: string;
  compliance_item_id: string;
  review_status: string;
  previous_status: string | null;
  new_status: string | null;
  decision_reason: string | null;
  requested_changes: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  users?: { full_name?: string | null; email?: string | null } | null;
};

type CommentRow = {
  id: string;
  compliance_item_id: string;
  author_role: string | null;
  comment_body: string | null;
  visibility: string | null;
  created_at: string | null;
};

type EventRow = {
  id: string;
  compliance_item_id: string | null;
  event_type: string | null;
  summary: string | null;
  from_status: string | null;
  to_status: string | null;
  actor_role: string | null;
  created_at: string | null;
};

const reviewableStatuses = ["submitted", "resubmitted", "under_review", "changes_requested", "rejected", "approved", "expiring_soon", "expired"];

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatStatus(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "not started";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function lagosDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(value / 1024))} KB`;
}

function statusClass(status: string | null | undefined) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "expiring_soon") return "bg-amber-100 text-amber-700";
  if (status === "under_review") return "bg-orange-100 text-orange-700";
  if (status === "submitted" || status === "resubmitted") return "bg-blue-100 text-blue-700";
  if (status === "changes_requested") return "bg-amber-100 text-amber-700";
  if (status === "rejected" || status === "expired") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function regulatorClass(code: string | null | undefined) {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized === "FIRS") return "bg-emerald-100 text-emerald-700";
  if (normalized === "SON") return "bg-blue-100 text-blue-700";
  if (normalized === "NAFDAC") return "bg-sky-100 text-sky-700";
  if (normalized === "CAC") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-700";
}

function nextActionButtonClass(status: string | null | undefined) {
  if (canAssign(status)) return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100";
  if (status === "under_review") return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100";
  if (canReopen(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  if (status === "expired" || status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";
  return "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100";
}

function nextActionCta(status: string | null | undefined, evidenceCount: number) {
  if (canAssign(status)) return "Start Review";
  if (status === "under_review" && evidenceCount > 0) return "Continue Review";
  if (status === "under_review") return "Evidence needed";
  if (canReopen(status)) return "Reopen if needed";
  if (status === "expired" || status === "expiring_soon") return "Track renewal";
  return "View details";
}

function canAssign(status: string | null | undefined) {
  return status === "submitted" || status === "resubmitted";
}

function canDecide(status: string | null | undefined, evidenceCount: number) {
  return status === "under_review" && evidenceCount > 0;
}

function canReopen(status: string | null | undefined) {
  return status === "approved" || status === "rejected" || status === "changes_requested";
}

function decisionDisabledText(status: string | null | undefined, evidenceCount: number) {
  if (status !== "under_review") return "Start review before approve, reject, or changes actions are enabled.";
  if (evidenceCount === 0) return "Approval is blocked until at least one active evidence document is attached.";
  return "Decision actions are available for this under-review item.";
}

function isPastDate(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function eventText(event: EventRow) {
  if (event.summary) return event.summary;
  if (event.event_type === "uploaded") return "Compliance evidence uploaded";
  if (event.event_type === "changes_requested") return "Reviewer requested changes";
  if (event.event_type?.includes("reminder")) return "Reminder sent before expiry";
  return event.event_type?.replaceAll("_", " ") ?? "Compliance event";
}

function averageReviewTime(reviews: ReviewRow[]) {
  const durations = reviews
    .filter((review) => review.reviewed_at && review.created_at)
    .map((review) => new Date(review.reviewed_at as string).getTime() - new Date(review.created_at as string).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (durations.length === 0) return "No completed reviews";
  const averageHours = durations.reduce((sum, value) => sum + value, 0) / durations.length / (1000 * 60 * 60);
  if (averageHours < 24) return `${Math.max(1, Math.round(averageHours))}h`;
  return `${Math.round(averageHours / 24)}d`;
}

function selectedAction(raw: FormDataEntryValue | null): ComplianceReviewAction {
  const action = String(raw ?? "assign");
  if (action === "approve" || action === "reject" || action === "request_changes" || action === "reopen") return action;
  return "assign";
}

async function reviewQueueAction(formData: FormData) {
  "use server";

  const ctx = await getCurrentUserContext();
  if (!canUseComplianceReviewQueue(ctx)) redirect("/access-denied");

  const action = selectedAction(formData.get("review_action"));
  const singleItem = String(formData.get("single_item_id") ?? "").trim();
  const selectedItems = formData.getAll("item_id").map((value) => String(value)).filter(Boolean);
  const itemIds = singleItem ? [singleItem] : selectedItems;
  const decisionReason = String(formData.get("decision_reason") ?? "").trim();
  const requestedChanges = String(formData.get("requested_changes") ?? "").trim();
  const internalNotes = String(formData.get("internal_notes") ?? "").trim();

  if (itemIds.length === 0) redirect("/dashboard/reviews/compliance?error=no_items_selected");

  try {
    for (const itemId of itemIds) {
      await performComplianceReviewAction(ctx, {
        complianceItemId: itemId,
        action,
        decisionReason,
        requestedChanges,
        internalNotes,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review action failed.";
    redirect(`/dashboard/reviews/compliance?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/reviews/compliance");
  revalidatePath("/dashboard/msme/compliance");
  redirect(`/dashboard/reviews/compliance?saved=${action}`);
}

async function reviewSingleAction(itemId: string, action: ComplianceReviewAction, formData: FormData) {
  "use server";

  const ctx = await getCurrentUserContext();
  if (!canUseComplianceReviewQueue(ctx)) redirect("/access-denied");

  try {
    await performComplianceReviewAction(ctx, {
      complianceItemId: itemId,
      action,
      decisionReason: String(formData.get("decision_reason") ?? "").trim(),
      requestedChanges: String(formData.get("requested_changes") ?? "").trim(),
      internalNotes: String(formData.get("internal_notes") ?? "").trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review action failed.";
    redirect(`/dashboard/reviews/compliance?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/reviews/compliance");
  revalidatePath("/dashboard/msme/compliance");
  redirect(`/dashboard/reviews/compliance?saved=${action}`);
}

export default async function ComplianceReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!canUseComplianceReviewQueue(ctx)) redirect("/access-denied");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: regulatorRows } = await supabase.from("compliance_regulators").select("id,code,name").eq("is_active", true).order("code");
  const regulators = ((regulatorRows ?? []) as RegulatorRow[]).filter((regulator) => canReviewRegulator(ctx, regulator.code));
  const regulatorByCode = new Map(regulators.map((regulator) => [String(regulator.code ?? "").toUpperCase(), regulator]));
  const selectedRegulator = params.regulator ? regulatorByCode.get(params.regulator.toUpperCase()) : null;

  let query = supabase
    .from("msme_compliance_items")
    .select("id,msme_id,regulator_id,status,submitted_at,expires_at,updated_at,decision_reason,reviewer_user_id,latest_review_id,msmes(id,msme_id,business_name,state,sector),compliance_regulators(id,code,name),compliance_requirement_definitions(code,title,category,description)")
    .in("status", reviewableStatuses)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (selectedRegulator) query = query.eq("regulator_id", selectedRegulator.id);
  if (params.status === "overdue") {
    query = query.eq("status", "expired").lt("expires_at", lagosDateString());
  } else if (params.status === "next_deadline") {
    query = query.not("expires_at", "is", null).order("expires_at", { ascending: true });
  } else if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.date) query = query.gte("updated_at", new Date(params.date).toISOString());
  if (params.date_to) {
    const endDate = new Date(params.date_to);
    endDate.setHours(23, 59, 59, 999);
    query = query.lte("updated_at", endDate.toISOString());
  }
  if (params.deadline) query = query.lte("expires_at", params.deadline);

  const { data: itemRows } = await query;
  const rows = ((itemRows ?? []) as QueueItem[]).filter((row) => {
    const regulator = relationOne(row.compliance_regulators);
    if (!canReviewRegulator(ctx, regulator?.code)) return false;
    if (!params.msme) return true;
    const term = params.msme.toLowerCase();
    return `${row.msmes?.business_name ?? ""} ${row.msmes?.msme_id ?? ""}`.toLowerCase().includes(term);
  });

  const itemIds = rows.map((row) => row.id);
  const [{ data: documents }, { data: reviews }, { data: comments }, { data: events }] = itemIds.length
    ? await Promise.all([
        supabase.from("compliance_documents").select("id,compliance_item_id,document_type,original_filename,mime_type,file_size_bytes,uploaded_at").in("compliance_item_id", itemIds).eq("is_deleted", false).order("uploaded_at", { ascending: false }),
        supabase.from("compliance_reviews").select("id,compliance_item_id,review_status,previous_status,new_status,decision_reason,requested_changes,reviewed_at,created_at,users(full_name,email)").in("compliance_item_id", itemIds).order("created_at", { ascending: false }),
        supabase.from("compliance_review_comments").select("id,compliance_item_id,author_role,comment_body,visibility,created_at").in("compliance_item_id", itemIds).order("created_at", { ascending: false }),
        supabase.from("compliance_events").select("id,compliance_item_id,event_type,summary,from_status,to_status,actor_role,created_at").in("compliance_item_id", itemIds).order("created_at", { ascending: false }).limit(80),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const documentsByItem = ((documents ?? []) as EvidenceDocument[]).reduce<Record<string, EvidenceDocument[]>>((acc, document) => {
    acc[document.compliance_item_id] = [...(acc[document.compliance_item_id] ?? []), document];
    return acc;
  }, {});
  const reviewsByItem = ((reviews ?? []) as ReviewRow[]).reduce<Record<string, ReviewRow[]>>((acc, review) => {
    acc[review.compliance_item_id] = [...(acc[review.compliance_item_id] ?? []), review];
    return acc;
  }, {});
  const commentsByItem = ((comments ?? []) as CommentRow[]).reduce<Record<string, CommentRow[]>>((acc, comment) => {
    acc[comment.compliance_item_id] = [...(acc[comment.compliance_item_id] ?? []), comment];
    return acc;
  }, {});
  const eventsByItem = ((events ?? []) as EventRow[]).reduce<Record<string, EventRow[]>>((acc, event) => {
    if (!event.compliance_item_id) return acc;
    acc[event.compliance_item_id] = [...(acc[event.compliance_item_id] ?? []), event];
    return acc;
  }, {});

  const activeItem = rows.find((row) => row.id === params.item) ?? rows[0] ?? null;
  const activeRequirement = relationOne(activeItem?.compliance_requirement_definitions);
  const activeDocuments = activeItem ? documentsByItem[activeItem.id] ?? [] : [];
  const activeRegulator = relationOne(activeItem?.compliance_regulators);
  const activeReviews = activeItem ? reviewsByItem[activeItem.id] ?? [] : [];
  const activeComments = activeItem ? commentsByItem[activeItem.id] ?? [] : [];
  const activeEvents = activeItem ? eventsByItem[activeItem.id] ?? [] : [];
  const activeDecisionText = decisionDisabledText(activeItem?.status, activeDocuments.length);
  const exportHref = `/api/compliance/reviews/export?${new URLSearchParams({
    ...(params.regulator ? { regulator: params.regulator } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.msme ? { msme: params.msme } : {}),
    ...(params.date ? { date: params.date } : {}),
    ...(params.date_to ? { date_to: params.date_to } : {}),
    ...(params.deadline ? { deadline: params.deadline } : {}),
  }).toString()}`;
  const allReviews = (reviews ?? []) as ReviewRow[];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const approvalsThisWeek = allReviews.filter((review) => review.review_status === "approved" && review.reviewed_at && new Date(review.reviewed_at).getTime() >= oneWeekAgo).length;
  const overdueReviews = rows.filter((row) => row.status === "expired" || (row.expires_at && new Date(row.expires_at).getTime() < Date.now() && row.status !== "approved")).length;
  const reviewerMetrics = [
    { label: "Queue size", value: String(rows.length), detail: "Filtered review items" },
    { label: "Overdue reviews", value: String(overdueReviews), detail: "Expired or past deadline" },
    { label: "Approvals this week", value: String(approvalsThisWeek), detail: "Completed approvals in the last 7 days" },
    { label: "Average review time", value: averageReviewTime(allReviews), detail: "From review creation to decision" },
  ];
  const notifications: ComplianceNotification[] = [
    ...rows
      .filter((row) => row.status === "submitted" || row.status === "resubmitted")
      .slice(0, 8)
      .map((row) => ({
        id: `pending-${row.id}`,
        title: "Pending review",
        detail: `${row.msmes?.business_name ?? "MSME"} is waiting for review to start.`,
        href: "/dashboard/reviews/compliance",
        severity: "info" as const,
        createdAt: row.submitted_at,
      })),
    ...rows
      .filter((row) => row.status === "expired" || row.status === "expiring_soon")
      .slice(0, 8)
      .map((row) => ({
        id: `deadline-${row.id}`,
        title: row.status === "expired" ? "Expired document" : "Expiring document",
        detail: `${row.msmes?.business_name ?? "MSME"} deadline: ${formatDate(row.expires_at)}.`,
        href: "/dashboard/reviews/compliance",
        severity: row.status === "expired" ? ("danger" as const) : ("warning" as const),
        createdAt: row.expires_at,
      })),
    ...rows
      .filter((row) => row.status === "rejected" || row.status === "changes_requested")
      .slice(0, 8)
      .map((row) => ({
        id: `decision-${row.id}`,
        title: row.status === "rejected" ? "Rejected item" : "Changes requested",
        detail: `${row.msmes?.business_name ?? "MSME"} has an unresolved reviewer decision.`,
        href: "/dashboard/reviews/compliance",
        severity: row.status === "rejected" ? ("danger" as const) : ("warning" as const),
        createdAt: row.updated_at,
      })),
  ];
  const expiringSoonReviews = rows.filter((row) => row.status === "expiring_soon").length;
  const submittedReviews = rows.filter((row) => row.status === "submitted" || row.status === "resubmitted").length;
  const underReviewCount = rows.filter((row) => row.status === "under_review").length;
  const tabCounts = {
    all: rows.length,
    submitted: submittedReviews,
    under_review: underReviewCount,
    expiring_soon: expiringSoonReviews,
    overdue: overdueReviews,
  };
  const filterBaseParams = {
    ...(params.regulator ? { regulator: params.regulator } : {}),
    ...(params.msme ? { msme: params.msme } : {}),
    ...(params.date ? { date: params.date } : {}),
    ...(params.date_to ? { date_to: params.date_to } : {}),
    ...(params.deadline ? { deadline: params.deadline } : {}),
  };
  const filterTabs = [
    { label: "All Items", status: "", count: tabCounts.all },
    { label: "Submitted", status: "submitted", count: tabCounts.submitted },
    { label: "Under Review", status: "under_review", count: tabCounts.under_review },
    { label: "Expiring Soon", status: "expiring_soon", count: tabCounts.expiring_soon },
    { label: "Overdue", status: "overdue", count: tabCounts.overdue },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <ComplianceToastBridge />
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="bg-gradient-to-b from-emerald-950 via-emerald-950 to-teal-950 px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black shadow-lg shadow-emerald-950/30">DBIN</span>
            <span>
              <span className="block text-sm font-bold leading-tight">Digital Business</span>
              <span className="block text-sm font-bold leading-tight">Identity Network</span>
            </span>
          </Link>
          <nav aria-label="Reviewer portal navigation" className="mt-10 space-y-7">
            <section>
              <p className="px-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-emerald-100/60">Reviewer Portal</p>
              <div className="mt-4 space-y-1.5">
                {[
                  { href: "/dashboard/reviews", label: "Overview", icon: Home },
                  { href: "/dashboard/reviews", label: "Reviewer Workflow", icon: ClipboardCheck },
                  { href: "/dashboard/reviews/compliance", label: "Compliance Reviews", icon: ShieldCheck },
                  { href: "/dashboard/reviews", label: "KYC Review", icon: FileText },
                  { href: "/verify", label: "Public Verification", icon: Gauge },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = item.href === "/dashboard/reviews/compliance";
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition",
                        active ? "bg-emerald-500/20 text-white shadow-inner" : "text-emerald-50/75 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          </nav>
          <div className="mt-10 hidden items-center gap-2 text-xs text-emerald-50/70 lg:absolute lg:bottom-6 lg:left-6 lg:flex">
            <span className="text-lg leading-none">«</span>
            Collapse
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden" aria-label="Open reviewer menu">
                  <Menu className="h-5 w-5" />
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Compliance Reviews</h1>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Phase 3</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ComplianceNotifications notifications={notifications} scope={`reviewer-${ctx.role}`} />
                <div className="hidden items-center gap-3 rounded-full border border-slate-100 bg-white py-1 pl-1 pr-3 shadow-sm sm:flex">
                  <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                    {(ctx.fullName ?? ctx.email ?? "R").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-bold text-slate-900">{ctx.fullName ?? "Regulator"}</span>
                    <span className="block text-xs text-slate-500">{formatStatus(ctx.role)}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1720px] space-y-4 px-4 py-4 sm:px-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { ...reviewerMetrics[0], label: "Queue items", icon: FileText, tone: "bg-blue-50 text-blue-700" },
                { label: "Expiring soon", value: String(expiringSoonReviews), detail: "Renewal window approaching", icon: Clock3, tone: "bg-amber-50 text-amber-700" },
                { ...reviewerMetrics[1], label: "Overdue reviews", icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
                { ...reviewerMetrics[3], label: "Avg review time", icon: Clock3, tone: "bg-indigo-50 text-indigo-700" },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <article key={metric.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xl font-semibold leading-none text-slate-950">{metric.value}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{metric.label}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {filterTabs.map((tab) => {
                    const href = `/dashboard/reviews/compliance?${new URLSearchParams({
                      ...filterBaseParams,
                      ...(tab.status ? { status: tab.status } : {}),
                    }).toString()}`;
                    const active = tab.status ? params.status === tab.status : !params.status;
                    return (
                      <Link
                        key={tab.label}
                        href={href}
                        className={[
                          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
                          active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                        ].join(" ")}
                      >
                        {tab.label}
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.68rem] text-slate-500">{tab.count}</span>
                      </Link>
                    );
                  })}
                </div>
                <Link href={exportHref} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Link>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[160px_160px_minmax(220px,1fr)_250px_104px_92px]">
                <label className="sr-only" htmlFor="regulator-filter">Regulator</label>
                <select id="regulator-filter" name="regulator" defaultValue={params.regulator ?? ""} className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700">
                  <option value="">All Regulators</option>
                  {regulators.map((regulator) => (
                    <option key={regulator.id} value={regulator.code ?? ""}>{regulator.code} - {regulator.name}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="status-filter">Status</label>
                <select id="status-filter" name="status" defaultValue={params.status ?? ""} className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700">
                  <option value="">All Statuses</option>
                  {reviewableStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                  <option value="overdue">Overdue</option>
                  <option value="next_deadline">Next deadline</option>
                </select>
                <label className="relative block">
                  <span className="sr-only">MSME search</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input name="msme" defaultValue={params.msme ?? ""} placeholder="Search business name or ID..." className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2.5 text-xs font-medium text-slate-900" />
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-white p-1">
                  <label className="relative block">
                    <span className="sr-only">Updated from</span>
                    <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input name="date" defaultValue={params.date ?? ""} type="date" className="h-7 w-full rounded border-0 bg-transparent pl-7 pr-1 text-[0.7rem] font-medium text-slate-700" />
                  </label>
                  <label className="relative block border-l border-slate-100">
                    <span className="sr-only">Updated to</span>
                    <input name="date_to" defaultValue={params.date_to ?? ""} type="date" className="h-7 w-full rounded border-0 bg-transparent px-1.5 text-[0.7rem] font-medium text-slate-700" />
                  </label>
                </div>
                <Button type="submit" variant="secondary" className="h-9 gap-1.5 border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </Button>
                <Link href="/dashboard/reviews/compliance" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                  <X className="h-3.5 w-3.5" />
                  Reset
                </Link>
                <input name="deadline" defaultValue={params.deadline ?? ""} type="hidden" />
              </div>
            </form>

            <form id="compliance-review-queue-form" action={reviewQueueAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_410px]">
              <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <ReviewQueueGuard formId="compliance-review-queue-form" />
                  <div className="flex flex-wrap gap-1.5">
                    <Button name="review_action" value="assign" size="sm" data-bulk-action data-action-label="Start review" data-allowed-statuses="submitted,resubmitted" className="h-8 bg-slate-100 px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-200">
                      <UserCheck className="mr-1 h-3.5 w-3.5" />Start Review
                    </Button>
                    <Button name="review_action" value="approve" size="sm" data-bulk-action data-action-label="Approve" data-allowed-statuses="under_review" data-requires-evidence="true" className="h-8 bg-slate-100 px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-200">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve
                    </Button>
                    <Button name="review_action" value="request_changes" size="sm" variant="secondary" data-bulk-action data-action-label="Request changes" data-allowed-statuses="under_review" className="h-8 px-2.5 text-xs font-medium">
                      Changes
                    </Button>
                    <Button name="review_action" value="reject" size="sm" variant="secondary" data-bulk-action data-action-label="Reject" data-allowed-statuses="under_review" className="h-8 px-2.5 text-xs font-medium">
                      <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[940px]">
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-sm font-medium text-slate-500">No compliance review items match the selected filters.</div>
                    ) : rows.map((row) => {
                      const regulator = relationOne(row.compliance_regulators);
                      const requirement = relationOne(row.compliance_requirement_definitions);
                      const evidenceCount = documentsByItem[row.id]?.length ?? 0;
                      const itemHref = `/dashboard/reviews/compliance?${new URLSearchParams({
                        ...(params.regulator ? { regulator: params.regulator } : {}),
                        ...(params.status ? { status: params.status } : {}),
                        ...(params.msme ? { msme: params.msme } : {}),
                        ...(params.date ? { date: params.date } : {}),
                        ...(params.date_to ? { date_to: params.date_to } : {}),
                        ...(params.deadline ? { deadline: params.deadline } : {}),
                        item: row.id,
                      }).toString()}`;
                      const isSelected = activeItem?.id === row.id;
                      const expired = row.status === "expired" || (isPastDate(row.expires_at) && row.status !== "approved");

                      return (
                        <div key={row.id} className={["grid min-h-[76px] grid-cols-[32px_minmax(210px,1.35fr)_minmax(180px,1fr)_112px_104px_118px_102px] items-center gap-3 border-b border-slate-100 px-4 py-2.5 transition", isSelected ? "border-l-2 border-l-emerald-500 bg-emerald-50/35 ring-1 ring-inset ring-emerald-300" : "bg-white hover:bg-slate-50"].join(" ")}>
                          <input
                            type="checkbox"
                            name="item_id"
                            value={row.id}
                            data-status={row.status ?? ""}
                            data-evidence-count={evidenceCount}
                            aria-label={`Select ${row.msmes?.business_name ?? "compliance item"}`}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          />
                          <div className="min-w-0">
                            <Link href={itemHref} className="block truncate text-sm font-semibold text-slate-950 hover:text-emerald-700">{row.msmes?.business_name ?? "MSME"}</Link>
                            <p className="mt-1 truncate text-[0.72rem] font-medium text-slate-500">
                              {row.msmes?.msme_id ?? row.msme_id}
                              <span className="mx-1.5 text-slate-300">·</span>
                              {row.msmes?.state ?? "Location not set"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{requirement?.title ?? requirement?.code ?? "Compliance item"}</p>
                            <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${regulatorClass(regulator?.code)}`}>{regulator?.code ?? "REG"}</span>
                          </div>
                          <div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-semibold capitalize ${statusClass(row.status)}`}>{formatStatus(row.status)}</span>
                            <Link href={itemHref} className="mt-1.5 block text-[0.7rem] font-semibold text-blue-600 hover:text-blue-700">{evidenceCount} evidence</Link>
                          </div>
                          <div>
                            <p className="text-[0.64rem] font-semibold uppercase text-slate-400">Deadline</p>
                            <p className={`mt-1 text-xs font-medium ${expired ? "text-rose-600" : "text-slate-700"}`}>{formatDate(row.expires_at)}</p>
                          </div>
                          <Link href={itemHref} className={`inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-[0.72rem] font-semibold ${nextActionButtonClass(row.status)}`}>
                            {nextActionCta(row.status, evidenceCount)}
                          </Link>
                          <span className="text-[0.68rem] font-medium text-slate-400">Updated {formatDate(row.updated_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  <span>Showing 1 to {Math.min(10, rows.length)} of {rows.length} items</span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-300 text-xs font-semibold text-emerald-700">1</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-slate-500">2</span>
                  </div>
                </div>
              </section>

              <aside className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm xl:w-[410px]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Review</p>
                  <X className="h-4 w-4 text-slate-400" />
                </div>

                {!activeItem ? (
                  <p className="m-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">Select a queue row or adjust filters to load item details.</p>
                ) : (
                  <div className="space-y-4 p-4">
                    <section className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="break-words text-base font-semibold text-slate-950">{activeItem.msmes?.business_name ?? "MSME"}</h2>
                            <p className="mt-1 text-xs font-medium text-slate-500">{activeItem.msmes?.msme_id ?? activeItem.msme_id}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold capitalize ${statusClass(activeItem.status)}`}>{formatStatus(activeItem.status)}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">{activeItem.msmes?.state ?? "State not set"} · {activeItem.msmes?.sector ?? "Sector not set"}</p>
                      </div>
                    </section>

                    <section className="border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Requirement</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{activeRequirement?.title ?? activeRequirement?.code ?? "Compliance item"}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${regulatorClass(activeRegulator?.code)}`}>{activeRegulator?.code ?? "REG"}</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-slate-500">{activeRequirement?.description ?? "No additional requirement description was provided."}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                        <div>
                          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400"><CalendarDays className="h-3.5 w-3.5" />Submitted</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{formatDateTime(activeItem.submitted_at)}</p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400"><CalendarDays className="h-3.5 w-3.5" />Deadline</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{formatDate(activeItem.expires_at)}</p>
                        </div>
                      </div>
                    </section>

                    <section className="border-t border-slate-100 pt-4">
                      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Evidence ({activeDocuments.length} file)</h3>
                      <div className="mt-2 space-y-2">
                        {activeDocuments.length === 0 ? (
                          <p className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />No active evidence documents. Approval is blocked.</p>
                        ) : activeDocuments.map((document) => (
                          <div key={document.id} className="rounded-md border border-slate-200 px-3 py-2.5">
                            <div className="flex items-start gap-2.5">
                              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                                <FileText className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900">{document.original_filename}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatBytes(document.file_size_bytes)} · Uploaded {formatDateTime(document.uploaded_at)}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <a href={`/api/msme/compliance/evidence/${document.id}?disposition=inline`} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 px-2.5 text-[0.7rem] font-semibold text-emerald-700 hover:bg-emerald-50"><Eye className="h-3 w-3" />Preview</a>
                                  <a href={`/api/msme/compliance/evidence/${document.id}?disposition=attachment`} className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-[0.7rem] font-semibold text-slate-600 hover:bg-slate-50"><Download className="h-3 w-3" />Download</a>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="border-t border-slate-100 pt-4">
                      <label className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Reviewer notes
                        <textarea name="internal_notes" rows={3} placeholder="Add internal notes (visible to reviewers only)..." className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
                      </label>
                      {activeComments.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {activeComments.slice(0, 2).map((comment) => (
                            <div key={comment.id} className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-slate-700">
                              <p className="font-semibold">{comment.visibility === "msme_visible" ? "MSME-visible comment" : "Internal comment"}</p>
                              <p className="mt-1">{comment.comment_body}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="border-t border-slate-100 pt-4">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Decision</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
                        <label className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-4 border-emerald-600" />Approve</label>
                        <label className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-orange-400" />Request Changes</label>
                        <label className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-rose-400" />Reject</label>
                      </div>
                      <label className="mt-3 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Decision reason
                        <textarea name="decision_reason" rows={3} placeholder="Provide reason for your decision..." className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
                      </label>
                      <label className="mt-3 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Requested changes
                        <textarea name="requested_changes" rows={2} placeholder="Visible guidance for the MSME when requesting changes" className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
                      </label>
                      <p className="mt-2 text-xs font-medium text-slate-500">{activeDecisionText}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <Button formAction={reviewSingleAction.bind(null, activeItem.id, "approve")} disabled={!canDecide(activeItem.status, activeDocuments.length)} className="h-9 bg-emerald-700 px-2 text-xs font-semibold hover:bg-emerald-800">
                          Approve
                        </Button>
                        <Button formAction={reviewSingleAction.bind(null, activeItem.id, "request_changes")} disabled={activeItem.status !== "under_review"} variant="secondary" className="h-9 border border-orange-200 bg-orange-50 px-2 text-xs font-semibold text-orange-700 hover:bg-orange-100">
                          Request Changes
                        </Button>
                        <Button formAction={reviewSingleAction.bind(null, activeItem.id, "reject")} disabled={activeItem.status !== "under_review"} variant="secondary" className="h-9 border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                          Reject
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Button formAction={reviewSingleAction.bind(null, activeItem.id, "assign")} variant="secondary" disabled={!canAssign(activeItem.status)} className="h-8 text-xs font-medium">
                          <UserCheck className="mr-1 h-3.5 w-3.5" />Start Review
                        </Button>
                        <Button formAction={reviewSingleAction.bind(null, activeItem.id, "reopen")} variant="secondary" disabled={!canReopen(activeItem.status)} className="h-8 text-xs font-medium">
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />Reopen
                        </Button>
                      </div>
                      <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Approvals require an under-review session, reviewer identity, and at least one active evidence document.
                      </div>
                    </section>

                    <section className="border-t border-slate-100 pt-4">
                      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Review history</h3>
                      <div className="mt-3 space-y-0 border-l border-slate-200 pl-4">
                        {activeEvents.length === 0 && activeReviews.length === 0 ? <p className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No review history has been recorded yet.</p> : null}
                        {activeReviews.slice(0, 4).map((entry, index) => (
                          <div key={entry.id} className="relative pb-4">
                            <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${index === 0 ? "bg-emerald-600" : "bg-blue-600"}`} />
                            <p className="text-sm font-semibold capitalize text-slate-900">{formatStatus(entry.review_status)}</p>
                            <p className="mt-1 text-xs text-slate-500">by {entry.users?.full_name ?? entry.users?.email ?? "Reviewer"} · {formatDateTime(entry.created_at)}</p>
                            {entry.decision_reason ? <p className="mt-2 text-xs text-slate-600">{entry.decision_reason}</p> : null}
                          </div>
                        ))}
                        {activeEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className="relative pb-4">
                            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-400 ring-4 ring-white" />
                            <p className="text-sm font-semibold text-slate-900">{eventText(event)}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </aside>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
