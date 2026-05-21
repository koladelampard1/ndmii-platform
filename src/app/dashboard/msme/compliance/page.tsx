import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, Clock3, FileText, History, Lock, ShieldCheck, UploadCloud } from "lucide-react";
import { ComplianceNotifications, type ComplianceNotification } from "@/components/compliance/compliance-notifications";
import { ComplianceToastBridge } from "@/components/compliance/compliance-toast-bridge";
import { SubmitButton } from "@/components/compliance/submit-button";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { ensureBaselineComplianceItemsForMsme } from "@/lib/data/msme-compliance-baseline";
import { submitComplianceItemForReview } from "@/lib/data/compliance-reviews";
import { ComplianceEvidencePanel, type ComplianceEvidenceListItem } from "./compliance-evidence-panel";

type ComplianceProfile = {
  overall_status: string | null;
  compliance_score: number | null;
  risk_level: string | null;
  total_required_count: number | null;
  approved_count: number | null;
  pending_count: number | null;
  under_review_count: number | null;
  changes_requested_count: number | null;
  rejected_count: number | null;
  expired_count: number | null;
  expiring_soon_count: number | null;
  suspended_count: number | null;
  revoked_count: number | null;
  last_reviewed_at: string | null;
  next_deadline_at: string | null;
  last_recalculated_at: string | null;
  metadata?: Record<string, unknown> | null;
};

type RequirementDefinition = {
  code?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  frequency?: string | null;
  is_mandatory?: boolean | null;
  compliance_regulators?: { code?: string | null; name?: string | null } | null;
};

type ComplianceItem = {
  id: string;
  status: string | null;
  reference_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  is_required: boolean | null;
  source: string | null;
  metadata?: Record<string, unknown> | null;
  compliance_requirement_definitions?: RequirementDefinition | RequirementDefinition[] | null;
};

type ComplianceEvent = {
  id: string;
  event_type: string | null;
  summary: string | null;
  to_status: string | null;
  created_at: string | null;
  actor_type: string | null;
  metadata?: Record<string, unknown> | null;
};

type ReviewComment = {
  id: string;
  compliance_item_id: string;
  comment_body: string | null;
  author_role: string | null;
  created_at: string | null;
};

type ComplianceReminder = {
  id: string;
  compliance_item_id: string;
  reminder_type: string | null;
  scheduled_for: string | null;
  status: string | null;
  sent_at: string | null;
};

const statusLabel: Record<string, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  suspended: "Suspended",
  revoked: "Revoked",
  waived: "Waived",
  archived: "Archived",
};

const statusClasses: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  waived: "bg-emerald-50 text-emerald-700",
  submitted: "bg-blue-100 text-blue-700",
  resubmitted: "bg-blue-100 text-blue-700",
  under_review: "bg-blue-100 text-blue-700",
  changes_requested: "bg-amber-100 text-amber-700",
  not_started: "bg-slate-100 text-slate-700",
  draft: "bg-slate-100 text-slate-700",
  rejected: "bg-rose-100 text-rose-700",
  expired: "bg-rose-100 text-rose-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  revoked: "bg-rose-100 text-rose-700",
  archived: "bg-slate-200 text-slate-700",
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatStatus(value: string | null | undefined) {
  return statusLabel[value ?? ""] ?? (value ? value.replaceAll("_", " ") : "Not started");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function isMigrated(metadata: Record<string, unknown> | null | undefined, source?: string | null) {
  return source === "legacy_migration" || metadata?.demo_or_migration_derived === true || metadata?.source === "legacy_migration_recalculation";
}

function reviewStatusLabel(status: string) {
  if (status === "approved") return "Reviewed and approved";
  if (status === "expiring_soon") return "Approved, renewal window open";
  if (status === "expired") return "Expired, renewal required";
  if (status === "rejected") return "Reviewed with issues";
  if (status === "under_review") return "Under review";
  if (status === "submitted" || status === "resubmitted") return "Awaiting reviewer action";
  return "Not yet reviewed";
}

function nextActionForStatus(status: string, evidenceCount: number) {
  if (status === "approved") return "Keep evidence current until renewal.";
  if (status === "expiring_soon") return "Upload renewed evidence before expiry.";
  if (status === "expired") return "Upload renewed evidence and submit for review.";
  if (status === "changes_requested") return evidenceCount > 0 ? "Review comments, upload corrections, then resubmit." : "Upload corrected evidence, then resubmit.";
  if (status === "rejected") return "Replace rejected evidence and resubmit.";
  if (["submitted", "resubmitted", "under_review"].includes(status)) return "Wait for reviewer decision.";
  return evidenceCount > 0 ? "Submit this requirement for review." : "Upload required evidence.";
}

function requirementTiming(requirement: RequirementDefinition | null) {
  const frequency = requirement?.frequency?.replaceAll("_", " ") || "annual";
  const category = requirement?.category?.toLowerCase() ?? "";
  const processingTime = category.includes("tax") || requirement?.code?.includes("TIN") ? "1-3 business days" : category.includes("permit") ? "3-7 business days" : "2-5 business days";
  return {
    processingTime,
    expiryPeriod: frequency === "one time" ? "No routine expiry" : frequency,
  };
}

function eventText(event: ComplianceEvent) {
  if (event.summary) return event.summary;
  if (event.event_type === "uploaded") return "Compliance evidence uploaded";
  if (event.event_type === "changes_requested") return "Reviewer requested changes";
  if (event.event_type?.includes("reminder")) return "Compliance reminder scheduled";
  return formatStatus(event.to_status);
}

function dateGroupLabel(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "long", year: "numeric" });
}

