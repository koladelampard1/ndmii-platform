import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileClock,
  Flag,
  IdCard,
  Link2,
  LockKeyhole,
  MessageSquareWarning,
  NotebookPen,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/data/authorization-scope";
import { getAdminMsmeDetail, type AdminMsmeDetail, type AdminMsmeTimelineItem, type RegistrySourceState } from "@/lib/data/admin-msme-registry";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { AdminMsmeOperationalControls } from "@/components/admin/admin-msme-operational-controls";

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
  return text
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").toLowerCase();
  if (["verified", "approved", "active", "low", "clear"].includes(normalized)) return "emerald";
  if (["pending", "pending_review", "submitted", "under_review", "changes_requested", "medium", "draft", "invited"].includes(normalized)) return "amber";
  if (["rejected", "failed", "revoked", "suspended", "critical", "high", "expired", "flagged"].includes(normalized)) return "rose";
  if (["not_started", "unavailable", "not linked"].includes(normalized)) return "slate";
  return "blue";
}

function StatusPill({ value, fallback = "Unavailable" }: { value: string | null | undefined; fallback?: string }) {
  const label = humanize(value, fallback);
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses[statusTone(value ?? fallback)]}`}>{label}</span>;
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

function display(value: string | number | null | undefined, fallback = "Unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function SourceBanner({ sources }: { sources: Record<string, RegistrySourceState> }) {
  const unavailable = Object.entries(sources).filter(([, source]) => !source.available && source.message !== "Not used in Phase 1 list view");
  if (!unavailable.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Some linked sources are unavailable: {unavailable.map(([name]) => name).join(", ")}. Available panels remain visible.
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

function DataGrid({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
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

function TimelineList({ items, emptyText }: { items: AdminMsmeTimelineItem[]; emptyText: string }) {
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
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{humanize(item.source)}</p>
        </li>
      ))}
    </ol>
  );
}

function Header({ detail }: { detail: AdminMsmeDetail }) {
  const row = detail.row;
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <Link href="/dashboard/admin/msmes" className="inline-flex items-center gap-2 text-sm font-black text-emerald-800 hover:text-emerald-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to registry
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">MSME detail workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{row.businessName}</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">{row.msmeId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill value={row.verificationStatus} />
          <StatusPill value={row.reviewStatus} />
          <StatusPill value={row.digitalIdStatus} />
          <StatusPill value={row.complianceStatus} />
          {row.flagged ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}><Flag className="h-3 w-3" />Flagged</span> : null}
          {row.suspended ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses.rose}`}><LockKeyhole className="h-3 w-3" />Suspended</span> : null}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">Created {formatDate(row.createdAt)}</p>
    </header>
  );
}

