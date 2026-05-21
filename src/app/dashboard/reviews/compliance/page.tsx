import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AlertTriangle, CheckCircle2, Clock3, Download, Eye, History, RotateCcw, ShieldCheck, UserCheck, XCircle } from "lucide-react";
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
  deadline?: string;
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
  if (status === "under_review" || status === "submitted" || status === "resubmitted") return "bg-blue-100 text-blue-700";
  if (status === "changes_requested") return "bg-amber-100 text-amber-700";
  if (status === "rejected" || status === "expired") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function rowClass(status: string | null | undefined) {
  if (status === "approved") return "border-l-4 border-l-emerald-500 bg-emerald-50/30";
  if (status === "expired" || status === "rejected") return "border-l-4 border-l-rose-500 bg-rose-50/30";
  if (status === "changes_requested" || status === "expiring_soon") return "border-l-4 border-l-amber-500 bg-amber-50/30";
  if (status === "submitted" || status === "resubmitted" || status === "under_review") return "border-l-4 border-l-blue-500 bg-blue-50/30";
  return "";
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

function progressBadges(status: string | null | undefined, expiresAt: string | null | undefined) {
  const current = status ?? "not_started";
  const steps = [
    ["submitted", "Submitted"],
    ["under_review", "Under Review"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["changes_requested", "Changes Requested"],
  ];
  const deadlineBadges = [
    current === "expiring_soon" ? ["expiring_soon", "Expiring Soon"] : null,
    current === "expired" || (expiresAt && new Date(expiresAt).getTime() < Date.now()) ? ["expired", "Expired"] : null,
  ].filter(Boolean) as string[][];
  return [...steps.filter(([key]) => key === current || (current === "resubmitted" && key === "submitted")), ...deadlineBadges];
}

function eventText(event: EventRow) {
  if (event.summary) return event.summary;
  if (event.event_type === "uploaded") return "Compliance evidence uploaded";
  if (event.event_type === "changes_requested") return "Reviewer requested changes";
  if (event.event_type?.includes("reminder")) return "Reminder sent before expiry";
  return event.event_type?.replaceAll("_", " ") ?? "Compliance event";
}

function dateGroupLabel(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-NG", { day: "2-digit", month: "long", year: "numeric" });
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

  const activeItem = rows[0] ?? null;
  const activeRequirement = relationOne(activeItem?.compliance_requirement_definitions);
  const activeDocuments = activeItem ? documentsByItem[activeItem.id] ?? [] : [];
  const exportHref = `/api/compliance/reviews/export?${new URLSearchParams({
    ...(params.regulator ? { regulator: params.regulator } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.msme ? { msme: params.msme } : {}),
    ...(params.date ? { date: params.date } : {}),
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

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Compliance Phase 3</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Reviewer Compliance Queue</h1>
          <p className="mt-1 text-sm text-slate-600">Review submitted evidence, record decisions, and preserve regulator audit history.</p>
        </div>
        <div className="flex items-center gap-2">
          <ComplianceNotifications notifications={notifications} scope={`reviewer-${ctx.role}`} />
          <Link href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <Download className="h-4 w-4" />
            Export CSV
          </Link>
        </div>
      </header>

      <ComplianceToastBridge />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {reviewerMetrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{metric.label}</p>
            <p className="mt-3 text-xs text-slate-500">{metric.detail}</p>
          </article>
        ))}
      </section>

      <form className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-6">
        <select name="regulator" defaultValue={params.regulator ?? ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All regulators</option>
          {regulators.map((regulator) => (
            <option key={regulator.id} value={regulator.code ?? ""}>{regulator.code} - {regulator.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {reviewableStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          <option value="overdue">Overdue</option>
          <option value="next_deadline">Next deadline</option>
        </select>
        <input name="msme" defaultValue={params.msme ?? ""} placeholder="MSME name or ID" className="rounded-md border px-3 py-2 text-sm" />
        <input name="date" defaultValue={params.date ?? ""} type="date" className="rounded-md border px-3 py-2 text-sm" />
        <input name="deadline" defaultValue={params.deadline ?? ""} type="date" title="Next deadline on or before" className="rounded-md border px-3 py-2 text-sm" />
        <Button type="submit">Apply filters</Button>
      </form>

      <form id="compliance-review-queue-form" action={reviewQueueAction} className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="grid gap-3 border-b bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <textarea name="decision_reason" rows={2} placeholder="Decision reason" className="rounded-md border px-3 py-2 text-sm" />
            <textarea name="requested_changes" rows={2} placeholder="Requested changes for MSME" className="rounded-md border px-3 py-2 text-sm" />
            <textarea name="internal_notes" rows={2} placeholder="Internal reviewer notes" className="rounded-md border px-3 py-2 text-sm" />
            <div className="flex flex-wrap content-start gap-2">
              <div className="basis-full"><ReviewQueueGuard formId="compliance-review-queue-form" /></div>
              <Button name="review_action" value="assign" size="sm" data-bulk-action data-action-label="Start review"><UserCheck className="mr-1 h-4 w-4" />Start Review</Button>
              <Button name="review_action" value="approve" size="sm" data-bulk-action data-action-label="Approve"><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button>
              <Button name="review_action" value="request_changes" size="sm" variant="secondary" data-bulk-action data-action-label="Request changes">Changes</Button>
              <Button name="review_action" value="reject" size="sm" variant="secondary" data-bulk-action data-action-label="Reject"><XCircle className="mr-1 h-4 w-4" />Reject</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">MSME</th>
                  <th className="px-3 py-2">Requirement</th>
                  <th className="px-3 py-2">Regulator</th>
                  <th className="px-3 py-2">Next deadline</th>
                  <th className="px-3 py-2">Evidence</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Row action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={8}>No compliance review items match the selected filters.</td></tr>
                ) : rows.map((row) => {
                  const regulator = relationOne(row.compliance_regulators);
                  const requirement = relationOne(row.compliance_requirement_definitions);
                  const evidenceCount = documentsByItem[row.id]?.length ?? 0;
                  return (
                    <tr key={row.id} className={`border-t align-top ${rowClass(row.status)}`}>
                      <td className="px-3 py-3"><input type="checkbox" name="item_id" value={row.id} aria-label={`Select ${row.msmes?.business_name ?? "compliance item"}`} className="h-4 w-4 rounded border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" /></td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{row.msmes?.business_name ?? "MSME"}</p>
                        <p className="text-xs text-slate-500">{row.msmes?.msme_id ?? row.msme_id}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.msmes?.state ?? "State"} · {row.msmes?.sector ?? "Sector"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{requirement?.title ?? requirement?.code ?? "Compliance item"}</p>
                        <p className="text-xs text-slate-500">{requirement?.category ?? "requirement"}</p>
                      </td>
                      <td className="px-3 py-3">{regulator?.code ?? "REG"}</td>
                      <td className="px-3 py-3">
                        <p className="text-slate-700">{formatDate(row.expires_at)}</p>
                        {row.status === "expiring_soon" ? <p className="mt-1 text-xs font-medium text-amber-700">Renewal window open</p> : null}
                        {row.status === "expired" ? <p className="mt-1 text-xs font-medium text-rose-700">Overdue renewal</p> : null}
                      </td>
                      <td className="px-3 py-3">{evidenceCount} active</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {progressBadges(row.status, row.expires_at).map(([key, label]) => (
                            <span key={key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(key)}`}>{label}</span>
                          ))}
                          {progressBadges(row.status, row.expires_at).length === 0 ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(row.status)}`}>{formatStatus(row.status)}</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button formAction={reviewSingleAction.bind(null, row.id, "assign")} size="sm" variant="secondary" disabled={!canAssign(row.status)} title={canAssign(row.status) ? "Start review" : "Only submitted items can start review"}><span className="sr-only">Start review </span><UserCheck className="h-4 w-4" /></Button>
                          <Button formAction={reviewSingleAction.bind(null, row.id, "approve")} size="sm" variant="secondary" disabled={!canDecide(row.status, evidenceCount)} title={canDecide(row.status, evidenceCount) ? "Approve" : "Approval requires under review status and active evidence"}><span className="sr-only">Approve </span><CheckCircle2 className="h-4 w-4" /></Button>
                          <Button formAction={reviewSingleAction.bind(null, row.id, "request_changes")} size="sm" variant="secondary" disabled={row.status !== "under_review"} title={row.status === "under_review" ? "Request changes" : "Request changes after review starts"}>Changes</Button>
                          <Button formAction={reviewSingleAction.bind(null, row.id, "reject")} size="sm" variant="secondary" disabled={row.status !== "under_review"} title={row.status === "under_review" ? "Reject" : "Reject after review starts"}><span className="sr-only">Reject </span><XCircle className="h-4 w-4" /></Button>
                          <Button formAction={reviewSingleAction.bind(null, row.id, "reopen")} size="sm" variant="secondary" disabled={!canReopen(row.status)} title={canReopen(row.status) ? "Reopen review" : "Only completed decisions can be reopened"}><span className="sr-only">Reopen </span><RotateCcw className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <article className="rounded-xl border bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Eye className="h-5 w-5 text-emerald-700" /> Evidence preview</h2>
            {!activeItem ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No evidence is loaded for the current queue. Adjust filters or start with a submitted row.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium text-slate-900">{activeRequirement?.title ?? "Compliance evidence"}</p>
                {activeDocuments.length === 0 ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="mr-1 inline h-4 w-4" />No active evidence documents. Approval is blocked.</p>
                ) : activeDocuments.map((document) => (
                  <div key={document.id} className="rounded-lg border p-3 text-sm">
                    <p className="break-words font-medium text-slate-900">{document.original_filename}</p>
                    <p className="mt-1 text-xs text-slate-500">{document.document_type.replaceAll("_", " ")} · {formatBytes(document.file_size_bytes)} · {formatDateTime(document.uploaded_at)}</p>
                    <div className="mt-2 flex gap-2">
                      <a href={`/api/msme/compliance/evidence/${document.id}?disposition=inline`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><Eye className="h-3.5 w-3.5" />Preview</a>
                      <a href={`/api/msme/compliance/evidence/${document.id}?disposition=attachment`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-3.5 w-3.5" />Download</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-xl border bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><History className="h-5 w-5 text-slate-500" /> Reviewer history</h2>
            {!activeItem ? null : (
              <div className="mt-3 space-y-3">
                {Object.entries((eventsByItem[activeItem.id] ?? []).reduce<Record<string, EventRow[]>>((acc, event) => {
                  const label = dateGroupLabel(event.created_at);
                  acc[label] = [...(acc[label] ?? []), event];
                  return acc;
                }, {})).map(([label, groupedEvents]) => (
                  <div key={label} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    {groupedEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium text-slate-900">{eventText(event)}</p>
                        <p className="mt-1 text-xs text-slate-500">{`${event.from_status ?? "none"} to ${event.to_status ?? "none"} - ${formatDateTime(event.created_at)}`}</p>
                      </div>
                    ))}
                  </div>
                ))}
                {(reviewsByItem[activeItem.id] ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium capitalize text-slate-900"><Clock3 className="mr-1 inline h-4 w-4 text-slate-500" />{formatStatus(entry.review_status)}</p>
                    <p className="mt-1 text-xs text-slate-500">{`${formatStatus(entry.previous_status)} to ${formatStatus(entry.new_status)} - ${formatDateTime(entry.created_at)}`}</p>
                    {entry.decision_reason ? <p className="mt-2 text-xs text-slate-600">{entry.decision_reason}</p> : null}
                  </div>
                ))}
                {(commentsByItem[activeItem.id] ?? []).map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="font-medium text-slate-900">{comment.visibility === "msme_visible" ? "MSME-visible comment" : "Internal comment"}</p>
                    <p className="mt-1 text-xs text-slate-600">{comment.comment_body}</p>
                    <p className="mt-2 text-xs text-slate-500">{comment.author_role} · {formatDateTime(comment.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
              <p>Approvals require an under-review session, reviewer identity, and at least one active evidence document.</p>
            </div>
          </article>
        </aside>
      </form>
    </section>
  );
}