function itemSortValue(item: ComplianceItem) {
  const requirement = relationOne(item.compliance_requirement_definitions);
  if (item.is_required) return `0-${requirement?.code ?? item.id}`;
  return `1-${requirement?.code ?? item.id}`;
}

async function prepareComplianceChecklist() {
  "use server";

  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" || !ctx.linkedMsmeId) {
    redirect("/access-denied");
  }

  const serviceSupabase = await createServiceRoleSupabaseClient();
  const result = await ensureBaselineComplianceItemsForMsme({
    serviceSupabase,
    msmeId: ctx.linkedMsmeId,
    appUserId: ctx.appUserId,
    email: ctx.email,
  });

  console.info("[msme-compliance-baseline]", {
    operation: "manual_retry",
    msmeId: ctx.linkedMsmeId,
    requirementDefinitionCount: result.requirementDefinitionCount,
    existingItemCount: result.existingItemCount,
    insertedItemCount: result.insertedItemCount,
    skippedItemCount: result.skippedItemCount,
    profileExists: Boolean(ctx.linkedMsmeId),
    code: result.ok ? null : "manual_retry_failed",
    message: result.ok ? null : "Manual compliance checklist preparation did not complete.",
  });

  revalidatePath("/dashboard/msme/compliance");
  redirect("/dashboard/msme/compliance");
}