export default async function AdminMsmeDetailPage({ params }: PageProps) {
  const ctx = await requireRole(["admin", "reviewer", "fccpc_officer", "firs_officer"]);
  const { id } = await params;

  let detail: AdminMsmeDetail | null = null;
  try {
    const supabase = await createServiceRoleSupabaseClient();
    detail = await getAdminMsmeDetail(supabase, id);
  } catch (error) {
    console.info("[admin-msme-registry]", {
      operation: "get_admin_msme_detail",
      msmeId: id,
      sourceAvailability: {},
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Unable to load MSME detail",
    });
  }

  if (!detail) notFound();
  const row = detail.row;

  return (
    <section className="mx-auto max-w-[1500px] space-y-5">
      <Header detail={detail} />
      <SourceBanner sources={detail.sources} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <SectionCard title="Profile summary" icon={Building2}>
            <DataGrid rows={[
              { label: "Owner", value: row.ownerName },
              { label: "Email", value: display(row.contactEmailMasked) },
              { label: "Phone", value: display(row.contactPhoneMasked) },
              { label: "State / LGA", value: [row.state, row.lga].filter(Boolean).join(" / ") || "Unavailable" },
              { label: "Sector", value: display(row.sector) },
              { label: "Business type", value: display(row.businessType) },
              { label: "Address", value: display(row.address) },
              { label: "CAC", value: display(row.cacMasked) },
              { label: "TIN", value: display(row.tinMasked) },
              { label: "Association", value: row.associationName ?? "Not linked" },
            ]} />
          </SectionCard>

          <SectionCard
            title="Digital identity"
            icon={IdCard}
            action={<Link href="/dashboard/admin/digital-ids" className="text-xs font-black text-emerald-800 hover:text-emerald-950">Open Digital IDs</Link>}
          >
            <DataGrid rows={[
              { label: "Credential", value: display(detail.credential.ndmiiId ?? row.digitalId, "No credential") },
              { label: "Credential status", value: <StatusPill value={detail.credential.status} /> },
              { label: "Approved", value: formatDate(detail.credential.approvedAt) },
              { label: "Revoked", value: formatDate(detail.credential.revokedAt) },
              { label: "Suspended", value: formatDate(detail.credential.suspendedAt) },
              { label: "Issued", value: formatDate(detail.credential.issuedAt) },
              { label: "Expiry", value: formatDate(detail.credential.expiresAt) },
              { label: "Token exists", value: detail.credential.tokenExists === null ? "Unavailable" : detail.credential.tokenExists ? "Yes" : "No" },
              { label: "Latest event", value: detail.credential.latestEvent?.summary ?? "No credential event recorded" },
            ]} />
          </SectionCard>

          <SectionCard
            title="Compliance"
            icon={ShieldCheck}
            action={<Link href={`/dashboard/reviews/compliance?msmeId=${encodeURIComponent(row.id)}`} className="text-xs font-black text-emerald-800 hover:text-emerald-950">Open Compliance Reviews</Link>}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <CountTile label="Approved" value={detail.compliance.approvedCount} />
              <CountTile label="Pending / Submitted / Review" value={[detail.compliance.pendingCount, detail.compliance.submittedCount, detail.compliance.underReviewCount].some((value) => value === null) ? null : (detail.compliance.pendingCount ?? 0) + (detail.compliance.submittedCount ?? 0) + (detail.compliance.underReviewCount ?? 0)} />
              <CountTile label="Rejected / Changes" value={[detail.compliance.rejectedCount, detail.compliance.changesRequestedCount].some((value) => value === null) ? null : (detail.compliance.rejectedCount ?? 0) + (detail.compliance.changesRequestedCount ?? 0)} />
              <CountTile label="Expired / Soon" value={[detail.compliance.expiredCount, detail.compliance.expiringSoonCount].some((value) => value === null) ? null : (detail.compliance.expiredCount ?? 0) + (detail.compliance.expiringSoonCount ?? 0)} />
            </div>
            <div className="mt-3">
              <DataGrid rows={[
                { label: "Profile status", value: <StatusPill value={detail.compliance.profileStatus} /> },
                { label: "Score / risk", value: `${detail.compliance.score ?? "Unavailable"}${detail.compliance.score !== null ? "%" : ""} / ${humanize(detail.compliance.riskLevel)}` },
                { label: "Evidence count", value: detail.compliance.evidenceCount ?? "Unavailable" },
                { label: "Latest events", value: detail.compliance.latestEvents.length ? `${detail.compliance.latestEvents.length} recent event(s)` : "No recent compliance events" },
              ]} />
            </div>
          </SectionCard>

          <SectionCard title="Operational timeline" icon={FileClock}>
            <TimelineList items={detail.timeline} emptyText="No linked timeline events are available for this MSME." />
          </SectionCard>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <SectionCard title="Complaints" icon={MessageSquareWarning} action={<Link href="/dashboard/fccpc" className="text-xs font-black text-emerald-800 hover:text-emerald-950">Open FCCPC</Link>}>
            <div className="grid grid-cols-3 gap-3">
              <CountTile label="Total" value={detail.complaints.count} />
              <CountTile label="Open" value={detail.complaints.openCount} />
              <CountTile label="Severity" value={humanize(detail.complaints.highestSeverity)} />
            </div>
            <div className="mt-3 space-y-2">
              {detail.complaints.latestReferences.length ? detail.complaints.latestReferences.map((complaint) => (
                <Link key={complaint.id} href={`/dashboard/fccpc/${complaint.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm hover:bg-emerald-50">
                  <span className="font-black text-slate-950">{complaint.reference}</span>
                  <span className="mt-1 block text-xs font-bold text-slate-500">{humanize(complaint.status)} · {formatDate(complaint.createdAt)}</span>
                </Link>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">No linked complaints.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Association" icon={Users}>
            <DataGrid rows={[
              { label: "Linked association", value: detail.association.name ?? "Not linked" },
              { label: "Membership status", value: humanize(detail.association.membershipStatus) },
              { label: "Source", value: detail.association.source ?? "Unavailable" },
              { label: "Member records", value: detail.association.memberRecordCount ?? "Unavailable" },
            ]} />
          </SectionCard>

          <SectionCard title="Onboarding / verification" icon={ClipboardCheck}>
            <DataGrid rows={[
              { label: "Verification status", value: <StatusPill value={row.verificationStatus} /> },
              { label: "Review status", value: <StatusPill value={row.reviewStatus} /> },
              { label: "Profile completeness", value: `${row.profileCompletenessScore}%` },
              { label: "Legacy compliance", value: [humanize(detail.verification.legacyComplianceStatus), detail.verification.legacyComplianceScore !== null ? `${detail.verification.legacyComplianceScore}%` : null, humanize(detail.verification.legacyComplianceRiskLevel)].filter(Boolean).join(" / ") },
              ...detail.verification.validationSummaries.map((item) => ({ label: item.label, value: humanize(item.value) })),
            ]} />
          </SectionCard>

          <SectionCard title="Operational indicators" icon={AlertCircle}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <StatusPill value={row.flagged ? "flagged" : "clear"} />
                <StatusPill value={row.suspended ? "suspended" : "active"} />
                <StatusPill value={row.reviewRequested ? "review_requested" : "review_not_requested"} />
                <StatusPill value={row.escalated ? "escalated" : "not_escalated"} />
              </div>
              <DataGrid rows={[
                { label: "Latest admin action", value: humanize(row.latestAdminAction, "No admin action") },
                { label: "Action date", value: formatDateTime(row.latestAdminActionAt) },
                { label: "Credential status", value: <StatusPill value={detail.credential.status} /> },
                { label: "Compliance risk", value: <StatusPill value={detail.compliance.riskLevel} /> },
              ]} />
            </div>
          </SectionCard>

          <SectionCard title="Admin actions" icon={ShieldCheck}>
            <AdminMsmeOperationalControls msmeId={row.id} role={ctx.role} flagged={row.flagged} suspended={row.suspended} />
          </SectionCard>

          <SectionCard title="Internal notes" icon={NotebookPen}>
            <div className="space-y-2">
              {detail.internalNotes.length ? detail.internalNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{note.noteBody}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{humanize(note.authorRole)} · {formatDateTime(note.createdAt)}</p>
                </div>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">No internal notes recorded.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Possible duplicate MSMEs" icon={AlertCircle}>
            <div className="space-y-2">
              {detail.duplicateSignals.length ? detail.duplicateSignals.map((signal) => (
                <Link key={signal.id} href={`/dashboard/admin/msmes/${encodeURIComponent(signal.id)}`} className="block rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-emerald-50">
                  <span className="block text-sm font-black text-slate-950">{signal.businessName}</span>
                  <span className="mt-1 block text-xs font-bold text-slate-500">{signal.msmeId} · {humanize(signal.confidence)} confidence</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">{signal.reasons.join(", ")}</span>
                </Link>
              )) : <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">No duplicate signals detected.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Quick links" icon={Link2}>
            <div className="grid gap-2 text-sm font-black">
              <Link className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50" href="/dashboard/admin/msmes"><ArrowLeft className="mr-2 inline h-4 w-4" />Registry</Link>
              <Link className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50" href="/dashboard/admin/digital-ids"><BadgeCheck className="mr-2 inline h-4 w-4" />Digital IDs</Link>
              <Link className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50" href={`/dashboard/reviews/compliance?msmeId=${encodeURIComponent(row.id)}`}><ShieldCheck className="mr-2 inline h-4 w-4" />Compliance Reviews</Link>
              <Link className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50" href="/dashboard/fccpc"><MessageSquareWarning className="mr-2 inline h-4 w-4" />FCCPC Complaints</Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
