import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, BadgeCheck, Building2, ClipboardCheck, Copy, FileClock, FileText, Gauge, IdCard, ListChecks, MessageSquareWarning, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { ReviewerDecisionPanel } from "@/components/admin/verification/reviewer-decision-panel";
import { requireRole } from "@/lib/data/authorization-scope";
import { getAdminVerificationWorkspace, type AdminVerificationWorkspace, type VerificationSourceState, type VerificationTimelineItem } from "@/lib/data/admin-verification-workspace";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Tone = "emerald" | "amber" | "rose" | "blue" | "slate" | "violet";

const toneClasses: Record<Tone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function humanize(value: string | null | undefined, fallback = "Unavailable") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/[_-]/g, " ").split(" ").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function statusTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").toLowerCase();
  if (["verified", "approved", "active", "passed", "provided", "clear", "normal", "strong", "low"].includes(normalized)) return "emerald";
  if (["pending", "pending_review", "under_review", "awaiting_documents", "submitted", "incomplete", "watch", "missing", "pending_items", "moderate", "medium"].includes(normalized)) return "amber";
  if (["failed", "rejected", "suspended", "revoked", "critical", "elevated", "expired", "attention_required", "critical review needed", "weak", "high", "urgent"].includes(normalized)) return "rose";
  if (["unavailable", "not_started", "missing"].includes(normalized)) return "slate";
  return "blue";
}

function StatusPill({ value, fallback = "Unavailable" }: { value: string | null | undefined; fallback?: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[statusTone(value ?? fallback)]}`}>{humanize(value, fallback)}</span>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatBytes(value: number | null | undefined) {
  if (!value) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function display(value: string | number | null | undefined, fallback = "Unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function SourceBanner({ sources }: { sources: Record<string, VerificationSourceState> }) {
  const unavailable = Object.entries(sources).filter(([, source]) => !source.available);
  if (!unavailable.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Some verification sources are unavailable: {unavailable.map(([name]) => name).join(", ")}. Available sections remain visible.
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action }: { title: string; icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-600">
          <Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function DataGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CountTile({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value ?? "Unavailable"}</p>
    </div>
  );
}

function TimelineList({ items, emptyText }: { items: VerificationTimelineItem[]; emptyText: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={`${item.source}-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-950">{humanize(item.eventType)}</p>
            <p className="text-xs font-bold text-slate-500">{formatDateTime(item.date)}</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-700">{item.summary}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{humanize(item.actorRole ?? item.source)}</p>
        </li>
      ))}
    </ol>
  );
}

function TextList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{item}</li>
      ))}
    </ul>
  );
}