async function submitComplianceReviewAction(formData: FormData) {
  "use server";

  const complianceItemId = String(formData.get("compliance_item_id") ?? "").trim();
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" || !ctx.linkedMsmeId) {
    redirect("/access-denied");
  }

  try {
    await submitComplianceItemForReview(ctx, complianceItemId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compliance item could not be submitted.";
    redirect(`/dashboard/msme/compliance?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/msme/compliance");
  revalidatePath("/dashboard/reviews/compliance");
  redirect("/dashboard/msme/compliance?saved=submitted");
}

export default async function MsmeCompliancePage() {
  const ctx = await getCurrentUserContext();

  if (ctx.role !== "msme") {
    redirect("/dashboard/compliance");
  }

  if (!ctx.linkedMsmeId) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Compliance</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Complete MSME onboarding before compliance requirements can be generated for your business.
        </div>
      </section>
    );
  }

  const serviceSupabase = await createServiceRoleSupabaseClient();
  let baselineGenerationFailed = false;

  let [{ data: profile }, { data: itemRows }, { data: eventRows }, { data: documentRows }, { data: commentRows }, { data: reminderRows }] = await Promise.all([
    serviceSupabase
      .from("msme_compliance_profiles")
      .select(
        "overall_status,compliance_score,risk_level,total_required_count,approved_count,pending_count,under_review_count,changes_requested_count,rejected_count,expired_count,expiring_soon_count,suspended_count,revoked_count,last_reviewed_at,next_deadline_at,last_recalculated_at,metadata",
      )
      .eq("msme_id", ctx.linkedMsmeId)
      .maybeSingle(),
    serviceSupabase
      .from("msme_compliance_items")
      .select(
        "id,status,reference_number,issued_at,expires_at,approved_at,rejected_at,is_required,source,metadata,compliance_requirement_definitions(code,title,description,category,frequency,is_mandatory,compliance_regulators(code,name))",
      )
      .eq("msme_id", ctx.linkedMsmeId),
    serviceSupabase
      .from("compliance_events")
      .select("id,event_type,summary,to_status,created_at,actor_type,metadata")
      .eq("msme_id", ctx.linkedMsmeId)
      .order("created_at", { ascending: false })
      .limit(6),
    serviceSupabase
      .from("compliance_documents")
      .select("id,compliance_item_id,document_type,original_filename,mime_type,file_size_bytes,uploaded_at,verified_at,expires_at")
      .eq("msme_id", ctx.linkedMsmeId)
      .eq("is_deleted", false)
      .order("uploaded_at", { ascending: false }),
    serviceSupabase
      .from("compliance_review_comments")
      .select("id,compliance_item_id,comment_body,author_role,created_at")
      .eq("msme_id", ctx.linkedMsmeId)
      .eq("visibility", "msme_visible")
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("compliance_reminders")
      .select("id,compliance_item_id,reminder_type,scheduled_for,status,sent_at")
      .eq("msme_id", ctx.linkedMsmeId)
      .order("scheduled_for", { ascending: true })
      .limit(12),
  ]);

  if ((itemRows ?? []).length === 0) {
    try {
      const result = await ensureBaselineComplianceItemsForMsme({
        serviceSupabase,
        msmeId: ctx.linkedMsmeId,
        appUserId: ctx.appUserId,
        email: ctx.email,
      });
      baselineGenerationFailed = !result.ok;

      const [repairedProfile, repairedItems, repairedEvents, repairedDocuments, repairedComments, repairedReminders] = await Promise.all([
        serviceSupabase
          .from("msme_compliance_profiles")
          .select(
            "overall_status,compliance_score,risk_level,total_required_count,approved_count,pending_count,under_review_count,changes_requested_count,rejected_count,expired_count,expiring_soon_count,suspended_count,revoked_count,last_reviewed_at,next_deadline_at,last_recalculated_at,metadata",
          )
          .eq("msme_id", ctx.linkedMsmeId)
          .maybeSingle(),
        serviceSupabase
          .from("msme_compliance_items")
          .select(
            "id,status,reference_number,issued_at,expires_at,approved_at,rejected_at,is_required,source,metadata,compliance_requirement_definitions(code,title,description,category,frequency,is_mandatory,compliance_regulators(code,name))",
          )
          .eq("msme_id", ctx.linkedMsmeId),
        serviceSupabase
          .from("compliance_events")
          .select("id,event_type,summary,to_status,created_at,actor_type,metadata")
          .eq("msme_id", ctx.linkedMsmeId)
          .order("created_at", { ascending: false })
          .limit(6),
        serviceSupabase
          .from("compliance_documents")
          .select("id,compliance_item_id,document_type,original_filename,mime_type,file_size_bytes,uploaded_at,verified_at,expires_at")
          .eq("msme_id", ctx.linkedMsmeId)
          .eq("is_deleted", false)
          .order("uploaded_at", { ascending: false }),
        serviceSupabase
          .from("compliance_review_comments")
          .select("id,compliance_item_id,comment_body,author_role,created_at")
          .eq("msme_id", ctx.linkedMsmeId)
          .eq("visibility", "msme_visible")
          .order("created_at", { ascending: false }),
        serviceSupabase
          .from("compliance_reminders")
          .select("id,compliance_item_id,reminder_type,scheduled_for,status,sent_at")
          .eq("msme_id", ctx.linkedMsmeId)
          .order("scheduled_for", { ascending: true })
          .limit(12),
      ]);

      profile = repairedProfile.data;
      itemRows = repairedItems.data;
      eventRows = repairedEvents.data;
      documentRows = repairedDocuments.data;
      commentRows = repairedComments.data;
      reminderRows = repairedReminders.data;
      baselineGenerationFailed = baselineGenerationFailed || (repairedItems.data ?? []).length === 0;
    } catch (error) {
      const typedError = error as { code?: string; message?: string };
      console.info("[msme-compliance-baseline]", {
        operation: "page_repair_failed",
        msmeId: ctx.linkedMsmeId,
        requirementDefinitionCount: 0,
        existingItemCount: 0,
        insertedItemCount: 0,
        skippedItemCount: 0,
        profileExists: Boolean(ctx.linkedMsmeId),
        code: typedError.code ?? "unknown",
        message: typedError.message ?? "Unable to repair compliance baseline.",
      });
      baselineGenerationFailed = true;
    }
  }

  const complianceProfile = profile as ComplianceProfile | null;
  const items = ((itemRows ?? []) as ComplianceItem[]).sort((a, b) => itemSortValue(a).localeCompare(itemSortValue(b)));
  const events = (eventRows ?? []) as ComplianceEvent[];
  const documents = (documentRows ?? []) as ComplianceEvidenceListItem[];
  const comments = (commentRows ?? []) as ReviewComment[];
  const reminders = (reminderRows ?? []) as ComplianceReminder[];
  const documentsByItem = documents.reduce<Record<string, ComplianceEvidenceListItem[]>>((acc, document) => {
    acc[document.compliance_item_id] = [...(acc[document.compliance_item_id] ?? []), document];
    return acc;
  }, {});
  const commentsByItem = comments.reduce<Record<string, ReviewComment[]>>((acc, comment) => {
    acc[comment.compliance_item_id] = [...(acc[comment.compliance_item_id] ?? []), comment];
    return acc;
  }, {});
  const migratedProfile = isMigrated(complianceProfile?.metadata ?? null);
  const totalRequired = complianceProfile?.total_required_count ?? items.filter((item) => item.is_required).length;
  const approvedRequired = complianceProfile?.approved_count ?? items.filter((item) => item.is_required && item.status === "approved").length;
  const score = complianceProfile?.compliance_score ?? (totalRequired ? Math.round((approvedRequired / totalRequired) * 100) : 0);
  const overallStatus = complianceProfile?.overall_status ?? (items.length ? "not_started" : "not_started");
  const expiringSoonCount = complianceProfile?.expiring_soon_count ?? items.filter((item) => item.status === "expiring_soon").length;
  const expiredCount = complianceProfile?.expired_count ?? items.filter((item) => item.status === "expired").length;
  const pendingReminderCount = reminders.filter((reminder) => reminder.status === "pending").length;
  const sentReminderCount = reminders.filter((reminder) => reminder.status === "sent").length;
  const upcomingComplianceDates = items
    .filter((item) => item.expires_at && ["approved", "expiring_soon", "expired"].includes(item.status ?? ""))
    .sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at)))
    .slice(0, 5);
  const eventsByDate = events.reduce<Record<string, ComplianceEvent[]>>((acc, event) => {
    const label = dateGroupLabel(event.created_at);
    acc[label] = [...(acc[label] ?? []), event];
    return acc;
  }, {});
  const notifications: ComplianceNotification[] = [
    ...items
      .filter((item) => item.status === "changes_requested")
      .map((item) => {
        const requirement = relationOne(item.compliance_requirement_definitions);
        return {
          id: `changes-${item.id}`,
          title: "Changes requested",
          detail: `${requirement?.title ?? "Compliance item"} needs updated evidence.`,
          href: "/dashboard/msme/compliance",
          severity: "warning" as const,
          createdAt: item.rejected_at ?? item.approved_at,
        };
      }),
    ...items
      .filter((item) => item.status === "rejected")
      .map((item) => {
        const requirement = relationOne(item.compliance_requirement_definitions);
        return {
          id: `rejected-${item.id}`,
          title: "Evidence rejected",
          detail: `${requirement?.title ?? "Compliance item"} was rejected. Replace the evidence and resubmit.`,
          href: "/dashboard/msme/compliance",
          severity: "danger" as const,
          createdAt: item.rejected_at,
        };
      }),
    ...items
      .filter((item) => ["expiring_soon", "expired"].includes(item.status ?? ""))
      .map((item) => {
        const requirement = relationOne(item.compliance_requirement_definitions);
        return {
          id: `deadline-${item.id}`,
          title: item.status === "expired" ? "Document expired" : "Document expiring soon",
          detail: `${requirement?.title ?? "Compliance item"} deadline: ${formatDate(item.expires_at)}.`,
          href: "/dashboard/msme/compliance",
          severity: item.status === "expired" ? ("danger" as const) : ("warning" as const),
          createdAt: item.expires_at,
        };
      }),
  ];

  const summaryCards = [
    { label: "Compliance score", value: `${score}%`, detail: "Calculated from active compliance requirements" },
    { label: "Approved required", value: `${approvedRequired} / ${totalRequired}`, detail: "Required requirements approved" },
    { label: "Expiring soon", value: String(expiringSoonCount), detail: "Approved items inside their renewal window" },
    { label: "Expired", value: String(expiredCount), detail: "Items requiring renewal before they count as compliant" },
    { label: "Next deadline", value: complianceProfile?.next_deadline_at ? formatDate(complianceProfile.next_deadline_at) : "Not set", detail: "Next known document or permit expiry" },
    { label: "Reminders", value: `${pendingReminderCount} queued / ${sentReminderCount} sent`, detail: "In-app compliance reminder records" },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Compliance</h1>
          <p className="mt-1 text-sm text-slate-600">Compliance requirements, private evidence uploads, and audit trail.</p>
        </div>
        <div className="flex items-center gap-2">
          <ComplianceNotifications notifications={notifications} scope={`msme-${ctx.linkedMsmeId}`} />
          <Link href="/dashboard/msme/id-card" className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            View Business Identity Credential
          </Link>
        </div>
      </header>
      <ComplianceToastBridge />

      <section className={`rounded-2xl border p-5 ${overallStatus === "approved" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`mt-0.5 h-6 w-6 ${overallStatus === "approved" ? "text-emerald-700" : "text-amber-700"}`} />
          <div>
            <p className="text-base font-semibold text-slate-900">Overall status: {formatStatus(overallStatus)}</p>
            <p className="mt-1 text-sm text-slate-700">
              {expiredCount > 0
                ? "Some approved evidence has expired. Upload renewed evidence and submit it for review to restore compliance."
                : expiringSoonCount > 0
                  ? "Some approved evidence is inside its renewal window. Start renewal before the deadline to avoid an expired status."
                  : items.length
                    ? "Upload CAC, tax, permit, and certification evidence against each requirement. Baseline items are not approvals and still need review."
                : "Your compliance checklist is being prepared. Once your required compliance items are available, you will be able to upload CAC, tax, permit, and certification evidence here."}
            </p>
            {migratedProfile ? (
              <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-700">
                Existing records still need review before they count as approved.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-2xl border bg-white p-4">
            <p className="text-3xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{card.label}</p>
            <p className="mt-4 text-xs text-slate-500">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Regulatory Requirements</h2>
              <p className="mt-1 text-sm text-slate-600">Upload private evidence for each requirement so reviewers can assess your compliance status.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed bg-slate-50 px-4 py-8 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Your compliance checklist is being prepared.</p>
              <p className="mt-1 text-sm text-slate-500">Once your required compliance items are available, you will be able to upload CAC, tax, permit, and certification evidence here.</p>
              {baselineGenerationFailed ? (
                <form action={prepareComplianceChecklist} className="mt-4">
                  <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800">
                    Prepare Compliance Checklist
                  </button>
                </form>
              ) : null}
            </div>
          ) : (
            <ul className="mt-4 divide-y">
              {items.map((item) => {
                const requirement = relationOne(item.compliance_requirement_definitions);
                const regulator = requirement?.compliance_regulators;
                const status = item.status ?? "not_started";
                const itemDocuments = documentsByItem[item.id] ?? [];
                const itemComments = commentsByItem[item.id] ?? [];
                const canSubmit = ["not_started", "draft"].includes(status) && itemDocuments.length > 0;
                const canResubmit = ["changes_requested", "rejected"].includes(status) && itemDocuments.length > 0;

                return (
                  <li key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {status === "approved" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : status === "rejected" || status === "expired" ? <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" /> : <Clock3 className="mt-0.5 h-5 w-5 text-amber-500" />}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{requirement?.title ?? requirement?.code ?? "Compliance requirement"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {regulator?.name ?? regulator?.code ?? "Regulator"} • {item.is_required ? "Required" : "Optional"} • {reviewStatusLabel(status)}
                          </p>
                          {requirement?.description ? <p className="mt-1 text-sm text-slate-600">{requirement.description}</p> : null}
                          <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
                            {(() => {
                              const timing = requirementTiming(requirement);
                              return [
                                ["Document needed", requirement?.title ?? requirement?.code ?? "Compliance evidence"],
                                ["Why it matters", requirement?.description ?? "Supports regulator verification and public trust signals."],
                                ["Regulator", regulator?.name ?? regulator?.code ?? "Assigned regulator"],
                                ["Processing time", timing.processingTime],
                                ["Expiry period", timing.expiryPeriod],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p className="font-semibold text-slate-500">{label}</p>
                                  <p className="mt-1 text-slate-800">{value}</p>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Evidence required</span>
                            <span className="rounded bg-slate-100 px-2 py-1">{itemDocuments.length} document{itemDocuments.length === 1 ? "" : "s"}</span>
                            <span className="rounded bg-slate-100 px-2 py-1">Private evidence</span>
                            {item.reference_number ? <span className="rounded bg-slate-100 px-2 py-1">Ref: {item.reference_number}</span> : null}
                            {item.approved_at ? <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Approved {formatDate(item.approved_at)}</span> : null}
                            {item.rejected_at ? <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">Rejected {formatDate(item.rejected_at)}</span> : null}
                            {item.expires_at ? <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Expires {formatDate(item.expires_at)}</span> : null}
                            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Next action: {nextActionForStatus(status, itemDocuments.length)}</span>
                            <span className="rounded bg-slate-100 px-2 py-1">Last reviewed: {formatDateTime(item.approved_at ?? item.rejected_at)}</span>
                          </div>
                          <ComplianceEvidencePanel complianceItemId={item.id} documents={itemDocuments} />
                          {itemComments.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewer comments</p>
                              {itemComments.map((comment) => (
                                <div key={comment.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
                                  <p>{comment.comment_body}</p>
                                  <p className="mt-2 text-xs text-slate-500">{comment.author_role ?? "reviewer"} • {formatDateTime(comment.created_at)}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {canSubmit || canResubmit ? (
                            <form action={submitComplianceReviewAction} className="mt-3">
                              <input type="hidden" name="compliance_item_id" value={item.id} />
                              <SubmitButton type="submit" pendingLabel="Submitting..." className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300">
                                {canResubmit ? "Resubmit for review" : "Submit for review"}
                              </SubmitButton>
                            </form>
                          ) : status === "under_review" || status === "submitted" || status === "resubmitted" ? (
                            <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">This requirement is with a reviewer.</p>
                          ) : null}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[status] ?? "bg-slate-100 text-slate-700"}`}>{formatStatus(status)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><CalendarDays className="h-5 w-5 text-emerald-700" /> Upcoming compliance dates</h2>
            {upcomingComplianceDates.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No expiry dates are currently attached to approved compliance items.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {upcomingComplianceDates.map((item) => {
                  const requirement = relationOne(item.compliance_requirement_definitions);
                  const status = item.status ?? "not_started";
                  return (
                    <li key={item.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{requirement?.title ?? requirement?.code ?? "Compliance item"}</p>
                          <p className="mt-1 text-xs text-slate-500">Due {formatDate(item.expires_at)}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[status] ?? "bg-slate-100 text-slate-700"}`}>{formatStatus(status)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Bell className="h-5 w-5 text-amber-600" /> Reminder queue</h2>
            {reminders.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No reminder records have been scheduled yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reminders.slice(0, 6).map((reminder) => (
                  <li key={reminder.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium capitalize text-slate-900">{reminder.reminder_type?.replaceAll("_", " ") ?? "Reminder"}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{formatStatus(reminder.status)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Scheduled {formatDate(reminder.scheduled_for)}{reminder.sent_at ? ` • Sent ${formatDateTime(reminder.sent_at)}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><History className="h-5 w-5 text-slate-500" /> Recent compliance events</h2>
            {events.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No compliance activity has been recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {Object.entries(eventsByDate).map(([label, groupedEvents]) => (
                  <li key={label} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    {groupedEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium text-slate-900">{eventText(event)}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.event_type?.replaceAll("_", " ")} • {event.actor_type ?? "system"} • {formatDateTime(event.created_at)}</p>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Private evidence scope</h3>
                <p className="mt-1 text-sm text-slate-600">Uploaded files stay in a private bucket. Signed preview and download links are short-lived and created only after authorization checks.</p>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700">
        <Lock className="h-4 w-4 text-emerald-700" />
        <p>Compliance records are private by default and scoped to your MSME ownership model.</p>
      </section>
    </section>
  );
}