function IntelligencePanel({ workspace }: { workspace: AdminVerificationWorkspace }) {
  const intelligence = workspace.intelligence;
  return (
    <SectionCard title="Verification Intelligence" icon={ShieldAlert}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Confidence</p>
          <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-black ${toneClasses[statusTone(intelligence.confidenceCategory)]}`}>{intelligence.confidenceCategory}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Attention</p>
          <StatusPill value={intelligence.attentionLevel} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Priority</p>
          <StatusPill value={intelligence.queuePriority} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Why this needs review</h3>
          <TextList items={intelligence.confidenceReasons} emptyText="No critical signals detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Recommended reviewer focus</h3>
          <TextList items={intelligence.recommendedFocusAreas} emptyText="Standard reviewer checks." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Signals detected</h3>
          <TextList items={intelligence.signals.map((signal) => signal.label)} emptyText="No critical signals detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Queue aging</h3>
          <TextList items={[intelligence.queueAging.label + (intelligence.queueAging.overdue ? " - overdue" : "")]} emptyText="No queue date available." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Duplicate signals</h3>
          <TextList items={intelligence.duplicateSignals} emptyText="No duplicate signals detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Complaint linkage</h3>
          <TextList items={intelligence.complaintLinked ? [`${workspace.complaints.openCount ?? "Unavailable"} open complaint(s) linked`] : []} emptyText="No open complaint linkage detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Credential weakness</h3>
          <TextList items={intelligence.credentialWeakness} emptyText="No credential weakness detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Compliance weakness</h3>
          <TextList items={intelligence.complianceWeakness} emptyText="No compliance weakness detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Profile completeness gaps</h3>
          <TextList items={intelligence.profileCompletenessGaps} emptyText="No profile completeness gaps detected." />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Repeated review history</h3>
          <TextList items={intelligence.repeatedReviewHistory} emptyText="No repeated rejection history detected." />
        </div>
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500">Rule-based decision support only. This panel does not approve, reject, enforce, call external registries, perform OCR, or expose raw NIN/BVN values.</p>
    </SectionCard>
  );
}

function Header({ workspace }: { workspace: AdminVerificationWorkspace }) {
  const { msme, review } = workspace;
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <Link href="/dashboard/admin/verifications" className="inline-flex items-center gap-2 text-sm font-black text-emerald-800 hover:text-emerald-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to verification queue
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Verification operations workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{msme.businessName}</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">{msme.msmeId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill value={review.status} />
          <StatusPill value={msme.attentionLevel} />
          <StatusPill value={msme.verificationStatus} />
          {msme.flagged ? <StatusPill value="flagged" /> : null}
          {msme.suspended ? <StatusPill value="suspended" /> : null}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">Created {formatDate(msme.createdAt)}</p>
    </header>
  );
}

export default async function AdminVerificationWorkspacePage({ params }: PageProps) {
  const ctx = await requireRole(["admin", "reviewer", "fccpc_officer", "firs_officer"]);
  const { id } = await params;
  const supabase = await createServiceRoleSupabaseClient();
  const workspace = await getAdminVerificationWorkspace(supabase, id);
  if (!workspace) notFound();

  return (
    <section className="mx-auto max-w-[1500px] space-y-5">
      <Header workspace={workspace} />
      <SourceBanner sources={workspace.sources} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <IntelligencePanel workspace={workspace} />

          <SectionCard title="MSME summary" icon={Building2}>
            <DataGrid rows={[
              { label: "Business name", value: workspace.msme.businessName },
              { label: "BIN / MSME ID", value: workspace.msme.msmeId },
              { label: "State / LGA", value: [workspace.msme.state, workspace.msme.lga].filter(Boolean).join(" / ") || "Unavailable" },
              { label: "Sector", value: display(workspace.msme.sector) },
              { label: "Workflow status", value: <StatusPill value={workspace.review.status} /> },
              { label: "Created date", value: formatDate(workspace.msme.createdAt) },
              { label: "Operational indicators", value: <div className="flex flex-wrap gap-2"><StatusPill value={workspace.msme.flagged ? "flagged" : "clear"} /><StatusPill value={workspace.msme.suspended ? "suspended" : "active"} /></div> },
              { label: "Attention level", value: <StatusPill value={workspace.msme.attentionLevel} /> },
              { label: "CAC / TIN", value: `${workspace.msme.cacMasked ?? "Unavailable"} / ${workspace.msme.tinMasked ?? "Unavailable"}` },
              { label: "Phone / email", value: `${workspace.msme.phoneMasked ?? "Unavailable"} / ${workspace.msme.emailMasked ?? "Unavailable"}` },
            ]} />
          </SectionCard>

          <SectionCard title="KYC summary" icon={ClipboardCheck}>
            <DataGrid rows={[
              { label: "NIN check", value: <StatusPill value={workspace.kyc.ninStatus} /> },
              { label: "BVN check", value: <StatusPill value={workspace.kyc.bvnStatus} /> },
              { label: "CAC check", value: <StatusPill value={workspace.kyc.cacStatus} /> },
              { label: "TIN check", value: <StatusPill value={workspace.kyc.tinStatus} /> },
              { label: "Address validation", value: <StatusPill value={workspace.kyc.addressStatus} /> },
              { label: "Phone / email validation", value: <StatusPill value={workspace.kyc.contactStatus} /> },
            ]} />
            <p className="mt-3 text-xs font-bold text-slate-500">Raw NIN and BVN values are not displayed in this workspace.</p>
          </SectionCard>

          <SectionCard title="Digital ID summary" icon={IdCard}>
            <DataGrid rows={[
              { label: "Credential", value: display(workspace.credential.ndmiiId, "No credential shown") },
              { label: "Credential status", value: <StatusPill value={workspace.credential.status} /> },
              { label: "Issued date", value: formatDate(workspace.credential.issuedAt) },
              { label: "Last credential event", value: workspace.credential.lastEvent?.summary ?? "No credential event recorded" },
            ]} />
          </SectionCard>

          <SectionCard title="Compliance summary" icon={ShieldCheck} action={<Link href={`/dashboard/reviews/compliance?msmeId=${encodeURIComponent(workspace.msme.id)}`} className="text-xs font-black text-emerald-800 hover:text-emerald-950">Open Compliance Reviews</Link>}>
            <div className="grid gap-3 md:grid-cols-4">
              <CountTile label="Failed items" value={workspace.compliance.failedCount} />
              <CountTile label="Pending items" value={workspace.compliance.pendingCount} />
              <CountTile label="Score" value={workspace.compliance.score === null ? null : `${workspace.compliance.score}%`} />
              <CountTile label="Risk" value={humanize(workspace.compliance.riskLevel)} />
            </div>
            <div className="mt-3">
              <DataGrid rows={[
                { label: "Compliance posture", value: <StatusPill value={workspace.compliance.posture} /> },
                { label: "Compliance review status", value: <StatusPill value={workspace.compliance.reviewStatus} /> },
                { label: "Missing required items", value: workspace.compliance.missingRequiredItems.length ? workspace.compliance.missingRequiredItems.join(", ") : "None detected in available sources" },
                { label: "Latest events", value: workspace.compliance.latestEvents.length ? `${workspace.compliance.latestEvents.length} recent event(s)` : "No recent compliance events" },
              ]} />
            </div>
          </SectionCard>

          <SectionCard title="Complaints summary" icon={MessageSquareWarning}>
            <div className="grid gap-3 md:grid-cols-3">
              <CountTile label="Open complaints" value={workspace.complaints.openCount} />
              <CountTile label="Severity" value={humanize(workspace.complaints.highestSeverity)} />
              <CountTile label="Unresolved disputes" value={workspace.complaints.unresolvedDisputes} />
            </div>
            <div className="mt-3">
              <TimelineList items={workspace.complaints.timeline} emptyText="No complaint timeline is available for this MSME." />
            </div>
          </SectionCard>

          <SectionCard title="Duplicate signals" icon={Copy}>
            <div className="space-y-2">
              {workspace.duplicateSignals.length ? workspace.duplicateSignals.map((signal) => (
                <div key={signal.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">{signal.businessName}</p>
                    <StatusPill value={signal.confidence} />
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{signal.msmeId}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{signal.signals.join(", ")}</p>
                </div>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No duplicate signals detected in available sources.</p>}
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">Signal-only view. Merge actions are intentionally unavailable.</p>
          </SectionCard>

          <SectionCard title="Submitted documents" icon={FileText}>
            <div className="space-y-2">
              {workspace.documents.length ? workspace.documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{document.fileName}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{humanize(document.documentType)} · {formatBytes(document.fileSizeBytes)} · Uploaded {formatDateTime(document.uploadedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={document.previewHref} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50">Preview</a>
                      <a href={document.downloadHref} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-white">Download</a>
                    </div>
                  </div>
                </div>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No submitted verification documents found in available sources.</p>}
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">No OCR, AI extraction, or face matching is performed.</p>
          </SectionCard>

          <SectionCard title="Verification timeline" icon={FileClock}>
            <TimelineList items={workspace.review.events} emptyText="No verification review events recorded yet." />
          </SectionCard>

          <SectionCard title="Internal review comments" icon={ListChecks}>
            <div className="space-y-2">
              {workspace.review.comments.length ? workspace.review.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{comment.comment}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{humanize(comment.actorRole)} · {formatDateTime(comment.createdAt)} · {humanize(comment.visibility)}</p>
                </div>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No internal review comments recorded.</p>}
            </div>
          </SectionCard>
        </div>

        <ReviewerDecisionPanel
          msmeId={workspace.msme.id}
          role={ctx.role}
          status={workspace.review.status}
          assignedReviewerId={workspace.review.assignedReviewerId}
          assignedReviewerName={workspace.review.assignedReviewerName}
          assignedAt={workspace.review.assignedAt}
          internalNotes={workspace.review.internalNotes}
          requestedDocuments={workspace.review.requestedDocuments}
          reviewers={workspace.reviewers}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-black text-slate-700 hover:bg-slate-50" href={`/dashboard/admin/msmes/${encodeURIComponent(workspace.msme.id)}`}><Gauge className="mr-2 inline h-4 w-4" />MSME Registry Workspace</Link>
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-black text-slate-700 hover:bg-slate-50" href="/dashboard/admin/digital-ids"><BadgeCheck className="mr-2 inline h-4 w-4" />Digital IDs</Link>
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-black text-slate-700 hover:bg-slate-50" href="/dashboard/admin/verifications"><ArrowLeft className="mr-2 inline h-4 w-4" />Verification Queue</Link>
      </div>
    </section>
  );
}
